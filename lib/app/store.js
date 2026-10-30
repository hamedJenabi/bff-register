import crypto from "crypto";
import { RegistrationError } from "../reg2026/errors";
import { choicesFromParticipant } from "../reg2026/serialization";
import { festivalDates } from "./calendar";
import {
  accessUrl,
  credentialToken,
  linkExpiry,
  randomToken,
  SESSION_SECONDS,
  signingSecret,
  tokenHash,
  tokenId,
  validCredential,
} from "./security";

const unauthorized = () =>
  new RegistrationError(
    401,
    "Open your personal app link from the festival email, or ask the organizers for a new link.",
  );

const registrationDanceRole = (value) => {
  if (!value) return null;
  return /(?:^|_)(lead|follow)$/i.exec(value)?.[1].toLowerCase() || value;
};

export const createAttendeeStore = (sql, registrationStore) => {
  const participant = async (id, tx = sql) =>
    (
      await tx`SELECT id, firstname, lastname, email, country,
    status, ticket, role, level, lunch, competition, competitions, open_mixnmatch_role, newcomers_mixnmatch_role,
    strictly_role, theme_class FROM registrations_26 WHERE id = ${id}`
    )[0];
  const store = {
    participant,
    issueAccess: (id) =>
      sql.begin(async (tx) => {
        signingSecret();
        const [person] =
          await tx`SELECT id, status FROM registrations_26 WHERE id = ${id} FOR UPDATE`;
        if (!person || person.status !== "confirmed")
          throw new RegistrationError(
            409,
            "App links are available for confirmed participants only.",
          );
        let [access] =
          await tx`SELECT * FROM attendee_access_26 WHERE registration_id = ${id}`;
        if (
          !access ||
          access.revoked_at ||
          new Date(access.expires_at).getTime() <= Date.now()
        ) {
          const expires = linkExpiry();
          if (access)
            await tx`DELETE FROM attendee_access_26 WHERE registration_id = ${id}`;
          [access] =
            await tx`INSERT INTO attendee_access_26 (id, registration_id, nonce, expires_at)
          VALUES (${crypto.randomUUID()}, ${id}, ${randomToken()}, ${expires}) RETURNING *`;
        }
        return { access, url: accessUrl(access) };
      }),
    claim: async (token) => {
      signingSecret();
      const id = tokenId(token, "access");
      if (!id) throw unauthorized();
      return sql.begin(async (tx) => {
        const [access] =
          await tx`SELECT a.* FROM attendee_access_26 a JOIN registrations_26 r
          ON r.id = a.registration_id WHERE a.id = ${id} AND r.status = 'confirmed' FOR UPDATE OF a`;
        if (!validCredential(access, token, "access")) throw unauthorized();
        const sessionToken = randomToken();
        const expiresAt = new Date(
          Math.min(
            new Date(access.expires_at).getTime(),
            Date.now() + SESSION_SECONDS * 1000,
          ),
        );
        await tx`DELETE FROM attendee_sessions_26 WHERE access_id = ${id} AND expires_at <= NOW()`;
        await tx`INSERT INTO attendee_sessions_26 (token_hash, access_id, expires_at)
          VALUES (${tokenHash(sessionToken)}, ${id}, ${expiresAt})`;
        return { sessionToken, expiresAt: expiresAt.toISOString() };
      });
    },
    resolveSession: async (token) => {
      signingSecret();
      if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
        throw unauthorized();
      const [access] =
        await sql`SELECT a.* FROM attendee_sessions_26 s JOIN attendee_access_26 a ON a.id = s.access_id
        JOIN registrations_26 r ON r.id = a.registration_id
        WHERE s.token_hash = ${tokenHash(token)} AND s.expires_at > NOW() AND a.expires_at > NOW()
        AND a.revoked_at IS NULL AND r.status = 'confirmed'`;
      if (!access) throw unauthorized();
      return access;
    },
    logout: async (token) => {
      if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        await sql`DELETE FROM attendee_sessions_26 WHERE token_hash = ${tokenHash(token)}`;
      }
    },
    revoke: (id) =>
      sql.begin(async (tx) => {
        const [access] =
          await tx`UPDATE attendee_access_26 SET revoked_at = NOW() WHERE registration_id = ${id} RETURNING id`;
        if (access)
          await tx`DELETE FROM attendee_sessions_26 WHERE access_id = ${access.id}`;
      }),
    snapshot: async (token) => {
      const access = await store.resolveSession(token);
      const person = await participant(access.registration_id);
      if (!person || person.status !== "confirmed") throw unauthorized();
      const [catalog, bookings, orders] = await Promise.all([
        registrationStore.schedule(),
        sql`SELECT session_id, pool, status FROM class_bookings_26 WHERE registration_id = ${person.id}`,
        sql`SELECT status, expires_at FROM reg2026_orders WHERE registration_id = ${person.id}`,
      ]);
      const saved = choicesFromParticipant(person);
      // Confirmed rows own modern admission. Legacy structured choices are usable only
      // when no booking/order history exists; pending checkout never grants admission.
      const legacy = bookings.length === 0 && orders.length === 0;
      const selections =
        legacy && ["fullpass", "parentPass"].includes(person.ticket)
          ? saved.classes
          : bookings
              .filter((row) => row.status === "confirmed")
              .map((row) => ({
                sessionId: row.session_id,
                ...(row.pool !== "total" ? { role: row.pool } : {}),
              }));
      const seen = new Set();
      const classes = selections
        .filter(
          (selection) =>
            selection &&
            typeof selection.sessionId === "string" &&
            !seen.has(selection.sessionId) &&
            seen.add(selection.sessionId),
        )
        .map((selection) => {
          const session = catalog.find(
            (entry) => entry.id === selection.sessionId,
          );
          return {
            sessionId: selection.sessionId,
            role: ["lead", "follow", "switch"].includes(selection.role)
              ? selection.role
              : null,
            title: session?.title || "Class details unavailable",
            teachers: session?.teachers || "",
            description:
              session
                ? session.description || ""
                : "Please contact the organizers for this class's details.",
            day: session?.day || null,
            date: session?.date || null,
            start: session?.start || null,
            end: session?.end || null,
            room: session?.room || null,
            levels: session?.levels || "",
            format: session
              ? session.format || (session.partnerClass ? "partner" : "solo")
              : undefined,
            bookable: session ? session.bookable !== false : undefined,
            detailsMissing: !session,
            source: legacy ? "legacy" : "confirmed",
          };
        });
      return {
        participant: {
          id: person.id,
          firstname: person.firstname,
          lastname: person.lastname,
          email: person.email,
          country: person.country,
          ticket: person.ticket,
          status: person.status,
          proficiency: person.role || null,
          danceRole: registrationDanceRole(person.level),
          lunch: saved.lunch,
          competitions: saved.competitions,
          competitionRoles: saved.competitionRoles,
        },
        classes,
        catalog: catalog.map((session) => ({
          sessionId: session.id,
          title: session.title,
          teachers: session.teachers,
          description: session.description,
          day: session.day,
          date: session.date || null,
          start: session.start,
          end: session.end,
          room: session.room,
          levels: session.levels || "",
          format: session.format || (session.partnerClass ? "partner" : "solo"),
          bookable: session.bookable !== false,
          role: null,
          detailsMissing: false,
          source: "catalog",
        })),
        pendingRegistration: orders.some(
          (order) =>
            order.status === "payment_pending" ||
            (order.status === "provisional" &&
              (!order.expires_at ||
                new Date(order.expires_at).getTime() > Date.now())),
        ),
        qr: {
          value: credentialToken(access, "qr"),
          expiresAt: new Date(access.expires_at).toISOString(),
        },
        syncedAt: new Date().toISOString(),
        timezone: "Europe/Vienna",
        festivalDates: festivalDates(catalog),
      };
    },
  };
  return store;
};
