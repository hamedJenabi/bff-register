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
const { createAppInvitationHandler } = require("../lib/app/invitations");
const { setAdminSession } = require("../lib/admin/session");
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
      "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule", "00015-reg2026-switch-role",
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
    const dates = { Friday: "2026-12-11", Saturday: "2026-12-12", Sunday: "2026-12-13" };
    const sessions = (await registration.schedule()).map((session) => ({
      ...session,
      date: dates[session.day],
      levels: "All levels",
      format: session.partnerClass ? "partner" : "solo",
      bookable: true,
      ...(session.id === "fri-1515-lot" ? { format: "talk", capacity: {}, description: "" } : {}),
    }));
    sessions.push({ ...sessions[0], id: "fixture-competitors-class", title: "Fixture competitors class",
      room: "Fixture room", bookable: false });
    const publish = async (catalog) => registration.publishSchedule({
      sessions: catalog, spreadsheetId: "fictional-browser-schedule", sheetName: "APP_SCHEDULE",
      sourceHash: crypto.createHash("sha256").update(JSON.stringify(catalog)).digest("hex"),
    }, (await registration.schedulePublication())?.id || 0);
    await publish(sessions);
    const [mira] = await sql`INSERT INTO registrations_26 (date,status,role,ticket,firstname,lastname,email,country,level)
      VALUES ('2026','confirmed','advanced','fullpass','Mira','Patel','mira@example.com','Austria','lead') RETURNING *`;
    let journeyOrder;
    const resetJourney = async () => {
      await sql`DELETE FROM registration_email_retries_26 WHERE registration_id = ${mira.id}`;
      await sql`DELETE FROM class_bookings_26 WHERE registration_id = ${mira.id}`;
      await sql`DELETE FROM reg2026_orders WHERE registration_id = ${mira.id}`;
      await sql`UPDATE registrations_26 SET theme_class = '', lunch = '', competitions = '', competition = 'no', strictly_role = '' WHERE id = ${mira.id}`;
      await publish(sessions);
      journeyOrder = await registration.submit(mira, {
        classes: [{ sessionId: "fri-1330-kantine", role: "lead" }, { sessionId: "sat-1130-superar-1" }],
        competitions: ["strictly"], competitionRoles: { strictly: "follow" }, lunch: ["saturday"],
      }, "fictional-browser-checkout");
      await registration.attachSession(journeyOrder.id, "fictional-browser-stripe-session");
    };
    await resetJourney();
    Object.assign(process.env, {
      APP_SIGNING_SECRET: "fictional-preview-signing-secret-for-browser-qa",
      APP_ORIGIN: process.env.PREVIEW_APP_ORIGIN || "http://localhost:3001",
      APP_LINK_EXPIRES_AT: "2099-01-01T00:00:00Z",
      APP_INVITATIONS_ENABLED: "true",
      APP_INVITATION_TEMPLATE_ID: "d-11111111111111111111111111111111",
      ADMIN_SESSION_SECRET: "fictional-browser-organizer-session-secret",
      ADMIN_USER: "fictional-organizer",
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
    const emails = [];
    const invite = createAppInvitationHandler({ participant: store.participant,
      issueAccess: store.issueAccess, send: async (message) => emails.push(message) });
    const organizerHeaders = {};
    setAdminSession({ setHeader: (name, value) => { organizerHeaders[name] = value; } });
    for (const person of [...people, mira]) {
      const result = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await invite({ method: "POST", body: { id: person.id }, headers: {
        cookie: organizerHeaders["Set-Cookie"].split(";")[0], host: "localhost", origin: "http://localhost",
      } }, result);
      if (result.statusCode !== 200) throw new Error(`Fictional invitation failed: ${result.body?.error}`);
    }
    const emailLink = (email) => emails.find((message) => message.to === email).dynamic_template_data.appAccessUrl;
    const links = {
      daria: emailLink("daria@example.com"),
      noah: emailLink("noah@example.com"),
      mira: emailLink("mira@example.com"),
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
      if (url.pathname === "/__fixtures/emails") return res.json(emails);
      if (url.pathname === "/__fixtures/pushes") return res.json(pushes);
      if (url.pathname.startsWith("/__fixtures/journey/") && req.method === "POST") {
        try {
          if (url.pathname === "/__fixtures/journey/reset") await resetJourney();
          else if (url.pathname === "/__fixtures/journey/publish") {
            await publish(sessions.map((session) => session.id === "fri-1330-kantine" ? {
              ...session, title: "Published partner workshop", teachers: "Fixture teachers", room: "Updated fixture room",
              description: "A published description from the schedule snapshot.", levels: "II–III",
            } : session));
          } else if (url.pathname === "/__fixtures/journey/confirm") {
            await registration.applyPayment({ id: "fictional-browser-stripe-session", currency: "eur",
              amount_total: journeyOrder.total_cents, client_reference_id: String(mira.id),
              metadata: { reg2026OrderId: String(journeyOrder.id) }, payment_status: "paid", status: "complete",
            }, "checkout.session.completed");
          } else return res.status(404).json({ error: "Unknown fixture action" });
          return res.json({ ok: true });
        } catch (error) { return res.status(500).json({ error: error.message }); }
      }
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
