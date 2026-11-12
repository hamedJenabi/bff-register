import { requireAdmin } from "../../../lib/admin/session";
import { registrationStore as store } from "../../../db/reg2026";
import { RegistrationError } from "../../../lib/reg2026/errors";
import { apiError } from "../../../lib/reg2026/http";
import { canonicalOrigin } from "../../../lib/reg2026/payments";
import { buildRegistrationPath, getIdentityValue } from "../../../lib/reg2026/security";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.body?.id);
    if (!/^\d+$/.test(String(req.body?.id)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
      throw new RegistrationError(422, "A valid participant ID is required.");
    }
    const participant = await store.participantById(id);
    if (!participant) throw new RegistrationError(404, "Participant not found.");
    if (participant.status !== "confirmed") {
      throw new RegistrationError(409, "Registration links are available for confirmed participants.");
    }
    const matches = await store.findParticipants(getIdentityValue(participant));
    if (matches.length !== 1 || matches[0].id !== id) {
      throw new RegistrationError(409, "This email and first name identify multiple participants. Resolve the duplicate registration first.");
    }
    return res.json({ registrationUrl: canonicalOrigin() + buildRegistrationPath(participant) });
  } catch (error) { return apiError(res, error); }
}
