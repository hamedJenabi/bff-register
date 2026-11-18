import sgMail from "@sendgrid/mail";
import { attendeeStore } from "../../db/app";
import { getTicketByName, sql } from "../../db/db";
import { createFinalEmailHandler, createFinalEmailStore } from "../../lib/app/final-email";

const preview = process.env.BFF_PREVIEW === "true" && process.env.NODE_ENV !== "production";
const mailer = new sgMail.MailService();
if (!preview && process.env.SENDGRID_API_KEY) mailer.setApiKey(process.env.SENDGRID_API_KEY);
mailer.setTimeout(15000);

export default createFinalEmailHandler({
  store: createFinalEmailStore(sql),
  issueAccess: attendeeStore.issueAccess,
  getClassSchedule: attendeeStore.classSchedule,
  getLevelLabel: async (level) => level ? (await getTicketByName(level))[0]?.label || "" : "",
  send: preview ? async () => {} : (message) => mailer.send(message),
  preview,
});
