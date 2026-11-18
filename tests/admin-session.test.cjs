const { test } = require("node:test");
const assert = require("node:assert/strict");
const { setAdminSession, hasAdminSession, requireAdmin, sameOrigin } = require("../lib/admin/session");
const login = require("../pages/api/login").default;
const response = () => ({ headers: {}, statusCode: 200, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("organizer cookies are signed, expire and cannot be replaced by a client flag", () => {
  process.env.ADMIN_USER = "organizer"; process.env.ADMIN_SESSION_SECRET = "test-only-secret";
  const res = response(); setAdminSession(res);
  const cookie = res.headers["Set-Cookie"].split(";")[0];
  assert.match(res.headers["Set-Cookie"], /HttpOnly; SameSite=Strict/);
  assert.ok(hasAdminSession({ headers: { cookie } }));
  assert.equal(hasAdminSession({ headers: { cookie: cookie + "tampered" } }), false);
  assert.equal(hasAdminSession({ headers: { cookie: "login_admin=true" } }), false);
  const originalNow = Date.now;
  Date.now = () => originalNow() + 9 * 60 * 60 * 1000;
  try { assert.equal(hasAdminSession({ headers: { cookie } }), false); } finally { Date.now = originalNow; }
  const denied = response(); assert.equal(requireAdmin({ headers: {}, method: "POST" }, denied), false);
  assert.equal(denied.statusCode, 401);
  assert.equal(sameOrigin({ headers: { origin: "https://evil.example", host: "register.example" } }), false);
});
test("login fails closed without configured credentials and sets a cookie only after valid login", async () => {
  delete process.env.HASHED_PASS;
  const unconfigured = response(); await login({ method: "POST", headers: {}, body: {} }, unconfigured);
  assert.equal(unconfigured.statusCode, 503);
  process.env.HASHED_PASS = "test-password";
  const wrong = response(); await login({ method: "POST", headers: {}, body: { userName: "organizer", password: "wrong" } }, wrong);
  assert.equal(wrong.statusCode, 401);
  const right = response(); await login({ method: "POST", headers: {}, body: { userName: "organizer", password: "test-password" } }, right);
  assert.equal(right.statusCode, 200); assert.ok(right.headers["Set-Cookie"]);
});
