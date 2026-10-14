// Loopback-only backend fixture for browser QA. Imports pure app handlers;
// never imports db/db, reads .env, sends email, or uses payment credentials.
require("./register.cjs");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { createAttendeeStore } = require("../lib/app/store");
const { createAppHandlers } = require("../lib/app/http");
const { createContentStore } = require("../lib/app/content-store");
const { createContentHandlers } = require("../lib/app/content-http");
const { hashAdminPassword } = require("../lib/app/admin-security");
const crypto = require("node:crypto");
const webpush = require("web-push");

(async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bff-attendee-preview-"));
  const data = path.join(root, "data");
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  let started = false,
    sql,
    server;
  const cleanup = async () => {
    server?.close();
    if (sql) {
      await sql.end();
      sql = null;
    }
    if (started) {
      started = false;
      execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], {
        stdio: "pipe",
      });
    }
    rmSync(root, { recursive: true, force: true });
  };
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      cleanup().finally(() => process.exit(0));
    });
  try {
    execFileSync(
      "initdb",
      ["-D", data, "-A", "trust", "--no-locale", "-E", "UTF8"],
      { stdio: "pipe" },
    );
    execFileSync(
      "pg_ctl",
      [
        "-D",
        data,
        "-l",
        path.join(root, "postgres.log"),
        "-o",
        `-k ${root} -h 127.0.0.1 -p ${port}`,
        "-w",
        "start",
      ],
      { stdio: "pipe" },
    );
    started = true;
    sql = postgres(
      `postgres://${encodeURIComponent(os.userInfo().username)}@127.0.0.1:${port}/postgres`,
      { onnotice: () => {} },
    );
    for (const file of [
      "00004-CREAT-registraion-2026",
      "00006-create-class-capacities-2026",
      "00007-create-reg2026-bookings",
      "00008-reg2026-order-safety",
      "00009-create-schedule-overrides-2026",
      "00010-reg2026-reopen-registration",
      "00011-attendee-app-access",
      "00012-festival-app-admin",
    ]) {
      await sql.begin((tx) => require(`../migrations/${file}`).up(tx));
    }
    const people =
      await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country,level,lunch,competitions,open_mixnmatch_role,strictly_role)
      VALUES ('2026','confirmed','advanced','fullpass','Daria','Rivera','daria@example.com','Austria','follow','saturday','solo_battle,open_mixnmatch,strictly','lead','follow'),
      ('2026','confirmed','beginner','partyPass','Noah','Chen','noah@example.com','Germany',NULL,'','','','') RETURNING *`;
    const registration = createRegistrationStore(sql);
    await registration.editClasses(
      people[0].id,
      [
        { sessionId: "fri-1330-ankersaal" },
        { sessionId: "sat-1130-superar-1" },
        { sessionId: "sun-1130-ankersaal", role: "follow" },
      ],
      "",
    );
    Object.assign(process.env, {
      APP_SIGNING_SECRET: "fictional-preview-signing-secret-for-browser-qa",
      APP_ORIGIN: process.env.PREVIEW_APP_ORIGIN || "http://localhost:3001",
      APP_LINK_EXPIRES_AT: "2099-01-01T00:00:00Z",
    });
    const store = createAttendeeStore(sql, registration);
    const adminPassword = "fictional-admin-browser-password";
    const vapidKeys = webpush.generateVAPIDKeys();
    Object.assign(process.env, {
      APP_ADMIN_PASSWORD_HASH: await hashAdminPassword(adminPassword),
      APP_PUSH_PUBLIC_KEY: vapidKeys.publicKey,
      APP_PUSH_PRIVATE_KEY: vapidKeys.privateKey,
      APP_PUSH_SUBJECT: "mailto:test@example.com",
    });
    const pushes = [];
    const content = createContentStore(sql, {
      sendPush: async (subscription, payload) => {
        pushes.push(payload);
      },
    });
    const contentHandlers = createContentHandlers(content, store);
    const handlers = createAppHandlers(store, content);
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/fictional-browser-fixture",
      keys: {
        p256dh: ecdh.getPublicKey().toString("base64url"),
        auth: crypto.randomBytes(16).toString("base64url"),
      },
    };
    const links = {
      daria: (await store.issueAccess(people[0].id)).url,
      noah: (await store.issueAccess(people[1].id)).url,
      admin: { username: "bff2026-admin", password: adminPassword },
      subscription,
    };
    server = http.createServer(async (req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      res.json = (body) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(body));
        return res;
      };
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      if (url.pathname === "/__fixtures") return res.json(links);
      if (url.pathname === "/__fixtures/pushes") return res.json(pushes);
      if (url.pathname === "/__fixtures/revoke" && req.method === "POST") {
        await store.revoke(people[0].id);
        return res.json({ ok: true });
      }
      const grouped = /^\/api\/app\/(manage|updates)\/([a-z]+)$/.exec(
        url.pathname,
      );
      const handler =
        (grouped && contentHandlers[grouped[1]][grouped[2]]) ||
        {
          "/api/app/claim": handlers.claim,
          "/api/app/me": handlers.me,
          "/api/app/logout": handlers.logout,
        }[url.pathname];
      if (!handler) return res.status(404).json({ error: "Not found" });
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 4096)
            return res.status(413).json({ error: "Too large" });
        }
        req.body = body ? JSON.parse(body) : {};
        await handler(req, res);
      } catch {
        if (!res.headersSent)
          res.status(500).json({ error: "Preview request failed" });
      }
    });
    await new Promise((resolve, reject) => {
      server.on("error", reject);
      server.listen(
        Number(process.env.PREVIEW_BACKEND_PORT || 31026),
        "127.0.0.1",
        resolve,
      );
    });
    console.log(
      `Fictional attendee backend ready at http://127.0.0.1:${server.address().port}`,
    );
    console.log(
      "Fictional links available at /__fixtures; no operational services are connected.",
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
