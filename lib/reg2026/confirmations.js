import sgMail from "@sendgrid/mail";
import { competitions, scheduleDays } from "./catalog";
import { indexSchedule } from "./schedule";
import { capturePreviewConfirmation } from "./preview-invitation-mailbox";

const DEFAULT_TEMPLATE_ID = "d-4f77d740ec504650aa9ea1a78e785cae";
export const CONFIRMATION_WORKFLOW = "reg2026-automatic-confirmation";
const competitionById = Object.fromEntries(competitions.map((entry) => [entry.id, entry]));
const titleCase = (value) => value ? value[0].toUpperCase() + value.slice(1) : "";

export const confirmationPayload = (participant, draft, sessions) => {
  const byId = indexSchedule(sessions);
  const classes = draft.classes.map((choice) => {
    const session = byId[choice.sessionId];
    return {
      title: session.title,
      day: session.day,
      start: session.start,
      end: session.end,
      teachers: session.teachers,
      room: session.room,
      role: titleCase(choice.role),
    };
  }).sort((left, right) => scheduleDays.indexOf(left.day) - scheduleDays.indexOf(right.day) || left.start.localeCompare(right.start));
  return {
    workflow: CONFIRMATION_WORKFLOW,
    to: participant.email,
    data: {
      firstname: participant.firstname,
      classes,
      competitions: draft.competitions.map((id) => ({
        label: competitionById[id].label,
        role: titleCase(draft.competitionRoles[id]),
      })),
      lunch: draft.lunch.map(titleCase),
    },
  };
};

export const confirmationTemplateId = () => {
  const id = process.env.REG2026_CONFIRMATION_TEMPLATE_ID || DEFAULT_TEMPLATE_ID;
  if (!/^d-[a-f0-9]{32}$/i.test(id)) throw new Error("Configure a valid registration confirmation SendGrid template ID.");
  return id;
};

export const deliverConfirmation = async (store, orderId, send = null) => {
  let claimed;
  let providerAttempted = false;
  try {
    claimed = await store.claimConfirmation(orderId);
    if (claimed.status !== "claimed") return claimed.status;
    const message = {
      from: "registration@bluesfever.eu",
      to: claimed.payload.to,
      template_id: confirmationTemplateId(),
      dynamic_template_data: claimed.payload.data,
    };
    if (process.env.BFF_PREVIEW === "true" && process.env.NODE_ENV !== "production") {
      await capturePreviewConfirmation(message);
    } else {
      if (!send && !process.env.SENDGRID_API_KEY) throw new Error("SendGrid is not configured.");
      if (process.env.SENDGRID_API_KEY) sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      providerAttempted = true;
      await (send || ((email) => sgMail.send(email)))(message);
    }
  } catch (error) {
    const definiteFailure = !providerAttempted || !!error.response?.statusCode;
    if (claimed?.status === "claimed") {
      if (definiteFailure) {
        try {
          await store.finishConfirmation(claimed.id, "failed", "Confirmation email was not accepted by SendGrid.");
        } catch (finishError) {
          console.error("Could not record confirmation email failure:", finishError.message);
          return "uncertain";
        }
      }
    }
    console.error("Registration confirmation email failed:", error.message);
    // A transport error has no provider response. Keep 'sending' until an organizer checks delivery.
    return definiteFailure ? "failed" : "uncertain";
  }
  try {
    await store.finishConfirmation(claimed.id, "sent", "");
    return "sent";
  } catch (error) {
    // Leave the record in 'sending': provider acceptance is uncertain, so a retry could duplicate the email.
    console.error("Could not record confirmation email acceptance:", error.message);
    return "uncertain";
  }
};
