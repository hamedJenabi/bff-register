import { clearAdminSession, requireAdmin } from "../../lib/admin/session";
export default function logout(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).end(); }
  if (!requireAdmin(req, res)) return;
  clearAdminSession(res);
  return res.json({ authenticated: false });
}
