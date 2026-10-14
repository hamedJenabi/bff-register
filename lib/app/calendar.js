import { RegistrationError } from "../reg2026/errors";

export const festivalDates = () => {
  const start = process.env.APP_FESTIVAL_START_DATE;
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
