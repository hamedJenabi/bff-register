import { registrationStore as store } from "../../../db/reg2026";
import { requireAdmin } from "../../../lib/admin/session";
import { queueInvitations, processDeliveryBatch } from "../../../lib/reg2026/invitations";
import { apiError } from "../../../lib/reg2026/http";
export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === "GET") return res.json({ summary: await store.deliverySummary() });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).end(); }
  try {
    if (req.body?.action === "queue") await queueInvitations(store);
    else if (!["send", "retry"].includes(req.body?.action)) return res.status(422).json({ error: "Unknown delivery action" });
    const processed = req.body.action === "queue" ? 0 : await processDeliveryBatch(store, req.body.action === "retry");
    return res.json({ processed, summary: await store.deliverySummary() });
  } catch (error) { return apiError(res, error); }
}
