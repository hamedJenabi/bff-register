import { mockSchedule } from "../../mockdata/schedule2026";

export const CATALOG_VERSION = "2026-draft-1";
export const schedule = mockSchedule;

export const scheduleById = Object.fromEntries(
  schedule.map((classSession) => [classSession.id, classSession]),
);

export const scheduleDays = ["Friday", "Saturday", "Sunday"];

export const competitions = [
  { id: "solo_battle", label: "Solo Battle", roleRequired: false },
  { id: "open_mixnmatch", label: "Open MixMatch", roleRequired: true },
  { id: "newcomers_mixnmatch", label: "Newcomers MixMatch", roleRequired: true },
  { id: "strictly", label: "Strictly", roleRequired: true },
  { id: "fever_showcase", label: "Fever Showcase", roleRequired: false },
];

export const CLASS_SELECTION_LIMIT = 5;
export const FREE_PASS_VOUCHER = "freepass26";
export const COMPETITION_PRICE_CENTS = 1000;
export const LUNCH_PRICE_CENTS = 1500;
