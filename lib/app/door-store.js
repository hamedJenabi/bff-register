import { RegistrationError } from "../reg2026/errors";
import { scheduleDays } from "../reg2026/catalog";
import { classBookingSelections } from "./class-bookings";
import { signingSecret, tokenId, validCredential } from "./security";

const doorMode = (session) => {
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
      EXISTS (SELECT 1 FROM reg2026_orders o WHERE o.registration_id = r.id
        AND o.draft->'preserveClasses' IS DISTINCT FROM 'true'::jsonb) AS "hasClassOrders"
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
        person.hasClassOrders,
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
            : await bookedParticipants(tx, session.id, access.registration_id);
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
          entries:
            session.mode === "open"
              ? []
              : await bookedParticipants(tx, session.id),
          generatedAt: new Date().toISOString(),
        };
      }),
  };
};
