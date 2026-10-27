const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { createAttendeeStore } = require("../lib/app/store");
const { createAppHandlers } = require("../lib/app/http");
const { createAppInvitationHandler } = require("../lib/app/invitations");
const { serializeThemeClass } = require("../lib/reg2026/serialization");
const {
  credentialToken,
  tokenHash,
  validCredential,
} = require("../lib/app/security");
const { setAdminSession } = require("../lib/admin/session");

const response = () => ({
  headers: {},
  code: 200,
  setHeader(key, value) {
    this.headers[key] = value;
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
const linkToken = (url) =>
  new URLSearchParams(new URL(url).hash.slice(1)).get("token");

test(
  "participant app API and email integration on isolated Postgres",
  { skip: !process.env.TEST_DATABASE_URL },
  async (t) => {
    const adminSql = postgres(process.env.TEST_DATABASE_URL, {
      onnotice: () => {},
    });
    await adminSql`CREATE SCHEMA attendee_app_tests`;
    const sql = postgres(process.env.TEST_DATABASE_URL, {
      onnotice: () => {},
      connection: { search_path: "attendee_app_tests" },
    });
    const keys = [
      "APP_SIGNING_SECRET",
      "APP_ORIGIN",
      "APP_INVITATIONS_ENABLED",
      "APP_INVITATION_TEMPLATE_ID",
      "APP_LINK_EXPIRES_AT",
      "APP_FESTIVAL_START_DATE",
      "ADMIN_SESSION_SECRET",
      "ADMIN_USER",
    ];
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]]),
    );
    Object.assign(process.env, {
      APP_SIGNING_SECRET: "isolated-attendee-app-signing-secret-32",
      APP_ORIGIN: "https://app.example.com",
      APP_INVITATIONS_ENABLED: "true",
      APP_INVITATION_TEMPLATE_ID: "d-11111111111111111111111111111111",
      APP_LINK_EXPIRES_AT: "2099-01-01T00:00:00Z",
      APP_FESTIVAL_START_DATE: "2026-12-11",
      ADMIN_SESSION_SECRET: "test-organizer-secret",
      ADMIN_USER: "test-organizer",
    });
    try {
      for (const migration of [
        "00004-CREAT-registraion-2026",
        "00006-create-class-capacities-2026",
        "00007-create-reg2026-bookings",
        "00008-reg2026-order-safety",
        "00009-create-schedule-overrides-2026",
        "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule",
        "00011-attendee-app-access",
      ]) {
        await sql.begin((tx) => require(`../migrations/${migration}`).up(tx));
      }
      const registration = createRegistrationStore(sql);
      const store = createAttendeeStore(sql, registration);
      const api = createAppHandlers(store);
      const createPerson = async (
        name,
        ticket = "fullpass",
        status = "confirmed",
      ) =>
        (
          await sql`INSERT INTO registrations_26
      (date,status,role,ticket,firstname,lastname,email,country,level,lunch,competitions)
      VALUES ('2026',${status},'advanced',${ticket},${name},'Dancer',${name.toLowerCase() + "@example.com"},'Austria','follow','saturday','solo_battle') RETURNING *`
        )[0];
      const alice = await createPerson("Alice");
      const bob = await createPerson("Bob", "parentPass");
      const party = await createPerson("Party", "partyPass");
      const waiting = await createPerson("Waiting", "fullpass", "waitinglist");
      await registration.editClasses(
        alice.id,
        [{ sessionId: "fri-1330-kantine", role: "lead" }],
        "",
      );
      await sql`UPDATE registrations_26 SET theme_class = ${serializeThemeClass([{ sessionId: "sat-1130-superar-1" }])} WHERE id = ${bob.id}`;
      const aliceLink = await store.issueAccess(alice.id);
      const bobLink = await store.issueAccess(bob.id);
      const aliceSession = await store.claim(linkToken(aliceLink.url));
      const bobSession = await store.claim(linkToken(bobLink.url));
      const sessionHeaders = (token) => ({ authorization: `Bearer ${token}` });
      const organizerResponse = response();
      setAdminSession(organizerResponse);
      const organizerHeaders = {
        cookie: organizerResponse.headers["Set-Cookie"].split(";")[0],
        host: "register.example.com",
        origin: "https://register.example.com",
      };

      await t.test(
        "each bearer resolves only its own confirmed registration and minimizes data",
        async () => {
          const a = response();
          await api.me(
            {
              method: "GET",
              headers: sessionHeaders(aliceSession.sessionToken),
              query: { id: bob.id },
            },
            a,
          );
          assert.equal(a.code, 200);
          assert.equal(a.body.participant.id, alice.id);
          assert.equal(a.body.participant.email, "alice@example.com");
          assert.equal(a.body.participant.proficiency, "advanced");
          assert.equal(a.body.participant.danceRole, "follow");
          assert.deepEqual(
            a.body.classes.map((entry) => [entry.sessionId, entry.role]),
            [["fri-1330-kantine", "lead"]],
          );
          assert.equal(a.body.participant.price, undefined);
          assert.equal(a.body.participant.theme_class, undefined);
          assert.equal(a.body.sessionToken, undefined);
          assert.equal(a.headers["Cache-Control"], "private, no-store");
          assert.equal(a.body.festivalDates.Friday, "2026-12-11");
          assert.equal(a.body.festivalDates.Sunday, "2026-12-13");
          const b = await store.snapshot(bobSession.sessionToken);
          assert.equal(b.participant.id, bob.id);
          const unauthorized = response();
          await api.me(
            { method: "GET", headers: { cookie: organizerHeaders.cookie } },
            unauthorized,
          );
          assert.equal(unauthorized.code, 401);
          const method = response();
          await api.me({ method: "POST", headers: {} }, method);
          assert.equal(method.code, 405);
        },
      );

      await t.test(
        "legacy choices are projected without creating bookings or changing registration",
        async () => {
          const before = await store.participant(bob.id);
          const snapshot = await store.snapshot(bobSession.sessionToken);
          assert.equal(snapshot.classes[0].sessionId, "sat-1130-superar-1");
          assert.equal(snapshot.classes[0].source, "legacy");
          await sql`UPDATE registrations_26 SET level = 'parentPass_follow' WHERE id = ${bob.id}`;
          assert.equal(
            (await store.snapshot(bobSession.sessionToken)).participant
              .danceRole,
            "follow",
          );
          await sql`UPDATE registrations_26 SET level = ${before.level} WHERE id = ${bob.id}`;
          assert.deepEqual(await store.participant(bob.id), before);
          assert.equal(
            (
              await sql`SELECT * FROM class_bookings_26 WHERE registration_id = ${bob.id}`
            ).length,
            0,
          );
          const partyLink = await store.issueAccess(party.id);
          const session = await store.claim(linkToken(partyLink.url));
          assert.deepEqual(
            (await store.snapshot(session.sessionToken)).classes,
            [],
          );
        },
      );

      await t.test(
        "provisional choices and ambiguous historical selections cannot grant admission",
        async () => {
          await sql`INSERT INTO class_bookings_26 (registration_id,session_id,pool,status,expires_at)
        VALUES (${alice.id},'sat-1130-superar-1','total','provisional',NOW() + INTERVAL '1 hour')`;
          await sql`INSERT INTO reg2026_orders (registration_id,status,draft,subtotal_cents,fee_cents,total_cents,expires_at)
        VALUES (${alice.id},'provisional','{}',0,0,0,NOW() + INTERVAL '1 hour')`;
          const snapshot = await store.snapshot(aliceSession.sessionToken);
          assert.equal(snapshot.classes.length, 1);
          assert.equal(snapshot.pendingRegistration, true);
          const pending = await createPerson("Pending");
          await sql`UPDATE registrations_26 SET theme_class = ${serializeThemeClass([{ sessionId: "sat-1130-superar-1" }])} WHERE id = ${pending.id}`;
          await sql`INSERT INTO reg2026_orders (registration_id,status,draft,subtotal_cents,fee_cents,total_cents,expires_at)
        VALUES (${pending.id},'provisional','{}',0,0,0,NOW() + INTERVAL '1 hour')`;
          const session = await store.claim(
            linkToken((await store.issueAccess(pending.id)).url),
          );
          assert.deepEqual(
            (await store.snapshot(session.sessionToken)).classes,
            [],
          );
          assert.equal(
            (await store.snapshot(session.sessionToken)).pendingRegistration,
            true,
          );
        },
      );

      await t.test(
        "catalog overrides refresh personal classes and missing metadata stays explicit",
        async () => {
          const current = (await registration.schedule()).find(
            (session) => session.id === "fri-1330-kantine",
          );
          await sql`INSERT INTO schedule_overrides_26 (session_id,data,revision) VALUES (${current.id}, ${sql.json({ title: "Updated Blues Class", room: "New Room" })},1)`;
          const snapshot = await store.snapshot(aliceSession.sessionToken);
          assert.equal(snapshot.classes[0].title, "Updated Blues Class");
          assert.equal(snapshot.classes[0].room, "New Room");
          assert.equal(
            snapshot.catalog.find(
              (session) => session.sessionId === "fri-1330-kantine",
            ).title,
            "Updated Blues Class",
          );
          await sql`UPDATE registrations_26 SET theme_class = ${serializeThemeClass([{ sessionId: "unknown-old-session" }])} WHERE id = ${bob.id}`;
          const missing = await store.snapshot(bobSession.sessionToken);
          assert.equal(missing.classes[0].detailsMissing, true);
          assert.equal(missing.classes[0].day, null);
        },
      );

      await t.test(
        "access links are reusable while sessions are separate, hashed, and revocable",
        async () => {
          const second = await store.claim(linkToken(aliceLink.url));
          assert.notEqual(second.sessionToken, aliceSession.sessionToken);
          const sessions =
            await sql`SELECT token_hash FROM attendee_sessions_26`;
          assert.ok(
            sessions.some(
              (row) => row.token_hash === tokenHash(second.sessionToken),
            ),
          );
          assert.ok(
            !sessions.some((row) => row.token_hash === second.sessionToken),
          );
          const qr = (await store.snapshot(second.sessionToken)).qr.value;
          await assert.rejects(store.claim(qr), /personal app link/);
          assert.ok(validCredential(aliceLink.access, qr, "qr"));
          assert.equal(validCredential(aliceLink.access, qr, "access"), false);
          await assert.rejects(
            store.claim(linkToken(aliceLink.url).slice(0, -1) + "!"),
            /personal app link/,
          );
          await assert.rejects(
            store.issueAccess(waiting.id),
            /confirmed participants/,
          );
          await store.logout(second.sessionToken);
          await assert.rejects(
            store.snapshot(second.sessionToken),
            /personal app link/,
          );
          assert.equal(
            (await store.snapshot(aliceSession.sessionToken)).participant.id,
            alice.id,
          );
        },
      );

      await t.test(
        "organizer endpoints enforce roles, origin, and stored IDs",
        async () => {
          const denied = response();
          await api.link(
            {
              method: "POST",
              headers: sessionHeaders(aliceSession.sessionToken),
              body: { id: bob.id },
            },
            denied,
          );
          assert.equal(denied.code, 401);
          const origin = response();
          await api.link(
            {
              method: "POST",
              headers: {
                ...organizerHeaders,
                origin: "https://outside.example.com",
              },
              body: { id: bob.id },
            },
            origin,
          );
          assert.equal(origin.code, 403);
          const invalid = response();
          await api.link(
            { method: "POST", headers: organizerHeaders, body: { id: "1e2" } },
            invalid,
          );
          assert.equal(invalid.code, 422);
          const allowed = response();
          await api.link(
            { method: "POST", headers: organizerHeaders, body: { id: bob.id } },
            allowed,
          );
          assert.equal(allowed.code, 200);
          assert.equal(
            (
              await store.snapshot(
                (await store.claim(linkToken(allowed.body.appAccessUrl)))
                  .sessionToken,
              )
            ).participant.id,
            bob.id,
          );
        },
      );

      await t.test(
        "separate app invitations use a dedicated template, stored recipients and links, and report send failures",
        async () => {
          const messages = [];
          const mail = createAppInvitationHandler({
            participant: store.participant,
            issueAccess: store.issueAccess,
            send: async (message) => {
              messages.push(message);
            },
          });
          for (const person of [alice, bob]) {
            const sent = response();
            await mail(
              {
                method: "POST",
                headers: organizerHeaders,
                body: {
                  id: person.id,
                  email: "forged@example.com",
                  firstname: "Forged",
                },
              },
              sent,
            );
            assert.equal(sent.code, 200);
          }
          assert.equal(messages[0].to, alice.email);
          assert.equal(
            messages[0].template_id,
            process.env.APP_INVITATION_TEMPLATE_ID,
          );
          assert.equal(
            messages[0].tracking_settings.click_tracking.enable,
            false,
          );
          assert.equal(messages[0].dynamic_template_data.firstname, "Alice");
          assert.equal(messages[1].to, bob.email);
          assert.notEqual(
            messages[0].dynamic_template_data.appAccessUrl,
            messages[1].dynamic_template_data.appAccessUrl,
          );
          for (let index = 0; index < 2; index++) {
            const session = await store.claim(
              linkToken(messages[index].dynamic_template_data.appAccessUrl),
            );
            assert.equal(
              (await store.snapshot(session.sessionToken)).participant.id,
              [alice, bob][index].id,
            );
          }
          const failingMail = createAppInvitationHandler({
            participant: store.participant,
            issueAccess: store.issueAccess,
            send: async () => {
              throw new Error("provider failure");
            },
          });
          const failure = response();
          await failingMail(
            {
              method: "POST",
              headers: organizerHeaders,
              body: { id: alice.id },
            },
            failure,
          );
          assert.equal(failure.code, 502);
          const denied = response();
          await mail(
            { method: "POST", headers: {}, body: { id: alice.id } },
            denied,
          );
          assert.equal(denied.code, 401);
          assert.equal(messages.length, 2);
          process.env.APP_INVITATIONS_ENABLED = "false";
          const disabled = response();
          await mail(
            {
              method: "POST",
              headers: organizerHeaders,
              body: { id: alice.id },
            },
            disabled,
          );
          assert.equal(disabled.code, 403);
          process.env.APP_INVITATIONS_ENABLED = "true";
          const template = process.env.APP_INVITATION_TEMPLATE_ID;
          delete process.env.APP_INVITATION_TEMPLATE_ID;
          const unconfigured = response();
          await mail(
            {
              method: "POST",
              headers: organizerHeaders,
              body: { id: alice.id },
            },
            unconfigured,
          );
          assert.equal(unconfigured.code, 503);
          process.env.APP_INVITATION_TEMPLATE_ID = template;
          const ineligible = response();
          await mail(
            {
              method: "POST",
              headers: organizerHeaders,
              body: { id: waiting.id },
            },
            ineligible,
          );
          assert.equal(ineligible.code, 409);
          const crossOrigin = response();
          await mail(
            {
              method: "POST",
              headers: {
                ...organizerHeaders,
                origin: "https://outside.example.com",
              },
              body: { id: alice.id },
            },
            crossOrigin,
          );
          assert.equal(crossOrigin.code, 403);
          assert.equal(messages.length, 2);
        },
      );

      await t.test(
        "revoked, expired, and unconfirmed registrations lose session access",
        async () => {
          const revoked = response();
          await api.revoke(
            {
              method: "POST",
              headers: organizerHeaders,
              body: { id: alice.id },
            },
            revoked,
          );
          assert.equal(revoked.code, 200);
          await assert.rejects(
            store.snapshot(aliceSession.sessionToken),
            /personal app link/,
          );
          await assert.rejects(
            store.claim(linkToken(aliceLink.url)),
            /personal app link/,
          );
          const replaced = await store.issueAccess(alice.id);
          assert.notEqual(replaced.url, aliceLink.url);
          assert.notEqual(
            credentialToken(replaced.access, "qr"),
            credentialToken(aliceLink.access, "qr"),
          );
          await sql`UPDATE attendee_access_26 SET expires_at = NOW() - INTERVAL '1 second' WHERE registration_id = ${bob.id}`;
          await assert.rejects(
            store.snapshot(bobSession.sessionToken),
            /personal app link/,
          );
          await assert.rejects(
            store.claim(linkToken(bobLink.url)),
            /personal app link/,
          );
          const session = await store.claim(linkToken(replaced.url));
          await sql`UPDATE registrations_26 SET status = 'canceled' WHERE id = ${alice.id}`;
          await assert.rejects(
            store.snapshot(session.sessionToken),
            /personal app link/,
          );
        },
      );
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) delete process.env[key];
        else process.env[key] = previous[key];
      }
      await sql.end();
      await adminSql`DROP SCHEMA attendee_app_tests CASCADE`;
      await adminSql.end();
    }
  },
);
