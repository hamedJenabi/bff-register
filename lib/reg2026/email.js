import sgMail from "@sendgrid/mail";
import { schedule, competitions } from "./catalog";
import { indexSchedule } from "./schedule";

export const confirmationMessage = (participant, draft, sessions = schedule) => {
  const scheduleById = indexSchedule(sessions);
  return {
    from: process.env.REG2026_EMAIL_FROM || "registration@bluesfever.eu",
    to: participant.email,
    templateId: "d-4f77d740ec504650aa9ea1a78e785cae",
    dynamicTemplateData: {
      firstname: participant.firstname, lastname: participant.lastname,
      classes: draft.classes.map((selection) => ({ ...scheduleById[selection.sessionId], role: selection.role || "" })),
      competitions: draft.competitions.map((id) => ({ label: competitions.find((item) => item.id === id)?.label || id, role: draft.competitionRoles[id] || "" })),
      lunch: draft.lunch,
    },
  };
};

export const sendMessage = async (message) => {
  if (!process.env.SENDGRID_API_KEY) throw new Error("SENDGRID_API_KEY is not configured");
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  await sgMail.send(message);
};

export const deliverEmail = async (store, deliveryId, send = sendMessage) => {
  const delivery = await store.claimDelivery(deliveryId);
  if (!delivery) return;
  try {
    const participant = await store.participantById(delivery.registration_id);
    if (!participant) throw new Error("Participant no longer exists");
    if (delivery.kind === "invitation") {
      const matches = await store.findParticipants(`${participant.email}+${participant.firstname}`);
      if (participant.status !== "confirmed" || matches.length !== 1 || matches[0].id !== participant.id) {
        throw new Error("Invitation recipient is no longer one unambiguous confirmed participant");
      }
    }
    const message = delivery.kind === "confirmation" ? confirmationMessage(participant, delivery.payload, await store.schedule()) : delivery.payload;
    await send(message);
    await store.finishDelivery(delivery.id, null);
  } catch (error) {
    await store.finishDelivery(delivery.id, error.message || "Email delivery failed");
  }
};

export const deliverOrderConfirmation = async (store, orderId, send) => {
  const deliveries = await store.deliveriesForOrder(orderId);
  for (const delivery of deliveries) {
    if (delivery.delivery_status === "pending") await deliverEmail(store, delivery.id, send);
  }
};
