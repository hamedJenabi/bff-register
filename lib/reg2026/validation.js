import {
  CLASS_SELECTION_LIMIT,
  FREE_PASS_VOUCHER,
  competitions,
  schedule,
} from "./catalog";
import { indexSchedule } from "./schedule";

const validRoles = new Set(["lead", "follow"]);
const competitionById = Object.fromEntries(
  competitions.map((competition) => [competition.id, competition]),
);

const uniqueStrings = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string"))]
    : [];

export const validateDraft = (draft, participant, sessions = schedule) => {
  const scheduleById = indexSchedule(sessions);
  const errors = {};
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    errors.form = "Submit a complete registration draft.";
  }
  for (const field of ["classes", "competitions", "lunch"]) {
    if (!Array.isArray(draft?.[field])) errors[field] = "Submit a complete list of choices.";
  }
  if (!["partyPass", "fullpass", "parentPass"].includes(participant.ticket)) {
    errors.form = "This festival pass is not eligible for registration.";
  }
  const classSelections = Array.isArray(draft?.classes) ? draft.classes : [];
  const normalizedClasses = [];
  const seenSessions = new Set();
  const occupiedSlots = new Set();

  if (!["fullpass", "parentPass"].includes(participant.ticket) && classSelections.length > 0) {
    errors.classes = "Party Pass participants cannot register for classes.";
  }

  for (const selection of classSelections) {
    const classSession = scheduleById[selection?.sessionId];
    if (!classSession || seenSessions.has(selection.sessionId)) {
      errors.classes = "One or more class choices are not valid.";
      continue;
    }

    seenSessions.add(selection.sessionId);
    if (occupiedSlots.has(classSession.slotId)) {
      errors.classes = "Choose no more than one class in each time slot.";
    }
    occupiedSlots.add(classSession.slotId);

    if (classSession.partnerClass && !validRoles.has(selection.role)) {
      errors.classes = `Choose lead or follow for ${classSession.title}.`;
    }

    normalizedClasses.push({
      sessionId: classSession.id,
      ...(classSession.partnerClass ? { role: selection.role } : {}),
    });
  }

  if (classSelections.length > CLASS_SELECTION_LIMIT) {
    errors.classes = `Choose no more than ${CLASS_SELECTION_LIMIT} classes in total across the festival.`;
  }

  for (const field of ["competitions", "lunch"]) {
    if (Array.isArray(draft?.[field]) && draft[field].some((item) => typeof item !== "string")) {
      errors[field] = "One or more choices are not valid.";
    }
  }
  const selectedCompetitions = uniqueStrings(draft?.competitions);
  const competitionRoles = {};
  for (const competitionId of selectedCompetitions) {
    const competition = competitionById[competitionId];
    if (!competition) {
      errors.competitions = "One or more competition choices are not valid.";
      continue;
    }
    if (competition.roleRequired) {
      const role = draft?.competitionRoles?.[competitionId];
      if (!validRoles.has(role)) {
        errors.competitions = `Choose lead or follow for ${competition.label}.`;
      } else {
        competitionRoles[competitionId] = role;
      }
    }
  }

  const lunch = uniqueStrings(draft?.lunch);
  if (lunch.some((day) => day !== "saturday" && day !== "sunday")) {
    errors.lunch = "One or more lunch choices are not valid.";
  }

  const voucher = typeof draft?.voucher === "string" ? draft.voucher.trim() : "";
  if (draft?.voucher !== undefined && typeof draft.voucher !== "string") {
    errors.voucher = "Enter a valid voucher code.";
  } else if (voucher && voucher !== FREE_PASS_VOUCHER) {
    errors.voucher = "Voucher code not recognized.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      classes: normalizedClasses,
      competitions: selectedCompetitions.filter((id) => competitionById[id]),
      competitionRoles,
      lunch: lunch.filter((day) => day === "saturday" || day === "sunday"),
      ...(voucher ? { voucher } : {}),
    },
  };
};
