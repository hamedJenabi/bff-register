import { requireAdmin } from "../../../lib/admin/session";
import { previewInvitations } from "../../../lib/reg2026/preview-invitation-mailbox";

export default function handler(req, res) {
  if (process.env.BFF_PREVIEW !== "true" || process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found." });
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end();
  }
  if (!requireAdmin(req, res)) return;
  return res.json({ invitations: previewInvitations() });
}
