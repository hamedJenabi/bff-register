const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const postgres = require("postgres");
const { createContentStore } = require("../lib/app/content-store");
const { createContentHandlers } = require("../lib/app/content-http");
const { createVolunteerStore } = require("../lib/app/volunteer-store");
const { hashAdminPassword } = require("../lib/app/admin-security");
const { tokenHash } = require("../lib/app/security");
const { RegistrationError } = require("../lib/reg2026/errors");

const response = () => ({
  code: 200, headers: {},
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  end() { return this; },
});
const linkToken = (link) => new URLSearchParams(new URL(link.url).hash.slice(1)).get("token");

test("shared volunteer access and organizer-only permissions on isolated Postgres", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const db = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  await db`CREATE SCHEMA volunteer_tests`;
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {}, connection: { search_path: "volunteer_tests" } });
  const keys = ["APP_SIGNING_SECRET", "APP_ORIGIN", "APP_ADMIN_PASSWORD_HASH"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const name of ["00004-CREAT-registraion-2026", "00012-festival-app-admin", "00020-festival-volunteer-access"]) {
      await sql.begin((tx) => require(`../migrations/${name}`).up(tx));
    }
    const password = "fictional-volunteer-test-admin-password";
    Object.assign(process.env, {
      APP_SIGNING_SECRET: "fictional-volunteer-signing-secret-for-isolated-tests",
      APP_ORIGIN: "https://app.example.com",
      APP_ADMIN_PASSWORD_HASH: await hashAdminPassword(password),
    });
    const content = createContentStore(sql);
    const volunteer = createVolunteerStore(sql);
    const participantToken = crypto.randomBytes(32).toString("base64url");
    const attendee = { resolveSession: async (token) => {
      if (token !== participantToken) throw new RegistrationError(401, "Participant access required");
      return { registration_id: 1 };
    } };
    const door = {
      sessions: async () => ({ sessions: [{ id: "fri-class" }] }),
      verify: async (body) => ({ status: body?.qr === "fictional-qr" ? "eligible" : "invalid" }),
      roster: async () => ({ entries: [{ firstname: "Private attendee" }] }),
    };
    const api = createContentHandlers(content, attendee, door, volunteer);
    const call = async (group, action, token, body) => {
      const res = response();
      await api[group][action]({ method: ["me", "door-sessions"].includes(action) ? "GET" : "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body }, res);
      return res;
    };
    let admin, link, first, second;
    await t.test("only password-authenticated admins generate one stable shared 30-day link", async () => {
      for (const action of ["volunteer-link", "volunteer-replace", "volunteer-revoke"]) {
        assert.equal((await call("manage", action, null, {})).code, 401);
        assert.equal((await call("manage", action, participantToken, {})).code, 401);
      }
      assert.equal((await call("manage", "login", null, { username: "bff2026-admin", password: "wrong" })).code, 401);
      admin = (await call("manage", "login", null, { username: "bff2026-admin", password })).body;
      link = (await call("manage", "volunteer-link", admin.token, {})).body;
      assert.equal(new URL(link.url).pathname, "/bff-volunteer");
      assert.equal(new URL(link.url).search, "");
      assert.match(linkToken(link), /^bf26\.volunteer\./);
      assert.ok(Math.abs(new Date(link.expiresAt) - Date.now() - 30 * 86400000) < 5000);
      const parallel = await Promise.all([volunteer.link(), volunteer.link()]);
      assert.equal(parallel[0].url, link.url);
      assert.equal(parallel[1].url, link.url);
      assert.equal((await sql`SELECT * FROM festival_volunteer_access_26`).length, 1);
    });
    await t.test("password-free exchange creates independent hashed sessions and limits access to scanning", async () => {
      for (const token of ["invalid", participantToken, linkToken(link).replace(".volunteer.", ".access."), `${linkToken(link).slice(0, -1)}!`]) {
        assert.equal((await call("volunteer", "claim", null, { token })).code, 401);
      }
      first = (await call("volunteer", "claim", null, { token: linkToken(link) })).body;
      second = (await call("volunteer", "claim", null, { token: linkToken(link) })).body;
      assert.notEqual(first.sessionToken, second.sessionToken);
      const rows = await sql`SELECT * FROM festival_volunteer_sessions_26`;
      assert.ok(rows.some((row) => row.token_hash === tokenHash(first.sessionToken)));
      assert.ok(!JSON.stringify(rows).includes(first.sessionToken));
      assert.equal((await call("volunteer", "me", first.sessionToken)).body.role, "volunteer");
      assert.equal((await call("volunteer", "door-sessions", first.sessionToken)).code, 200);
      assert.equal((await call("volunteer", "door-verify", first.sessionToken, { qr: "fictional-qr" })).body.status, "eligible");
      for (const token of [null, participantToken, admin.token, linkToken(link)]) {
        assert.equal((await call("volunteer", "me", token)).code, 401);
        assert.equal((await call("volunteer", "door-verify", token, {})).code, 401);
      }
      for (const action of ["me", "announcement", "archive", "push", "dispatch", "door-roster", "door-sessions", "door-verify", "volunteer-link", "volunteer-replace", "volunteer-revoke"]) {
        assert.equal((await call("manage", action, first.sessionToken, {})).code, 401, action);
      }
      for (const action of ["announcement", "push", "door-roster", "volunteer-link"]) assert.equal(api.volunteer[action], undefined);
      await assert.rejects(attendee.resolveSession(first.sessionToken), (e) => e.status === 401);
      assert.equal((await call("manage", "door-roster", admin.token, {})).code, 200);
      assert.equal((await call("manage", "announcement", admin.token, { title: "Organizer", description: "Password-protected publishing" })).code, 200);
    });
    await t.test("logout affects one device; replacement invalidates the old link and all remaining devices", async () => {
      await volunteer.logout(first.sessionToken);
      await assert.rejects(volunteer.requireVolunteer(first.sessionToken), (e) => e.status === 401);
      assert.equal((await volunteer.requireVolunteer(second.sessionToken)).role, "volunteer");
      const old = link;
      link = (await call("manage", "volunteer-replace", admin.token, {})).body;
      assert.notEqual(link.url, old.url);
      await assert.rejects(volunteer.claim(linkToken(old)), (e) => e.status === 401);
      await assert.rejects(volunteer.requireVolunteer(second.sessionToken), (e) => e.status === 401);
      first = await volunteer.claim(linkToken(link));
      assert.equal((await volunteer.requireVolunteer(first.sessionToken)).role, "volunteer");
    });
    await t.test("revocation, expiry, signing-secret rotation, and persisted claim throttling reject stale access", async () => {
      await call("manage", "volunteer-revoke", admin.token, {});
      await assert.rejects(volunteer.requireVolunteer(first.sessionToken), (e) => e.status === 401);
      await assert.rejects(volunteer.claim(linkToken(link)), (e) => e.status === 401);
      const renewed = await volunteer.link();
      assert.notEqual(renewed.url, link.url);
      link = renewed;
      first = await volunteer.claim(linkToken(link));
      await sql`UPDATE festival_volunteer_sessions_26 SET expires_at=NOW()-INTERVAL '1 second'`;
      await assert.rejects(volunteer.requireVolunteer(first.sessionToken), (e) => e.status === 401);
      first = await volunteer.claim(linkToken(link));
      const secret = process.env.APP_SIGNING_SECRET;
      process.env.APP_SIGNING_SECRET = "another-fictional-volunteer-signing-secret-32";
      await assert.rejects(volunteer.requireVolunteer(first.sessionToken), (e) => e.status === 401);
      await assert.rejects(volunteer.claim(linkToken(link)), (e) => e.status === 401);
      process.env.APP_SIGNING_SECRET = secret;
      await sql`UPDATE festival_volunteer_access_26 SET claim_count=500`;
      await assert.rejects(volunteer.claim(linkToken(link)), (e) => e.status === 429);
      await sql`UPDATE festival_volunteer_access_26 SET claim_window=NOW()-INTERVAL '16 minutes'`;
      first = await volunteer.claim(linkToken(link));
      await sql`UPDATE festival_volunteer_access_26 SET expires_at=NOW()-INTERVAL '1 second'`;
      await assert.rejects(volunteer.requireVolunteer(first.sessionToken), (e) => e.status === 401);
      await assert.rejects(volunteer.claim(linkToken(link)), (e) => e.status === 401);
      const next = await volunteer.link();
      assert.notEqual(next.url, link.url);
      assert.equal((await volunteer.claim(linkToken(next))).role, "volunteer");
    });
  } finally {
    for (const key of keys) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key];
    await sql.end();
    await db`DROP SCHEMA volunteer_tests CASCADE`;
    await db.end();
  }
});
