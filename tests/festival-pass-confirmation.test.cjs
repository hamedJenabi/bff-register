const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setAdminSession } = require("../lib/admin/session");
const { resolveParticipant } = require("../lib/reg2026/access");

const templateId = "d-9a1d3b06c6fb43f69a1ee68b940ebe35";
const response = (events = []) => ({
  headers: {}, code: 200,
  setHeader(key, value) { this.headers[key] = value; return this; },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; events.push("response"); return this; },
});

test("festival pass confirmations include usable personal links for each pass", async (t) => {
  const keys = ["REG2026_ORIGIN", "REG2026_SIGNING_SECRET", "ADMIN_USER", "ADMIN_SESSION_SECRET"];
  const previousEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    REG2026_ORIGIN: "https://register.example.com",
    REG2026_SIGNING_SECRET: "test-pass-confirmation-secret",
    ADMIN_USER: "organizer", ADMIN_SESSION_SECRET: "test-organizer-secret",
  });
  const paths = ["../db/db", "stripe", "@sendgrid/mail", "../pages/api/register", "../pages/api/edituser"].map(require.resolve);
  const previousModules = paths.map((path) => require.cache[path]);
  const [dbPath, stripePath, mailPath, registerPath, editPath] = paths;
  const saved = [], sent = [], events = [];
  let paymentStatus = "paid", duplicate;
  require.cache[dbPath] = { loaded: true, exports: {
    getTicketByName: async () => ({ label: "Festival classes" }),
    updateTicketCapacity: async () => {},
    getUserByEmailAndName: async () => duplicate,
    insertRegistration: async (participant) => {
      const record = { ...participant, id: saved.length + 1 };
      saved.push(record);
      return [{ id: record.id }];
    },
    updateUserInfo: async (participant) => { saved.push(participant); },
  } };
  require.cache[stripePath] = { loaded: true, exports: class {
    checkout = { sessions: { retrieve: async () => ({ payment_status: paymentStatus }) } };
  } };
  require.cache[mailPath] = { loaded: true, exports: {
    setApiKey() {},
    async send(message) {
      await new Promise(setImmediate);
      sent.push(message);
      events.push("email accepted");
    },
  } };
  delete require.cache[registerPath];
  delete require.cache[editPath];
  const person = (ticket) => ({
    firstname: "Zoë + Guest", lastname: "Dancer", email: ` NEW+${ticket}@EXAMPLE.COM `,
    country: "Austria", ticket, role: "", level: "", parent_partner: "",
    theme_class: "", competition: "no", competitions: [],
    open_mixnmatch_role: "", newcomers_mixnmatch_role: "", strictly_role: "",
    tshirt: "M", donation_amount: "5", lunch: "", terms: true,
    regi2026link: "https://untrusted.example/", isPartyPass: ticket !== "partyPass",
  });
  const assertLink = async (message, participant) => {
    assert.equal(message.template_id, templateId);
    assert.equal(message.to, participant.email);
    assert.equal(message.dynamic_template_data.firstname, participant.firstname);
    assert.equal(message.dynamic_template_data.isPartyPass, participant.ticket === "partyPass");
    assert.deepEqual(message.tracking_settings.click_tracking, { enable: false, enable_text: false });
    const url = new URL(message.dynamic_template_data.regi2026link);
    assert.equal(url.origin, process.env.REG2026_ORIGIN);
    assert.equal(url.pathname, "/reg2026");
    const resolved = await resolveParticipant(Object.fromEntries(url.searchParams), {
      findParticipants: async (identity) => saved.filter((record) =>
        record.status === "confirmed" && `${record.email}+${record.firstname}` === identity),
    });
    assert.equal(resolved.id, participant.id);
  };
  try {
    const register = require(registerPath).default;
    const edituser = require(editPath).default;
    for (const ticket of ["fullpass", "parentPass", "partyPass"]) {
      await t.test(`new paid ${ticket} keeps booking details and sends the signed link before responding`, async () => {
        events.length = 0;
        const res = response(events);
        await register({ body: person(ticket), query: { session_id: "cs_test" } }, res);
        assert.equal(res.code, 200);
        assert.deepEqual(events, ["email accepted", "response"]);
        const message = sent.at(-1);
        assert.equal(message.dynamic_template_data.tshirt, "M");
        assert.equal(message.dynamic_template_data.donation, "5");
        assert.equal(message.dynamic_template_data.level, "Festival classes");
        await assertLink(message, saved.at(-1));
      });
    }
    await t.test("duplicate and unpaid requests do not send a confirmation or personal link", async () => {
      const count = sent.length;
      duplicate = saved[0];
      const duplicateResponse = response();
      await register({ body: person("fullpass"), query: { session_id: "cs_test" } }, duplicateResponse);
      assert.equal(duplicateResponse.code, 302);
      assert.equal(sent.length, count);
      duplicate = undefined;
      paymentStatus = "unpaid";
      const unpaidResponse = response();
      await register({ body: { ...person("partyPass"), email: "unpaid@example.com" }, query: { session_id: "cs_unpaid" } }, unpaidResponse);
      assert.equal(unpaidResponse.code, 200);
      assert.equal(saved.at(-1).status, "registered");
      assert.equal(sent.length, count);
    });
    await t.test("dashboard confirmations use the same link and preserve email suppression for edits and group updates", async () => {
      const session = response(); setAdminSession(session);
      const headers = { cookie: session.headers["Set-Cookie"].split(";")[0] };
      for (const ticket of ["fullpass", "parentPass", "partyPass"]) {
        const body = { ...person(ticket), id: saved.length + 1, status: "confirmed", prevStatus: "registered",
          email: `dashboard-${ticket}@example.com`, donation: "5", competitions: "", price: "200" };
        const res = response();
        await edituser({ method: "POST", headers, body }, res);
        assert.equal(res.code, 200);
        await assertLink(sent.at(-1), saved.at(-1));
      }
      const count = sent.length;
      // Suppressed updates should not require schedule-link configuration.
      delete process.env.REG2026_SIGNING_SECRET;
      await edituser({ method: "POST", headers, query: { action: "edit" }, body: saved.at(-1) }, response());
      await edituser({ method: "POST", headers, body: { ...saved.at(-1), isGroupApi: true } }, response());
      assert.equal(sent.length, count);
    });
  } finally {
    paths.forEach((path, index) => {
      if (previousModules[index]) require.cache[path] = previousModules[index];
      else delete require.cache[path];
    });
    for (const key of keys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  }
});
