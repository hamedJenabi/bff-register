import crypto from "crypto";
import { promisify } from "util";
import { RegistrationError } from "../reg2026/errors";
const scrypt = promisify(crypto.scrypt);
export const ADMIN_SECONDS = 30 * 24 * 60 * 60;
export const hashAdminPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt:${salt}:${key.toString("hex")}`;
};
export const adminCredential = () => {
  const hash = process.env.APP_ADMIN_PASSWORD_HASH;
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(hash || ""))
    throw new RegistrationError(503, "Festival admin login is not configured.");
  return hash;
};
export const verifyAdminPassword = async (password, hash) => {
  if (typeof password !== "string" || password.length > 256) return false;
  const [, salt, expected] = hash.split(":");
  const key = await scrypt(password, salt, 64, {
    N: 32768,
    maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(key, Buffer.from(expected, "hex"));
};
