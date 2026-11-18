import crypto from "crypto";

export const getIdentityValue = (participant) =>
  `${participant.email}+${participant.firstname}`;

const getSigningSecret = () => process.env.REG2026_SIGNING_SECRET || "";

export const signIdentity = (identity) => {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error("REG2026_SIGNING_SECRET is not configured");
  }

  return crypto.createHmac("sha256", secret).update(identity).digest("base64url");
};

export const verifyIdentitySignature = (identity, signature) => {
  if (typeof identity !== "string" || typeof signature !== "string") {
    return false;
  }

  let expected;
  try {
    expected = signIdentity(identity);
  } catch (error) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
};

export const buildRegistrationPath = (participant) => {
  const identity = getIdentityValue(participant);
  const query = new URLSearchParams({
    user: identity,
    sig: signIdentity(identity),
  });
  return `/reg2026?${query.toString()}`;
};
