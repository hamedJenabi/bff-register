import { requireAdmin } from "../../../lib/admin/session";
import { registrationStore as store } from "../../../db/reg2026";
import { RegistrationError } from "../../../lib/reg2026/errors";
import { apiError } from "../../../lib/reg2026/http";
import { getScheduleAdminState, getScheduleSource, saveScheduleCapacity, syncScheduleFromSheet } from "../../../lib/reg2026/google-sheets";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  }
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === "GET") return res.json(await getScheduleAdminState(store));
    if (req.body?.action === "sync") return res.json(await syncScheduleFromSheet(store, req.body.version));
    if (req.body?.action === "capacity") return res.json(await saveScheduleCapacity(store, req.body));
    const source = getScheduleSource(await store.schedulePublication());
    if (source.configured) throw new RegistrationError(409, "Edit the schedule in Google Sheets, then sync it from the Schedule dashboard.");
    if (typeof req.body?.id !== "string" || !Number.isSafeInteger(req.body?.version) || req.body.version < 0) {
      throw new RegistrationError(422, "Reload the current class details before saving.");
    }
    const session = await store.editSchedule(req.body.id, req.body.values, req.body.version);
    return res.json({ session, schedule: await store.schedule() });
  } catch (error) { return apiError(res, error); }
}
