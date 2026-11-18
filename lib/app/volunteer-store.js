import crypto from "crypto";
import { RegistrationError } from "../reg2026/errors";
import {
  appOrigin,
  credentialToken,
  randomToken,
  signingSecret,
  tokenHash,
  tokenId,
  validCredential,
} from "./security";

export const VOLUNTEER_SECONDS = 30 * 24 * 60 * 60;
const unauthorized = () => new RegistrationError(
  401,
  "Volunteer access has ended. Ask the organizer for the current volunteer link.",
);

export const createVolunteerStore = (sql) => {
  const locked = (action) => sql.begin(async (tx) => {
    // Serialize first creation as well as replacement/revocation across dynos.
    await tx`SELECT pg_advisory_xact_lock(2026, 2619)`;
    const [access] = await tx`SELECT * FROM festival_volunteer_access_26 FOR UPDATE`;
    return action(tx, access);
  });
  return {
    link: async (replace = false) => {
      signingSecret();
      const origin = appOrigin();
      return locked(async (tx, existing) => {
        let access = existing;
        if (replace || !access || access.revoked_at || new Date(access.expires_at).getTime() <= Date.now()) {
          const expires = new Date(Date.now() + VOLUNTEER_SECONDS * 1000);
          if (access) {
            await tx`DELETE FROM festival_volunteer_sessions_26 WHERE access_id=${access.id}`;
            [access] = await tx`UPDATE festival_volunteer_access_26 SET nonce=${randomToken()},
              expires_at=${expires},revoked_at=NULL,claim_count=0,claim_window=NOW() RETURNING *`;
          } else {
            [access] = await tx`INSERT INTO festival_volunteer_access_26(id,nonce,expires_at)
              VALUES(${crypto.randomUUID()},${randomToken()},${expires}) RETURNING *`;
          }
        }
        return {
          url: `${origin}/bff-volunteer#token=${credentialToken(access, "volunteer")}`,
          expiresAt: new Date(access.expires_at).toISOString(),
        };
      });
    },
    revoke: () => locked(async (tx, access) => {
      if (access) {
        await tx`UPDATE festival_volunteer_access_26 SET revoked_at=NOW()`;
        await tx`DELETE FROM festival_volunteer_sessions_26 WHERE access_id=${access.id}`;
      }
      return { ok: true };
    }),
    claim: async (token) => {
      signingSecret();
      const id = tokenId(token, "volunteer");
      if (!id) throw unauthorized();
      return sql.begin(async (tx) => {
        const [access] = await tx`SELECT * FROM festival_volunteer_access_26 WHERE id=${id} FOR UPDATE`;
        if (!validCredential(access, token, "volunteer")) throw unauthorized();
        const reset = Date.now() - new Date(access.claim_window).getTime() >= 15 * 60 * 1000;
        if (!reset && access.claim_count >= 500) {
          throw new RegistrationError(429, "Too many volunteer sign-ins. Try again in 15 minutes.");
        }
        await tx`UPDATE festival_volunteer_access_26 SET claim_count=${reset ? 1 : access.claim_count + 1},
          claim_window=${reset ? new Date() : access.claim_window} WHERE id=${id}`;
        const sessionToken = randomToken();
        const expiresAt = new Date(Math.min(new Date(access.expires_at).getTime(), Date.now() + VOLUNTEER_SECONDS * 1000));
        await tx`DELETE FROM festival_volunteer_sessions_26 WHERE access_id=${id} AND expires_at<=NOW()`;
        await tx`INSERT INTO festival_volunteer_sessions_26(token_hash,access_id,credential_hash,expires_at)
          VALUES(${tokenHash(sessionToken)},${id},${tokenHash(token)},${expiresAt})`;
        return { sessionToken, expiresAt: expiresAt.toISOString(), role: "volunteer" };
      });
    },
    requireVolunteer: async (token) => {
      signingSecret();
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw unauthorized();
      const [access] = await sql`SELECT a.*,s.credential_hash,s.expires_at AS session_expires_at
        FROM festival_volunteer_sessions_26 s JOIN festival_volunteer_access_26 a ON a.id=s.access_id
        WHERE s.token_hash=${tokenHash(token)} AND s.expires_at>NOW() AND a.expires_at>NOW() AND a.revoked_at IS NULL`;
      if (!access || access.credential_hash !== tokenHash(credentialToken(access, "volunteer"))) throw unauthorized();
      return { role: "volunteer", expiresAt: new Date(access.session_expires_at).toISOString() };
    },
    logout: async (token) => {
      if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        await sql`DELETE FROM festival_volunteer_sessions_26 WHERE token_hash=${tokenHash(token)}`;
      }
      return { ok: true };
    },
  };
};
