const { test } = require("node:test");
const assert = require("node:assert/strict");
const { SHEET_COLUMNS, parseScheduleRows, validatePublishedSessions } = require("../lib/reg2026/sheet-schema");
const { validateDraft } = require("../lib/reg2026/validation");
const { festivalDates } = require("../lib/app/calendar");

const row = (overrides = {}) => {
  const values = {
    session_id: "sheet-friday-a", day: "Friday", date: "", start: "13:30", end: "14:45",
    room: "Ankersaal", title: "A class from Sheets", teachers: "Teacher One",
    description: "Reviewed class description.", levels: "II–III", format: "solo",
    lead_capacity: "", follow_capacity: "", total_capacity: 30, bookable: true,
    ...overrides,
  };
  return SHEET_COLUMNS.map((column) => values[column]);
};
const parse = (...rows) => parseScheduleRows([SHEET_COLUMNS, ...rows]);
const rejectsRows = (...rows) => assert.throws(() => parse(...rows), (error) => {
  assert.equal(error.status, 422);
  assert.ok(error.errors && Object.keys(error.errors).length, "Errors should identify the offending sheet row or column");
  return true;
});

test("sheet rows become explicit solo, partner and talk sessions without enforcing informational levels", () => {
  const sessions = parse(
    row(),
    row({ session_id: "sheet-friday-b", room: "Kantine", format: "partner", lead_capacity: 20, follow_capacity: 15, total_capacity: "", bookable: "TRUE" }),
    row({ session_id: "sheet-friday-talk", room: "Studio", format: "talk", total_capacity: "", bookable: "FALSE", description: "" }),
  );
  assert.equal(sessions.length, 3);
  const solo = sessions.find(({ id }) => id === "sheet-friday-a");
  const partner = sessions.find(({ id }) => id === "sheet-friday-b");
  const talk = sessions.find(({ id }) => id === "sheet-friday-talk");
  assert.equal(solo.partnerClass, false);
  assert.deepEqual(solo.capacity, { total: 30 });
  assert.equal(solo.levels, "II–III");
  assert.equal(partner.partnerClass, true);
  assert.deepEqual(partner.capacity, { total: 40 });
  assert.equal(talk.partnerClass, false);
  assert.deepEqual(talk.capacity, {}, "Open talks have no finite capacity pools");
  assert.equal(talk.bookable, false);
  assert.equal(talk.description, "");
  const draft = { classes: [{ sessionId: solo.id }], competitions: [], competitionRoles: {}, lunch: [] };
  assert.equal(validateDraft(draft, { ticket: "fullpass", role: "beginner" }, sessions).valid, true);
  assert.equal(validateDraft({ ...draft, classes: [{ sessionId: talk.id }] }, { ticket: "fullpass" }, sessions).valid, false);
});

test("sheet imports require complete, unambiguous headers and at least one session", () => {
  assert.throws(() => parseScheduleRows([]), (error) => error.status === 422);
  assert.throws(() => parseScheduleRows([SHEET_COLUMNS]), (error) => error.status === 422);
  assert.throws(() => parseScheduleRows([SHEET_COLUMNS.slice(1), row().slice(1)]), (error) => error.status === 422);
  assert.throws(() => parseScheduleRows([[...SHEET_COLUMNS, "title"], [...row(), "Duplicate title"]]), (error) => error.status === 422);
  assert.throws(() => parseScheduleRows([[...SHEET_COLUMNS, "unexpected_column"], [...row(), "Unexpected"]]), (error) => error.status === 422);
  const shuffled = [...SHEET_COLUMNS].reverse();
  const original = row();
  const reordered = shuffled.map((column) => original[SHEET_COLUMNS.indexOf(column)]);
  assert.equal(parseScheduleRows([shuffled, reordered])[0].id, "sheet-friday-a");
});

test("partner classes use an editable shared total, and old role capacities normalize to the 40-place placeholder", () => {
  const current = parse(row({ format: "partner", total_capacity: 40 }));
  assert.deepEqual(current[0].capacity, { total: 40 });
  assert.deepEqual(parse(row({ format: "partner", total_capacity: 25 }))[0].capacity, { total: 25 });
  assert.deepEqual(parse(row({ format: "partner", total_capacity: 0 }))[0].capacity, { total: 0 });
  const legacy = { ...current[0], capacity: { lead: 12, follow: 13 } };
  assert.deepEqual(validatePublishedSessions([legacy]), current);
});

test("sheet rows reject missing booking rules, malformed values, duplicate IDs and spreadsheet errors", () => {
  for (const invalid of [
    { session_id: "" }, { title: "" }, { teachers: "" }, { day: "Monday" },
    { start: "25:00" }, { end: "13:00" }, { format: "" }, { format: "maybe" },
    { bookable: "maybe" }, { total_capacity: "" }, { total_capacity: "10.5" },
    { total_capacity: -1 }, { total_capacity: 1001 }, { total_capacity: "NaN" },
    { format: "partner", lead_capacity: 20, follow_capacity: "", total_capacity: "" },
    { format: "partner", lead_capacity: 20, follow_capacity: 20, total_capacity: 30 },
    { format: "talk", total_capacity: 30 }, { format: "talk", total_capacity: "", lead_capacity: 20 },
    { lead_capacity: 20 }, { title: "#REF!" }, { description: "#N/A" },
  ]) rejectsRows(row(invalid));
  rejectsRows(row(), row({ room: "Studio" }));
  const sessions = parse(row({ total_capacity: 0 }));
  assert.deepEqual(sessions[0].capacity, { total: 0 });
});

test("source dates must be real, match the weekday and describe one consecutive festival weekend", () => {
  const dates = parse(
    row({ date: "2026-12-11" }),
    row({ session_id: "sheet-saturday-a", day: "Saturday", date: "2026-12-12" }),
    row({ session_id: "sheet-sunday-a", day: "Sunday", date: "2026-12-13" }),
  );
  assert.deepEqual(dates.map(({ date }) => date), ["2026-12-11", "2026-12-12", "2026-12-13"]);
  rejectsRows(row({ date: "2026-02-30" }));
  rejectsRows(row({ date: "2026-12-12" }));
  rejectsRows(row({ date: "2026-12-11" }), row({ session_id: "sheet-saturday-a", day: "Saturday" }));
  rejectsRows(row({ date: "2026-12-11" }), row({ session_id: "sheet-saturday-a", day: "Saturday", date: "2026-12-19" }));
});

test("publishing rejects overlapping room bookings while adjacent sessions and parallel rooms are valid", () => {
  rejectsRows(row(), row({ session_id: "sheet-overlap", start: "14:00", end: "15:15" }));
  assert.equal(parse(row(), row({ session_id: "sheet-adjacent", start: "14:45", end: "16:00" })).length, 2);
  assert.equal(parse(row(), row({ session_id: "sheet-parallel", room: "Kantine", start: "14:00", end: "15:15" })).length, 2);
  const sessions = parse(row(), row({ session_id: "sheet-parallel", room: "Kantine", start: "14:00", end: "15:15" }));
  const validation = validateDraft({ classes: sessions.map(({ id }) => ({ sessionId: id })), competitions: [], competitionRoles: {}, lunch: [] }, { ticket: "fullpass" }, sessions);
  assert.equal(validation.valid, false, "Different start times must not allow a participant to book overlapping classes");
});

test("publication validation rejects corrupt snapshots and oversized imports", () => {
  assert.throws(() => validatePublishedSessions([]), (error) => error.status === 422);
  assert.throws(() => validatePublishedSessions([{ id: "missing-fields" }]), (error) => error.status === 422);
  const rows = Array.from({ length: 501 }, (_, i) => row({ session_id: `sheet-session-${i}`, room: `Room ${i}` }));
  assert.throws(() => parse(...rows), (error) => error.status === 422);
});

test("published dates are authoritative for the attendee calendar and blank dates stay unknown", () => {
  const previous = process.env.APP_FESTIVAL_START_DATE;
  process.env.APP_FESTIVAL_START_DATE = "2026-12-11";
  try {
    assert.equal(festivalDates(parse(row())), null);
    const dated = parse(row({ date: "2027-01-08" }));
    assert.deepEqual(festivalDates(dated), { Friday: "2027-01-08", Saturday: "2027-01-09", Sunday: "2027-01-10" });
    assert.deepEqual(festivalDates(), { Friday: "2026-12-11", Saturday: "2026-12-12", Sunday: "2026-12-13" });
    for (const sessionId of ["__proto__", "constructor", "toString"]) {
      assert.equal(validateDraft({ classes: [{ sessionId }], competitions: [], competitionRoles: {}, lunch: [] }, { ticket: "fullpass" }, dated).valid, false);
    }
  } finally {
    if (previous === undefined) delete process.env.APP_FESTIVAL_START_DATE;
    else process.env.APP_FESTIVAL_START_DATE = previous;
  }
});
