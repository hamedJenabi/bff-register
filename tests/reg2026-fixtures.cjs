const { schedule, scheduleById } = require("../lib/reg2026/catalog");
const { conflictsWithSolo } = require("../lib/reg2026/competitions");

// Keep the sessions under test first, then fill unused slots with bookable classes.
function fiveClasses(...choices) {
  const slots = new Set(choices.map(({ sessionId }) => scheduleById[sessionId].slotId));
  for (const session of schedule) {
    if (choices.length === 5) break;
    if (session.bookable === false || slots.has(session.slotId) || conflictsWithSolo(session)) continue;
    slots.add(session.slotId);
    choices.push({ sessionId: session.id, ...(session.partnerClass ? { role: "lead" } : {}) });
  }
  return choices;
}

module.exports = { fiveClasses };
