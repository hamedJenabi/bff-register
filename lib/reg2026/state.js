import { hasRegisteredClasses } from "./serialization";

export const loadRegistrationState = async (store, participant, orderId) => {
  const completedOrder = await store.completedOrder(participant.id);
  if (completedOrder) return { completed: true, order: completedOrder };

  // Saved class selections also identify registrations without an order record.
  if (hasRegisteredClasses(participant)) return { completed: true, order: null };

  const activeOrder = await store.activeOrder(participant.id);
  if (activeOrder) return { completed: false, order: activeOrder };

  const order = typeof orderId === "string" && /^\d+$/.test(orderId)
    ? await store.order(orderId, participant.id)
    : null;
  return { completed: false, order: order || null };
};
