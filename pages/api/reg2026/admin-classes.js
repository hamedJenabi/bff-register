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
    const rawId = req.method === "GET" ? req.query.id : req.body?.id;
    const id = Number(rawId);
    if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
      throw new RegistrationError(422, "A valid participant ID is required.");
    }
    if (req.method === "GET") return res.json(await store.organizerClasses(id));
    if (typeof req.body.version !== "string" || req.body.version.length > 10000) {
      throw new RegistrationError(422, "Reload the current class choices before saving.");
    }
    if (req.body.action && req.body.action !== "reopen") throw new RegistrationError(422, "Unknown class action.");
    const saved = req.body.action === "reopen"
      ? await store.reopenClasses(id, req.body.version)
      : await store.editClasses(id, req.body.classes, req.body.version);
    return res.json({ ...saved, availability: (await store.availability(id)).classes });
  } catch (error) { return apiError(res, error); }
}
