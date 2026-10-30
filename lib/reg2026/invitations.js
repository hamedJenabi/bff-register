import { RegistrationError } from "./errors";
import { canonicalOrigin } from "./payments";
import { buildRegistrationPath } from "./security";
import { requireAdmin } from "../admin/session";
import { hasRegisteredClasses } from "./serialization";
import { assertRegistrationOpen } from "./access";

const PLACEHOLDER_TEMPLATE_ID = "d-00000000000000000000000000000000";
const DEFAULT_TEMPLATE_ID = "d-e5d1923545f34993b9694b4dbf215172";

export const invitationTemplateId = () => {
  const id = process.env.REG2026_INVITATION_TEMPLATE_ID || DEFAULT_TEMPLATE_ID;
  if (!id || id === PLACEHOLDER_TEMPLATE_ID || !/^d-[a-f0-9]{32}$/i.test(id)) {
    throw new RegistrationError(503, "Configure the schedule-invitation SendGrid template before sending.");
  }
  return id;
};

export const registrationInvitationMessage = (participant, templateId) => ({
  from: "registration@bluesfever.eu",
  to: participant.email,
  template_id: templateId,
  dynamic_template_data: {
    firstname: participant.firstname,
    lastname: participant.lastname,
    isPartyPass: participant.ticket === "partyPass",
    regi2026link: canonicalOrigin() + buildRegistrationPath(participant),
  },
  tracking_settings: {
    click_tracking: { enable: false, enable_text: false },
  },
});

export const createRegistrationInvitationStore = (sql) => ({
  ready: async () => {
    const [result] = await sql`SELECT to_regclass('registration_schedule_invitations_26')::text AS table_name`;
    if (!result.table_name) {
      throw new RegistrationError(503, "Schedule invitations need database migration 00014 before sending.");
    }
  },
  claim: (id) => sql.begin(async (tx) => {
    const [participant] = await tx`SELECT id, firstname, lastname, email, ticket, theme_class
      FROM registrations_26 WHERE id = ${id} AND status = 'confirmed' FOR SHARE`;
    if (!participant) return { status: "ineligible" };
    const [completed] = await tx`SELECT EXISTS(SELECT 1 FROM reg2026_orders
      WHERE registration_id = ${id} AND status = 'confirmed' AND reopened_at IS NULL) AS present`;
    if (completed.present || hasRegisteredClasses(participant)) return { status: "completed" };
    const [identity] = await tx`SELECT COUNT(*)::INTEGER AS count FROM registrations_26
      WHERE status = 'confirmed' AND email || '+' || firstname = ${participant.email + "+" + participant.firstname}`;
    if (identity.count !== 1) return { status: "ambiguous" };

    await tx`INSERT INTO registration_schedule_invitations_26 (registration_id)
      VALUES (${id}) ON CONFLICT DO NOTHING`;
    const [delivery] = await tx`SELECT status, updated_at FROM registration_schedule_invitations_26
      WHERE registration_id = ${id} FOR UPDATE`;
    if (delivery.status === "sent") return { status: "already_sent" };
    if (delivery.status === "uncertain") return { status: "uncertain" };
    if (delivery.status === "sending") {
      if (Date.now() - new Date(delivery.updated_at).getTime() > 10 * 60 * 1000) {
        await tx`UPDATE registration_schedule_invitations_26 SET status = 'uncertain', updated_at = NOW()
          WHERE registration_id = ${id}`;
        return { status: "uncertain" };
      }
      return { status: "sending" };
    }
    await tx`UPDATE registration_schedule_invitations_26
      SET status = 'sending', attempts = attempts + 1, updated_at = NOW()
      WHERE registration_id = ${id}`;
    return { status: "claimed", participant };
  }),
  finish: (id, status) => sql`UPDATE registration_schedule_invitations_26
    SET status = ${status}, sent_at = CASE WHEN ${status} = 'sent' THEN NOW() ELSE sent_at END,
      updated_at = NOW()
    WHERE registration_id = ${id} AND status = 'sending'`,
});

export const createRegistrationInvitationHandler = ({ store, send }) => async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.body?.id);
    if (!/^\d+$/.test(String(req.body?.id)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
      throw new RegistrationError(422, "Select a valid confirmed participant.");
    }
    const templateId = invitationTemplateId();
    assertRegistrationOpen();
    canonicalOrigin();
    if (!process.env.REG2026_SIGNING_SECRET) {
      throw new RegistrationError(503, "Configure the schedule registration signing secret before sending.");
    }
    await store.ready();
    const claim = await store.claim(id);
    if (claim.status === "ineligible") throw new RegistrationError(409, "This participant is no longer confirmed.");
    if (claim.status === "ambiguous") throw new RegistrationError(409, "This participant shares a registration-link identity. Resolve the duplicate before sending.");
    if (claim.status !== "claimed") return res.json({ status: claim.status });
    const message = registrationInvitationMessage(claim.participant, templateId);
    try {
      await send(message);
    } catch {
      await store.finish(id, "failed");
      throw new RegistrationError(502, "The schedule invitation could not be sent. Retry this participant later.");
    }
    await store.finish(id, "sent");
    return res.json({ status: "sent" });
  } catch (error) {
    return res.status(error instanceof RegistrationError ? error.status : 500).json({
      error: error instanceof RegistrationError ? error.message : "Schedule invitations are temporarily unavailable.",
    });
  }
};
