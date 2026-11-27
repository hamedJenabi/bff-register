// Noon in Vienna (CET) on Sunday, 29 November 2026.
const closesAt = Date.parse("2026-11-29T12:00:00+01:00");

export function ticketRegistrationTimeLeft() {
  return Math.max(0, closesAt - Date.now());
}

export function isTicketRegistrationClosed() {
  return ticketRegistrationTimeLeft() === 0;
}
