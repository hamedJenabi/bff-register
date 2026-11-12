import { createHash } from "node:crypto";
import { canEditConfirmedRegistration, REG2026_EDITS_CLOSE_AT } from "./access";
import { choicesFromParticipant, hasRegisteredClasses } from "./serialization";

export const confirmedChoicesVersion = (participant, order) => createHash("sha256")
  .update(JSON.stringify([String(order?.id || ""), choicesFromParticipant(participant)]))
  .digest("hex");

export const loadRegistrationState = async (store, participant, orderId) => {
  const activeOrder = await store.activeOrder(participant.id);
  const completedOrder = await store.completedOrder(participant.id);
  // A checkout for changes can coexist with already confirmed choices.
  const completed = !!completedOrder || hasRegisteredClasses(participant);
  const editable = completed && !activeOrder && canEditConfirmedRegistration(participant.ticket);
  const edit = editable ? {
    version: confirmedChoicesVersion(participant, completedOrder),
    closesAt: REG2026_EDITS_CLOSE_AT,
  } : null;
  if (activeOrder || completed) return { completed, order: activeOrder || completedOrder || null, edit };

  const order = typeof orderId === "string" && /^\d+$/.test(orderId)
    ? await store.order(orderId, participant.id)
    : null;
  return { completed: false, order: order || null, edit: null };
};
