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
    const createPerson = async (name, ticket = "fullpass") => (await sql`INSERT INTO registrations_26
      (date,status,role,ticket,firstname,lastname,email,country)
      VALUES ('2026','confirmed','advanced',${ticket},${name},'Participant',${name + "@example.com"},'Austria') RETURNING *`)[0];
    const freeParticipant = await createPerson("Free");
    // Existing pass choices can be carried into a first supplemental submission.
    await sql`UPDATE registrations_26 SET theme_class = ${require("../lib/reg2026/serialization").serializeThemeClass(free.classes)} WHERE id = ${participant.id}`;
    await sql`INSERT INTO class_bookings_26 (registration_id,session_id,pool,status) VALUES (${participant.id},'fri-1330-ankersaal','total','confirmed')`;
    let order, pending;
    await t.test("free submissions complete once and identical retries are idempotent", async () => {
      order = await store.submit(freeParticipant, free, "free-request-0001");
      assert.equal(order.status, "confirmed");
      const repeated = await store.submit(freeParticipant, free, "free-request-0001");
      assert.equal(repeated.id, order.id);
      const [counts] = await sql`SELECT COUNT(*)::INTEGER AS count FROM class_bookings_26 WHERE registration_id = ${freeParticipant.id}`;
      assert.equal(counts.count, 1);
      assert.equal((await store.deliveriesForOrder(order.id)).length, 1);
      assert.equal((await store.completedOrder(freeParticipant.id)).id, order.id);
      await assert.rejects(store.submit(freeParticipant, empty(), "free-request-0001"), /different choices/);
    });
    await t.test("completed registration rejects edits and preserves its booking", async () => {
      await assert.rejects(store.submit(freeParticipant, { ...empty(), classes: [{ sessionId: "fri-1515-lot" }] }, "changed-request-01"), /contact the organizers/);
      await assert.rejects(store.submit(freeParticipant, free, "new-key-request-01"), /contact the organizers/);
      const [booking] = await sql`SELECT session_id FROM class_bookings_26 WHERE registration_id = ${freeParticipant.id}`;
      assert.equal(booking.session_id, "fri-1330-ankersaal");
    });
    await t.test("empty registrations complete once even with concurrent different submission keys", async () => {
      const person = await createPerson("Empty", "partyPass");
      const attempts = await Promise.allSettled([store.submit(person, empty(), "empty-request-001"), store.submit(person, empty(), "empty-request-002")]);
      assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
      assert.match(attempts.find((result) => result.status === "rejected").reason.message, /contact the organizers/);
      assert.equal((await store.completedOrder(person.id)).status, "confirmed");
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
      await assert.rejects(store.submit(participant, empty(), "remove-paid-0001"), /contact the organizers/);
    });
    await t.test("failed email is durable while booking stays confirmed", async () => {
      process.env.REG2026_CONFIRMATION_TEMPLATE_ID = "d-test";
      await deliverOrderConfirmation(store, pending.id, async () => { throw new Error("test delivery unavailable"); });
      assert.equal((await store.order(pending.id, participant.id)).status, "confirmed");
      assert.equal((await store.deliveriesForOrder(pending.id))[0].delivery_status, "failed");
    });
    await t.test("expired checkout releases provisional places and permits an unfinished registration to retry", async () => {
      const person = await createPerson("Expiry");
      const draft = { ...free, lunch: ["saturday"] };
      const next = await store.submit(person, draft, "expiry-request-01");
      await store.attachSession(next.id, "cs_test_expiry");
      await store.applyPayment({ ...session(), id: "cs_test_expiry", client_reference_id: String(person.id),
        metadata: { reg2026OrderId: String(next.id) }, amount_total: next.total_cents, status: "expired" }, "checkout.session.expired");
      assert.equal((await sql`SELECT id FROM class_bookings_26 WHERE registration_id = ${person.id}`).length, 0);
      assert.equal(await store.completedOrder(person.id), undefined);
      const retry = await store.submit(person, draft, "expiry-request-02");
      assert.equal(retry.status, "provisional");
      const bookings = await sql`SELECT session_id FROM class_bookings_26 WHERE registration_id = ${participant.id}`;
      assert.deepEqual(bookings.map((booking) => booking.session_id), ["fri-1330-kantine"]);
    });
    await t.test("invitations skip ambiguous identities, survive failures and never blindly resend", async () => {
      const { queueInvitations, processDeliveryBatch } = require("../lib/reg2026/invitations");
      process.env.REG2026_ENABLED = "true";
      process.env.REG2026_CATALOG_REVIEWED = "true";
      process.env.REG2026_INVITATION_TEMPLATE_ID = "d-invite-test";
      await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        VALUES ('2026','confirmed','advanced','partyPass','Duplicate','One','duplicate@example.com','Austria'),
          ('2026','confirmed','advanced','partyPass','Duplicate','Two','duplicate@example.com','Austria')`;
      const eligible = await store.confirmedRecipients();
      assert.ok(eligible.every((person) => person.email !== "duplicate@example.com"));
      assert.equal(await queueInvitations(store), eligible.length);
      assert.equal(await queueInvitations(store), eligible.length);
      const records = await sql`SELECT * FROM registration_email_retries_26 WHERE kind = 'invitation'`;
      assert.equal(records.length, eligible.length);
      assert.ok(records[0].payload.dynamicTemplateData.registrationUrl.includes("sig="));
      await processDeliveryBatch(store, false, async () => { throw new Error("temporary failure"); });
      await processDeliveryBatch(store, true, async () => {});
      assert.ok((await sql`SELECT delivery_status FROM registration_email_retries_26 WHERE kind = 'invitation'`).every((record) => record.delivery_status === "sent"));
      await queueInvitations(store);
      assert.equal(await processDeliveryBatch(store, false, async () => { throw new Error("must not resend"); }), 0);
    });
    await t.test("HTTP endpoints enforce signed access, complete drafts and server-owned checkout", async () => {
      const { signIdentity } = require("../lib/reg2026/security");
      const payments = require("../lib/reg2026/payments");
      const sessions = new Map();
      const mockStripe = { checkout: { sessions: {
        create: async (args, options) => {
          assert.equal(args.line_items[0].price_data.unit_amount, 1547);
          const value = { id: "cs_http_test", url: "https://checkout.example.com/http", amount_total: 1547, currency: "eur",
            status: "open", payment_status: "unpaid", metadata: args.metadata, client_reference_id: args.client_reference_id };
          sessions.set(value.id, value); return value;
        }, retrieve: async (id) => sessions.get(id),
      } }, webhooks: { constructEvent: () => { throw new Error("Invalid signature"); } } };
      require.cache[require.resolve("../db/reg2026")] = { id: require.resolve("../db/reg2026"), filename: require.resolve("../db/reg2026"), loaded: true, exports: { registrationStore: store } };
      require.cache[require.resolve("../lib/reg2026/payments")].exports = { ...payments,
        getStripe: () => mockStripe, checkoutForOrder: (...args) => payments.checkoutForOrder(...args, mockStripe),
        reconcileOrder: (...args) => payments.reconcileOrder(...args, mockStripe),
      };
      const submit = require("../pages/api/reg2026/submit").default;
      const load = require("../pages/api/reg2026/index").default;
      const res = () => ({ headers: {}, code: 200, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, end() { return this; } });
      const [person] = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        VALUES ('2026','confirmed','advanced','partyPass','HTTP','Participant','http+test@example.com','Austria') RETURNING *`;
      const user = person.email + "+" + person.firstname;
      const access = { user, sig: signIdentity(user) };
      const rejected = res(); await load({ method: "GET", query: { user, sig: "tampered" } }, rejected);
      assert.equal(rejected.code, 403);
      const projection = res(); await load({ method: "GET", query: access }, projection);
      assert.equal(projection.code, 200); assert.equal(projection.body.participant.email, undefined);
      const malformed = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-malformed-01", draft: null } }, malformed);
      assert.equal(malformed.code, 422);
      const classes = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-party-00001", draft: free } }, classes);
      assert.equal(classes.code, 422);
      const [fullPass] = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        VALUES ('2026','confirmed','advanced','fullpass','Limit','Participant','limit@example.com','Austria') RETURNING *`;
      const fullUser = fullPass.email + "+" + fullPass.firstname;
      const slots = new Set();
      const tooMany = require("../lib/reg2026/catalog").schedule
        .filter((session) => !slots.has(session.slotId) && slots.add(session.slotId)).slice(0, 6)
        .map((session) => ({ sessionId: session.id, ...(session.partnerClass ? { role: "lead" } : {}) }));
      const overLimit = res();
      await submit({ method: "POST", body: { user: fullUser, sig: signIdentity(fullUser),
        requestKey: "http-class-limit-01", draft: { ...empty(), classes: tooMany } } }, overLimit);
      assert.equal(overLimit.code, 422);
      assert.match(overLimit.body.errors.classes, /5 classes in total/);
      assert.equal(await store.activeOrder(fullPass.id), undefined);
      const closed = res(); process.env.REG2026_ENABLED = "false";
      await submit({ method: "POST", body: { ...access, requestKey: "http-closed-0001", draft: empty() } }, closed);
      assert.equal(closed.code, 403); process.env.REG2026_ENABLED = "true";
      const paid = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-payment-001", draft: { ...empty(), lunch: ["saturday"] }, price: 1 } }, paid);
      assert.equal(paid.code, 200); assert.equal(paid.body.order.totalCents, 1547);
      assert.equal(paid.body.checkoutUrl, "https://checkout.example.com/http");
      const retried = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-payment-001", draft: { ...empty(), lunch: ["saturday"] } } }, retried);
      assert.equal(retried.body.order.id, paid.body.order.id);
      // Exercise raw webhook HTTP handling with Stripe's own local signature verifier.
      const Stripe = require("stripe");
      const verifier = new Stripe("sk_test_not_a_live_key");
      mockStripe.webhooks.constructEvent = (...args) => verifier.webhooks.constructEvent(...args);
      process.env.REG2026_STRIPE_WEBHOOK_SECRET = "whsec_test_only";
      const webhook = require("../pages/api/reg2026/webhook").default;
      const { Readable } = require("node:stream");
      const event = { id: "evt_test", type: "checkout.session.completed", data: { object: { ...sessions.get("cs_http_test"), status: "complete", payment_status: "paid" } } };
      const raw = JSON.stringify(event);
      const invoke = async (signature) => {
        const req = Readable.from([Buffer.from(raw)]); req.method = "POST"; req.headers = { "stripe-signature": signature };
        const response = res(); await webhook(req, response); return response;
      };
      assert.equal((await invoke("bad-signature")).code, 400);
      const signature = verifier.webhooks.generateTestHeaderString({ payload: raw, secret: process.env.REG2026_STRIPE_WEBHOOK_SECRET });
      assert.equal((await invoke(signature)).code, 200);
      assert.equal((await invoke(signature)).code, 200);
      assert.equal((await store.order(paid.body.order.id, person.id)).status, "confirmed");
      const state = res(); await load({ method: "GET", query: { ...access, order: paid.body.order.id } }, state);
      assert.deepEqual(state.body.choices.lunch, ["saturday"]);
      assert.equal(state.body.completed, true);
      const reopened = res(); await load({ method: "GET", query: access }, reopened);
      assert.equal(reopened.body.completed, true);
      assert.equal(reopened.body.order.id, paid.body.order.id);
      const edited = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-edit-once-01",
        draft: { ...empty(), lunch: ["saturday", "sunday"] } } }, edited);
      assert.equal(edited.code, 409); assert.match(edited.body.error, /contact the organizers/);
      const repeat = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-payment-001",
        draft: { ...empty(), lunch: ["saturday"] } } }, repeat);
      assert.equal(repeat.code, 200); assert.equal(repeat.body.order.id, paid.body.order.id);
      const wrongOrder = res(); await load({ method: "GET", query: { ...access, order: "999999" } }, wrongOrder);
      assert.equal(wrongOrder.body.completed, true);
      process.env.ADMIN_SESSION_SECRET = "test-admin-secret"; process.env.ADMIN_USER = "test-admin";
      const invitations = require("../pages/api/reg2026/invitations").default;
      const unauthenticated = res(); await invitations({ method: "POST", headers: {}, body: { action: "queue", recipients: [person] } }, unauthenticated);
      assert.equal(unauthenticated.code, 401);
      require.cache[require.resolve("../db/db")] = { loaded: true, exports: {
        getConfirmedUserByEmailAndName: async () => person,
        setUserLunchById: () => { throw new Error("Legacy writes must not be reached"); },
        setUserCompById: () => { throw new Error("Legacy writes must not be reached"); },
      } };
      const legacyLunch = require("../pages/api/lunch").default;
      const retired = res(); await legacyLunch({ method: "POST", body: {} }, retired);
      assert.equal(retired.code, 410);
      process.env.REG2026_ENABLED = "false";
      const protectedBooking = res(); await legacyLunch({ method: "POST", body: {
        email: person.email, firstname: person.firstname, lastname: person.lastname, lunch: [],
      } }, protectedBooking);
      assert.equal(protectedBooking.code, 410);
    });
  } finally { await sql.end(); }
});
