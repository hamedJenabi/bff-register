const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { SHEET_COLUMNS, parseScheduleRows } = require("../lib/reg2026/sheet-schema");
const { serializeThemeClass } = require("../lib/reg2026/serialization");

const sheetId = "1testScheduleWorkbook_01234567890123456789";
const empty = () => ({ classes: [], competitions: [], competitionRoles: {}, lunch: [] });
const source = (sessions) => ({ sessions, spreadsheetId: sheetId, sheetName: "APP_SCHEDULE", sourceHash: createHash("sha256").update(JSON.stringify(sessions)).digest("hex") });
const sessionRows = () => [
  SHEET_COLUMNS,
  ["sheet-session-a", "Friday", "", "13:30", "14:45", "Ankersaal", "Sheet solo class", "Teacher One", "A reviewed description.", "II–III", "solo", "", "", 30, true],
  ["sheet-session-b", "Friday", "", "15:15", "16:30", "Kantine", "Sheet partner class", "Teachers Two", "A partner description.", "All levels", "partner", 20, 20, "", true],
];

test("sheet schedules publish atomically and protect real registrations on isolated Postgres", { skip: !process.env.TEST_DATABASE_URL }, async (t) => {
  const admin = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
  const schema = "sheet_schedule_tests";
  await admin`CREATE SCHEMA ${admin(schema)}`;
  const sql = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {}, connection: { search_path: schema } });
  const previousSheet = process.env.REG2026_SCHEDULE_SHEET_ID;
  delete process.env.REG2026_SCHEDULE_SHEET_ID;
  try {
    for (const migration of ["00004-CREAT-registraion-2026", "00006-create-class-capacities-2026", "00007-create-reg2026-bookings", "00008-reg2026-order-safety", "00009-create-schedule-overrides-2026", "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule", "00015-reg2026-switch-role"]) {
      await sql.begin((tx) => require(`../migrations/${migration}`).up(tx));
    }
    const store = createRegistrationStore(sql);
    const sessions = parseScheduleRows(sessionRows());
    const createPerson = async (name) => (await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
      VALUES ('2026','confirmed','advanced','fullpass',${name},'Dancer',${name.toLowerCase() + "@example.com"},'Austria') RETURNING *`)[0];
    let publication;

    await t.test("configured Sheets mode cannot serve mock classes before a successful publication", async () => {
      assert.ok((await store.schedule()).length > 2, "Unconfigured legacy fixtures remain usable");
      process.env.REG2026_SCHEDULE_SHEET_ID = sheetId;
      assert.equal(await store.schedulePublication(), null);
      await assert.rejects(store.schedule(), (error) => error.status === 503);
    });

    await t.test("one full publication replaces every mock and override and remains authoritative without env", async () => {
      await sql`INSERT INTO schedule_overrides_26 (session_id,data,revision) VALUES ('sheet-session-a', '{"title":"Conflicting DB override"}'::jsonb, 1)`;
      await sql`INSERT INTO class_capacities_26 (session_id,pool,capacity) VALUES ('sheet-session-a','total',999)`;
      publication = await store.publishSchedule(source(sessions), 0);
      const metadata = await store.schedulePublication();
      assert.equal(metadata.id, publication.id);
      assert.equal(metadata.count, 2);
      assert.equal(metadata.spreadsheetId, sheetId);
      assert.equal(metadata.sheetName, "APP_SCHEDULE");
      assert.ok(Number.isFinite(Date.parse(metadata.publishedAt)));
      assert.deepEqual((await store.schedule()).map(({ id }) => id), sessions.map(({ id }) => id));
      assert.equal((await store.schedule())[0].title, "Sheet solo class");
      assert.deepEqual((await store.schedule())[0].capacity, { total: 30 });
      delete process.env.REG2026_SCHEDULE_SHEET_ID;
      assert.equal((await store.schedule()).length, 2);
      await assert.rejects(store.editSchedule(sessions[0].id, {}, publication.id), (error) => error.status === 409);
      process.env.REG2026_SCHEDULE_SHEET_ID = sheetId;
    });

    await t.test("existing role-pool publications normalize to the shared total without requiring a reset or Sheet rewrite", async () => {
      const legacy = sessions.map((session) => session.partnerClass ? { ...session, capacity: { lead: 20, follow: 20 } } : session);
      await sql`UPDATE schedule_publications_26 SET sessions = ${sql.json(legacy)}, source_hash = ${source(legacy).sourceHash} WHERE id = ${publication.id}`;
      assert.deepEqual((await store.schedule()).find((session) => session.partnerClass).capacity, { total: 40 });
      assert.equal((await store.schedulePublication()).sourceHash, source(sessions).sourceHash);
      assert.equal((await store.publishSchedule(source(sessions), publication.id)).id, publication.id);
    });

    await t.test("identical syncs reuse their revision and stale edits cannot replace a newer publication", async () => {
      const repeated = await store.publishSchedule(source(sessions), publication.id);
      assert.equal(repeated.id, publication.id);
      const changed = sessions.map((session) => ({ ...session, title: `${session.title} updated` }));
      await assert.rejects(store.publishSchedule(source(changed), 0), (error) => error.status === 409);
      assert.equal((await store.schedulePublication()).id, publication.id);
      publication = await store.publishSchedule(source(changed), publication.id);
      assert.equal((await store.schedule())[0].title, "Sheet solo class updated");
      await assert.rejects(store.publishSchedule(source([{ id: "broken" }]), publication.id), (error) => error.status === 422);
      assert.equal((await store.schedulePublication()).id, publication.id);
    });

    const registered = await createPerson("SheetRegistered");
    await t.test("registration validates and reserves places against the published source", async () => {
      const before = await store.availability();
      assert.deepEqual(Object.keys(before.classes), sessions.map(({ id }) => id));
      assert.equal(before.classes["sheet-session-a"].total.remaining, 30);
      const order = await store.submit(registered, { ...empty(), classes: [{ sessionId: "sheet-session-a" }] }, "sheet-registration-01");
      assert.equal(order.status, "confirmed");
      assert.equal((await store.availability()).classes["sheet-session-a"].total.remaining, 29);
      const other = await createPerson("SheetOldMock");
      await assert.rejects(store.submit(other, { ...empty(), classes: [{ sessionId: "fri-1330-ankersaal" }] }, "sheet-mock-rejected-01"), (error) => error.status === 422);
    });

    await t.test("booked session deletion and structural changes are rejected without changing the last good snapshot", async () => {
      const current = await store.schedule();
      const mutations = [
        current.filter(({ id }) => id !== "sheet-session-a"),
        current.map((session) => session.id === "sheet-session-a" ? { ...session, start: "13:00" } : session),
        current.map((session) => session.id === "sheet-session-a" ? { ...session, day: "Saturday" } : session),
        current.map((session) => session.id === "sheet-session-a" ? { ...session, partnerClass: true, format: "partner", capacity: { lead: 20, follow: 20 } } : session),
      ];
      for (const next of mutations) {
        await assert.rejects(store.publishSchedule(source(next), publication.id), (error) => error.status === 409);
        assert.equal((await store.schedulePublication()).id, publication.id);
        assert.deepEqual(await store.schedule(), current);
      }
      assert.equal((await sql`SELECT * FROM class_bookings_26 WHERE registration_id = ${registered.id}`).length, 1);
    });

    await t.test("capacity reduction preserves confirmed places, clamps availability and rejects new registrations", async () => {
      const next = (await store.schedule()).map((session) => session.id === "sheet-session-a" ? { ...session, title: "Renamed sheet class", capacity: { total: 0 } } : session);
      publication = await store.publishSchedule(source(next), publication.id);
      assert.equal((await store.schedule())[0].title, "Renamed sheet class");
      assert.equal((await store.availability()).classes["sheet-session-a"].total.remaining, 0);
      assert.equal((await sql`SELECT * FROM class_bookings_26 WHERE registration_id = ${registered.id}`).length, 1);
      const other = await createPerson("SheetFull");
      await assert.rejects(store.submit(other, { ...empty(), classes: [{ sessionId: "sheet-session-a" }] }, "sheet-full-rejected-01"), (error) => error.status === 409);
    });

    await t.test("legacy saved classes and order-only references also prevent orphaned session IDs", async () => {
      const legacy = await createPerson("SheetLegacy");
      await sql`UPDATE registrations_26 SET theme_class = ${serializeThemeClass([{ sessionId: "sheet-session-b", role: "follow" }])} WHERE id = ${legacy.id}`;
      const withoutB = (await store.schedule()).filter(({ id }) => id !== "sheet-session-b");
      await assert.rejects(store.publishSchedule(source(withoutB), publication.id), (error) => error.status === 409);
      await sql`UPDATE registrations_26 SET theme_class = 'no' WHERE id = ${legacy.id}`;
      await sql`INSERT INTO reg2026_orders (registration_id,status,draft,subtotal_cents,fee_cents,total_cents,confirmed_at,reopened_at)
        VALUES (${legacy.id},'confirmed',${sql.json({ ...empty(), classes: [{ sessionId: "sheet-session-b", role: "follow" }] })},0,0,0,NOW(),NOW())`;
      await assert.rejects(store.publishSchedule(source(withoutB), publication.id), (error) => error.status === 409);
      assert.equal((await store.schedulePublication()).id, publication.id);
    });

    await t.test("first calendar dates enrich booked sessions once and later weekend moves keep the last good snapshot", async () => {
      const before = await store.schedule();
      assert.ok(before.every((session) => session.date === ""));
      const dated = before.map((session) => ({ ...session, date: "2026-10-30" }));
      const changedTime = dated.map((session) => session.id === "sheet-session-a" ? { ...session, start: "13:00" } : session);
      await assert.rejects(store.publishSchedule(source(changedTime), publication.id), (error) => error.status === 409);
      assert.deepEqual(await store.schedule(), before);

      publication = await store.publishSchedule(source(dated), publication.id);
      const published = await store.schedule();
      assert.ok(published.every((session) => session.date === "2026-10-30"));
      assert.equal((await sql`SELECT * FROM class_bookings_26 WHERE registration_id = ${registered.id}`).length, 1);
      assert.equal((await store.schedulePublication()).id, publication.id);

      for (const date of ["2026-11-06", ""]) {
        const moved = published.map((session) => ({ ...session, date }));
        await assert.rejects(store.publishSchedule(source(moved), publication.id), (error) => error.status === 409);
        assert.equal((await store.schedulePublication()).id, publication.id);
        assert.deepEqual(await store.schedule(), published);
      }
    });

    await t.test("open talks keep unlimited JSON-safe availability after many bookings and allow participant and organizer selections", async () => {
      const current = await store.schedule();
      const talk = { ...current[0], id: "sheet-open-talk", title: "Open talk", format: "talk", partnerClass: false,
        capacity: {}, room: "Talk room", start: "17:30", end: "18:45", bookable: true };
      publication = await store.publishSchedule(source([...current, talk]), publication.id);
      const people = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country)
        SELECT '2026','confirmed','advanced','fullpass','TalkExisting' || n,'Dancer','talk' || n || '@example.com','Austria'
        FROM generate_series(1,35) AS n RETURNING id`;
      for (const person of people) await sql`INSERT INTO class_bookings_26 (registration_id,session_id,pool,status)
        VALUES (${person.id},${talk.id},'total','confirmed')`;
      const open = { capacity: null, remaining: null, unlimited: true };
      assert.deepEqual(JSON.parse(JSON.stringify((await store.availability()).classes[talk.id].total)), open);
      const participant = await createPerson("OpenTalkParticipant");
      const order = await store.submit(participant, { ...empty(), classes: [{ sessionId: talk.id }] }, "open-talk-registration-01");
      assert.equal(order.status, "confirmed");
      const organizerParticipant = await createPerson("OpenTalkOrganizerEdit");
      await store.editClasses(organizerParticipant.id, [{ sessionId: talk.id }], "");
      assert.equal((await sql`SELECT id FROM class_bookings_26 WHERE session_id = ${talk.id}`).length, 37);
      assert.deepEqual((await store.availability()).classes[talk.id].total, open);
    });

    await t.test("dashboard capacity edits write the source before publishing and keep bookings and other class fields", async () => {
      const before = await store.schedule();
      const writes = [];
      const updateSheet = async (request) => {
        assert.equal(request.publication.id, publication.id);
        assert.equal(request.id, "sheet-session-b");
        assert.deepEqual(request.capacity, { total: 25 });
        writes.push(request);
      };
      const oldVersion = publication.id;
      publication = await store.editPublishedCapacity("sheet-session-b", { total: "25" }, oldVersion, updateSheet);
      assert.equal(writes.length, 1);
      assert.ok(publication.id > oldVersion);
      const after = await store.schedule();
      assert.deepEqual(after.find((session) => session.id === "sheet-session-b").capacity, { total: 25 });
      const details = (sessions) => sessions.map(({ capacity, version, ...session }) => session);
      assert.deepEqual(details(after), details(before));
      const repeated = await store.editPublishedCapacity("sheet-session-b", { total: 25 }, publication.id, updateSheet);
      assert.equal(repeated.id, publication.id);
      assert.equal(writes.length, 1);
      await assert.rejects(store.editPublishedCapacity("sheet-session-b", { total: 30 }, oldVersion, updateSheet), (error) => error.status === 409);
      for (const invalid of [{ total: "" }, { total: -1 }, { total: 1001 }, { lead: 12, total: 30 }]) {
        await assert.rejects(store.editPublishedCapacity("sheet-session-b", invalid, publication.id, updateSheet), (error) => error.status === 422);
      }
      await assert.rejects(store.editPublishedCapacity("sheet-open-talk", {}, publication.id, updateSheet), (error) => error.status === 422);
      assert.equal(writes.length, 1, "Invalid and stale saves must not contact Google");
      const keepBookings = await sql`SELECT id FROM class_bookings_26 ORDER BY id`;
      await store.editPublishedCapacity("sheet-session-a", { total: 0 }, publication.id, updateSheet);
      assert.deepEqual(await sql`SELECT id FROM class_bookings_26 ORDER BY id`, keepBookings);
      assert.equal((await store.availability()).classes["sheet-session-a"].total.remaining, 0);
    });

    await t.test("failed Sheet writes or changed sources keep the published schedule and simultaneous edits reject stale saves", async () => {
      const before = await store.schedule();
      for (const status of [503, 409]) {
        await assert.rejects(store.editPublishedCapacity("sheet-session-b", { total: 28 }, publication.id,
          async () => { const error = new Error("Sheet update failed"); error.status = status; throw error; }), (error) => error.status === status);
        assert.equal((await store.schedulePublication()).id, publication.id);
        assert.deepEqual(await store.schedule(), before);
      }
      let writes = 0;
      const version = publication.id;
      const changes = await Promise.allSettled([24, 23].map((total) => store.editPublishedCapacity("sheet-session-b", { total }, version,
        async () => { writes += 1; })));
      assert.equal(changes.filter((entry) => entry.status === "fulfilled").length, 1);
      assert.equal(changes.find((entry) => entry.status === "rejected").reason.status, 409);
      assert.equal(writes, 1);
      publication = await store.schedulePublication();
    });
  } finally {
    if (previousSheet === undefined) delete process.env.REG2026_SCHEDULE_SHEET_ID;
    else process.env.REG2026_SCHEDULE_SHEET_ID = previousSheet;
    await sql.end({ timeout: 2 });
    await admin`DROP SCHEMA ${admin(schema)} CASCADE`;
    await admin.end({ timeout: 2 });
  }
});
