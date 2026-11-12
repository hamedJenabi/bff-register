import { mockSchedule } from "../../mockdata/schedule2026";

export const CATALOG_VERSION = "2026-draft-1";
export const schedule = mockSchedule;

export const scheduleById = Object.fromEntries(
  schedule.map((classSession) => [classSession.id, classSession]),
);

export const scheduleDays = ["Friday", "Saturday", "Sunday"];

export const competitions = [
  { id: "solo_battle", label: "Solo Battle", roleRequired: false, capacity: { total: 30 } },
  { id: "open_mixnmatch", label: "Open MixMatch", roleRequired: true, capacity: { lead: 40, follow: 40 } },
  { id: "newcomers_mixnmatch", label: "Newcomers MixMatch", roleRequired: true, capacity: { lead: 25, follow: 25 },
    description: "You cannot register for Newcomers MixMatch and Open MixMatch in the same dance role." },
  { id: "strictly", label: "Strictly", roleRequired: true, capacity: { lead: 24, follow: 24 } },
  { id: "fever_showcase", label: "Fever Showcase", roleRequired: false, capacity: { total: 25 } },
];

export const CLASS_SELECTION_LIMIT = 5;
export const isClassPass = (ticket) => ticket === "fullpass" || ticket === "parentPass";
export const FREE_PASS_VOUCHER = "freepass26";
export const COMPETITION_PRICE_CENTS = 1000;
export const LUNCH_PRICE_CENTS = 1500;
