import sgMail from "@sendgrid/mail";
import { sql } from "../../../db/db";
import {
  createRegistrationInvitationHandler,
  createRegistrationInvitationStore,
} from "../../../lib/reg2026/invitations";
import { capturePreviewInvitation } from "../../../lib/reg2026/preview-invitation-mailbox";

if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default createRegistrationInvitationHandler({
  store: createRegistrationInvitationStore(sql),
  send: process.env.BFF_PREVIEW === "true" && process.env.NODE_ENV !== "production"
    ? capturePreviewInvitation
    : (message) => sgMail.send(message),
});
