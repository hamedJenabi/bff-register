const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const postgres = require("postgres");
const webpush = require("web-push");
const { createContentStore } = require("../lib/app/content-store");
const { createContentHandlers } = require("../lib/app/content-http");
const { hashAdminPassword } = require("../lib/app/admin-security");
const { tokenHash } = require("../lib/app/security");
const { RegistrationError } = require("../lib/reg2026/errors");
const response = () => ({
  code: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(code) {
    this.code = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  end() {
    return this;
  },
});
test(
  "festival admin, announcements, and notification delivery on isolated Postgres",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const db = postgres(process.env.TEST_DATABASE_URL, { onnotice: () => {} });
    await db`CREATE SCHEMA app_admin_tests`;
    const sql = postgres(process.env.TEST_DATABASE_URL, {
      onnotice: () => {},
      connection: { search_path: "app_admin_tests" },
    });
    const keys = [
      "APP_ADMIN_PASSWORD_HASH",
      "APP_PUSH_PUBLIC_KEY",
      "APP_PUSH_PRIVATE_KEY",
      "APP_PUSH_SUBJECT",
    ];
    const previous = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      for (const migration of [
        "00004-CREAT-registraion-2026",
        "00012-festival-app-admin",
      ])
        await sql.begin((tx) => require(`../migrations/${migration}`).up(tx));
      const password = "fictional-isolated-admin-password";
      const vapid = webpush.generateVAPIDKeys();
      Object.assign(process.env, {
        APP_ADMIN_PASSWORD_HASH: await hashAdminPassword(password),
        APP_PUSH_PUBLIC_KEY: vapid.publicKey,
        APP_PUSH_PRIVATE_KEY: vapid.privateKey,
        APP_PUSH_SUBJECT: "mailto:test@example.com",
      });
      const people =
        await sql`INSERT INTO registrations_26(date,status,role,ticket,firstname,lastname,email,country) VALUES('2026','confirmed','advanced','fullpass','A','Test','a@example.com','Austria'),('2026','confirmed','beginner','partyPass','B','Test','b@example.com','Austria'),('2026','waiting','beginner','partyPass','C','Test','c@example.com','Austria') RETURNING id`;
      const delivered = [];
      const store = createContentStore(sql, {
        sendPush: async (subscription, payload) => {
          if (subscription.endpoint.endsWith("expired"))
            throw { statusCode: 410 };
          if (subscription.endpoint.endsWith("failed"))
            throw { statusCode: 503 };
          delivered.push(payload);
        },
      });
      const participantToken = crypto.randomBytes(32).toString("base64url");
      const attendee = {
        resolveSession: async (token) => {
          if (token !== participantToken)
            throw new RegistrationError(401, "Invalid participant");
          return { registration_id: people[0].id };
        },
      };
      const api = createContentHandlers(store, attendee);
      let admin;
      await t.test(
        "password validation, role isolation, and hashed 30-day sessions",
        async () => {
          await assert.rejects(
            store.login("wrong", password),
            (e) => e.status === 401,
          );
          await assert.rejects(
            store.login("bff2026-admin", "wrong"),
            (e) => e.status === 401,
          );
          admin = await store.login("bff2026-admin", password);
          const [row] = await sql`SELECT * FROM festival_admin_sessions_26`;
          assert.equal(row.token_hash, tokenHash(admin.token));
          assert.ok(
            Math.abs(new Date(admin.expiresAt) - Date.now() - 30 * 86400000) <
              5000,
          );
          await assert.rejects(
            store.requireAdmin(participantToken),
            (e) => e.status === 401,
          );
          const res = response();
          await api.manage.me(
            {
              method: "GET",
              headers: { authorization: `Bearer ${participantToken}` },
            },
            res,
          );
          assert.equal(res.code, 401);
          const other = await store.login("bff2026-admin", password);
          await sql`UPDATE festival_admin_sessions_26 SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=${tokenHash(other.token)}`;
          await assert.rejects(
            store.requireAdmin(other.token),
            (e) => e.status === 401,
          );
          const oldHash = process.env.APP_ADMIN_PASSWORD_HASH;
          process.env.APP_ADMIN_PASSWORD_HASH = await hashAdminPassword(
            "rotated-fictional-password",
          );
          await assert.rejects(
            store.requireAdmin(admin.token),
            (e) => e.status === 401,
          );
          process.env.APP_ADMIN_PASSWORD_HASH = oldHash;
        },
      );
      await t.test(
        "persistent announcements, expiry validation, edits, and soft archive",
        async () => {
          await assert.rejects(
            store.saveAnnouncement(participantToken, {
              title: "Denied",
              description: "Denied",
            }),
            (e) => e.status === 401,
          );
          const a = await store.saveAnnouncement(admin.token, {
            title: "Welcome",
            description: "Doors open\nBring your QR",
            expiresOn: null,
          });
          assert.equal((await store.publicAnnouncements())[0].expiresOn, null);
          assert.equal(
            (await store.publicAnnouncements())[0].description,
            "Doors open\nBring your QR",
          );
          await store.saveAnnouncement(admin.token, {
            id: a.id,
            title: "Changed",
            description: "Updated",
            expiresOn: "2020-01-01",
          });
          assert.equal((await store.publicAnnouncements()).length, 0);
          const [today] =
            await sql`SELECT to_char((NOW() AT TIME ZONE 'Europe/Vienna')::date,'YYYY-MM-DD') AS day`;
          await store.saveAnnouncement(admin.token, {
            id: a.id,
            title: "Today",
            description: "Visible today",
            expiresOn: today.day,
          });
          assert.equal((await store.publicAnnouncements()).length, 1);
          await assert.rejects(
            store.saveAnnouncement(admin.token, {
              title: "Bad",
              description: "Bad",
              expiresOn: "2026-02-30",
            }),
            (e) => e.status === 422,
          );
          await store.archiveAnnouncement(admin.token, a.id);
          assert.equal((await store.publicAnnouncements()).length, 0);
          assert.ok(
            (await store.overview(admin.token)).announcements[0].archivedAt,
          );
          await assert.rejects(
            store.saveAnnouncement(admin.token, {
              id: a.id,
              title: "Bad",
              description: "Bad",
            }),
            (e) => e.status === 404,
          );
        },
      );
      const ecdh = crypto.createECDH("prime256v1");
      ecdh.generateKeys();
      const subscription = (suffix) => ({
        endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
        keys: {
          p256dh: ecdh.getPublicKey().toString("base64url"),
          auth: crypto.randomBytes(16).toString("base64url"),
        },
      });
      const subscribed = subscription("ok");
      await t.test(
        "authenticated opt-in, endpoint safety, and participant ownership",
        async () => {
          await assert.rejects(
            store.subscribe(people[0].id, {
              ...subscribed,
              endpoint: "https://127.0.0.1/private",
            }),
            (e) => e.status === 422,
          );
          await store.subscribe(people[0].id, subscribed);
          await assert.rejects(
            store.subscribe(people[1].id, subscribed),
            (e) => e.status === 409,
          );
          await store.subscribe(people[0].id, subscription("expired"));
          await store.subscribe(people[1].id, subscription("failed"));
          await store.subscribe(people[2].id, subscription("unconfirmed"));
          await store.unsubscribe(people[1].id, subscribed.endpoint);
          assert.equal((await store.overview(admin.token)).audience.devices, 3);
          const res = response();
          await api.updates.subscribe(
            { method: "POST", headers: {}, body: subscription("denied") },
            res,
          );
          assert.equal(res.code, 401);
        },
      );
      await t.test(
        "idempotent broadcasts, captured delivery, errors, and expired cleanup",
        async () => {
          const body = {
            title: "Festival update",
            description: "A fictional notice",
            requestId: crypto.randomUUID(),
          };
          const message = await store.queuePush(admin.token, body);
          assert.equal(message.total, 3);
          assert.equal(
            (await store.queuePush(admin.token, body)).id,
            message.id,
          );
          await assert.rejects(
            store.queuePush(admin.token, { ...body, title: "Changed" }),
            (e) => e.status === 409,
          );
          const result = await store.processPush(admin.token, message.id);
          assert.deepEqual(result.counts, { sent: 1, failed: 1, expired: 1 });
          assert.equal(delivered.length, 1);
          assert.equal(delivered[0].title, "Festival update");
          assert.equal(delivered[0].url, "/");
          await store.processPush(admin.token, message.id);
          assert.equal(delivered.length, 1);
          assert.equal((await store.overview(admin.token)).audience.devices, 2);
          await store.unsubscribe(people[0].id, subscribed.endpoint);
          assert.equal((await store.overview(admin.token)).audience.devices, 1);
          const uncertain = await store.queuePush(admin.token, {
            ...body,
            requestId: crypto.randomUUID(),
          });
          await sql`UPDATE festival_push_deliveries_26 SET status='sending',updated_at=NOW()-INTERVAL '3 minutes' WHERE message_id=${uncertain.id}`;
          assert.equal(
            (await store.processPush(admin.token, uncertain.id)).counts.unknown,
            1,
          );
          assert.equal(delivered.length, 1);
        },
      );
      await t.test(
        "login throttling persists and sign-out revokes the session",
        async () => {
          await store.logout(admin.token);
          await assert.rejects(
            store.requireAdmin(admin.token),
            (e) => e.status === 401,
          );
          for (let i = 0; i < 10; i++)
            await assert.rejects(
              store.login("bff2026-admin", "wrong"),
              (e) => e.status === 401,
            );
          await assert.rejects(
            store.login("bff2026-admin", password),
            (e) => e.status === 429,
          );
          await sql`UPDATE festival_admin_attempts_26 SET window_start=NOW()-INTERVAL '16 minutes'`;
          assert.ok((await store.login("bff2026-admin", password)).token);
        },
      );
    } finally {
      for (const key of keys)
        previous[key] === undefined
          ? delete process.env[key]
          : (process.env[key] = previous[key]);
      await sql.end();
      await db`DROP SCHEMA app_admin_tests CASCADE`;
      await db.end();
    }
  },
);
