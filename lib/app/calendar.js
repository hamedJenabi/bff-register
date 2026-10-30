import { RegistrationError } from "../reg2026/errors";

export const festivalDates = (sessions) => {
  const sheetDates = Array.isArray(sessions) && sessions.some((session) => Object.prototype.hasOwnProperty.call(session, "date"));
  const datedSession = sheetDates && sessions.find((session) => session.date);
  const start = sheetDates
    ? datedSession && new Date(Date.parse(`${datedSession.date}T12:00:00Z`) - ["Friday", "Saturday", "Sunday"].indexOf(datedSession.day) * 86400000).toISOString().slice(0, 10)
    : process.env.APP_FESTIVAL_START_DATE;
  if (!start) return null;
  const date = new Date(`${start}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== start ||
    date.getUTCDay() !== 5
  ) {
    throw new RegistrationError(
      503,
      "Festival start date must be a valid Friday in YYYY-MM-DD format.",
    );
  }
  return Object.fromEntries(
    ["Friday", "Saturday", "Sunday"].map((day, index) => [
      day,
      new Date(date.getTime() + index * 86400000).toISOString().slice(0, 10),
    ]),
  );
};
