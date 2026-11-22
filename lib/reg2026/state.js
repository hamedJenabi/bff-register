import { createHash } from "node:crypto";
import { isClassPass } from "./catalog";
import { choicesFromParticipant, hasRegisteredClasses } from "./serialization";

export const confirmedChoicesVersion = (participant, order) => createHash("sha256")
  .update(JSON.stringify([String(order?.id || ""), choicesFromParticipant(participant)]))
  .digest("hex");

export const classRegistrationComplete = (participant, order) => hasRegisteredClasses(participant) ||
  (isClassPass(participant.ticket) && !!order && order.draft?.classesUnregistered !== true);

export const loadRegistrationState = async (store, participant, orderId) => {
  const activeOrder = await store.activeOrder(participant.id);
  const completedOrder = await store.completedOrder(participant.id);
  const classesLocked = classRegistrationComplete(participant, completedOrder);
  const completed = !!completedOrder || classesLocked;
  const state = { completed, classesLocked, open: !activeOrder };
  if (activeOrder || completed) return { ...state, order: activeOrder || completedOrder || null };

  const order = typeof orderId === "string" && /^\d+$/.test(orderId)
    ? await store.order(orderId, participant.id)
    : null;
  return { ...state, order: order || null };
};
