import { buildRegistrationPath } from "./security";
import { canonicalOrigin } from "./payments";
import { assertRegistrationOpen } from "./access";
import { RegistrationError } from "./errors";
import { deliverEmail } from "./email";

export const queueInvitations = async (store) => {
  assertRegistrationOpen();
  if (process.env.REG2026_CATALOG_REVIEWED !== "true") throw new RegistrationError(403, "Review the final catalog before sending invitations.");
  if (!process.env.REG2026_INVITATION_TEMPLATE_ID) throw new RegistrationError(503, "REG2026_INVITATION_TEMPLATE_ID is not configured.");
  const origin = canonicalOrigin();
  const participants = await store.confirmedRecipients();
  for (const participant of participants) {
    await store.queueInvitation(participant.id, {
      from: process.env.REG2026_EMAIL_FROM || "registration@bluesfever.eu", to: participant.email,
      templateId: process.env.REG2026_INVITATION_TEMPLATE_ID,
      dynamicTemplateData: { firstname: participant.firstname, lastname: participant.lastname,
        registrationUrl: origin + buildRegistrationPath(participant) },
    });
  }
  return participants.length;
};
export const processDeliveryBatch = async (store, retry, send) => {
  const rows = await store.deliveryBatch(retry);
  for (const row of rows) await deliverEmail(store, row.id, send);
  return rows.length;
};
