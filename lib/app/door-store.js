import { RegistrationError } from "../reg2026/errors";
import { scheduleDays } from "../reg2026/catalog";
import { classBookingSelections } from "./class-bookings";
import { signingSecret, tokenId, validCredential } from "./security";

export const CUTTIN_SESSION_ID = "sat-1600-ankersaal";

const doorMode = (session) => {
  if (session.id === CUTTIN_SESSION_ID) return "roster";
  if (session.format === "talk") return "open";
  return session.bookable === false ? null : "booking";
};

const sessionSummary = (session) => ({
  id: session.id,
  title: session.title,
  day: session.day,
  date: session.date || null,
  start: session.start,
  end: session.end,
  room: session.room,
  mode: doorMode(session),
});

export const createDoorStore = (sql, registrationStore) => {
  const sessionFor = async (tx, id) => {
    if (typeof id !== "string" || !/^[a-z0-9_-]{1,120}$/.test(id)) {
      throw new RegistrationError(422, "Select a class session.");
    }
    const session = (await registrationStore.schedule(tx)).find(
      (item) => item.id === id,
    );
    if (!session || !doorMode(session)) {
      throw new RegistrationError(
        404,
        "That session is unavailable for door checks. Refresh the class list.",
      );
    }
    return sessionSummary(session);
  };
  const bookedParticipants = async (tx, sessionId, id = null) => {
    const people =
      await tx`SELECT r.id, r.firstname, r.lastname, r.ticket, r.theme_class,
      COALESCE(b.bookings, '[]'::jsonb) AS bookings,
      EXISTS (SELECT 1 FROM reg2026_orders o WHERE o.registration_id = r.id) AS "hasOrders"
      FROM registrations_26 r LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('session_id', session_id, 'pool', pool, 'status', status) ORDER BY id) AS bookings
        FROM class_bookings_26 WHERE registration_id = r.id
      ) b ON true
      WHERE r.status = 'confirmed' ${id === null ? tx`` : tx`AND r.id = ${id}`}
      ORDER BY r.lastname, r.firstname, r.id`;
    return people.flatMap((person) => {
      const { selections } = classBookingSelections(
        person,
        person.bookings,
        person.hasOrders,
      );
      const booking = selections.find((entry) => entry.sessionId === sessionId);
      return booking
        ? [
            {
              id: person.id,
              firstname: person.firstname,
              lastname: person.lastname,
              role: booking.role,
            },
          ]
        : [];
    });
  };
  const cuttinParticipants = (
    tx,
    id = null,
  ) => tx`SELECT r.id, r.firstname, r.lastname, NULL AS role
    FROM app_cuttin_roster_26 c JOIN registrations_26 r ON r.id = c.registration_id
    WHERE r.status = 'confirmed' ${id === null ? tx`` : tx`AND r.id = ${id}`}
    ORDER BY r.lastname, r.firstname, r.id`;
  const rosterFor = (tx, session, id) =>
    session.mode === "roster"
      ? cuttinParticipants(tx, id)
      : bookedParticipants(tx, session.id, id);

  return {
    sessions: async () => {
      const catalog = await registrationStore.schedule();
      return {
        sessions: catalog
          .filter(doorMode)
          .map(sessionSummary)
          .sort(
            (a, b) =>
              scheduleDays.indexOf(a.day) - scheduleDays.indexOf(b.day) ||
              a.start.localeCompare(b.start) ||
              a.room.localeCompare(b.room),
          ),
      };
    },
    verify: ({ sessionId, qr } = {}) =>
      sql.begin("isolation level repeatable read read only", async (tx) => {
        const session = await sessionFor(tx, sessionId);
        signingSecret();
        const id = tokenId(qr, "qr");
        if (!id) return { status: "invalid" };
        const [access] =
          await tx`SELECT a.*, r.firstname, r.lastname FROM attendee_access_26 a
        JOIN registrations_26 r ON r.id = a.registration_id WHERE a.id = ${id} AND r.status = 'confirmed'`;
        if (!validCredential(access, qr, "qr")) return { status: "invalid" };

        const [entry] =
          session.mode === "open"
            ? [access]
            : await rosterFor(tx, session, access.registration_id);
        return entry
          ? {
              status: "eligible",
              firstname: entry.firstname,
              lastname: entry.lastname,
              role: entry.role ?? null,
            }
          : { status: "ineligible" };
      }),
    roster: (sessionId) =>
      sql.begin("isolation level repeatable read read only", async (tx) => {
        const session = await sessionFor(tx, sessionId);
        return {
          session,
          entries: session.mode === "open" ? [] : await rosterFor(tx, session),
          generatedAt: new Date().toISOString(),
        };
      }),
    search: async (value) => {
      const query = typeof value === "string" ? value.trim() : "";
      if (query.length < 2 || query.length > 100)
        throw new RegistrationError(
          422,
          "Enter 2 to 100 characters of a name or registration ID.",
        );
      const participants =
        await sql`SELECT id, firstname, lastname FROM registrations_26 WHERE status = 'confirmed'
        AND (id::text = ${query} OR position(lower(${query}) in lower(concat_ws(' ', firstname, lastname))) > 0)
        ORDER BY lastname, firstname, id LIMIT 20`;
      return { participants };
    },
    setCuttinEntry: ({ id, included } = {}) =>
      sql.begin(async (tx) => {
        if (
          !Number.isInteger(id) ||
          id <= 0 ||
          id > 2147483647 ||
          typeof included !== "boolean"
        ) {
          throw new RegistrationError(
            422,
            "Select a registration and an action.",
          );
        }
        await sessionFor(tx, CUTTIN_SESSION_ID);
        if (included) {
          const [person] =
            await tx`SELECT id FROM registrations_26 WHERE id = ${id} AND status = 'confirmed' FOR SHARE`;
          if (!person)
            throw new RegistrationError(
              409,
              "This registration is no longer confirmed.",
            );
          await tx`INSERT INTO app_cuttin_roster_26 (registration_id) VALUES (${id}) ON CONFLICT DO NOTHING`;
        } else {
          await tx`DELETE FROM app_cuttin_roster_26 WHERE registration_id = ${id}`;
        }
        return { ok: true };
      }),
  };
};
