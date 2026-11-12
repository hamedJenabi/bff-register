const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { checkoutForOrder } = require("../lib/reg2026/payments");
const sgMail = require("@sendgrid/mail");
const { fiveClasses } = require("./reg2026-fixtures.cjs");
const empty = () => ({ classes: [], competitions: [], competitionRoles: {}, lunch: [] });

test("registration orders on isolated Postgres", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  const originalSend = sgMail.send;
  const originalSendGridKey = process.env.SENDGRID_API_KEY;
  process.env.SENDGRID_API_KEY = "SG.fictional-test-key";
  const emailSends = [];
  let failNextEmail = false;
  sgMail.send = async (message) => {
    if (failNextEmail) {
      failNextEmail = false;
      const error = new Error("Fictional SendGrid rejection");
      error.response = { statusCode: 503 };
      throw error;
    }
    emailSends.push(message);
  };
  try {
    for (const file of ["00004-CREAT-registraion-2026", "00006-create-class-capacities-2026", "00007-create-reg2026-bookings", "00008-reg2026-order-safety", "00009-create-schedule-overrides-2026", "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule", "00015-reg2026-switch-role", "00016-reg2026-competition-capacities", "00017-reg2026-showcase-capacity"]) {
      await sql.begin((tx) => require(`../migrations/${file}`).up(tx));
    }
    const store = createRegistrationStore(sql);
    await t.test("schedule mocks work with an empty capacity table and stored limits override defaults", async () => {
      assert.equal((await sql`SELECT * FROM class_capacities_26`).length, 0);
      assert.equal((await sql`SELECT * FROM schedule_overrides_26`).length, 0);
      const defaults = await store.availability();
      assert.equal(defaults.classes["fri-1330-ankersaal"].total.remaining, 30);
      assert.equal(defaults.classes["fri-1330-kantine"].total.remaining, 40);
      assert.equal(defaults.classes["fri-1330-kantine"].lead.remaining, 40);
      assert.equal(defaults.classes["fri-1330-kantine"].switch.remaining, 40);
      assert.equal(defaults.classes["fri-1330-kantine"].follow.remaining, 20);
      await sql`INSERT INTO class_capacities_26 (session_id, pool, capacity) VALUES ('fri-1330-kantine', 'lead', 12)`;
      assert.equal((await store.availability()).classes["fri-1330-kantine"].lead.remaining, 40, "Legacy role limits no longer restrict the shared pool");
      await sql`DELETE FROM class_capacities_26`;
      await sql`INSERT INTO class_capacities_26 (session_id, pool, capacity) VALUES ('fri-1330-kantine', 'total', 24)`;
      const edited = await store.availability();
      assert.equal(edited.classes["fri-1330-kantine"].lead.remaining, 24);
      assert.equal(edited.classes["fri-1330-kantine"].follow.remaining, 12);
      await sql`DELETE FROM class_capacities_26`;
    });
    const [participant] = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country,price)
      VALUES ('2026','confirmed','advanced','parentPass','Test','Participant','test+one@example.com','Austria','200') RETURNING *`;
    const free = { ...empty(), classes: fiveClasses({ sessionId: "fri-1330-ankersaal" }) };
    const createPerson = async (name, ticket = "parentPass") => (await sql`INSERT INTO registrations_26
      (date,status,role,ticket,firstname,lastname,email,country)
      VALUES ('2026','confirmed','advanced',${ticket},${name},'Participant',${name + "@example.com"},'Austria') RETURNING *`)[0];
    const freeParticipant = await createPerson("Free");
    // Preserve historical queued messages without delivering or changing them.
    await sql`INSERT INTO registration_email_retries_26
      (registration_id, kind, payload, last_error, attempts, delivery_status)
      VALUES (${participant.id}, 'invitation', '{}'::jsonb, '', 0, 'pending')`;
    const historicalDeliveries = await sql`SELECT * FROM registration_email_retries_26 ORDER BY id`;
    // Older pass-purchase fields do not count as a completed /reg2026 submission.
    await sql`UPDATE registrations_26 SET theme_class = 'legacy-class-ankersaal' WHERE id = ${participant.id}`;
    await sql`INSERT INTO class_bookings_26 (registration_id,session_id,pool,status) VALUES (${participant.id},'fri-1330-ankersaal','total','confirmed')`;
    let order, pending;
    await t.test("free submissions complete once and identical retries are idempotent", async () => {
      order = await store.submit(freeParticipant, free, "free-request-0001");
      assert.equal(order.status, "confirmed");
      const repeated = await store.submit(freeParticipant, free, "free-request-0001");
      assert.equal(repeated.id, order.id);
      const [counts] = await sql`SELECT COUNT(*)::INTEGER AS count FROM class_bookings_26 WHERE registration_id = ${freeParticipant.id}`;
      assert.equal(counts.count, 5);
      const [queued] = await sql`SELECT delivery_status, attempts, payload FROM registration_email_retries_26 WHERE order_id = ${order.id}`;
      assert.equal(queued.delivery_status, "pending");
      assert.equal(queued.attempts, 0);
      assert.deepEqual(queued.payload.data.classes[0], {
        title: "Groove in Motion 1", day: "Friday", start: "13:30", end: "14:45",
        teachers: "Catherine", room: "Ankersaal", role: "",
      });
      assert.equal((await store.completedOrder(freeParticipant.id)).id, order.id);
      await assert.rejects(store.submit(freeParticipant, empty(), "free-request-0001"), /different choices/);
    });
    await t.test("completed registration rejects edits and preserves its booking", async () => {
      await assert.rejects(store.submit(freeParticipant, { ...empty(), classes: [{ sessionId: "fri-1515-lot" }] }, "changed-request-01"), /contact the organizers/);
      await assert.rejects(store.submit(freeParticipant, free, "new-key-request-01"), /contact the organizers/);
      const bookings = await sql`SELECT session_id FROM class_bookings_26 WHERE registration_id = ${freeParticipant.id}`;
      assert.deepEqual(bookings.map((booking) => booking.session_id).sort(), free.classes.map(({ sessionId }) => sessionId).sort());
    });
    await t.test("empty registrations complete once even with concurrent different submission keys", async () => {
      const person = await createPerson("Empty", "partyPass");
      const attempts = await Promise.allSettled([store.submit(person, empty(), "empty-request-001"), store.submit(person, empty(), "empty-request-002")]);
      assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
      assert.match(attempts.find((result) => result.status === "rejected").reason.message, /contact the organizers/);
      assert.equal((await store.completedOrder(person.id)).status, "confirmed");
    });
    await t.test("paid draft reserves provisionally and checkout uses a stable idempotency key", async () => {
      const draft = { ...empty(), classes: fiveClasses({ sessionId: "fri-1330-kantine", role: "lead" }), lunch: ["saturday"] };
      const results = await Promise.all([store.submit(participant, draft, "paid-request-0001"), store.submit(participant, draft, "paid-request-0001")]);
      pending = results[0];
      assert.equal(results[1].id, pending.id);
      assert.equal(pending.total_cents, 1547);
      assert.equal((await sql`SELECT id FROM registration_email_retries_26 WHERE order_id = ${pending.id}`).length, 0);
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
      assert.equal((await store.availability()).classes["fri-1330-kantine"].lead.remaining, 39);
      const [row] = await sql`SELECT expires_at FROM class_bookings_26 WHERE order_id = ${pending.id}`;
      assert.equal(row.expires_at, null);
    });
    await t.test("verified payment atomically replaces confirmed choices exactly once", async () => {
      await assert.rejects(store.applyPayment({ ...session(), amount_total: 1 }, "reconcile"), /does not match/);
      const paid = { ...session(), payment_status: "paid" };
      await store.applyPayment(paid, "checkout.session.async_payment_succeeded");
      await store.applyPayment(paid, "checkout.session.async_payment_succeeded");
      await store.applyPayment({ ...session(), status: "expired" }, "checkout.session.expired");
      const [booking] = await sql`SELECT status FROM class_bookings_26 WHERE registration_id = ${participant.id} AND session_id = 'fri-1330-kantine'`;
      assert.equal(booking.status, "confirmed");
      const [person] = await sql`SELECT lunch, price FROM registrations_26 WHERE id = ${participant.id}`;
      assert.equal(person.lunch, "saturday");
      assert.equal(person.price, "200");
      assert.equal((await sql`SELECT delivery_status FROM registration_email_retries_26 WHERE order_id = ${pending.id}`)[0].delivery_status, "pending");
      const [message] = await sql`SELECT payload FROM registration_email_retries_26 WHERE order_id = ${pending.id}`;
      assert.equal(message.payload.data.classes[0].role, "Lead");
      assert.equal(message.payload.data.classes[0].room, "Kantine");
      await assert.rejects(store.submit(participant, empty(), "remove-paid-0001"), /contact the organizers/);
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
      assert.deepEqual(bookings.map((booking) => booking.session_id).sort(), pending.draft.classes.map(({ sessionId }) => sessionId).sort());
    });
    await t.test("organizers replace classes atomically without changing orders, add-ons or email deliveries", async () => {
      const person = await createPerson("OrganizerEdit");
      const original = await store.submit(person, { ...free, competitions: ["solo_battle"], lunch: ["saturday"] }, "admin-original-01");
      await store.attachSession(original.id, "cs_admin_original");
      const payment = { id: "cs_admin_original", amount_total: original.total_cents, currency: "eur", client_reference_id: String(person.id),
        metadata: { reg2026OrderId: String(original.id) }, status: "complete", payment_status: "paid" };
      await store.applyPayment(payment, "checkout.session.completed");
      const [queuedEmail] = await sql`SELECT payload FROM registration_email_retries_26 WHERE order_id = ${original.id}`;
      assert.deepEqual(queuedEmail.payload.data.competitions, [{ label: "Solo Battle", role: "" }]);
      const before = await store.organizerClasses(person.id);
      const [orderBefore] = await sql`SELECT * FROM reg2026_orders WHERE id = ${original.id}`;
      const emailsBefore = await sql`SELECT * FROM registration_email_retries_26 WHERE registration_id = ${person.id}`;
      const remainingBefore = (await store.availability()).classes["fri-1330-ankersaal"].total.remaining;
      const replacement = [{ sessionId: "sat-1415-studio" }, { sessionId: "sun-1130-lot", role: "follow" }];
      const edited = await store.editClasses(person.id, replacement, before.version);
      assert.deepEqual((await store.organizerClasses(person.id)).classes, replacement);
      assert.equal((await store.availability()).classes["fri-1330-ankersaal"].total.remaining, remainingBefore + 1);
      const bookings = await sql`SELECT session_id, pool, status FROM class_bookings_26 WHERE registration_id = ${person.id} ORDER BY session_id`;
      assert.deepEqual(Array.from(bookings), [{ session_id: "sat-1415-studio", pool: "total", status: "confirmed" }, { session_id: "sun-1130-lot", pool: "follow", status: "confirmed" }]);
      const [current] = await sql`SELECT competitions, lunch FROM registrations_26 WHERE id = ${person.id}`;
      assert.deepEqual(current, { competitions: "solo_battle", lunch: "saturday" });
      assert.deepEqual((await sql`SELECT * FROM reg2026_orders WHERE id = ${original.id}`)[0], orderBefore);
      assert.deepEqual(await sql`SELECT * FROM registration_email_retries_26 WHERE registration_id = ${person.id}`, emailsBefore);
      await store.applyPayment(payment, "checkout.session.completed");
      assert.deepEqual((await store.organizerClasses(person.id)).classes, replacement);
      await assert.rejects(store.editClasses(person.id, [], before.version), /changed in another session/);
      await assert.rejects(store.editClasses(person.id, [{ sessionId: "sun-1130-lot" }], edited.version), /check the class choices/);
      await assert.rejects(store.editClasses(person.id, [{ sessionId: "fri-1330-ankersaal" }, { sessionId: "fri-1330-studio" }], edited.version), /check the class choices/);
      await sql`INSERT INTO class_capacities_26 (session_id, pool, capacity) VALUES ('fri-1515-lot', 'total', 0)`;
      await assert.rejects(store.editClasses(person.id, [{ sessionId: "fri-1515-lot" }], edited.version), /now full/);
      await sql`DELETE FROM class_capacities_26 WHERE session_id = 'fri-1515-lot'`;
      assert.deepEqual((await store.organizerClasses(person.id)).classes, replacement);

      require.cache[require.resolve("../db/reg2026")] = { loaded: true, exports: { registrationStore: store } };
      process.env.ADMIN_SESSION_SECRET = "test-admin-secret"; process.env.ADMIN_USER = "test-admin";
      const { setAdminSession } = require("../lib/admin/session");
      const response = () => ({ headers: {}, code: 200, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, end() { return this; } });
      const sessionResponse = response(); setAdminSession(sessionResponse);
      const headers = { cookie: sessionResponse.headers["Set-Cookie"].split(";")[0], host: "localhost:3000", origin: "http://localhost:3000" };
      const adminClasses = require("../pages/api/reg2026/admin-classes").default;
      const unauthorized = response(); await adminClasses({ method: "POST", headers: {}, body: { id: person.id, classes: [], version: edited.version } }, unauthorized);
      assert.equal(unauthorized.code, 401);
      const crossOrigin = response(); await adminClasses({ method: "POST", headers: { ...headers, origin: "https://outside.example.com" }, body: {} }, crossOrigin);
      assert.equal(crossOrigin.code, 403);
      const loaded = response(); await adminClasses({ method: "GET", headers, query: { id: person.id } }, loaded);
      assert.equal(loaded.code, 200); assert.equal(loaded.body.editable, true);
      const cleared = response(); await adminClasses({ method: "POST", headers, body: { id: person.id, classes: [], version: loaded.body.version } }, cleared);
      assert.equal(cleared.code, 200); assert.deepEqual(cleared.body.classes, []);
      assert.equal((await sql`SELECT id FROM class_bookings_26 WHERE registration_id = ${person.id}`).length, 0);
      assert.deepEqual((await sql`SELECT * FROM reg2026_orders WHERE id = ${original.id}`)[0], orderBefore);
      assert.deepEqual(await sql`SELECT * FROM registration_email_retries_26 WHERE registration_id = ${person.id}`, emailsBefore);
      const unfinished = await createPerson("AdminPending");
      await store.submit(unfinished, { ...free, lunch: ["sunday"] }, "admin-pending-01");
      assert.equal((await store.organizerClasses(unfinished.id)).editable, false);
      await assert.rejects(store.editClasses(unfinished.id, [], ""), /pending checkout/);
    });
    await t.test("admin reopening releases classes, preserves paid add-ons and retires the completion lock", async () => {
      const person = await createPerson("ReopenPaid");
      const draft = { ...free, competitions: ["strictly"], competitionRoles: { strictly: "lead" }, lunch: ["saturday"] };
      const original = await store.submit(person, draft, "reopen-original-01");
      await store.attachSession(original.id, "cs_reopen_original");
      const payment = { id: "cs_reopen_original", amount_total: original.total_cents, currency: "eur", client_reference_id: String(person.id),
        metadata: { reg2026OrderId: String(original.id) }, status: "complete", payment_status: "paid" };
      await store.applyPayment(payment, "checkout.session.completed");
      const before = await store.organizerClasses(person.id);
      assert.equal(before.reopenable, true);
      const remainingBefore = (await store.availability()).classes["fri-1330-ankersaal"].total.remaining;
      const { setAdminSession } = require("../lib/admin/session");
      const response = () => ({ headers: {}, code: 200, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, end() { return this; } });
      const cookie = response(); setAdminSession(cookie);
      const headers = { cookie: cookie.headers["Set-Cookie"].split(";")[0], host: "localhost:3000", origin: "http://localhost:3000" };
      const endpoint = require("../pages/api/reg2026/admin-classes").default;
      const body = { id: person.id, action: "reopen", version: before.version };
      const unauthorized = response(); await endpoint({ method: "POST", headers: {}, body }, unauthorized);
      assert.equal(unauthorized.code, 401);
      const crossOrigin = response(); await endpoint({ method: "POST", headers: { ...headers, origin: "https://outside.example.com" }, body }, crossOrigin);
      assert.equal(crossOrigin.code, 403);
      const stale = response(); await endpoint({ method: "POST", headers, body: { ...body, version: "stale" } }, stale);
      assert.equal(stale.code, 409); assert.deepEqual((await store.organizerClasses(person.id)).classes, free.classes);
      const reset = response(); await endpoint({ method: "POST", headers, body }, reset);
      assert.equal(reset.code, 200); assert.equal(reset.body.reopened, true); assert.deepEqual(reset.body.classes, []);
      assert.equal((await store.availability()).classes["fri-1330-ankersaal"].total.remaining, remainingBefore + 1);
      assert.equal((await sql`SELECT id FROM class_bookings_26 WHERE registration_id = ${person.id}`).length, 0);
      const [preserved] = await sql`SELECT * FROM reg2026_orders WHERE id = ${original.id}`;
      assert.equal(preserved.status, "confirmed"); assert.ok(preserved.reopened_at);
      assert.equal(preserved.total_cents, original.total_cents); assert.equal(preserved.stripe_session_id, payment.id);
      assert.equal(await store.completedOrder(person.id), undefined);
      const [participantAfter] = await store.findParticipants(person.email + "+" + person.firstname);
      assert.equal(participantAfter.competitions, "strictly"); assert.equal(participantAfter.strictly_role, "lead"); assert.equal(participantAfter.lunch, "saturday");
      const { loadRegistrationState } = require("../lib/reg2026/state");
      const reopenedState = await loadRegistrationState(store, participantAfter, String(original.id));
      assert.equal(reopenedState.completed, false); assert.equal(reopenedState.order, null);
      // A retried webhook or old form submission cannot restore removed classes.
      await store.applyPayment(payment, "checkout.session.completed");
      assert.deepEqual((await store.organizerClasses(person.id)).classes, []);
      await assert.rejects(store.submit(person, draft, "reopen-original-01"), /Reload the form/);
      const replacement = { ...draft, classes: fiveClasses({ sessionId: "fri-1515-lot" }) };
      const next = await store.submit(participantAfter, replacement, "reopen-replacement-01");
      assert.equal(next.status, "confirmed"); assert.equal(next.total_cents, 0);
      assert.equal((await store.completedOrder(person.id)).id, next.id);
      assert.deepEqual((await store.organizerClasses(person.id)).classes, replacement.classes);
      await assert.rejects(store.reopenClasses(person.id, before.version), /changed in another session/);
      const [pendingPerson] = await sql`SELECT * FROM registrations_26 WHERE firstname = 'AdminPending'`;
      assert.equal((await store.organizerClasses(pendingPerson.id)).reopenable, false);
      await assert.rejects(store.reopenClasses(pendingPerson.id, ""), /pending checkout/);
    });
    await t.test("voucher registrations confirm choices and capacity once without a checkout", async () => {
      const person = await createPerson("Voucher");
      const draft = { ...empty(), classes: fiveClasses({ sessionId: "sun-1415-ankersaal" }), competitions: ["solo_battle"], lunch: ["saturday", "sunday"], voucher: "freepass26" };
      const confirmed = await store.submit(person, draft, "voucher-request-01");
      assert.equal(confirmed.status, "confirmed"); assert.equal(confirmed.total_cents, 0); assert.equal(confirmed.fee_cents, 0);
      assert.equal(confirmed.stripe_session_id, null); assert.equal(confirmed.draft.voucher, "freepass26");
      const [booking] = await sql`SELECT status FROM class_bookings_26 WHERE registration_id = ${person.id}`;
      assert.equal(booking.status, "confirmed");
      const [current] = await sql`SELECT competitions, lunch FROM registrations_26 WHERE id = ${person.id}`;
      assert.deepEqual(current, { competitions: "solo_battle", lunch: "saturday,sunday" });
      assert.equal((await store.submit(person, draft, "voucher-request-01")).id, confirmed.id);
      await assert.rejects(store.submit(person, draft, "voucher-new-key-01"), /contact the organizers/);
    });
    await t.test("organizers generate links from stored identities without changing registrations or sending emails", async () => {
      await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        VALUES ('2026','confirmed','advanced','partyPass','Duplicate','One','duplicate@example.com','Austria'),
          ('2026','confirmed','advanced','partyPass','Duplicate','Two','duplicate@example.com','Austria')`;
      require.cache[require.resolve("../db/reg2026")] = { loaded: true, exports: { registrationStore: store } };
      process.env.ADMIN_SESSION_SECRET = "test-admin-secret"; process.env.ADMIN_USER = "test-admin";
      const { setAdminSession } = require("../lib/admin/session");
      const { buildRegistrationPath, verifyIdentitySignature } = require("../lib/reg2026/security");
      const { resolveParticipant } = require("../lib/reg2026/access");
      const generate = require("../pages/api/reg2026/link").default;
      const response = () => ({ headers: {}, code: 200, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, end() { return this; } });
      const sessionResponse = response(); setAdminSession(sessionResponse);
      const headers = { cookie: sessionResponse.headers["Set-Cookie"].split(";")[0], host: "localhost:3000", origin: "http://localhost:3000" };
      const unauthorized = response(); await generate({ method: "POST", headers: {}, body: { id: participant.id } }, unauthorized);
      assert.equal(unauthorized.code, 401);
      const crossOrigin = response(); await generate({ method: "POST", headers: { ...headers, origin: "https://outside.example.com" }, body: { id: participant.id } }, crossOrigin);
      assert.equal(crossOrigin.code, 403);
      const wrongMethod = response(); await generate({ method: "GET", headers, query: { id: participant.id } }, wrongMethod);
      assert.equal(wrongMethod.code, 405); assert.equal(wrongMethod.headers.Allow, "POST");
      const malformed = response(); await generate({ method: "POST", headers, body: { id: "1 OR 1=1" } }, malformed);
      assert.equal(malformed.code, 422);
      const missing = response(); await generate({ method: "POST", headers, body: { id: 2147483647 } }, missing);
      assert.equal(missing.code, 404);
      const unconfirmed = await createPerson("LinkUnconfirmed");
      await sql`UPDATE registrations_26 SET status = 'waitinglist' WHERE id = ${unconfirmed.id}`;
      const ineligible = response(); await generate({ method: "POST", headers, body: { id: unconfirmed.id } }, ineligible);
      assert.equal(ineligible.code, 409);
      const [duplicate] = await sql`SELECT id FROM registrations_26 WHERE email = 'duplicate@example.com' LIMIT 1`;
      const ambiguous = response(); await generate({ method: "POST", headers, body: { id: duplicate.id } }, ambiguous);
      assert.equal(ambiguous.code, 409);
      const before = await sql`SELECT * FROM registrations_26 WHERE id = ${participant.id}`;
      const ordersBefore = await sql`SELECT * FROM reg2026_orders WHERE registration_id = ${participant.id}`;
      const emailsBefore = await sql`SELECT * FROM registration_email_retries_26 WHERE registration_id = ${participant.id}`;
      const generated = response(); await generate({ method: "POST", headers,
        body: { id: participant.id, firstname: "Forged", email: "forged@example.com" } }, generated);
      assert.equal(generated.code, 200); assert.equal(generated.headers["Cache-Control"], "private, no-store");
      assert.equal(generated.body.registrationUrl, process.env.REG2026_ORIGIN + buildRegistrationPath(participant));
      const url = new URL(generated.body.registrationUrl);
      assert.equal(url.searchParams.get("user"), "test+one@example.com+Test");
      assert.equal(verifyIdentitySignature(url.searchParams.get("user"), url.searchParams.get("sig")), true);
      assert.equal((await resolveParticipant(Object.fromEntries(url.searchParams), store)).id, participant.id);
      assert.deepEqual(await sql`SELECT * FROM registrations_26 WHERE id = ${participant.id}`, before);
      assert.deepEqual(await sql`SELECT * FROM reg2026_orders WHERE registration_id = ${participant.id}`, ordersBefore);
      assert.deepEqual(await sql`SELECT * FROM registration_email_retries_26 WHERE registration_id = ${participant.id}`, emailsBefore);

      // Classes saved by an organizer have no supplemental order record.
      const savedPerson = await createPerson("SavedClasses", "fullpass");
      await store.editClasses(savedPerson.id, free.classes, "");
      assert.equal(await store.completedOrder(savedPerson.id), undefined);
      const savedLink = response();
      await generate({ method: "POST", headers, body: { id: savedPerson.id } }, savedLink);
      assert.equal(savedLink.code, 200);
      const savedAccess = Object.fromEntries(new URL(savedLink.body.registrationUrl).searchParams);
      const { loadRegistrationState } = require("../lib/reg2026/state");
      const savedParticipant = await resolveParticipant(savedAccess, store);
      const savedState = await loadRegistrationState(store, savedParticipant);
      assert.equal(savedState.completed, true);
      assert.equal(savedState.order, null);
      const staleOrder = await loadRegistrationState(store, savedParticipant, "999999");
      assert.equal(staleOrder.completed, true);
      await assert.rejects(store.submit(savedPerson, empty(), "saved-classes-edit-02"), /contact the organizers/);
      assert.deepEqual((await store.organizerClasses(savedPerson.id)).classes, free.classes);
      const firstTimePerson = await createPerson("FirstTimeLink");
      const firstTimeLink = response();
      await generate({ method: "POST", headers, body: { id: firstTimePerson.id } }, firstTimeLink);
      const firstTimeParticipant = await resolveParticipant(Object.fromEntries(new URL(firstTimeLink.body.registrationUrl).searchParams), store);
      const firstTimeState = await loadRegistrationState(store, firstTimeParticipant);
      assert.equal(firstTimeState.completed, false);
    });
    await t.test("schedule editor persists overrides, updates registration metadata and protects booked sessions", async () => {
      const { scheduleFormValues } = require("../lib/reg2026/schedule");
      const { validateDraft } = require("../lib/reg2026/validation");
      const { setAdminSession } = require("../lib/admin/session");
      require.cache[require.resolve("../db/reg2026")] = { loaded: true, exports: { registrationStore: store } };
      const endpoint = require("../pages/api/reg2026/schedule").default;
      const response = () => ({ headers: {}, code: 200, setHeader(k,v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; }, end() { return this; } });
      const sessionResponse = response(); setAdminSession(sessionResponse);
      const headers = { cookie: sessionResponse.headers["Set-Cookie"].split(";")[0], host: "localhost:3000", origin: "http://localhost:3000" };
      const unauthenticated = response(); await endpoint({ method: "GET", headers: {} }, unauthenticated);
      assert.equal(unauthenticated.code, 401);
      const crossOrigin = response(); await endpoint({ method: "POST", headers: { ...headers, origin: "https://outside.example.com" }, body: {} }, crossOrigin);
      assert.equal(crossOrigin.code, 403);
      const loaded = response(); await endpoint({ method: "GET", headers }, loaded);
      const base = loaded.body.schedule.find((session) => session.id === "sun-1600-superar-2");
      assert.equal(base.version, 0);
      const invalid = response(); await endpoint({ method: "POST", headers, body: { id: base.id, version: 0,
        values: { ...scheduleFormValues(base), title: "", end: "10:00", totalCapacity: "-1" } } }, invalid);
      assert.equal(invalid.code, 422); assert.ok(invalid.body.errors.title); assert.ok(invalid.body.errors.end); assert.ok(invalid.body.errors.totalCapacity);
      const changed = { ...scheduleFormValues(base), title: "Late Blues Workshop", teachers: "Catherine & Guest",
        description: "Practice pulse, connection and musical choices.", room: "Main Studio", start: "15:45", end: "17:00",
        partnerClass: true, totalCapacity: "5" };
      const emailCount = (await sql`SELECT COUNT(*)::INT AS count FROM registration_email_retries_26`)[0].count;
      const saved = response(); await endpoint({ method: "POST", headers, body: { id: base.id, version: 0, values: changed } }, saved);
      assert.equal(saved.code, 200); assert.equal(saved.body.session.version, 1);
      assert.equal(saved.body.session.slotId, "sunday-1545");
      assert.equal(saved.body.session.title, changed.title); assert.equal(saved.body.session.partnerClass, true);
      assert.equal((await sql`SELECT COUNT(*)::INT AS count FROM registration_email_retries_26`)[0].count, emailCount);
      assert.equal((await sql`SELECT * FROM schedule_overrides_26`).length, 1);
      assert.equal((await sql`SELECT * FROM class_capacities_26`).length, 1);
      const reloaded = await store.schedule();
      assert.equal(reloaded.find((session) => session.id === base.id).description, changed.description);
      const person = await createPerson("ScheduleParticipant");
      const choice = { ...empty(), classes: fiveClasses({ sessionId: base.id, role: "lead" }) };
      assert.equal(validateDraft({ ...choice, classes: [{ sessionId: base.id }] }, person, reloaded).valid, false);
      const order = await store.submit(person, choice, "schedule-choice-01");
      const [confirmation] = await sql`SELECT payload FROM registration_email_retries_26 WHERE order_id = ${order.id}`;
      assert.deepEqual(confirmation.payload.data.classes.find((entry) => entry.title === changed.title), {
        title: changed.title, day: "Sunday", start: changed.start, end: changed.end,
        teachers: changed.teachers, room: changed.room, role: "Lead",
      });
      const availability = await store.availability();
      assert.equal(availability.classes[base.id].lead.remaining, 4); assert.equal(availability.classes[base.id].follow.remaining, 2);
      const organizerView = await store.organizerClasses(person.id);
      assert.equal(organizerView.schedule.find((session) => session.id === base.id).title, changed.title);
      await assert.rejects(store.editSchedule(base.id, changed, 0), /changed in another session/);
      await assert.rejects(store.editSchedule(base.id, { ...changed, partnerClass: false }, 1), /has registrations/);
      await assert.rejects(store.editSchedule(base.id, { ...changed, start: "16:00" }, 1), /has registrations/);
      const after = await store.editSchedule(base.id, { ...changed, description: "Updated workshop description.", totalCapacity: "0" }, 1);
      assert.equal(after.version, 2); assert.equal((await store.availability()).classes[base.id].lead.remaining, 0);
      assert.deepEqual((await store.organizerClasses(person.id)).classes, choice.classes);
      const [booking] = await sql`SELECT pool, status FROM class_bookings_26 WHERE registration_id = ${person.id} AND session_id = ${base.id}`;
      assert.deepEqual(booking, { pool: "lead", status: "confirmed" });
    });
    await t.test("HTTP endpoints enforce signed access, complete drafts and server-owned checkout", async () => {
      process.env.REG2026_ENABLED = "true";
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
      const [savedPerson] = await sql`SELECT * FROM registrations_26 WHERE firstname = 'SavedClasses'`;
      const savedUser = savedPerson.email + "+" + savedPerson.firstname;
      const savedAccess = { user: savedUser, sig: signIdentity(savedUser) };
      const savedState = res(); await load({ method: "GET", query: savedAccess }, savedState);
      assert.equal(savedState.code, 200); assert.equal(savedState.body.completed, true);
      assert.deepEqual(savedState.body.choices.classes, free.classes); assert.equal(savedState.body.order, null);
      const staleState = res(); await load({ method: "GET", query: { ...savedAccess, order: "999999" } }, staleState);
      assert.equal(staleState.body.completed, true);
      const savedEdit = res(); await submit({ method: "POST", body: { ...savedAccess, requestKey: "saved-classes-edit-01", draft: empty() } }, savedEdit);
      assert.equal(savedEdit.code, 409); assert.match(savedEdit.body.error, /contact the organizers/);
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
      const fullAccess = { user: fullUser, sig: signIdentity(fullUser) };
      const slots = new Set();
      const { conflictsWithSolo } = require("../lib/reg2026/competitions");
      const tooMany = require("../lib/reg2026/catalog").schedule
        .filter((session) => !conflictsWithSolo(session) && !slots.has(session.slotId) && slots.add(session.slotId)).slice(0, 6)
        .map((session) => ({ sessionId: session.id, ...(session.partnerClass ? { role: "lead" } : {}) }));
      const overLimit = res();
      await submit({ method: "POST", body: { ...fullAccess,
        requestKey: "http-class-limit-01", draft: { ...empty(), classes: tooMany } } }, overLimit);
      assert.equal(overLimit.code, 422);
      assert.match(overLimit.body.errors.classes, /5 classes in total/);
      for (const count of [0, 4]) {
        const underLimit = res();
        await submit({ method: "POST", body: { ...fullAccess, requestKey: `http-class-minimum-${count}`,
          draft: { ...empty(), classes: tooMany.slice(0, count), lunch: ["saturday"] } } }, underLimit);
        assert.equal(underLimit.code, 422);
        assert.equal(underLimit.body.errors.classes, "Choose your 5 classes before submitting.");
      }
      assert.equal(await store.activeOrder(fullPass.id), undefined);
      assert.equal((await sql`SELECT id FROM class_bookings_26 WHERE registration_id = ${fullPass.id}`).length, 0);
      const closed = res(); process.env.REG2026_ENABLED = "false";
      await submit({ method: "POST", body: { ...access, requestKey: "http-closed-0001", draft: empty() } }, closed);
      assert.equal(closed.code, 403); process.env.REG2026_ENABLED = "true";
      const fiveClasses = tooMany.slice(0, 5);
      const invalidVoucher = res(); await submit({ method: "POST", body: { ...fullAccess, requestKey: "http-bad-voucher-01",
        draft: { ...empty(), classes: fiveClasses, voucher: "invalid", lunch: ["saturday"] }, price: 0 } }, invalidVoucher);
      assert.equal(invalidVoucher.code, 422); assert.match(invalidVoucher.body.errors.voucher, /not recognized/);
      assert.equal(await store.completedOrder(fullPass.id), undefined);
      const voucher = res(); await submit({ method: "POST", body: { ...fullAccess, requestKey: "http-free-voucher-01",
        draft: { ...empty(), classes: fiveClasses, competitions: ["solo_battle"], lunch: ["saturday", "sunday"], voucher: "freepass26" } } }, voucher);
      assert.equal(voucher.code, 200); assert.equal(voucher.body.order.status, "confirmed");
      assert.equal(voucher.body.order.totalCents, 0); assert.equal(voucher.body.checkoutUrl, null); assert.equal(sessions.size, 0);
      assert.equal((await sql`SELECT id FROM class_bookings_26 WHERE registration_id = ${fullPass.id} AND status = 'confirmed'`).length, 5);
      assert.equal(emailSends.length, 1);
      assert.equal(emailSends[0].template_id, "d-4f77d740ec504650aa9ea1a78e785cae");
      assert.deepEqual(emailSends[0].dynamic_template_data.competitions, [{ label: "Solo Battle", role: "" }]);
      assert.deepEqual(emailSends[0].dynamic_template_data.lunch, ["Saturday", "Sunday"]);
      const paid = res(); await submit({ method: "POST", body: { ...access, requestKey: "http-payment-001", draft: { ...empty(), lunch: ["saturday"] }, price: 1 } }, paid);
      assert.equal(paid.code, 200); assert.equal(paid.body.order.totalCents, 1547);
      assert.equal(paid.body.checkoutUrl, "https://checkout.example.com/http");
      const unfinished = res(); await load({ method: "GET", query: access }, unfinished);
      assert.equal(unfinished.body.completed, false);
      assert.equal(unfinished.body.order.status, "provisional");
      assert.deepEqual(unfinished.body.pendingDraft.lunch, ["saturday"]);
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
      assert.equal(emailSends.length, 2);
      assert.equal(emailSends[1].to, person.email);
      assert.deepEqual(emailSends[1].dynamic_template_data.classes, []);
      assert.deepEqual(emailSends[1].dynamic_template_data.lunch, ["Saturday"]);
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
    await t.test("failed confirmation delivery leaves the order confirmed and can retry once", async () => {
      const person = await createPerson("EmailRetry", "partyPass");
      const order = await store.submit(person, empty(), "email-retry-0001");
      const { deliverConfirmation } = require("../lib/reg2026/confirmations");
      failNextEmail = true;
      assert.equal(await deliverConfirmation(store, order.id), "failed");
      assert.equal((await store.completedOrder(person.id)).id, order.id);
      assert.deepEqual((await sql`SELECT delivery_status, attempts FROM registration_email_retries_26 WHERE order_id = ${order.id}`)[0],
        { delivery_status: "failed", attempts: 1 });
      assert.equal(await deliverConfirmation(store, order.id), "sent");
      assert.equal(await deliverConfirmation(store, order.id), "already_sent");
      assert.deepEqual((await sql`SELECT delivery_status, attempts FROM registration_email_retries_26 WHERE order_id = ${order.id}`)[0],
        { delivery_status: "sent", attempts: 2 });
    });
    await t.test("uncertain transport delivery is held instead of automatically duplicated", async () => {
      const person = await createPerson("EmailUncertain", "partyPass");
      const order = await store.submit(person, empty(), "email-uncertain-01");
      const { deliverConfirmation } = require("../lib/reg2026/confirmations");
      const timeout = async () => { throw new Error("Fictional network timeout"); };
      assert.equal(await deliverConfirmation(store, order.id, timeout), "uncertain");
      assert.equal(await deliverConfirmation(store, order.id), "sending");
      assert.deepEqual((await sql`SELECT delivery_status, attempts FROM registration_email_retries_26 WHERE order_id = ${order.id}`)[0],
        { delivery_status: "sending", attempts: 1 });
      assert.equal((await store.completedOrder(person.id)).id, order.id);
    });
    await t.test("local preview captures confirmation data without calling SendGrid", async () => {
      const previousPreview = process.env.BFF_PREVIEW;
      process.env.BFF_PREVIEW = "true";
      try {
        const person = await createPerson("EmailPreview", "partyPass");
        const order = await store.submit(person, empty(), "email-preview-0001");
        const { deliverConfirmation } = require("../lib/reg2026/confirmations");
        const { previewConfirmations } = require("../lib/reg2026/preview-invitation-mailbox");
        assert.equal(await deliverConfirmation(store, order.id), "sent");
        assert.equal(emailSends.length, 3);
        assert.deepEqual(previewConfirmations().at(-1), {
          to: person.email, templateId: "d-4f77d740ec504650aa9ea1a78e785cae",
          firstname: person.firstname, classes: [], competitions: [], lunch: [],
        });
      } finally {
        if (previousPreview === undefined) delete process.env.BFF_PREVIEW;
        else process.env.BFF_PREVIEW = previousPreview;
      }
    });
    await t.test("confirmed orders queue once and preserve historical delivery records", async () => {
      assert.equal(emailSends.length, 3);
      assert.deepEqual(await sql`SELECT * FROM registration_email_retries_26 WHERE id = ${historicalDeliveries[0].id}`, historicalDeliveries);
    });
    await t.test("confirmed Full, Parent, and Party Pass holders can edit eligible choices through November 20 in Vienna", async () => {
      const now = Date.now;
      const previousEnabled = process.env.REG2026_ENABLED;
      const previousClose = process.env.REG2026_CLOSES_AT;
      process.env.REG2026_ENABLED = "true";
      process.env.REG2026_CLOSES_AT = "2026-11-19T23:00:00+01:00";
      Date.now = () => Date.parse("2026-11-20T23:59:59+01:00");
      const { loadRegistrationState } = require("../lib/reg2026/state");
      const { signIdentity } = require("../lib/reg2026/security");
      const submit = require("../pages/api/reg2026/submit").default;
      const load = require("../pages/api/reg2026/index").default;
      const res = () => ({ code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(body) { this.body = body; return this; } });
      const signed = (person) => {
        const user = person.email + "+" + person.firstname;
        return { user, sig: signIdentity(user) };
      };
      const state = async (person) => {
        const response = res(); await load({ method: "GET", query: signed(person) }, response);
        assert.equal(response.code, 200);
        return response.body;
      };
      const save = async (person, requestKey, editVersion, draft) => {
        const response = res(); await submit({ method: "POST", body: { ...signed(person), requestKey, editVersion, draft } }, response);
        return response;
      };
      try {
        const full = await createPerson("EditFull", "fullpass");
        const slots = new Set();
        const classes = (await store.schedule()).filter((s) => !slots.has(s.slotId) && slots.add(s.slotId)).slice(0, 5)
          .map((s) => ({ sessionId: s.id, ...(s.partnerClass ? { role: "lead" } : {}) }));
        const fullDraft = { ...empty(), classes, lunch: ["saturday"] };
        const initialFull = await store.submit(full, { ...fullDraft, voucher: "freepass26" }, "before-full-edit-01");
        const initialState = await state(full);
        assert.equal(initialState.completed, true);
        assert.equal(initialState.open, true);
        assert.equal(initialState.edit.closesAt, Date.parse("2026-11-20T23:00:00Z"));
        const replacement = [{ sessionId: "fri-1330-lot", role: "lead" }, ...classes.slice(1)];
        const update = { ...fullDraft, classes: replacement };
        assert.equal((await save(full, "edit-full-short-01", initialState.edit.version, { ...update, classes: replacement.slice(1) })).body.errors.classes,
          "Choose your 5 classes before submitting.");
        const replaced = await save(full, "edit-full-classes-01", initialState.edit.version, update);
        assert.equal(replaced.code, 200);
        assert.equal(replaced.body.order.totalCents, 0);
        assert.equal((await save(full, "edit-full-classes-01", initialState.edit.version, update)).body.order.id, replaced.body.order.id);
        assert.equal((await save(full, "edit-full-stale-01", initialState.edit.version, fullDraft)).code, 409);
        assert.equal((await store.order(initialFull.id, full.id)).status, "confirmed");
        assert.deepEqual((await state(full)).choices.classes, replacement);
        assert.equal((await sql`SELECT count(*)::int AS count FROM class_bookings_26 WHERE registration_id = ${full.id} AND session_id = ${classes[0].sessionId}`)[0].count, 0);
        const roleChange = { ...update, classes: [{ ...replacement[0], role: "follow" }, ...replacement.slice(1)],
          competitions: ["strictly"], competitionRoles: { strictly: "lead" } };
        const beforeHold = (await store.availability()).classes[replacement[0].sessionId];
        const tentative = await store.submit(full, roleChange, "edit-full-pending-01", (await state(full)).edit.version);
        await store.attachSession(tentative.id, "cs_edit_full");
        const hold = { id: "cs_edit_full", currency: "eur", amount_total: tentative.total_cents,
          client_reference_id: String(full.id), metadata: { reg2026OrderId: String(tentative.id) }, status: "complete", payment_status: "unpaid" };
        await store.applyPayment(hold, "checkout.session.completed");
        const duringHold = (await store.availability()).classes[replacement[0].sessionId];
        assert.equal(duringHold.total.remaining, beforeHold.total.remaining);
        assert.equal(duringHold.follow.remaining, beforeHold.follow.remaining - 1);
        await store.applyPayment(hold, "checkout.session.async_payment_failed");
        assert.deepEqual((await state(full)).choices.classes, replacement);
        assert.deepEqual((await store.availability()).classes[replacement[0].sessionId], beforeHold);

        const party = await createPerson("EditParty", "partyPass");
        const partyDraft = { ...empty(), lunch: ["saturday"], competitions: ["strictly"], competitionRoles: { strictly: "lead" } };
        const prior = await store.submit(party, { ...partyDraft, voucher: "freepass26" }, "before-party-edit-01");
        const partyVersion = (await state(party)).edit.version;
        for (const [key, field, change] of [
          ["lunch-add", "lunch", { lunch: ["saturday", "sunday"] }],
          ["lunch-remove", "lunch", { lunch: [] }],
          ["comp-remove", "competitions", { competitions: [] }],
          ["role-change", "competitions", { competitionRoles: { strictly: "follow" } }],
          ["class-add", "classes", { classes: [classes[0]] }],
        ]) {
          const response = await save(party, `edit-party-${key}`, partyVersion, { ...partyDraft, ...change });
          assert.equal(response.code, 422);
          assert.ok(response.body.errors[field]);
        }
        const addComp = { ...partyDraft, competitions: ["strictly", "open_mixnmatch"], competitionRoles: { strictly: "lead", open_mixnmatch: "follow" } };
        const newOrder = await store.submit(party, addComp, "edit-party-add-paid-01", partyVersion);
        assert.equal(newOrder.status, "provisional");
        assert.equal(newOrder.subtotal_cents, 1000);
        assert.equal((await store.completedOrder(party.id)).id, prior.id);
        assert.equal((await loadRegistrationState(store, party)).order.id, newOrder.id);
        assert.equal((await loadRegistrationState(store, party)).edit, null);
        await store.attachSession(newOrder.id, "cs_edit_party");
        const payment = { id: "cs_edit_party", currency: "eur", amount_total: newOrder.total_cents,
          client_reference_id: String(party.id), metadata: { reg2026OrderId: String(newOrder.id) }, status: "complete", payment_status: "paid" };

        const parent = await createPerson("EditParent", "parentPass");
        const partialParent = { ...empty(), classes: classes.slice(0, 4) };
        await assert.rejects(store.submit(parent, partialParent, "parent-first-too-short"), (error) =>
          error.status === 422 && error.errors.classes === "Choose your 5 classes before submitting.");
        await store.editClasses(parent.id, partialParent.classes, "");
        const parentState = await state(parent);
        assert.equal(parentState.open, true);
        assert.equal(parentState.edit.closesAt, initialState.edit.closesAt);
        const parentEdit = { ...empty(), classes: replacement, competitions: ["fever_showcase"], voucher: "freepass26" };
        assert.equal((await save(parent, "edit-parent-choices-01", parentState.edit.version, parentEdit)).code, 200);
        const editedParent = await state(parent);
        assert.deepEqual(editedParent.choices.classes, replacement);
        assert.deepEqual(editedParent.choices.competitions, parentEdit.competitions);
        const fullVersion = (await state(full)).edit.version;
        Date.now = () => Date.parse("2026-11-21T00:00:00+01:00");
        assert.equal((await state(full)).edit, null);
        assert.equal((await save(full, "edit-full-after-close", fullVersion, fullDraft)).code, 409);
        assert.equal((await state(parent)).edit, null);
        assert.equal((await save(parent, "edit-parent-after-close", editedParent.edit.version, parentEdit)).code, 409);
        await store.applyPayment(payment, "checkout.session.completed");
        await store.applyPayment(payment, "checkout.session.completed");
        const final = await state(party);
        assert.equal(final.order.id, String(newOrder.id));
        assert.equal(final.edit, null);
        assert.deepEqual(final.choices.competitions, addComp.competitions);
        assert.deepEqual(final.choices.lunch, partyDraft.lunch);
        assert.equal(final.choices.competitionRoles.strictly, "lead");
      } finally {
        Date.now = now;
        if (previousEnabled === undefined) delete process.env.REG2026_ENABLED;
        else process.env.REG2026_ENABLED = previousEnabled;
        if (previousClose === undefined) delete process.env.REG2026_CLOSES_AT;
        else process.env.REG2026_CLOSES_AT = previousClose;
      }
    });
  } finally {
    sgMail.send = originalSend;
    if (originalSendGridKey === undefined) delete process.env.SENDGRID_API_KEY;
    else process.env.SENDGRID_API_KEY = originalSendGridKey;
    await sql.end();
  }
});
