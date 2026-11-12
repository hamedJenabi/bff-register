import { schedule as mockSchedule, scheduleDays } from "./catalog";

export const indexSchedule = (sessions) => Object.fromEntries(sessions.map((session) => [session.id, session]));
export const scheduleFields = ["title", "teachers", "description", "day", "start", "end", "room", "partnerClass"];
export const structuralFields = ["day", "start", "end", "partnerClass"];

export const mergeSchedule = (overrides = [], limits = []) => {
  const edits = Object.fromEntries(overrides.map((row) => [row.session_id, row]));
  const capacities = Object.fromEntries(limits.map((row) => [`${row.session_id}:${row.pool}`, row.capacity]));
  return mockSchedule.map((base) => {
    const edit = edits[base.id];
    const session = { ...base, ...edit?.data };
    session.slotId = `${session.day.toLowerCase()}-${session.start.replace(":", "")}`;
    session.capacity = Object.fromEntries((session.partnerClass ? ["lead", "follow"] : ["total"])
      .map((pool) => [pool, capacities[`${base.id}:${pool}`] ?? base.capacity[pool] ?? (pool === "total" ? 30 : 20)]));
    return { ...session, version: edit?.revision || 0 };
  }).sort((a, b) => scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) || a.start.localeCompare(b.start));
};

export const scheduleFormValues = (session) => ({
  ...Object.fromEntries(scheduleFields.map((field) => [field, session[field]])),
  leadCapacity: String(session.capacity.lead ?? 20),
  followCapacity: String(session.capacity.follow ?? 20),
  totalCapacity: String(session.capacity.total ?? 30),
  formError: "",
});

export const validateSchedule = (values) => {
  const errors = {};
  const value = {};
  for (const [field, maximum, required] of [["title", 200, true], ["teachers", 200, true], ["description", 6000, false], ["room", 200, false]]) {
    if (typeof values?.[field] !== "string" || values[field].trim().length > maximum || (required && !values[field].trim())) {
      errors[field] = required ? `Enter ${field}, up to ${maximum} characters.` : `Use up to ${maximum} characters.`;
    } else value[field] = values[field].trim();
  }
  if (!scheduleDays.includes(values?.day)) errors.day = "Choose Friday, Saturday or Sunday.";
  else value.day = values.day;
  for (const field of ["start", "end"]) {
    if (typeof values?.[field] !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(values[field])) errors[field] = "Enter a valid time.";
    else value[field] = values[field];
  }
  if (value.start && value.end && value.end <= value.start) errors.end = "End time must be after start time.";
  if (typeof values?.partnerClass !== "boolean") errors.partnerClass = "Choose solo or partner class.";
  else value.partnerClass = values.partnerClass;
  value.capacity = {};
  for (const pool of values?.partnerClass ? ["lead", "follow"] : ["total"]) {
    const field = `${pool}Capacity`;
    const raw = values?.[field];
    const capacity = Number(raw);
    if (!["string", "number"].includes(typeof raw) || !/^\d+$/.test(String(raw)) || !Number.isSafeInteger(capacity) || capacity > 1000) {
      errors[field] = "Enter a whole number from 0 to 1000.";
    } else value.capacity[pool] = capacity;
  }
  return { valid: !Object.keys(errors).length, value, errors };
};
