const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { choicesFromParticipant, serializeThemeClass } = require("../lib/reg2026/serialization");

const sessionId = "fri-1330-kantine";
const draft = (role) => ({ classes: [{ sessionId, role }], competitions: [], competitionRoles: {}, lunch: [] });

test("partner roles share capacity and serialize competing bookings on isolated Postgres", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const admin = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  const schema = "partner_capacity_tests";
  await admin`CREATE SCHEMA ${admin(schema)}`;
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {}, connection: { search_path: schema } });
  const previousSheet = process.env.REG2026_SCHEDULE_SHEET_ID;
  delete process.env.REG2026_SCHEDULE_SHEET_ID;
  try {
    for (const file of ["00004-CREAT-registraion-2026", "00006-create-class-capacities-2026", "00007-create-reg2026-bookings", "00008-reg2026-order-safety", "00009-create-schedule-overrides-2026", "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule", "00015-reg2026-switch-role"]) {
      await sql.begin((tx) => require(`../migrations/${file}`).up(tx));
    }
    const store = createRegistrationStore(sql);
    let number = 0;
    const person = async () => {
      const name = `Capacity${++number}`;
      return (await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        VALUES ('2026','confirmed','advanced','fullpass',${name},'Dancer',${name + "@example.com"},'Austria') RETURNING *`)[0];
    };
    const seed = async (count, role, status = "confirmed", expiresAt = null) => {
      for (let i = 0; i < count; i += 1) {
        const attendee = await person();
        await sql`INSERT INTO class_bookings_26 (registration_id,session_id,pool,status,expires_at)
          VALUES (${attendee.id},${sessionId},${role},${status},${expiresAt})`;
      }
    };
    const reset = () => sql`TRUNCATE registrations_26, class_bookings_26, reg2026_orders, registration_email_retries_26 RESTART IDENTITY CASCADE`;
    const places = async () => (await store.availability()).classes[sessionId];

    await t.test("the 20th follower succeeds, the 21st is rejected, and Switch persists in choices and confirmation", async () => {
      await seed(19, "follow");
      const follower = await person();
      await store.submit(follower, draft("follow"), "capacity-follower-20");
      assert.equal((await places()).follow.remaining, 0);
      assert.equal((await places()).lead.remaining, 20);
      assert.equal((await places()).switch.remaining, 20);
      const extra = await person();
      await assert.rejects(store.submit(extra, draft("follow"), "capacity-follower-21"), (error) => error.status === 409);
      const order = await store.submit(extra, draft("switch"), "capacity-switch-21");
      assert.equal((await places()).total.remaining, 19);
      const [saved] = await sql`SELECT theme_class FROM registrations_26 WHERE id = ${extra.id}`;
      assert.deepEqual(choicesFromParticipant(saved).classes, draft("switch").classes);
      const [confirmation] = await sql`SELECT payload FROM registration_email_retries_26 WHERE order_id = ${order.id}`;
      assert.equal(confirmation.payload.data.classes[0].role, "Switch");
      const [booking] = await sql`SELECT pool FROM class_bookings_26 WHERE registration_id = ${extra.id}`;
      assert.equal(booking.pool, "switch");
      await store.editClasses(extra.id, draft("lead").classes, saved.theme_class);
      assert.equal((await places()).total.remaining, 19, "Changing role keeps the participant's existing place");
      await reset();
    });

    await t.test("all roles close at 40, including when the class has no followers", async () => {
      await seed(30, "lead");
      await seed(10, "switch");
      const availability = await places();
      for (const role of ["total", "lead", "follow", "switch"]) assert.equal(availability[role].remaining, 0);
      const extra = await person();
      for (const role of ["lead", "follow", "switch"]) {
        await assert.rejects(store.submit(extra, draft(role), `capacity-full-${role}`), (error) => error.status === 409);
        await assert.rejects(store.editClasses(extra.id, draft(role).classes, ""), (error) => error.status === 409);
      }
      await reset();
    });

    await t.test("active holds count in both limits, expired holds do not, and the participant's own place is excluded", async () => {
      await seed(18, "follow");
      await seed(1, "follow", "provisional", new Date(Date.now() + 60000));
      await seed(1, "follow", "provisional");
      await seed(5, "follow", "provisional", new Date(Date.now() - 60000));
      await seed(3, "switch", "provisional", new Date(Date.now() + 60000));
      assert.equal((await places()).follow.remaining, 0);
      assert.equal((await places()).total.remaining, 17);
      const [existing] = await sql`SELECT registration_id FROM class_bookings_26 WHERE pool = 'follow' AND status = 'confirmed' LIMIT 1`;
      const own = (await store.availability(existing.registration_id)).classes[sessionId];
      assert.equal(own.follow.remaining, 1);
      assert.equal(own.total.remaining, 18);
      await reset();
    });

    await t.test("simultaneous Lead and Switch submissions cannot both take the final total place", async () => {
      await seed(39, "lead");
      const people = [await person(), await person()];
      const results = await Promise.allSettled(people.map((attendee, i) => store.submit(attendee, draft(i ? "switch" : "lead"), `capacity-race-${i}`)));
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.find((result) => result.status === "rejected").reason.status, 409);
      assert.equal((await places()).total.remaining, 0);
      assert.equal((await sql`SELECT id FROM class_bookings_26`).length, 40);
      await reset();
    });

    await t.test("a simultaneous organizer save and participant submission cannot both take the 20th follower place", async () => {
      await seed(19, "follow");
      const people = [await person(), await person()];
      const results = await Promise.allSettled([
        store.submit(people[0], draft("follow"), "capacity-follow-race"),
        store.editClasses(people[1].id, draft("follow").classes, ""),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.find((result) => result.status === "rejected").reason.status, 409);
      assert.equal((await places()).follow.remaining, 0);
      assert.equal((await places()).total.remaining, 20);
      await reset();
    });

    await t.test("existing over-limit bookings stay editable and replacing a follower with Switch reopens Follow", async () => {
      const attendee = await person();
      const saved = serializeThemeClass(draft("follow").classes);
      await sql`UPDATE registrations_26 SET theme_class = ${saved} WHERE id = ${attendee.id}`;
      await sql`INSERT INTO class_bookings_26 (registration_id,session_id,pool,status) VALUES (${attendee.id},${sessionId},'follow','confirmed')`;
      await seed(19, "follow");
      await seed(20, "lead");
      const unchanged = await store.editClasses(attendee.id, draft("follow").classes, saved);
      const changed = await store.editClasses(attendee.id, draft("switch").classes, unchanged.version);
      assert.deepEqual(changed.classes, draft("switch").classes);
      assert.equal((await places()).total.remaining, 0);
      await sql`DELETE FROM class_bookings_26 WHERE registration_id = ${attendee.id}`;
      assert.equal((await places()).follow.remaining, 1);
      assert.equal((await places()).total.remaining, 1);
    });
  } finally {
    if (previousSheet === undefined) delete process.env.REG2026_SCHEDULE_SHEET_ID;
    else process.env.REG2026_SCHEDULE_SHEET_ID = previousSheet;
    await sql.end({ timeout: 2 });
    await admin`DROP SCHEMA ${admin(schema)} CASCADE`;
    await admin.end({ timeout: 2 });
  }
});
