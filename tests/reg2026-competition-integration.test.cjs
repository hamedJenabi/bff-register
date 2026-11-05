const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { competitions } = require("../lib/reg2026/catalog");

const draft = (id, role, free = true) => ({
  classes: [], competitions: [id], competitionRoles: role ? { [id]: role } : {}, lunch: [],
  ...(free ? { voucher: "freepass26" } : {}),
});

test("competition limits and reservations on isolated Postgres", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const admin = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  const schema = "competition_capacity_tests";
  await admin`CREATE SCHEMA ${admin(schema)}`;
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {}, connection: { search_path: schema } });
  const previousSheet = process.env.REG2026_SCHEDULE_SHEET_ID;
  delete process.env.REG2026_SCHEDULE_SHEET_ID;
  try {
    for (const file of ["00004-CREAT-registraion-2026", "00006-create-class-capacities-2026", "00007-create-reg2026-bookings", "00008-reg2026-order-safety", "00009-create-schedule-overrides-2026", "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule", "00015-reg2026-switch-role", "00016-reg2026-competition-capacities"]) {
      await sql.begin((tx) => require(`../migrations/${file}`).up(tx));
    }
    const store = createRegistrationStore(sql);
    let number = 0;
    const seed = (count, id = "", role = "") => sql`INSERT INTO registrations_26
      (date,status,role,ticket,firstname,lastname,email,country,competitions,open_mixnmatch_role,newcomers_mixnmatch_role,strictly_role)
      SELECT '2026','confirmed','advanced','fullpass',${`Competition${++number}`},'Dancer','fixture@example.com','Austria',${id},
        ${id === "open_mixnmatch" ? role : ""},${id === "newcomers_mixnmatch" ? role : ""},${id === "strictly" ? role : ""}
      FROM generate_series(1, ${count}) RETURNING *`;
    const person = async () => (await seed(1))[0];
    const reset = () => sql`TRUNCATE registrations_26, class_bookings_26, reg2026_orders, registration_email_retries_26, competition_capacities_26 RESTART IDENTITY CASCADE`;
    const places = async (id, pool) => (await store.availability()).competitions[id][pool];
    const checkout = (attendee, order, status, paymentStatus) => ({
      id: `cs_competition_${order.id}`, currency: "eur", amount_total: order.total_cents,
      client_reference_id: String(attendee.id), metadata: { reg2026OrderId: String(order.id) },
      status, payment_status: paymentStatus,
    });

    for (const competition of competitions.filter((entry) => entry.capacity)) {
      for (const [pool, capacity] of Object.entries(competition.capacity)) {
        await t.test(`${competition.label} ${pool}: accepts place ${capacity}, rejects the next and serializes the final place`, async () => {
          const role = pool === "total" ? undefined : pool;
          await seed(capacity - 1, competition.id, role);
          const entrants = [await person(), await person()];
          const results = await Promise.allSettled(entrants.map((attendee, i) => store.submit(
            attendee, draft(competition.id, role), `competition-last-${i}`,
          )));
          assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
          assert.equal(results.find((result) => result.status === "rejected").reason.status, 409);
          assert.match(results.find((result) => result.status === "rejected").reason.message, /sold out/);
          assert.equal((await places(competition.id, pool)).remaining, 0);
          if (competition.roleRequired) {
            const otherRole = pool === "lead" ? "follow" : "lead";
            assert.equal((await places(competition.id, otherRole)).remaining, capacity);
            await store.submit(await person(), draft(competition.id, otherRole), "competition-other-role");
            assert.equal((await places(competition.id, otherRole)).remaining, capacity - 1);
          }
          const winner = entrants[results.findIndex((result) => result.status === "fulfilled")];
          assert.equal((await store.availability(winner.id)).competitions[competition.id][pool].remaining, 1);
          const [existing] = await seed(2, competition.id, role);
          await store.submit(existing, draft(competition.id, role), "competition-existing");
          assert.equal((await places(competition.id, pool)).remaining, 0, "Existing entries are retained above the new limit");
          await reset();
        });
      }
    }

    await t.test("checkout holds count once, exclude their owner, release on expiry/failure and persist while payment is pending", async () => {
      await seed(29, "solo_battle");
      const attendee = await person();
      const order = await store.submit(attendee, draft("solo_battle", undefined, false), "competition-paid-hold");
      assert.equal((await places("solo_battle", "total")).remaining, 0);
      assert.deepEqual((await store.competitionInventory()).solo_battle.total, { capacity: 30, remaining: 0, registered: 29, held: 1, version: 0 });
      assert.equal((await store.availability(attendee.id)).competitions.solo_battle.total.remaining, 1);
      await sql`UPDATE reg2026_orders SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = ${order.id}`;
      assert.equal((await places("solo_battle", "total")).remaining, 1);
      assert.equal((await store.competitionInventory()).solo_battle.total.held, 0);
      await sql`UPDATE reg2026_orders SET status = 'payment_pending', expires_at = NULL WHERE id = ${order.id}`;
      assert.equal((await places("solo_battle", "total")).remaining, 0);
      await store.attachSession(order.id, `cs_competition_${order.id}`);
      await store.applyPayment(checkout(attendee, order, "complete", "unpaid"), "checkout.session.async_payment_failed");
      assert.equal((await places("solo_battle", "total")).remaining, 1);
      const retry = await store.submit(attendee, draft("solo_battle", undefined, false), "competition-paid-retry");
      await store.attachSession(retry.id, `cs_competition_${retry.id}`);
      await store.applyPayment(checkout(attendee, retry, "complete", "paid"), "checkout.session.completed");
      assert.equal((await places("solo_battle", "total")).remaining, 0, "Confirmed choices and their order consume a single place");
      await store.reopenClasses(attendee.id, (await sql`SELECT theme_class FROM registrations_26 WHERE id = ${attendee.id}`)[0].theme_class);
      const secondOrder = await store.submit(attendee, { ...draft("solo_battle", undefined, false), lunch: ["saturday"] }, "competition-paid-lunch");
      assert.equal(secondOrder.status, "provisional");
      assert.equal((await places("solo_battle", "total")).remaining, 0, "Saved choices and an active add-on order consume a single place");
      assert.deepEqual((await store.competitionInventory()).solo_battle.total, { capacity: 30, remaining: 0, registered: 30, held: 0, version: 0 });
      await reset();
    });

    await t.test("role-specific checkout holds block only that role and release when cancelled", async () => {
      for (const id of ["newcomers_mixnmatch", "open_mixnmatch", "strictly"]) {
        const competition = competitions.find((entry) => entry.id === id);
        for (const role of ["lead", "follow"]) {
          const capacity = competition.capacity[role];
          await seed(capacity - 1, id, role);
          const attendee = await person();
          const order = await store.submit(attendee, draft(id, role, false), `competition-${id}-${role}`);
          assert.equal((await places(id, role)).remaining, 0);
          await assert.rejects(store.submit(await person(), draft(id, role), "competition-over-hold"), (error) => error.status === 409);
          assert.equal((await places(id, role === "lead" ? "follow" : "lead")).remaining, capacity);
          await store.attachSession(order.id, `cs_competition_${order.id}`);
          await store.applyPayment(checkout(attendee, order, "expired", "unpaid"), "checkout.session.expired");
          assert.equal((await places(id, role)).remaining, 1);
          await reset();
        }
      }
    });

    await t.test("Showcase stays open and unconfirmed festival registrations do not consume competition places", async () => {
      await seed(50, "fever_showcase");
      assert.equal((await places("fever_showcase", "total")).unlimited, true);
      await store.submit(await person(), draft("fever_showcase"), "competition-showcase");
      assert.deepEqual((await store.competitionInventory()).fever_showcase.total, { capacity: null, remaining: null, unlimited: true, registered: 51, held: 0, version: 0 });
      await seed(30, "solo_battle");
      await sql`UPDATE registrations_26 SET status = 'waitinglist' WHERE competitions = 'solo_battle'`;
      assert.equal((await places("solo_battle", "total")).remaining, 30);
      assert.equal((await store.competitionInventory()).solo_battle.total.registered, 0);
      await reset();
    });

    await t.test("organizer edits immediately enforce independent limits and preserve existing entries when reduced", async () => {
      assert.deepEqual(await store.editCompetitionCapacity({ id: "open_mixnmatch", pool: "lead", capacity: 40, version: 0 }), { unchanged: true });
      assert.equal((await sql`SELECT * FROM competition_capacities_26`).length, 0);
      await store.editCompetitionCapacity({ id: "open_mixnmatch", pool: "lead", capacity: "2", version: 0 });
      await seed(1, "open_mixnmatch", "lead");
      await store.submit(await person(), draft("open_mixnmatch", "lead"), "competition-edited-limit");
      await assert.rejects(store.submit(await person(), draft("open_mixnmatch", "lead"), "competition-edited-full"), (error) => error.status === 409);
      let inventory = (await store.competitionInventory()).open_mixnmatch;
      assert.deepEqual(inventory.lead, { capacity: 2, remaining: 0, registered: 2, held: 0, version: 1 });
      assert.deepEqual(inventory.follow, { capacity: 40, remaining: 40, registered: 0, held: 0, version: 0 });
      await store.editCompetitionCapacity({ id: "open_mixnmatch", pool: "lead", capacity: 1, version: 1 });
      inventory = (await store.competitionInventory()).open_mixnmatch;
      assert.equal(inventory.lead.registered, 2);
      assert.equal(inventory.lead.remaining, 0);
      await store.editCompetitionCapacity({ id: "open_mixnmatch", pool: "lead", capacity: 3, version: 2 });
      assert.equal((await places("open_mixnmatch", "lead")).remaining, 1);
      await store.editCompetitionCapacity({ id: "open_mixnmatch", pool: "follow", capacity: 0, version: 0 });
      assert.equal((await places("open_mixnmatch", "follow")).remaining, 0);
      await assert.rejects(store.submit(await person(), draft("open_mixnmatch", "follow"), "competition-zero-limit"), (error) => error.status === 409);
      await reset();
    });

    await t.test("concurrent capacity edits reject stale versions, including after restoring the default", async () => {
      const changes = await Promise.allSettled([20, 25].map((capacity) => store.editCompetitionCapacity({ id: "solo_battle", pool: "total", capacity, version: 0 })));
      assert.equal(changes.filter((change) => change.status === "fulfilled").length, 1);
      assert.equal(changes.find((change) => change.status === "rejected").reason.status, 409);
      await store.editCompetitionCapacity({ id: "solo_battle", pool: "total", capacity: 30, version: 1 });
      await assert.rejects(store.editCompetitionCapacity({ id: "solo_battle", pool: "total", capacity: 29, version: 0 }), (error) => error.status === 409);
      assert.equal((await store.competitionInventory()).solo_battle.total.version, 2);
      await reset();
    });

    await t.test("invalid edits are rejected without changing limits", async () => {
      const valid = { id: "strictly", pool: "lead", capacity: 20, version: 0 };
      for (const capacity of [-1, 1.5, 1001, "", "2x", null, true, {}, []]) {
        await assert.rejects(store.editCompetitionCapacity({ ...valid, capacity }), (error) => error.status === 422);
      }
      for (const pool of ["switch", "total", "__proto__"]) {
        await assert.rejects(store.editCompetitionCapacity({ ...valid, pool }), (error) => error.status === 422);
      }
      for (const version of [-1, "0", null, 0.5]) {
        await assert.rejects(store.editCompetitionCapacity({ ...valid, version }), (error) => error.status === 422);
      }
      await assert.rejects(store.editCompetitionCapacity({ ...valid, id: "missing" }), (error) => error.status === 404);
      await assert.rejects(store.editCompetitionCapacity({ ...valid, id: "fever_showcase", pool: "total" }), (error) => error.status === 422);
      assert.equal((await sql`SELECT * FROM competition_capacities_26`).length, 0);
      assert.equal((await places("strictly", "lead")).capacity, 24);
    });

    await t.test("Solo time conflicts are rejected for participant submissions and organizer class edits", async () => {
      const attendee = await person();
      const conflict = { sessionId: "sat-1600-superar-1", role: "lead" };
      await assert.rejects(store.submit(attendee, { ...draft("solo_battle"), classes: [conflict] }, "competition-solo-conflict"), (error) =>
        error.status === 422 && /Cuttin'/.test(error.errors.classes));
      await sql`UPDATE registrations_26 SET competitions = 'solo_battle' WHERE id = ${attendee.id}`;
      await assert.rejects(store.editClasses(attendee.id, [conflict], ""), (error) =>
        error.status === 422 && /Cuttin'/.test(error.errors.classes));
      await store.submit(attendee, { ...draft("solo_battle"), classes: [{ sessionId: "sun-1600-hilger", role: "lead" }] }, "competition-solo-other-day");
    });
  } finally {
    if (previousSheet === undefined) delete process.env.REG2026_SCHEDULE_SHEET_ID;
    else process.env.REG2026_SCHEDULE_SHEET_ID = previousSheet;
    await sql.end({ timeout: 2 });
    await admin`DROP SCHEMA ${admin(schema)} CASCADE`;
    await admin.end({ timeout: 2 });
  }
});
