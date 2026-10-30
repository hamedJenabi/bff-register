import { RegistrationError } from "./errors";
import { scheduleDays } from "./catalog";
import { validateSchedule } from "./schedule";
import { PARTNER_CLASS_CAPACITY } from "./capacity";

export const SHEET_COLUMNS = [
  "session_id", "day", "date", "start", "end", "room", "title", "teachers",
  "description", "levels", "format", "lead_capacity", "follow_capacity", "total_capacity", "bookable",
];
export const MAX_SHEET_SESSIONS = 500;

const fail = (errors) => {
  throw new RegistrationError(422, "The schedule was not published. Please correct the listed sheet cells.", errors);
};
const plainText = (value) => typeof value === "string" ? value.trim() : "";
const empty = (value) => value === undefined || value === null || value === "";
const sheetError = /^#(?:REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|ERROR!|SPILL!|NULL!)/;
const boolean = (value) => value === true || value === "TRUE" || value === "true" ? true
  : value === false || value === "FALSE" || value === "false" ? false : null;
const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

// This second validation boundary also protects callers publishing a JSON snapshot.
export const validatePublishedSessions = (sessions) => {
  const errors = {};
  if (!Array.isArray(sessions) || !sessions.length || sessions.length > MAX_SHEET_SESSIONS) {
    fail({ sheet: `Provide between 1 and ${MAX_SHEET_SESSIONS} class sessions.` });
  }
  const ids = new Set();
  const dated = [];
  const normalized = sessions.map((session, index) => {
    const key = `row ${index + 2}`;
    if (!session || typeof session !== "object" || Array.isArray(session)) {
      errors[key] = "Provide a complete class session.";
      return null;
    }
    const id = plainText(session.id);
    if (!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(id)) errors[`${key}: session_id`] = "Use a permanent ID with lowercase letters, digits, hyphens or underscores (up to 120 characters).";
    else if (ids.has(id)) errors[`${key}: session_id`] = `Duplicate session ID: ${id}.`;
    ids.add(id);
    const format = session.format || (typeof session.partnerClass === "boolean" ? (session.partnerClass ? "partner" : "solo") : "");
    if (!["solo", "partner", "talk"].includes(format)) errors[`${key}: format`] = "Choose solo, partner or talk after reviewing this session.";
    if (typeof session.partnerClass !== "boolean" || session.partnerClass !== (format === "partner")) errors[`${key}: format`] = "The class format must match its dance-role requirements.";
    const legacyPartner = format === "partner" && session.capacity?.total === undefined;
    const result = validateSchedule({ ...session,
      totalCapacity: legacyPartner ? PARTNER_CLASS_CAPACITY : session.capacity?.total });
    for (const [field, message] of Object.entries(result.errors)) errors[`${key}: ${field}`] = message;
    if (!plainText(session.room)) errors[`${key}: room`] = "Enter a room (use TBA if it is not assigned yet).";
    const expectedPools = format === "talk" ? [] : legacyPartner ? ["lead", "follow"] : ["total"];
    if (!session.capacity || Object.keys(session.capacity).some((pool) => !expectedPools.includes(pool)) ||
        (legacyPartner && expectedPools.some((pool) => !Number.isInteger(session.capacity[pool]) || session.capacity[pool] < 0 || session.capacity[pool] > 1000))) {
      errors[`${key}: capacity`] = "Use total capacity for classes and no capacity for open talks.";
    }
    if (typeof session.bookable !== "boolean") errors[`${key}: bookable`] = "Choose TRUE or FALSE.";
    if (typeof session.levels !== "string" || session.levels.trim().length > 200) errors[`${key}: levels`] = "Use informational level text up to 200 characters.";
    const date = session.date === undefined || session.date === null ? "" : session.date;
    if (typeof date !== "string" || (date && (!validDate(date) || new Date(`${date}T12:00:00Z`).getUTCDay() !== [5, 6, 0][scheduleDays.indexOf(session.day)]))) {
      errors[`${key}: date`] = "Use a real YYYY-MM-DD date that matches the weekday, or leave all dates blank.";
    } else if (date) dated.push({ date, day: session.day, key });
    for (const [field, value] of Object.entries(session)) {
      if (typeof value === "string" && sheetError.test(value)) errors[`${key}: ${field}`] = "Resolve the spreadsheet formula error before publishing.";
    }
    return { id, ...result.value, date, levels: plainText(session.levels), format, bookable: session.bookable,
      slotId: `${String(result.value.day).toLowerCase()}-${String(result.value.start).replace(":", "")}` };
  });
  if (dated.length && dated.length !== sessions.length) errors.dates = "Fill in dates for every session, or leave every date blank.";
  const fridayDates = new Set(dated.map(({ date, day }) => new Date(Date.parse(`${date}T12:00:00Z`) - scheduleDays.indexOf(day) * 86400000).toISOString().slice(0, 10)));
  if (fridayDates.size > 1) errors.dates = "All sessions must belong to the same Friday–Sunday festival weekend.";
  // A room can hold parallel alternatives only when it has not yet been assigned.
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    if (!current?.start || !current.end || !current.room || /^(tba|tbc|room tba|room tbc)$/i.test(current.room)) continue;
    const clash = normalized.slice(0, index).find((other) => other && other.day === current.day && other.room.toLowerCase() === current.room.toLowerCase()
      && other.start && other.end && minutes(other.start) < minutes(current.end) && minutes(current.start) < minutes(other.end));
    if (clash) errors[`row ${index + 2}: room`] = `Room/time overlaps with ${clash.id}.`;
  }
  if (Object.keys(errors).length) fail(errors);
  return normalized.sort((a, b) => scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
};

export const parseScheduleRows = (values) => {
  if (!Array.isArray(values) || !Array.isArray(values[0])) fail({ headers: "The APP_SCHEDULE tab needs its header row." });
  const headers = values[0].map((value) => plainText(value));
  // Sheets can return trailing empty columns; interior empty or duplicate headers are errors.
  while (headers.length && !headers[headers.length - 1]) headers.pop();
  const errors = {};
  for (const name of SHEET_COLUMNS) if (!headers.includes(name)) errors[`header: ${name}`] = `Missing column: ${name}.`;
  if (new Set(headers).size !== headers.length) errors.headers = "Column headers must be unique.";
  for (const name of headers) if (!SHEET_COLUMNS.includes(name)) errors[`header: ${name || "blank"}`] = "Use only the documented schedule column names.";
  if (Object.keys(errors).length) fail(errors);
  const rows = values.slice(1).map((row, index) => ({ row, number: index + 2 })).filter(({ row }) => Array.isArray(row) && row.some((value) => !empty(value)));
  if (!rows.length || rows.length > MAX_SHEET_SESSIONS) fail({ sheet: `Provide between 1 and ${MAX_SHEET_SESSIONS} class sessions.` });
  const sessions = rows.map(({ row, number }) => {
    const fields = Object.fromEntries(headers.map((name, index) => [name, row[index] ?? ""]));
    if (row.slice(headers.length).some((value) => !empty(value))) errors[`row ${number}`] = "Move data under the documented columns.";
    for (const [field, value] of Object.entries(fields)) {
      if (typeof value === "string" && sheetError.test(value)) errors[`row ${number}: ${field}`] = "Resolve the spreadsheet formula error before publishing.";
      if (typeof value === "object" && value !== null) errors[`row ${number}: ${field}`] = "Use a plain cell value.";
    }
    const format = plainText(fields.format).toLowerCase();
    if (!["solo", "partner", "talk"].includes(format)) errors[`row ${number}: format`] = "Choose solo, partner or talk after reviewing this session.";
    // Existing partner rows use reviewed lead/follow columns. Their replacement
    // is a shared placeholder of 40 until total_capacity is explicitly saved.
    const legacyPartner = format === "partner" && empty(fields.total_capacity);
    const pools = format === "talk" ? [] : legacyPartner ? ["lead", "follow"] : ["total"];
    for (const pool of ["solo", "partner", "talk"].includes(format) ? ["lead", "follow", "total"] : []) {
      const raw = fields[`${pool}_capacity`];
      if (pools.includes(pool) && (empty(raw) || !/^(0|[1-9]\d*)$/.test(String(raw)) || !Number.isSafeInteger(Number(raw)) || Number(raw) > 1000)) {
        errors[`row ${number}: ${pool}_capacity`] = "Enter a reviewed whole-number capacity from 0 to 1000.";
      } else if (!pools.includes(pool) && !empty(raw)) errors[`row ${number}: ${pool}_capacity`] = "Leave unused capacity pools blank.";
    }
    const bookable = boolean(fields.bookable);
    if (bookable === null) errors[`row ${number}: bookable`] = "Choose TRUE or FALSE.";
    for (const field of ["session_id", "day", "date", "start", "end", "room", "title", "teachers", "description", "levels"]) {
      if (typeof fields[field] !== "string") errors[`row ${number}: ${field}`] = "Use text in this column; dates must be YYYY-MM-DD and times HH:mm.";
    }
    return { id: plainText(fields.session_id), day: fields.day, date: fields.date,
      start: fields.start, end: fields.end, room: fields.room, title: fields.title,
      teachers: fields.teachers, description: fields.description, levels: fields.levels,
      format, partnerClass: format === "partner", bookable,
      capacity: format === "talk" ? {} : { total: legacyPartner ? PARTNER_CLASS_CAPACITY : Number(fields.total_capacity) } };
  });
  if (Object.keys(errors).length) fail(errors);
  try { return validatePublishedSessions(sessions); }
  catch (error) {
    // Preserve the real Sheet row numbers when blank separator rows were present.
    if (error instanceof RegistrationError) error.errors = Object.fromEntries(Object.entries(error.errors).map(([key, value]) => [key.replace(/^row (\d+)/, (_, row) => `row ${rows[Number(row) - 2]?.number ?? row}`), value]));
    throw error;
  }
};
