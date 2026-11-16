import crypto from "crypto";
import { safeEqual } from "../admin/session";
import { RegistrationError } from "../reg2026/errors";

export const SESSION_SECONDS = 90 * 24 * 60 * 60;
export const tokenHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

export const signingSecret = () => {
  const secret = process.env.APP_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    throw new RegistrationError(
      503,
      "Participant app access is not configured yet.",
    );
  return secret;
};

export const credentialToken = (access, purpose) => {
  const digest = crypto
    .createHmac("sha256", signingSecret())
    .update(`blues-fever-2026:${purpose}:${access.id}:${access.nonce}`)
    .digest("base64url");
  return `bf26.${purpose}.${access.id}.${digest}`;
};

export const tokenId = (token, purpose) => {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  return parts.length === 4 &&
    parts[0] === "bf26" &&
    parts[1] === purpose &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
      parts[2],
    ) &&
    /^[A-Za-z0-9_-]{43}$/.test(parts[3])
    ? parts[2]
    : null;
};

export const validCredential = (access, token, purpose) =>
  !!access &&
  !access.revoked_at &&
  new Date(access.expires_at).getTime() > Date.now() &&
  safeEqual(credentialToken(access, purpose), token);

export const linkExpiry = () => {
  const raw = process.env.APP_LINK_EXPIRES_AT;
  const expiry = raw
    ? new Date(raw)
    : new Date(Date.now() + SESSION_SECONDS * 1000);
  if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) {
    throw new RegistrationError(
      503,
      "Participant app link expiry must be a future date.",
    );
  }
  return expiry;
};

export const appOrigin = () => {
  let url;
  try {
    url = new URL(process.env.APP_ORIGIN);
  } catch {
    throw new RegistrationError(
      503,
      "Participant app origin is not configured yet.",
    );
  }
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  ) {
    throw new RegistrationError(
      503,
      "Participant app origin must be an HTTPS origin (or local development origin).",
    );
  }
  return url.origin;
};

export const accessUrl = (access) =>
  `${appOrigin()}/claim#token=${credentialToken(access, "access")}`;
