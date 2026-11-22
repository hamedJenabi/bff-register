const { test } = require("node:test");
const assert = require("node:assert/strict");
const postgres = require("postgres");
const { createRegistrationStore } = require("../lib/reg2026/store");
const { createAttendeeStore } = require("../lib/app/store");
const { createAppHandlers } = require("../lib/app/http");
const { createScheduleHandler } = require("../lib/app/schedule");
const { createContentHandlers } = require("../lib/app/content-http");
const { createContentStore } = require("../lib/app/content-store");
const { createDoorStore } = require("../lib/app/door-store");
const { createArrivalHandlers } = require("../lib/app/arrival-http");
const { createArrivalStore } = require("../lib/app/arrival-store");
const { hashAdminPassword } = require("../lib/app/admin-security");
const { createAppInvitationHandler } = require("../lib/app/invitations");
const { createFinalEmailHandler, createFinalEmailStore } = require("../lib/app/final-email");
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
      "APP_ADMIN_PASSWORD_HASH",
      "ADMIN_SESSION_SECRET",
      "ADMIN_USER",
      "FINAL_EMAIL_ENABLED",
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
      FINAL_EMAIL_ENABLED: "false",
    });
    try {
      for (const migration of [
        "00004-CREAT-registraion-2026",
        "00006-create-class-capacities-2026",
        "00007-create-reg2026-bookings",
        "00008-reg2026-order-safety",
        "00009-create-schedule-overrides-2026",
        "00010-reg2026-reopen-registration", "00013-reg2026-sheet-schedule", "00015-reg2026-switch-role", "00016-reg2026-competition-capacities", "00017-reg2026-showcase-capacity", "00021-reg2026-internal-registration",
        "00011-attendee-app-access",
        "00012-festival-app-admin",
        "00018-reg2026-final-emails",
        "00022-festival-arrivals",
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
        [{ sessionId: "fri-1330-kantine", role: "switch" }],
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

      await t.test("the public catalog matches participant class details without exposing private data", async () => {
        const result = response();
        await createScheduleHandler(registration)({ method: "GET", headers: {} }, result);
        assert.equal(result.code, 200);
        const personal = await store.snapshot(aliceSession.sessionToken);
        assert.deepEqual(result.body.catalog, personal.catalog);
        assert.deepEqual(result.body.festivalDates, personal.festivalDates);
        assert.deepEqual(Object.keys(result.body).sort(), ["catalog", "festivalDates", "timezone"]);
        assert.ok(result.body.catalog.length > 0);
        for (const session of result.body.catalog) {
          assert.deepEqual(Object.keys(session).sort(), ["bookable", "date", "day", "description", "detailsMissing", "end", "format", "levels", "role", "room", "sessionId", "source", "start", "teachers", "title"]);
          assert.equal(session.role, null);
        }
        const method = response();
        await createScheduleHandler(registration)({ method: "POST" }, method);
        assert.equal(method.code, 405);
        const failed = response();
        await createScheduleHandler({ schedule: async () => { throw Error("private database diagnostic"); } })({ method: "GET" }, failed);
        assert.equal(failed.code, 503);
        assert.equal(failed.body.catalog, undefined);
        assert.doesNotMatch(JSON.stringify(failed.body), /private database/);
      });

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
            [["fri-1330-kantine", "switch"]],
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
        "legacy classes stay eligible after competition registration without creating class bookings",
        async () => {
          const competitionOrder = await registration.submit(bob, {
            classes: [{ sessionId: "sat-1130-superar-1" }],
            competitions: ["solo_battle", "strictly"],
            competitionRoles: { strictly: "follow" },
            lunch: ["saturday"],
            voucher: "freepass26",
          }, "bob-competition-add");
          assert.equal(competitionOrder.status, "confirmed");
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
        "class door checks use current confirmed bookings and open talks",
        async () => {
          const password = "fictional-class-door-admin-password";
          process.env.APP_ADMIN_PASSWORD_HASH = await hashAdminPassword(password);
          const content = createContentStore(sql);
          const catalog = await registration.schedule();
          const open = "fri-1515-lot";
          const unavailable = "fixture-unbookable";
          const door = createDoorStore(sql, { schedule: async () => [
            ...catalog.map((session) => session.id === open ? { ...session, format: "talk" } : session),
            { ...catalog[0], id: unavailable, format: "solo", bookable: false },
          ] });
          const { manage } = createContentHandlers(content, store, door);
          const admin = await content.login("bff2026-admin", password);
          const call = async (action, body, token = admin.token) => {
            const res = response();
            await manage[action]({ method: body ? "POST" : "GET", headers: sessionHeaders(token), body }, res);
            assert.equal(res.headers["Cache-Control"], "private, no-store");
            return res;
          };
          const booked = "fri-1330-kantine";
          const legacy = "sat-1130-superar-1";
          const aliceQr = credentialToken(aliceLink.access, "qr");
          const bobQr = credentialToken(bobLink.access, "qr");
          const partyLink = await store.issueAccess(party.id);
          const partyQr = credentialToken(partyLink.access, "qr");
          const verify = async (sessionId, qr) => (await call("door-verify", { sessionId, qr })).body;

          assert.equal((await call("door-sessions", undefined, aliceSession.sessionToken)).code, 401);
          assert.equal((await call("door-verify", { sessionId: booked, qr: aliceQr }, aliceSession.sessionToken)).code, 401);
          assert.equal((await call("door-roster", { sessionId: booked }, aliceSession.sessionToken)).code, 401);
          const list = (await call("door-sessions")).body.sessions;
          assert.equal(list.some(({ id }) => id === unavailable), false);
          assert.equal(list.find(({ id }) => id === open).mode, "open");
          assert.deepEqual(await verify(booked, aliceQr), { status: "eligible", firstname: "Alice", lastname: "Dancer", role: "switch" });
          assert.deepEqual(await verify(legacy, aliceQr), { status: "ineligible" }); // provisional only
          assert.equal((await verify(legacy, bobQr)).status, "eligible");
          assert.equal((await verify(open, partyQr)).status, "eligible");
          assert.deepEqual(await verify(booked, partyQr), { status: "ineligible" });
          assert.deepEqual(await verify(booked, linkToken(aliceLink.url)), { status: "invalid" });
          assert.deepEqual(await verify(booked, "not-a-festival-qr"), { status: "invalid" });
          assert.equal((await call("door-verify", { sessionId: "gone", qr: aliceQr })).code, 404);
          assert.equal((await call("door-verify", { sessionId: unavailable, qr: aliceQr })).code, 404);
          assert.equal((await call("door-roster", { sessionId: unavailable })).code, 404);
          assert.deepEqual((await call("door-roster", { sessionId: legacy })).body.entries,
            [{ id: bob.id, firstname: "Bob", lastname: "Dancer", role: null }]);

          const temporary = await createPerson("Temporary door fixture", "partyPass");
          const { access } = await store.issueAccess(temporary.id);
          const qr = credentialToken(access, "qr");
          await sql`UPDATE registrations_26 SET status = 'canceled' WHERE id = ${temporary.id}`;
          assert.deepEqual(await verify(open, qr), { status: "invalid" });
          await sql`UPDATE registrations_26 SET status = 'confirmed' WHERE id = ${temporary.id}`;
          await sql`UPDATE attendee_access_26 SET expires_at = NOW() - INTERVAL '1 second' WHERE id = ${access.id}`;
          assert.deepEqual(await verify(open, qr), { status: "invalid" });
          await sql`UPDATE attendee_access_26 SET expires_at = NOW() + INTERVAL '1 day' WHERE id = ${access.id}`;
          await store.revoke(temporary.id);
          assert.deepEqual(await verify(open, qr), { status: "invalid" });
          await sql`UPDATE registrations_26 SET status = 'canceled' WHERE id = ${temporary.id}`;
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
        "final email targets confirmed registrations and safely resumes interrupted sends",
        async () => {
          const legacyClasses = serializeThemeClass([{ sessionId: "unknown-old-session" }, { sessionId: "sat-1130-superar-1" }]);
          await sql`UPDATE registrations_26 SET email = ${alice.email}, theme_class = ${legacyClasses} WHERE id = ${bob.id}`;
          const messages = [];
          const dependencies = {
            store: createFinalEmailStore(sql),
            issueAccess: store.issueAccess,
            getClassSchedule: store.classSchedule,
            getLevelLabel: async () => "Test level",
            send: async (message) => messages.push(message),
          };
          const mail = createFinalEmailHandler({ ...dependencies, preview: true });
          const request = async ({ method = "POST", headers = organizerHeaders, body, handler = mail } = {}) => {
            const result = response();
            await handler({ method, headers, body }, result);
            return result;
          };
          const sendTo = (id, handler = mail) => request({ body: { id, email: "forged@example.com" }, handler });

          assert.equal((await request({ method: "GET", headers: {} })).code, 401);
          assert.equal((await request({ body: { id: alice.id }, headers: { ...organizerHeaders, origin: "https://other.example.com" } })).code, 403);
          assert.equal((await request({ method: "GET", handler: createFinalEmailHandler(dependencies) })).code, 503);
          const audience = await request({ method: "GET" });
          assert.deepEqual(audience.body.recipients.map(({ firstname }) => firstname), ["Alice", "Bob", "Party", "Pending"]);
          assert.equal((await sendTo(waiting.id)).code, 409);
          assert.equal(messages.length, 0);

          for (const person of [alice, bob]) {
            assert.equal((await sendTo(person.id)).body.status, "sent");
            const message = messages.at(-1);
            const link = new URL(message.dynamic_template_data.appAccessUrl);
            assert.equal(message.to, alice.email);
            assert.equal(message.template_id, "d-faecb94e7a544674883c69bc2421b9ec");
            assert.equal(message.dynamic_template_data.firstname, person.firstname);
            assert.equal(message.dynamic_template_data.competitions, person.id === bob.id ? "Solo Battle,Strictly" : "Solo Battle");
            assert.deepEqual(message.tracking_settings.click_tracking, { enable: false, enable_text: false });
            assert.equal(link.origin, process.env.APP_ORIGIN);
            assert.equal(link.pathname, "/claim");
            assert.equal(link.search, "");
            const session = await store.claim(linkToken(link));
            assert.equal((await store.snapshot(session.sessionToken)).participant.id, person.id);
          }
          const confirmedClasses = messages[0].dynamic_template_data.classes;
          assert.equal(confirmedClasses.length, 1);
          assert.deepEqual(confirmedClasses[0], {
            title: "Updated Blues Class",
            day: "Friday",
            start: "13:30",
            end: "14:45",
            teachers: (await registration.schedule()).find(({ id }) => id === "fri-1330-kantine").teachers,
            room: "New Room",
            role: "Switch",
          });
          const legacyEmailClasses = messages[1].dynamic_template_data.classes;
          assert.equal(legacyEmailClasses.length, 2);
          assert.equal(legacyEmailClasses[0].day, "Saturday");
          assert.equal(legacyEmailClasses[0].role, "");
          assert.equal(legacyEmailClasses[1].title, "Class details unavailable");
          assert.equal(legacyEmailClasses[1].day, null);
          assert.notEqual(messages[0].dynamic_template_data.appAccessUrl, messages[1].dynamic_template_data.appAccessUrl);
          assert.equal((await sendTo(alice.id)).body.status, "already_sent");
          assert.equal(messages.length, 2);

          const rejected = createFinalEmailHandler({ ...dependencies, preview: true, send: async () => {
            throw Object.assign(new Error("rejected"), { code: 400, response: {} });
          } });
          assert.equal((await sendTo(party.id, rejected)).code, 502);
          const retried = await Promise.all([sendTo(party.id), sendTo(party.id)]);
          assert.equal(retried.filter((result) => result.body.status === "sent").length, 1);
          assert.ok(retried.every((result) => ["sent", "already_sent", "sending"].includes(result.body.status)));
          assert.equal(messages.length, 3);
          assert.equal(messages.at(-1).dynamic_template_data.ticket, "Party Pass");
          assert.deepEqual(messages.at(-1).dynamic_template_data.classes, []);

          const interrupted = await createPerson("Interrupted");
          const unknown = createFinalEmailHandler({ ...dependencies, preview: true, send: async () => {
            throw new Error("connection lost");
          } });
          assert.equal((await sendTo(interrupted.id, unknown)).body.status, "uncertain");
          assert.equal((await sendTo(interrupted.id)).body.status, "uncertain");
          const stale = await createPerson("Stale");
          await sql`INSERT INTO registration_final_emails_26 (registration_id, status, updated_at)
            VALUES (${stale.id}, 'sending', NOW() - INTERVAL '11 minutes')`;
          assert.equal((await sendTo(stale.id)).body.status, "uncertain");
          const canceled = await createPerson("Canceled after preview");
          await sql`UPDATE registrations_26 SET status = 'canceled' WHERE id = ${canceled.id}`;
          assert.equal((await sendTo(canceled.id)).code, 409);
          assert.equal(messages.length, 3);
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
      await t.test("the public scanner submits valid QR codes and only organizers can confirm arrivals", async () => {
        const parent = await createPerson("Check-in Parent", "parentPass");
        const next = await createPerson("Check-in Party", "partyPass");
        await sql`UPDATE registrations_26 SET tshirt = 'Curvy M (W)' WHERE id = ${parent.id}`;
        await sql`UPDATE registrations_26 SET lunch = '', tshirt = 'No T-shirt', competitions = '' WHERE id = ${next.id}`;
        const parentLink = await store.issueAccess(parent.id);
        const nextLink = await store.issueAccess(next.id);
        const session = await store.claim(linkToken(parentLink.url));
        const parentQr = credentialToken(parentLink.access, "qr");
        const nextQr = credentialToken(nextLink.access, "qr");
        const arrivalApi = createArrivalHandlers(createArrivalStore(sql));
        const scannerHeaders = { host: organizerHeaders.host, origin: organizerHeaders.origin };
        const call = async (action, body, headers = scannerHeaders) => {
          const res = response();
          await arrivalApi[action]({
            method: action === "dashboard" ? "GET" : "POST",
            headers,
            body,
          }, res);
          return res;
        };
        const status = async () => {
          const res = response();
          await api.me({ method: "GET", headers: sessionHeaders(session.sessionToken), query: { checkIn: "1" } }, res);
          assert.equal(res.code, 200);
          return res.body;
        };

        assert.equal((await call("dashboard")).code, 401);
        assert.equal((await call("resolve", { id: 1, action: "confirm" })).code, 401);
        assert.equal((await call("undo", { registrationId: parent.id })).code, 401);
        assert.equal((await call("scan", { qr: parentQr }, { ...scannerHeaders, origin: "https://elsewhere.example.com" })).code, 403);
        assert.deepEqual((await call("scan", { qr: linkToken(parentLink.url) })).body, { status: "invalid" });
        assert.deepEqual((await call("scan", { qr: credentialToken(bobLink.access, "qr") })).body, { status: "invalid" });

        const duplicates = await Promise.all([call("scan", { qr: parentQr }), call("scan", { qr: parentQr })]);
        assert.ok(duplicates.every(({ body }) => body.status === "queued"));
        assert.deepEqual((await call("scan", { qr: nextQr })).body, { status: "queued" });
        assert.deepEqual(await status(), { festivalCheckedIn: false });
        const [{ body: firstLaptop }, { body: secondLaptop }] = await Promise.all([
          call("dashboard", undefined, organizerHeaders), call("dashboard", undefined, organizerHeaders),
        ]);
        assert.deepEqual(firstLaptop, secondLaptop);
        assert.deepEqual(firstLaptop.scan, {
          id: firstLaptop.scan.id, name: "Check-in Parent Dancer", pass: "Parent Pass",
          lunch: ["Saturday"], tshirt: "Curvy M (W)", competitions: ["Solo Battle"],
        });
        assert.deepEqual(firstLaptop.checkedInIds, []);
        const confirmation = { id: firstLaptop.scan.id, action: "confirm" };
        const results = await Promise.all([
          call("resolve", confirmation, organizerHeaders), call("resolve", confirmation, organizerHeaders),
        ]);
        for (const { body } of results) {
          assert.deepEqual(body.checkedInIds, [parent.id]);
          assert.equal(body.scan.name, "Check-in Party Dancer");
          assert.equal(body.scan.pass, "Party Pass");
          assert.equal(body.scan.tshirt, null);
          assert.deepEqual(body.scan.lunch, []);
          assert.deepEqual(body.scan.competitions, []);
        }
        assert.deepEqual(await status(), { festivalCheckedIn: true });
        assert.equal((await store.snapshot(session.sessionToken)).festivalCheckedIn, true);
        assert.deepEqual((await call("scan", { qr: parentQr })).body, { status: "alreadyCheckedIn" });
        const [before] = await sql`SELECT checked_in_at FROM festival_arrivals_26 WHERE registration_id = ${parent.id}`;
        await call("resolve", confirmation, organizerHeaders);
        const [after] = await sql`SELECT checked_in_at FROM festival_arrivals_26 WHERE registration_id = ${parent.id}`;
        assert.deepEqual(before, after);

        const registrationBeforeUndo = await store.participant(parent.id);
        const undo = { registrationId: parent.id };
        assert.equal((await call("undo", undo, organizerHeaders)).code, 200);
        assert.equal((await call("undo", undo, organizerHeaders)).code, 200);
        assert.deepEqual(await store.participant(parent.id), registrationBeforeUndo);
        assert.deepEqual(await status(), { festivalCheckedIn: false });
        assert.equal((await store.snapshot(session.sessionToken)).festivalCheckedIn, false);
        await call("undo", { registrationId: next.id }, organizerHeaders);
        const staleConfirmation = await call("resolve", confirmation, organizerHeaders);
        assert.deepEqual(staleConfirmation.body, { checkedInIds: [], scan: results[0].body.scan });
        const dismissed = await call("resolve", { id: results[0].body.scan.id, action: "dismiss" }, organizerHeaders);
        assert.deepEqual(dismissed.body, { checkedInIds: [], scan: null });
        assert.deepEqual((await call("scan", { qr: parentQr })).body, { status: "queued" });
        const rescanned = (await call("dashboard", undefined, organizerHeaders)).body.scan;
        assert.notEqual(rescanned.id, confirmation.id);
        await call("resolve", { id: rescanned.id, action: "confirm" }, organizerHeaders);
        assert.deepEqual(await status(), { festivalCheckedIn: true });
        assert.deepEqual((await call("scan", { qr: nextQr })).body, { status: "queued" });
      });
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
