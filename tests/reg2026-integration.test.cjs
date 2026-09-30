const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { checkoutForOrder } = require("../lib/reg2026/payments");
const { deliverOrderConfirmation } = require("../lib/reg2026/email");
const empty = () => ({ classes: [], competitions: [], competitionRoles: {}, lunch: [] });

test("registration orders on isolated Postgres", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  try {
    for (const file of ["00004-CREAT-registraion-2026", "00006-create-class-capacities-2026", "00007-create-reg2026-bookings", "00008-reg2026-order-safety"]) {
      await sql.begin((tx) => require(`../migrations/${file}`).up(tx));
    }
    const store = createRegistrationStore(sql);
    const [participant] = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country,price)
      VALUES ('2026','confirmed','advanced','fullpass','Test','Participant','test+one@example.com','Austria','200') RETURNING *`;
    const free = { ...empty(), classes: [{ sessionId: "fri-1330-ankersaal" }] };
    let order, pending;
    await t.test("free submissions persist choices and retry without duplicate capacity or emails", async () => {
      order = await store.submit(participant, free, "free-request-0001");
      assert.equal(order.status, "confirmed");
      const repeated = await store.submit(participant, free, "free-request-0001");
      assert.equal(repeated.id, order.id);
      const [counts] = await sql`SELECT COUNT(*)::INTEGER AS count FROM class_bookings_26`;
      assert.equal(counts.count, 1);
      assert.equal((await store.deliveriesForOrder(order.id)).length, 1);
      await assert.rejects(store.submit(participant, empty(), "free-request-0001"), /different choices/);
    });
    await t.test("failed edit leaves the old booking intact", async () => {
      await sql`UPDATE class_capacities_26 SET capacity = 0 WHERE session_id = 'fri-1515-lot'`;
      await assert.rejects(store.submit(participant, { ...empty(), classes: [{ sessionId: "fri-1515-lot" }] }, "failed-request-01"), /now full/);
      const [booking] = await sql`SELECT session_id FROM class_bookings_26 WHERE registration_id = ${participant.id}`;
      assert.equal(booking.session_id, "fri-1330-ankersaal");
    });
    await t.test("paid draft reserves provisionally and checkout uses a stable idempotency key", async () => {
      const draft = { ...empty(), classes: [{ sessionId: "fri-1330-kantine", role: "lead" }], lunch: ["saturday"] };
      const results = await Promise.all([store.submit(participant, draft, "paid-request-0001"), store.submit(participant, draft, "paid-request-0001")]);
      pending = results[0];
      assert.equal(results[1].id, pending.id);
      assert.equal(pending.total_cents, 1547);
      const [person] = await sql`SELECT theme_class FROM registrations_26 WHERE id = ${participant.id}`;
      assert.match(person.theme_class, /ankersaal/);
      process.env.REG2026_ORIGIN = "https://register.example.com";
      process.env.REG2026_SIGNING_SECRET = "test-only";
      const payment = { checkout: { sessions: { create: async (args, options) => {
        assert.equal(args.line_items[0].price_data.unit_amount, 1547);
        assert.equal(options.idempotencyKey, `reg2026-order-${pending.id}`);
        assert.ok(args.success_url.startsWith("https://register.example.com/reg2026?"));
        return { id: "cs_test_paid", url: "https://checkout.example.com/test" };
      } } } };
      assert.equal(await checkoutForOrder(store, participant, pending, payment), "https://checkout.example.com/test");
    });
    const session = () => ({ id: "cs_test_paid", amount_total: pending.total_cents, currency: "eur", client_reference_id: String(participant.id), metadata: { reg2026OrderId: String(pending.id) }, status: "complete", payment_status: "unpaid" });
    await t.test("processing payments retain reservations past the one-hour window", async () => {
      const processing = await store.applyPayment(session(), "checkout.session.completed");
      assert.equal(processing.status, "payment_pending");
      assert.equal((await store.availability()).classes["fri-1330-kantine"].lead.remaining, 19);
      const [row] = await sql`SELECT expires_at FROM class_bookings_26 WHERE order_id = ${pending.id}`;
      assert.equal(row.expires_at, null);
    });
    await t.test("verified payment atomically replaces confirmed choices exactly once", async () => {
      await assert.rejects(store.applyPayment({ ...session(), amount_total: 1 }, "reconcile"), /does not match/);
      const paid = { ...session(), payment_status: "paid" };
      await store.applyPayment(paid, "checkout.session.async_payment_succeeded");
      await store.applyPayment(paid, "checkout.session.async_payment_succeeded");
      await store.applyPayment({ ...session(), status: "expired" }, "checkout.session.expired");
      const [booking] = await sql`SELECT session_id, status FROM class_bookings_26 WHERE registration_id = ${participant.id}`;
      assert.equal(booking.session_id, "fri-1330-kantine");
      assert.equal(booking.status, "confirmed");
      const [person] = await sql`SELECT lunch, price FROM registrations_26 WHERE id = ${participant.id}`;
      assert.equal(person.lunch, "saturday");
      assert.equal(person.price, "200");
      assert.equal((await store.deliveriesForOrder(pending.id)).length, 1);
      await assert.rejects(store.submit(participant, empty(), "remove-paid-0001"), /paid add-ons/);
    });
    await t.test("failed email is durable while booking stays confirmed", async () => {
      process.env.REG2026_CONFIRMATION_TEMPLATE_ID = "d-test";
      await deliverOrderConfirmation(store, pending.id, async () => { throw new Error("test delivery unavailable"); });
      assert.equal((await store.order(pending.id, participant.id)).status, "confirmed");
      assert.equal((await store.deliveriesForOrder(pending.id))[0].delivery_status, "failed");
    });
    await t.test("expired checkout releases only provisional places", async () => {
      const [current] = await store.findParticipants("test+one@example.com+Test");
      const draft = { ...free, lunch: ["saturday", "sunday"] };
      const next = await store.submit(current, draft, "expiry-request-01");
      await store.attachSession(next.id, "cs_test_expiry");
      await store.applyPayment({ ...session(), id: "cs_test_expiry", metadata: { reg2026OrderId: String(next.id) }, amount_total: next.total_cents, status: "expired" }, "checkout.session.expired");
      const bookings = await sql`SELECT session_id FROM class_bookings_26 WHERE registration_id = ${participant.id}`;
      assert.deepEqual(bookings.map((b) => b.session_id), ["fri-1330-kantine"]);
    });
  } finally { await sql.end(); }
});
