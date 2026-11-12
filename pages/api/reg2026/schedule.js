import { requireAdmin } from "../../../lib/admin/session";
import { registrationStore as store } from "../../../db/reg2026";
import { RegistrationError } from "../../../lib/reg2026/errors";
import { apiError } from "../../../lib/reg2026/http";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return res.json({ schedule: await store.schedule() });
    if (typeof req.body?.id !== "string" || !Number.isSafeInteger(req.body?.version) || req.body.version < 0) {
      throw new RegistrationError(422, "Reload the current class details before saving.");
    }
    const session = await store.editSchedule(req.body.id, req.body.values, req.body.version);
    return res.json({ session, schedule: await store.schedule() });
  } catch (error) { return apiError(res, error); }
}
