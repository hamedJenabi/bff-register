import {
  CLASS_DAILY_LIMIT,
  competitions,
  scheduleById,
} from "./catalog";

const validRoles = new Set(["lead", "follow"]);
const competitionById = Object.fromEntries(
  competitions.map((competition) => [competition.id, competition]),
);

const uniqueStrings = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string"))]
    : [];

export const validateDraft = (draft, participant) => {
  const errors = {};
  const classSelections = Array.isArray(draft?.classes) ? draft.classes : [];
  const normalizedClasses = [];
  const seenSessions = new Set();
  const occupiedSlots = new Set();
  const dailyCounts = {};

  if (participant.ticket === "partyPass" && classSelections.length > 0) {
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

    dailyCounts[classSession.day] = (dailyCounts[classSession.day] || 0) + 1;
    if (dailyCounts[classSession.day] > CLASS_DAILY_LIMIT) {
      errors.classes = `Choose no more than ${CLASS_DAILY_LIMIT} classes per day.`;
    }

    if (classSession.partnerClass && !validRoles.has(selection.role)) {
      errors.classes = `Choose lead or follow for ${classSession.title}.`;
    }

    normalizedClasses.push({
      sessionId: classSession.id,
      ...(classSession.partnerClass ? { role: selection.role } : {}),
    });
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

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      classes: normalizedClasses,
      competitions: selectedCompetitions.filter((id) => competitionById[id]),
      competitionRoles,
      lunch: lunch.filter((day) => day === "saturday" || day === "sunday"),
    },
  };
};
