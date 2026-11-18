import crypto from "crypto";

const COOKIE = "bff_admin_session";
const secret = () => process.env.ADMIN_SESSION_SECRET || "";
const digest = (value) => crypto.createHmac("sha256", secret()).update(value).digest("base64url");
export const safeEqual = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = crypto.createHash("sha256").update(left).digest();
  const b = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(a, b);
};
export const hasAdminSession = (req) => {
  if (!secret() || !process.env.ADMIN_USER) return false;
  try {
    const cookie = (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE + "="));
    const [payload, signature, extra] = (cookie?.slice(COOKIE.length + 1) || "").split(".");
    if (!payload || !signature || extra || !safeEqual(digest(payload), signature)) return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString());
    return session.admin === process.env.ADMIN_USER && Number.isFinite(session.expires) && session.expires > Date.now();
  } catch { return false; }
};
export const setAdminSession = (res) => {
  if (!secret()) throw new Error("ADMIN_SESSION_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ admin: process.env.ADMIN_USER, expires: Date.now() + 8 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(16).toString("hex") })).toString("base64url");
  res.setHeader("Set-Cookie", `${COOKIE}=${payload}.${digest(payload)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
};
export const clearAdminSession = (res) => res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
export const sameOrigin = (req) => {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
};
export const requireAdmin = (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!hasAdminSession(req)) { res.status(401).json({ error: "Organizer login required." }); return false; }
  if (!["GET", "HEAD"].includes(req.method) && !sameOrigin(req)) {
    res.status(403).json({ error: "Origin is not allowed." }); return false;
  }
  return true;
};
export const adminPageRedirect = (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  return hasAdminSession(req) ? null : { redirect: { destination: "/login/admin", permanent: false } };
};
