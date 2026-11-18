import { CATALOG_VERSION } from "./catalog";

export const emptySavedChoices = {
  classes: [],
  competitions: [],
  competitionRoles: {},
  lunch: [],
};

export const parseThemeClass = (value) => {
  if (!value || value === "no") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed?.version !== 1 || !Array.isArray(parsed.selections)) {
      return [];
    }
    return parsed.selections;
  } catch (error) {
    return [];
  }
};

export const hasRegisteredClasses = (participant) =>
  parseThemeClass(participant.theme_class).length > 0;

export const serializeThemeClass = (selections) =>
  JSON.stringify({
    version: 1,
    catalogVersion: CATALOG_VERSION,
    selections: selections.map(({ sessionId, role }) => ({
      sessionId,
      ...(role ? { role } : {}),
    })),
  });

export const commaList = (value) =>
  typeof value === "string" && value.length > 0
    ? value.split(",").filter(Boolean)
    : [];

export const choicesFromParticipant = (participant) => ({
  classes: parseThemeClass(participant.theme_class),
  competitions: commaList(participant.competitions),
  competitionRoles: {
    open_mixnmatch: participant.open_mixnmatch_role || "",
    newcomers_mixnmatch: participant.newcomers_mixnmatch_role || "",
    strictly: participant.strictly_role || "",
  },
  lunch: commaList(participant.lunch),
});
