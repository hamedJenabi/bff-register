import { parseThemeClass } from "../reg2026/serialization";

export function classBookingSelections(person, bookings, hasOrders) {
  const legacy = bookings.length === 0 && !hasOrders;
  const choices =
    legacy && ["fullpass", "parentPass"].includes(person.ticket)
      ? parseThemeClass(person.theme_class)
      : bookings
          .filter((booking) => booking.status === "confirmed")
          .map((booking) => ({
            sessionId: booking.session_id,
            role: booking.pool,
          }));
  const seen = new Set();
  const selections = [];
  for (const choice of choices) {
    if (typeof choice?.sessionId !== "string" || seen.has(choice.sessionId))
      continue;
    seen.add(choice.sessionId);
    selections.push({
      sessionId: choice.sessionId,
      role: ["lead", "follow", "switch"].includes(choice.role)
        ? choice.role
        : null,
    });
  }
  return { legacy, selections };
}
