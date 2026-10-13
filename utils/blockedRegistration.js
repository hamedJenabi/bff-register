// This module is imported only by API routes, so the blocklist stays server-side.
const blockedEmails = new Set(["jakubkrajewskidesign@gmail.com"]);
const blockedFullNames = new Set([
  "jakub krajewski",
  "kuba krajewski",
]);

const normalize = (value) =>
  typeof value === "string"
    ? value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
    : "";

export function isBlockedRegistration(user) {
  const email = normalize(user?.email);
  const fullName = `${normalize(user?.firstname)} ${normalize(user?.lastname)}`.trim();

  return blockedEmails.has(email) || blockedFullNames.has(fullName);
}
