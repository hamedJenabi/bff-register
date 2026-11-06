import crypto from "crypto";
import { RegistrationError } from "../reg2026/errors";
import { randomToken, tokenHash } from "./security";
import {
  ADMIN_SECONDS,
  adminCredential,
  verifyAdminPassword,
} from "./admin-security";
import { pushConfiguration, sendWebPush, validateSubscription } from "./push";
const uuid = (value) => {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value || "",
    )
  )
    throw new RegistrationError(422, "Invalid item ID.");
  return value;
};
const text = (value, name, max) => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new RegistrationError(
      422,
      `${name} is required (up to ${max} characters).`,
    );
  return value.trim();
};
const content = (body) => {
  const title = text(body?.title, "Title", 120),
    description = text(body?.description, "Description", 1000);
  if (Buffer.byteLength(JSON.stringify({ title, description })) > 3000)
    throw new RegistrationError(422, "Please shorten the message.");
  return { title, description };
};
const announcementColumns = (sql) =>
  sql`id,title,description,to_char(expires_on,'YYYY-MM-DD') AS "expiresOn",archived_at AS "archivedAt",created_at AS "createdAt"`;

export const createContentStore = (sql, { sendPush = sendWebPush } = {}) => {
  const publicAnnouncements =
    () => sql`SELECT ${announcementColumns(sql)} FROM festival_announcements_26
    WHERE archived_at IS NULL AND (expires_on IS NULL OR expires_on >= (NOW() AT TIME ZONE 'Europe/Vienna')::date)
    ORDER BY created_at DESC,id`;
  const requireAdmin = async (token) => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || ""))
      throw new RegistrationError(401, "Sign in to festival admin.");
    const hash = tokenHash(adminCredential());
    const [session] =
      await sql`SELECT expires_at FROM festival_admin_sessions_26 WHERE token_hash=${tokenHash(token)} AND credential_hash=${hash} AND expires_at > NOW()`;
    if (!session)
      throw new RegistrationError(
        401,
        "Your admin session has ended. Sign in again.",
      );
    return { username: "bff2026-admin", expiresAt: session.expires_at };
  };
  const stats = async (id) => {
    const [message] =
      await sql`SELECT id,title,description,created_at AS "createdAt" FROM festival_push_messages_26 WHERE id=${uuid(id)}`;
    if (!message) throw new RegistrationError(404, "Notification not found.");
    const counts =
      await sql`SELECT status,count(*)::int AS count FROM festival_push_deliveries_26 WHERE message_id=${id} GROUP BY status`;
    return {
      ...message,
      counts: Object.fromEntries(counts.map((row) => [row.status, row.count])),
      total: counts.reduce((total, row) => total + row.count, 0),
    };
  };
  return {
    publicAnnouncements,
    requireAdmin,
    login: async (username, password) => {
      const credential = adminCredential();
      const result = await sql.begin(async (tx) => {
        await tx`INSERT INTO festival_admin_attempts_26(id) VALUES(1) ON CONFLICT DO NOTHING`;
        const [rate] =
          await tx`SELECT * FROM festival_admin_attempts_26 WHERE id=1 FOR UPDATE`;
        let attempts = rate.attempts;
        if (
          Date.now() - new Date(rate.window_start).getTime() >=
          15 * 60 * 1000
        ) {
          attempts = 0;
          await tx`UPDATE festival_admin_attempts_26 SET attempts=0,window_start=NOW() WHERE id=1`;
        }
        if (attempts >= 10) return { limited: true };
        // Count invalid usernames too, and serialize checks across server instances.
        const valid = await verifyAdminPassword(password, credential);
        if (username !== "bff2026-admin" || !valid) {
          await tx`UPDATE festival_admin_attempts_26 SET attempts=attempts+1 WHERE id=1`;
          return { invalid: true };
        }
        await tx`UPDATE festival_admin_attempts_26 SET attempts=0,window_start=NOW() WHERE id=1`;
        const token = randomToken(),
          expiresAt = new Date(Date.now() + ADMIN_SECONDS * 1000);
        await tx`INSERT INTO festival_admin_sessions_26(token_hash,credential_hash,expires_at) VALUES(${tokenHash(token)},${tokenHash(credential)},${expiresAt})`;
        return {
          token,
          expiresAt: expiresAt.toISOString(),
          username: "bff2026-admin",
        };
      });
      if (result.limited)
        throw new RegistrationError(
          429,
          "Too many login attempts. Try again in 15 minutes.",
        );
      if (result.invalid)
        throw new RegistrationError(401, "Incorrect username or password.");
      return result;
    },
    logout: async (token) => {
      if (token)
        await sql`DELETE FROM festival_admin_sessions_26 WHERE token_hash=${tokenHash(token)}`;
    },
    overview: async (token) => {
      const session = await requireAdmin(token);
      const announcements = await sql`SELECT ${announcementColumns(sql)},
        (archived_at IS NOT NULL OR (expires_on IS NOT NULL AND expires_on < (NOW() AT TIME ZONE 'Europe/Vienna')::date)) AS inactive
        FROM festival_announcements_26 ORDER BY created_at DESC,id`;
      const [audience] =
        await sql`SELECT count(*)::int AS devices,count(DISTINCT s.registration_id)::int AS participants FROM festival_push_subscriptions_26 s JOIN registrations_26 r ON r.id=s.registration_id WHERE r.status='confirmed'`;
      const messages =
        await sql`SELECT id FROM festival_push_messages_26 ORDER BY created_at DESC LIMIT 10`;
      return {
        ...session,
        announcements,
        audience,
        pushConfigured: !!pushConfiguration(),
        notifications: await Promise.all(messages.map((m) => stats(m.id))),
      };
    },
    saveAnnouncement: async (token, body) => {
      await requireAdmin(token);
      const { title, description } = content(body);
      const expiresOn = body.expiresOn || null;
      if (
        expiresOn &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ||
          !Number.isFinite(Date.parse(`${expiresOn}T12:00:00Z`)) ||
          new Date(`${expiresOn}T12:00:00Z`).toISOString().slice(0, 10) !==
            expiresOn)
      )
        throw new RegistrationError(422, "Enter a valid expiry date.");
      const id = body.id ? uuid(body.id) : crypto.randomUUID();
      if (body.id) {
        const rows =
          await sql`UPDATE festival_announcements_26 SET title=${title},description=${description},expires_on=${expiresOn},updated_at=NOW() WHERE id=${id} AND archived_at IS NULL RETURNING id`;
        if (!rows.length)
          throw new RegistrationError(404, "Announcement not found.");
      } else
        await sql`INSERT INTO festival_announcements_26(id,title,description,expires_on) VALUES(${id},${title},${description},${expiresOn})`;
      return { id };
    },
    archiveAnnouncement: async (token, id) => {
      await requireAdmin(token);
      await sql`UPDATE festival_announcements_26 SET archived_at=NOW(),updated_at=NOW() WHERE id=${uuid(id)}`;
      return { ok: true };
    },
    subscribe: async (registrationId, body) => {
      if (!pushConfiguration())
        throw new RegistrationError(
          503,
          "Push notifications are not configured.",
        );
      const { endpoint, p256dh, auth } = validateSubscription(body);
      // A participant can register their own device, not reassign another's endpoint.
      const rows =
        await sql`INSERT INTO festival_push_subscriptions_26(id,registration_id,endpoint,p256dh,auth)
        VALUES(${crypto.randomUUID()},${registrationId},${endpoint},${p256dh},${auth})
        ON CONFLICT(endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh,auth=EXCLUDED.auth
        WHERE festival_push_subscriptions_26.registration_id=EXCLUDED.registration_id RETURNING id`;
      if (!rows.length)
        throw new RegistrationError(
          409,
          "This device is subscribed to another registration. Disable notifications there first.",
        );
      return { ok: true };
    },
    unsubscribe: async (registrationId, endpoint) => {
      if (typeof endpoint !== "string" || endpoint.length > 2048)
        throw new RegistrationError(422, "Invalid device subscription.");
      await sql`DELETE FROM festival_push_subscriptions_26 WHERE registration_id=${registrationId} AND endpoint=${endpoint}`;
      return { ok: true };
    },
    queuePush: async (token, body) => {
      await requireAdmin(token);
      if (!pushConfiguration())
        throw new RegistrationError(
          503,
          "Push notifications are not configured.",
        );
      const { title, description } = content(body),
        requestId = uuid(body.requestId);
      const id = await sql.begin(async (tx) => {
        const [message] =
          await tx`INSERT INTO festival_push_messages_26(id,request_id,title,description) VALUES(${crypto.randomUUID()},${requestId},${title},${description}) ON CONFLICT(request_id) DO NOTHING RETURNING id`;
        if (!message) {
          const [existing] =
            await tx`SELECT * FROM festival_push_messages_26 WHERE request_id=${requestId}`;
          if (existing.title !== title || existing.description !== description)
            throw new RegistrationError(
              409,
              "This send request was already used for another message.",
            );
          return existing.id;
        }
        await tx`INSERT INTO festival_push_deliveries_26(message_id,subscription_id)
          SELECT ${message.id},s.id FROM festival_push_subscriptions_26 s JOIN registrations_26 r ON r.id=s.registration_id WHERE r.status='confirmed'`;
        return message.id;
      });
      return stats(id);
    },
    processPush: async (token, id) => {
      await requireAdmin(token);
      const message = await stats(id);
      // Lost requests have uncertain delivery. Never automatically resend them.
      await sql`UPDATE festival_push_deliveries_26 SET status='unknown',updated_at=NOW() WHERE message_id=${id} AND status='sending' AND updated_at < NOW()-INTERVAL '2 minutes'`;
      const batch = await sql.begin(async (tx) => {
        const rows =
          await tx`SELECT subscription_id FROM festival_push_deliveries_26 WHERE message_id=${id} AND status='pending' ORDER BY subscription_id LIMIT 20 FOR UPDATE SKIP LOCKED`;
        for (const row of rows)
          await tx`UPDATE festival_push_deliveries_26 SET status='sending',updated_at=NOW() WHERE message_id=${id} AND subscription_id=${row.subscription_id}`;
        return rows;
      });
      // Twenty bounded requests in parallel; progress is durable between batches.
      await Promise.all(
        batch.map(async ({ subscription_id }) => {
          let status = "expired";
          const [subscription] =
            await sql`SELECT s.* FROM festival_push_subscriptions_26 s JOIN registrations_26 r ON r.id=s.registration_id WHERE s.id=${subscription_id} AND r.status='confirmed'`;
          if (subscription) {
            try {
              await sendPush(
                {
                  endpoint: subscription.endpoint,
                  keys: {
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                  },
                },
                {
                  title: message.title,
                  description: message.description,
                  url: "/",
                  tag: message.id,
                },
              );
              status = "sent";
            } catch (error) {
              status = [404, 410].includes(error.statusCode)
                ? "expired"
                : "failed";
              if (status === "expired")
                await sql`DELETE FROM festival_push_subscriptions_26 WHERE id=${subscription_id}`;
            }
          }
          await sql`UPDATE festival_push_deliveries_26 SET status=${status},updated_at=NOW() WHERE message_id=${id} AND subscription_id=${subscription_id}`;
        }),
      );
      return stats(id);
    },
  };
};
