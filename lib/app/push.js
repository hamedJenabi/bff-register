import crypto from "crypto";
import webpush from "web-push";
import { RegistrationError } from "../reg2026/errors";
export const pushConfiguration = () => {
  const publicKey = process.env.APP_PUSH_PUBLIC_KEY;
  const privateKey = process.env.APP_PUSH_PRIVATE_KEY;
  const subject = process.env.APP_PUSH_SUBJECT;
  return publicKey && privateKey && subject
    ? { publicKey, privateKey, subject }
    : null;
};
export const validateSubscription = (value) => {
  let url;
  try {
    url = new URL(value?.endpoint);
  } catch {
    throw new RegistrationError(422, "Invalid notification subscription.");
  }
  const host = url.hostname;
  // These are push-service destinations, never arbitrary participant-supplied URLs.
  const allowed =
    host === "fcm.googleapis.com" ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".push.apple.com") ||
    host.endsWith(".notify.windows.com");
  if (
    !allowed ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    value.endpoint.length > 2048
  )
    throw new RegistrationError(422, "Unsupported notification service.");
  const { p256dh, auth } = value.keys || {};
  if (
    !/^[A-Za-z0-9_-]{87}={0,2}$/.test(p256dh || "") ||
    !/^[A-Za-z0-9_-]{22}={0,2}$/.test(auth || "")
  )
    throw new RegistrationError(422, "Invalid notification keys.");
  try {
    crypto.ECDH.convertKey(Buffer.from(p256dh, "base64url"), "prime256v1");
  } catch {
    throw new RegistrationError(422, "Invalid notification keys.");
  }
  return { endpoint: value.endpoint, p256dh, auth };
};
export const sendWebPush = async (subscription, payload) => {
  const configuration = pushConfiguration();
  if (!configuration)
    throw new RegistrationError(503, "Push notifications are not configured.");
  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails: configuration,
    TTL: 86400,
    timeout: 7000,
    urgency: "normal",
  });
};
