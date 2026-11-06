const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationInvitationStore, createRegistrationInvitationHandler } = require("../lib/reg2026/invitations");
const { setAdminSession } = require("../lib/admin/session");
const { verifyIdentitySignature } = require("../lib/reg2026/security");
const { serializeThemeClass } = require("../lib/reg2026/serialization");

const response = () => ({
  headers: {}, code: 200,
  setHeader(key, value) { this.headers[key] = value; return this; },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
});

test("schedule invitations use confirmed, incomplete participants and distinct signed links", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const adminSql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  await adminSql`CREATE SCHEMA registration_invitation_tests`;
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {}, connection: { search_path: "registration_invitation_tests" } });
  const keys = ["ADMIN_USER", "ADMIN_SESSION_SECRET", "REG2026_ENABLED", "REG2026_CLOSES_AT", "REG2026_ORIGIN", "REG2026_SIGNING_SECRET", "REG2026_INVITATION_TEMPLATE_ID"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    ADMIN_USER: "test-admin", ADMIN_SESSION_SECRET: "test-admin-session-secret",
    REG2026_ENABLED: "true", REG2026_CLOSES_AT: "2099-01-01T00:00:00Z",
    REG2026_ORIGIN: "https://register.example.com", REG2026_SIGNING_SECRET: "test-registration-signing-secret",
    REG2026_INVITATION_TEMPLATE_ID: "d-11111111111111111111111111111111",
  });
  try {
    for (const name of ["00004-CREAT-registraion-2026", "00007-create-reg2026-bookings", "00008-reg2026-order-safety", "00010-reg2026-reopen-registration", "00014-reg2026-schedule-invitations"]) {
      await sql.begin((tx) => require(`../migrations/${name}`).up(tx));
    }
    const people = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
      VALUES ('2026','confirmed','advanced','fullpass','Ada','One','ada@example.com','Austria'),
             ('2026','confirmed','advanced','partyPass','Ben','Two','ben@example.com','Austria'),
             ('2026','waitinglist','advanced','fullpass','Wait','List','wait@example.com','Austria'),
             ('2026','confirmed','advanced','fullpass','Done','Classes','done@example.com','Austria'),
             ('2026','confirmed','advanced','partyPass','Done','Empty','empty@example.com','Austria'),
             ('2026','confirmed','advanced','fullpass','Same','A','same@example.com','Austria'),
             ('2026','confirmed','advanced','fullpass','Same','B','same@example.com','Austria') RETURNING *`;
    await sql`UPDATE registrations_26 SET theme_class = ${serializeThemeClass([{ sessionId: "fri-1330-ankersaal" }])} WHERE id = ${people[3].id}`;
    await sql`INSERT INTO reg2026_orders (registration_id,status,draft,subtotal_cents,fee_cents,total_cents)
      VALUES (${people[4].id},'confirmed','{}'::jsonb,0,0,0)`;
    const store = createRegistrationInvitationStore(sql);
    const sent = [];
    let rejectBen = true;
    const handler = createRegistrationInvitationHandler({ store, send: async (message) => {
      if (rejectBen && message.to === "ben@example.com") throw new Error("Fictional SendGrid failure");
      sent.push(message);
    } });
    const session = response(); setAdminSession(session);
    const headers = { host: "register.example.com", origin: "https://register.example.com", cookie: session.headers["Set-Cookie"].split(";")[0] };
    const call = async (id, otherHeaders = headers) => {
      const res = response();
      await handler({ method: "POST", headers: otherHeaders, body: { id } }, res);
      return res;
    };

    await t.test("authorization and missing template prevent every send", async () => {
      assert.equal((await call(people[0].id, {})).code, 401);
      assert.equal((await call(people[0].id, { ...headers, origin: "https://other.example.com" })).code, 403);
      process.env.REG2026_INVITATION_TEMPLATE_ID = "d-00000000000000000000000000000000";
      assert.equal((await call(people[0].id)).code, 503);
      process.env.REG2026_INVITATION_TEMPLATE_ID = "d-11111111111111111111111111111111";
      process.env.REG2026_ENABLED = "false";
      assert.equal((await call(people[0].id)).code, 403);
      process.env.REG2026_ENABLED = "true";
      await sql`ALTER TABLE registration_schedule_invitations_26 RENAME TO invitation_table_hidden`;
      try {
        const missingMigration = await call(people[0].id);
        assert.equal(missingMigration.code, 503);
        assert.match(missingMigration.body.error, /migration 00014/);
      } finally {
        await sql`ALTER TABLE invitation_table_hidden RENAME TO registration_schedule_invitations_26`;
      }
      assert.equal(sent.length, 0);
      assert.equal((await sql`SELECT COUNT(*)::INTEGER AS count FROM registration_schedule_invitations_26`)[0].count, 0);
    });

    await t.test("links are personalized, successful recipients are skipped on retry", async () => {
      const first = await call(people[0].id);
      assert.equal(first.code, 200);
      assert.equal(first.body.status, "sent");
      assert.equal(sent.length, 1);
      assert.equal(sent[0].template_id, process.env.REG2026_INVITATION_TEMPLATE_ID);
      assert.equal(sent[0].to, "ada@example.com");
      assert.equal(sent[0].dynamic_template_data.firstname, "Ada");
      assert.equal(sent[0].dynamic_template_data.isPartyPass, false);
      assert.equal(sent[0].tracking_settings.click_tracking.enable, false);
      const url = new URL(sent[0].dynamic_template_data.regi2026link);
      assert.equal(url.pathname, "/reg2026");
      assert.equal(verifyIdentitySignature(url.searchParams.get("user"), url.searchParams.get("sig")), true);
      assert.equal((await call(people[0].id)).body.status, "already_sent");
      assert.equal(sent.length, 1);
    });

    await t.test("completed, unconfirmed, and ambiguous registrations are excluded", async () => {
      assert.equal((await call(people[2].id)).code, 409);
      assert.equal((await call(people[3].id)).body.status, "completed");
      assert.equal((await call(people[4].id)).body.status, "completed");
      assert.equal((await call(people[5].id)).code, 409);
      assert.equal((await call(people[6].id)).code, 409);
      assert.equal(sent.length, 1);
    });

    await t.test("failed provider acceptance can retry without repeating successful sends", async () => {
      assert.equal((await call(people[1].id)).code, 502);
      assert.equal((await sql`SELECT status, attempts FROM registration_schedule_invitations_26 WHERE registration_id = ${people[1].id}`)[0].status, "failed");
      rejectBen = false;
      assert.equal((await call(people[1].id)).body.status, "sent");
      assert.equal((await call(people[1].id)).body.status, "already_sent");
      assert.equal(sent.length, 2);
      assert.equal(sent[1].dynamic_template_data.isPartyPass, true);
      assert.notEqual(sent[0].dynamic_template_data.regi2026link, sent[1].dynamic_template_data.regi2026link);
      assert.equal((await sql`SELECT attempts FROM registration_schedule_invitations_26 WHERE registration_id = ${people[1].id}`)[0].attempts, 2);
    });

    await t.test("interrupted sends are held for review instead of duplicated", async () => {
      const [person] = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        VALUES ('2026','confirmed','advanced','fullpass','Cara','Three','cara@example.com','Austria') RETURNING *`;
      await sql`INSERT INTO registration_schedule_invitations_26 (registration_id,status,attempts,updated_at)
        VALUES (${person.id},'sending',1,NOW() - INTERVAL '11 minutes')`;
      assert.equal((await call(person.id)).body.status, "uncertain");
      assert.equal((await call(person.id)).body.status, "uncertain");
      assert.equal((await sql`SELECT status FROM registration_schedule_invitations_26 WHERE registration_id = ${person.id}`)[0].status, "uncertain");
      assert.equal(sent.length, 2);
    });
  } finally {
    for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
    await sql.end();
    await adminSql.end();
  }
});
