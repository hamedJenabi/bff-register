import sgMail from "@sendgrid/mail";
import { attendeeStore } from "../../../../db/app";
import { createAppInvitationHandler } from "../../../../lib/app/invitations";

if (process.env.SENDGRID_API_KEY)
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default createAppInvitationHandler({
  participant: attendeeStore.participant,
  issueAccess: attendeeStore.issueAccess,
  send: (message) => sgMail.send(message),
});
