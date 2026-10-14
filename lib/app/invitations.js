import { requireAdmin } from "../admin/session";
import { RegistrationError } from "../reg2026/errors";

export const createAppInvitationHandler =
  ({ participant, issueAccess, send }) =>
  async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).end();
    }
    if (!requireAdmin(req, res)) return;
    try {
      if (process.env.APP_INVITATIONS_ENABLED !== "true") {
        throw new RegistrationError(
          403,
          "App invitations are currently disabled.",
        );
      }
      const template = process.env.APP_INVITATION_TEMPLATE_ID;
      if (!template || !/^d-[a-f0-9]{32}$/i.test(template)) {
        throw new RegistrationError(
          503,
          "Configure a dedicated SendGrid app-invitation template before sending.",
        );
      }
      const id = Number(req.body?.id);
      if (
        !/^\d+$/.test(String(req.body?.id)) ||
        !Number.isSafeInteger(id) ||
        id <= 0 ||
        id > 2147483647
      ) {
        throw new RegistrationError(
          422,
          "Select a valid participant before sending an app invitation.",
        );
      }
      const user = await participant(id);
      if (!user) throw new RegistrationError(404, "Participant not found.");
      if (user.status !== "confirmed")
        throw new RegistrationError(
          409,
          "App invitations are available for confirmed participants only.",
        );
      const { url, access } = await issueAccess(user.id);
      try {
        await send({
          from: "registration@bluesfever.eu",
          to: user.email,
          template_id: template,
          dynamic_template_data: {
            firstname: user.firstname,
            lastname: user.lastname,
            appAccessUrl: url,
            accessExpiresAt: new Date(access.expires_at).toISOString(),
          },
          tracking_settings: {
            click_tracking: { enable: false, enable_text: false },
          },
        });
      } catch {
        throw new RegistrationError(
          502,
          "App-invitation delivery failed. Please retry this participant.",
        );
      }
      return res.json({ ok: true, registrationId: user.id });
    } catch (error) {
      return res
        .status(error instanceof RegistrationError ? error.status : 500)
        .json({
          error:
            error instanceof RegistrationError
              ? error.message
              : "The app invitation could not be prepared. Please try again.",
        });
    }
  };
