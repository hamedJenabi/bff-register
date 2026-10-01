import {
  setAdminSession,
  safeEqual,
  sameOrigin,
} from "../../lib/admin/session";
export default async function login(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!sameOrigin(req))
    return res.status(403).json({ error: "Origin is not allowed" });
  if (
    !process.env.ADMIN_USER ||
    !process.env.HASHED_PASS ||
    !process.env.ADMIN_SESSION_SECRET
  ) {
    return res
      .status(503)
      .json({ error: "Organizer login is not configured." });
  }
  if (
    !safeEqual(req.body?.userName, process.env.ADMIN_USER) ||
    !safeEqual(req.body?.password, process.env.HASHED_PASS)
  ) {
    return res.status(401).json({ error: "Wrong username or password" });
  }
  setAdminSession(res);
  return res.json({ authenticated: true });
}
