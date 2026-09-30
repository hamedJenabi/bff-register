import sgMail from "@sendgrid/mail";
import { scheduleById, competitions } from "./catalog";

export const confirmationMessage = (participant, draft) => {
  const templateId = process.env.REG2026_CONFIRMATION_TEMPLATE_ID;
  if (!templateId) throw new Error("REG2026_CONFIRMATION_TEMPLATE_ID is not configured");
  return {
    from: process.env.REG2026_EMAIL_FROM || "registration@bluesfever.eu",
    to: participant.email,
    templateId,
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
    const message = delivery.kind === "confirmation" ? confirmationMessage(participant, delivery.payload) : delivery.payload;
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
