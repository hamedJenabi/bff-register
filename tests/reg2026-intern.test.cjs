const { test } = require("node:test");
const assert = require("node:assert/strict");
const { signIdentity, verifyIdentitySignature } = require("../lib/reg2026/security");
const { checkoutForOrder } = require("../lib/reg2026/payments");
const { schedule } = require("../lib/reg2026/catalog");
const { fiveClasses } = require("./reg2026-fixtures.cjs");
const { setAdminSession } = require("../lib/admin/session");
const { RegistrationError } = require("../lib/reg2026/errors");

const response = () => ({
  code: 200, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(value) { this.code = value; return this; },
  json(value) { this.body = value; return this; },
  end() { return this; },
});

const withStore = async (store, endpoint, action) => {
  const dbPath = require.resolve("../db/reg2026"), endpointPath = require.resolve(endpoint);
  const previousDb = require.cache[dbPath], previousEndpoint = require.cache[endpointPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { registrationStore: store } };
  delete require.cache[endpointPath];
  try { await action(require(endpoint).default); } finally {
    if (previousDb) require.cache[dbPath] = previousDb; else delete require.cache[dbPath];
    if (previousEndpoint) require.cache[endpointPath] = previousEndpoint; else delete require.cache[endpointPath];
  }
};

const withEnv = async (updates, action) => {
  const previous = Object.fromEntries(Object.keys(updates).map((key) => [key, process.env[key]]));
  Object.assign(process.env, updates);
  try { return await action(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("only intern=true enables the submission override and signed access is still required", async () => withEnv({
  REG2026_ENABLED: "true", REG2026_SIGNING_SECRET: "intern-test-secret", REG2026_CLOSES_AT: "2099-01-01T00:00:00Z",
}, async () => {
  const participant = { id: 1, email: "a+b@example.com", firstname: "Dancer", ticket: "fullpass" };
  const identity = `${participant.email}+${participant.firstname}`;
  const access = { user: identity, sig: signIdentity(identity) };
  const submissions = [];
  const store = {
    findParticipants: async () => [participant],
    activeOrder: async () => null,
    completedOrder: async () => null,
    schedule: async () => schedule,
    submit: async (...args) => { submissions.push(args); return { id: 1, status: "confirmed" }; },
    claimConfirmation: async () => ({ status: "sent" }),
  };
  await withStore(store, "../pages/api/reg2026/submit", async (submit) => {
    const body = { ...access, draft: { classes: fiveClasses(), competitions: [], competitionRoles: {}, lunch: [] }, requestKey: "intern-request-key-01" };
    for (const intern of [undefined, "false", "", "1", "TRUE", true, ["true"], "true"]) {
      const res = response();
      await submit({ method: "POST", body: { ...body, intern } }, res);
      assert.equal(res.code, 200);
      assert.deepEqual(submissions.at(-1)[4], { intern: intern === "true" });
    }
    const count = submissions.length;
    const denied = response();
    await submit({ method: "POST", body: { ...body, intern: "true", sig: "invalid" } }, denied);
    assert.equal(denied.code, 403);
    assert.equal(submissions.length, count);
  });
}));

test("only organizers can change the internal registration switch using same-origin writes", async () => withEnv({
  ADMIN_USER: "intern-organizer", ADMIN_SESSION_SECRET: "intern-organizer-secret",
}, async () => {
  let enabled = false, writes = 0;
  const store = { setInternalRegistrationEnabled: async (value) => {
    if (typeof value !== "boolean") throw new RegistrationError(422, "Choose on or off.");
    enabled = value; writes += 1; return enabled;
  } };
  await withStore(store, "../pages/api/reg2026/schedule", async (handler) => {
    const body = { action: "internal-registration", enabled: true };
    const denied = response();
    await handler({ method: "POST", headers: {}, body }, denied);
    assert.equal(denied.code, 401);
    const login = response();
    setAdminSession(login);
    const cookie = login.headers["Set-Cookie"].split(";")[0];
    const crossOrigin = response();
    await handler({ method: "POST", headers: { cookie, host: "register.example.com", origin: "https://different.example.com" }, body }, crossOrigin);
    assert.equal(crossOrigin.code, 403);
    assert.equal(writes, 0);
    const headers = { cookie, host: "register.example.com", origin: "https://register.example.com" };
    for (const value of [true, false]) {
      const saved = response();
      await handler({ method: "POST", headers, body: { ...body, enabled: value } }, saved);
      assert.equal(saved.code, 200);
      assert.equal(saved.body.internEnabled, value);
      assert.equal(enabled, value);
    }
    const invalid = response();
    await handler({ method: "POST", headers, body: { ...body, enabled: "true" } }, invalid);
    assert.equal(invalid.code, 422);
    assert.equal(writes, 2);
  });
}));

test("registration refresh only enables sold-out classes when the flag and URL parameter are both on", async () => withEnv({
  REG2026_ENABLED: "true", REG2026_SIGNING_SECRET: "intern-test-secret", REG2026_CLOSES_AT: "2099-01-01T00:00:00Z",
}, async () => {
  const participant = { id: 1, email: "dancer@example.com", firstname: "Dancer", ticket: "fullpass" };
  const user = `${participant.email}+${participant.firstname}`;
  let enabled = false;
  const store = {
    findParticipants: async () => [participant], activeOrder: async () => null, completedOrder: async () => null,
    schedule: async () => schedule, availability: async () => ({}), internalRegistrationEnabled: async () => enabled,
  };
  await withStore(store, "../pages/api/reg2026/index", async (handler) => {
    for (enabled of [false, true, false]) {
      for (const intern of [undefined, "false", "true"]) {
        const res = response();
        await handler({ method: "GET", query: { user, sig: signIdentity(user), intern } }, res);
        assert.equal(res.code, 200);
        assert.equal(res.body.internEnabled, enabled && intern === "true");
      }
    }
  });
}));

test("checkout preserves internal registration in both return URLs without changing signed identity", async () => withEnv({
  REG2026_SIGNING_SECRET: "intern-test-secret", REG2026_ORIGIN: "https://register.example.com",
}, async () => {
  const participant = { id: 1, email: "a+b@example.com", firstname: "Dancer" };
  const order = { id: 10, status: "provisional", total_cents: 1040, draft: {}, expires_at: new Date(Date.now() + 3600000) };
  for (const intern of [false, true]) {
    const payment = { checkout: { sessions: { create: async (args) => {
      for (const returnUrl of [args.success_url, args.cancel_url]) {
        const url = new URL(returnUrl);
        assert.equal(url.searchParams.get("intern"), intern ? "true" : null);
        assert.equal(url.searchParams.get("order"), "10");
        assert.equal(url.searchParams.get("user"), "a+b@example.com+Dancer");
        assert.ok(verifyIdentitySignature(url.searchParams.get("user"), url.searchParams.get("sig")));
      }
      assert.equal(new URL(args.cancel_url).searchParams.get("checkout"), "cancelled");
      return { id: "cs_intern", url: "https://checkout.example.com/intern" };
    } } } };
    assert.equal(await checkoutForOrder({ attachSession: async () => true }, participant, order, payment, { intern }), "https://checkout.example.com/intern");
  }
}));
