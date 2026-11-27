const { test } = require("node:test");
const assert = require("node:assert/strict");

test("festival ticket checkout closes at noon Vienna time", async (t) => {
  const cutoff = Date.parse("2026-11-29T11:00:00Z");
  let now = cutoff - 1;
  t.mock.method(Date, "now", () => now);

  const database = t.mock.fn(async () => undefined);
  const checkout = t.mock.fn(async () => ({ url: "https://checkout.example.com/" }));
  const mocks = {
    "../db/db": { getUserByEmailAndName: database },
    stripe: class Stripe {
      checkout = { sessions: { create: checkout } };
    },
  };
  for (const [name, exports] of Object.entries(mocks)) {
    const path = require.resolve(name);
    const previous = require.cache[path];
    require.cache[path] = { loaded: true, exports };
    t.after(() => {
      if (previous) require.cache[path] = previous;
      else delete require.cache[path];
    });
  }

  const { default: handler } = require("../pages/api/checkout");
  const startCheckout = async () => {
    const response = {
      status(code) { this.code = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await handler({
      method: "POST",
      headers: { origin: "https://register.example.com" },
      body: { price: 14500, user: { email: "dancer@example.com", firstname: "Dancer" } },
    }, response);
    return response;
  };

  const open = await startCheckout();
  assert.equal(open.code, 200);
  assert.equal(open.body.url, "https://checkout.example.com/");

  for (now of [cutoff, cutoff + 1]) {
    const closed = await startCheckout();
    assert.equal(closed.code, 409);
    assert.equal(closed.body.error, "Festival ticket registration is closed.");
  }
  assert.equal(database.mock.callCount(), 1);
  assert.equal(checkout.mock.callCount(), 1);
});
