import { requireAdmin } from "../admin/session";
import { scheduleDays } from "../reg2026/catalog";
import { RegistrationError } from "../reg2026/errors";
import { titleCase } from "../../utils/functions";
import { appOrigin, linkExpiry, signingSecret } from "./security";

const ticketLabels = { partyPass: "Party Pass", fullpass: "Full Pass", parentPass: "Parent Pass" };
const classDays = [...scheduleDays, null];

export const createFinalEmailStore = (sql) => ({
  ready: async () => {
    const [tables] = await sql`SELECT to_regclass('registration_final_emails_26') IS NOT NULL
      AND to_regclass('attendee_access_26') IS NOT NULL AS ready`;
    if (!tables.ready) throw new RegistrationError(503, "Apply the attendee access and final email migrations before sending.");
  },
  recipients: () => sql`SELECT id, firstname, lastname, email FROM registrations_26 WHERE status = 'confirmed' ORDER BY id`,
  claim: (id) => sql.begin(async (tx) => {
    const [participant] = await tx`SELECT id, firstname, lastname, email, country, ticket, level, lunch, theme_class,
      competition, open_mixnmatch_role, newcomers_mixnmatch_role, strictly_role, competitions
      FROM registrations_26 WHERE id = ${id} AND status = 'confirmed' FOR SHARE`;
    if (!participant) throw new RegistrationError(409, "This registration is no longer confirmed.");

    await tx`INSERT INTO registration_final_emails_26 (registration_id) VALUES (${id}) ON CONFLICT DO NOTHING`;
    const [delivery] = await tx`SELECT status, attempts, updated_at < NOW() - INTERVAL '10 minutes' AS stale
      FROM registration_final_emails_26 WHERE registration_id = ${id} FOR UPDATE`;
    if (delivery.status === "sent") return { status: "already_sent" };
    if (delivery.status === "uncertain") return { status: "uncertain" };
    if (delivery.status === "sending") {
      if (!delivery.stale) return { status: "sending" };
      await tx`UPDATE registration_final_emails_26 SET status = 'uncertain', updated_at = NOW() WHERE registration_id = ${id}`;
      return { status: "uncertain" };
    }
    const attempt = delivery.attempts + 1;
    await tx`UPDATE registration_final_emails_26 SET status = 'sending', attempts = ${attempt}, updated_at = NOW() WHERE registration_id = ${id}`;
    return { status: "claimed", participant, attempt };
  }),
  finish: (id, attempt, status) => sql`UPDATE registration_final_emails_26
    SET status = ${status}, updated_at = NOW()
    WHERE registration_id = ${id} AND attempts = ${attempt} AND status IN ('sending', 'uncertain')`,
});

export const createFinalEmailHandler = ({ store, issueAccess, getClassSchedule, getLevelLabel, send, preview = false }) => async (req, res) => {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }
  if (!requireAdmin(req, res)) return;
  try {
    if (!preview && process.env.FINAL_EMAIL_ENABLED !== "true") {
      throw new RegistrationError(503, "Final email sending is disabled. Enable it after the SendGrid template is ready.");
    }
    if (!preview && !process.env.SENDGRID_API_KEY) throw new RegistrationError(503, "Configure SendGrid before sending the final email.");
    signingSecret();
    appOrigin();
    linkExpiry();
    await store.ready();
    if (req.method === "GET") return res.json({ recipients: await store.recipients() });

    const id = req.body?.id;
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new RegistrationError(422, "Select a valid registration.");
    const { status, participant, attempt } = await store.claim(id);
    if (status !== "claimed") return res.json({ status });

    let message;
    try {
      const [level, { classes }] = await Promise.all([
        getLevelLabel(participant.level),
        getClassSchedule(participant),
      ]);
      const { url, access } = await issueAccess(id);
      message = {
        from: "registration@bluesfever.eu",
        to: participant.email,
        template_id: "d-faecb94e7a544674883c69bc2421b9ec",
        dynamic_template_data: {
          firstname: participant.firstname,
          lastname: participant.lastname,
          country: participant.country,
          level,
          ticket: ticketLabels[participant.ticket] || "",
          classes: classes.map(({ title, day, start, end, teachers, room, role }) => ({
            title, day, start, end, teachers, room, role: titleCase(role) || "",
          })).sort((left, right) => classDays.indexOf(left.day) - classDays.indexOf(right.day) ||
            (left.start || "").localeCompare(right.start || "")),
          lunch: participant.lunch || "No",
          themeClass: participant.theme_class ? titleCase(participant.theme_class) : "No",
          competition: ["yes", "later"].includes(participant.competition),
          competitionAnswer: participant.competition === "later" ? "I will decide later" : "No",
          open_mixnmatch_role: participant.open_mixnmatch_role || "",
          newcomers_mixnmatch_role: participant.newcomers_mixnmatch_role || "",
          strictly_role: participant.strictly_role || "",
          competitions: participant.competitions?.split(",").map(titleCase).join(",") || "",
          appAccessUrl: url,
          accessExpiresAt: new Date(access.expires_at).toISOString(),
        },
        tracking_settings: { click_tracking: { enable: false, enable_text: false } },
      };
    } catch (error) {
      await store.finish(id, attempt, "failed");
      if (error instanceof RegistrationError) throw error;
      throw new RegistrationError(500, "The final email could not be prepared. You can retry this registration.");
    }

    try {
      await send(message);
    } catch (error) {
      const code = error?.code;
      const rejected = error?.response && Number.isInteger(code) && code >= 400 && code < 500 && code !== 408;
      await store.finish(id, attempt, rejected ? "failed" : "uncertain");
      if ([401, 403, 429].includes(code) && rejected) {
        throw new RegistrationError(503, "SendGrid rejected the request. Check the sender configuration or rate limit before resuming.");
      }
      if (rejected) throw new RegistrationError(502, "SendGrid rejected this email. Correct the issue before retrying.");
      return res.json({ status: "uncertain" });
    }
    await store.finish(id, attempt, "sent");
    return res.json({ status: "sent" });
  } catch (error) {
    return res.status(error instanceof RegistrationError ? error.status : 500).json({
      error: error instanceof RegistrationError ? error.message : "Final email status could not be confirmed. Review the result before retrying.",
    });
  }
};
