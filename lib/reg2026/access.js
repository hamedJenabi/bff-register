import { verifyIdentitySignature } from "./security";
import { RegistrationError } from "./errors";

// Midnight at the end of November 20 in Vienna (CET).
export const REG2026_EDITS_CLOSE_AT = Date.parse("2026-11-21T00:00:00+01:00");

export const canEditConfirmedRegistration = (ticket, now = Date.now()) =>
  process.env.REG2026_ENABLED === "true" && ["fullpass", "partyPass"].includes(ticket) &&
  now < REG2026_EDITS_CLOSE_AT;

export const assertRegistrationOpen = () => {
  const closes = process.env.REG2026_CLOSES_AT;
  if (process.env.REG2026_ENABLED !== "true" ||
      (process.env.NODE_ENV === "production" && !closes) ||
      (closes && (!Number.isFinite(Date.parse(closes)) || Date.now() >= Date.parse(closes)))) {
    throw new RegistrationError(403, "Festival choices registration is currently closed.");
  }
};

export const isRegistrationOpen = () => {
  try { assertRegistrationOpen(); return true; } catch { return false; }
};

export const resolveParticipant = async (access, store) => {
  if (!verifyIdentitySignature(access?.user, access?.sig)) {
    throw new RegistrationError(403, "This registration link is invalid. Please request a new link from the organizers.");
  }
  const matches = await store.findParticipants(access.user);
  if (matches.length !== 1) {
    throw new RegistrationError(403, "This link does not identify one confirmed participant. Please contact the organizers.");
  }
  return matches[0];
};

export const publicParticipant = ({ id, firstname, lastname, ticket }) => ({ id, firstname, lastname, ticket });
