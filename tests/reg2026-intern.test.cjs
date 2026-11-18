const { test } = require("node:test");
const assert = require("node:assert/strict");
const { signIdentity, verifyIdentitySignature } = require("../lib/reg2026/security");
const { checkoutForOrder } = require("../lib/reg2026/payments");
const { schedule } = require("../lib/reg2026/catalog");
const { fiveClasses } = require("./reg2026-fixtures.cjs");

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
  const dbPath = require.resolve("../db/reg2026");
  const endpointPath = require.resolve("../pages/api/reg2026/submit");
  const previousDb = require.cache[dbPath], previousEndpoint = require.cache[endpointPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { registrationStore: store } };
  delete require.cache[endpointPath];
  const response = () => ({ code: 200, setHeader() {}, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } });
  try {
    const submit = require("../pages/api/reg2026/submit").default;
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
  } finally {
    if (previousDb) require.cache[dbPath] = previousDb; else delete require.cache[dbPath];
    if (previousEndpoint) require.cache[endpointPath] = previousEndpoint; else delete require.cache[endpointPath];
  }
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
