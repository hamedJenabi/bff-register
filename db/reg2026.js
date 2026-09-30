import { sql } from "./db";
import { scheduleById } from "../lib/reg2026/catalog";
import {
  choicesFromParticipant,
  serializeThemeClass,
} from "../lib/reg2026/serialization";

export const findConfirmedParticipantsByIdentity = async (identity) =>
  sql`
    SELECT id, email, firstname, lastname, ticket, theme_class, competitions,
      open_mixnmatch_role, newcomers_mixnmatch_role, strictly_role, lunch
    FROM registrations_26
    WHERE status = 'confirmed'
      AND email || '+' || firstname = ${identity}
  `;

export const getClassAvailability = async () => {
  const rows = await sql`
    SELECT capacities.session_id, capacities.pool, capacities.capacity,
      capacities.capacity - COUNT(DISTINCT bookings.registration_id)::INTEGER AS remaining
    FROM class_capacities_26 AS capacities
    LEFT JOIN class_bookings_26 AS bookings
      ON bookings.session_id = capacities.session_id
      AND bookings.pool = capacities.pool
      AND (
        bookings.status = 'confirmed'
        OR (bookings.status = 'provisional' AND bookings.expires_at > NOW())
      )
    GROUP BY capacities.session_id, capacities.pool, capacities.capacity
    ORDER BY capacities.session_id, capacities.pool
  `;

  return rows.reduce((availability, row) => {
    availability[row.session_id] ||= {};
    availability[row.session_id][row.pool] = {
      capacity: Number(row.capacity),
      remaining: Number(row.remaining),
    };
    return availability;
  }, {});
};

const poolForSelection = (selection) => {
  const classSession = scheduleById[selection.sessionId];
  return classSession?.partnerClass ? selection.role : "total";
};

const findUnavailableSelections = async (transaction, registrationId, classes) => {
  if (classes.length === 0) {
    return [];
  }

  const requested = classes.map((selection) => ({
    sessionId: selection.sessionId,
    pool: poolForSelection(selection),
  }));
  const sessionIds = requested.map(({ sessionId }) => sessionId);
  const rows = await transaction`
    SELECT capacities.session_id, capacities.pool, capacities.capacity,
      COUNT(DISTINCT bookings.registration_id)::INTEGER AS occupied
    FROM class_capacities_26 AS capacities
    LEFT JOIN class_bookings_26 AS bookings
      ON bookings.session_id = capacities.session_id
      AND bookings.pool = capacities.pool
      AND bookings.registration_id <> ${registrationId}
      AND (
        bookings.status = 'confirmed'
        OR (bookings.status = 'provisional' AND bookings.expires_at > NOW())
      )
    WHERE capacities.session_id = ANY(${sessionIds})
    GROUP BY capacities.session_id, capacities.pool, capacities.capacity
  `;

  const capacityByKey = new Map(
    rows.map((row) => [
      `${row.session_id}:${row.pool}`,
      Number(row.capacity) - Number(row.occupied),
    ]),
  );

  return requested.filter(
    ({ sessionId, pool }) =>
      !capacityByKey.has(`${sessionId}:${pool}`) ||
      capacityByKey.get(`${sessionId}:${pool}`) <= 0,
  );
};

export const saveFreeRegistration = async (participant, draft) =>
  sql.begin(async (transaction) => {
    const unavailable = await findUnavailableSelections(
      transaction,
      participant.id,
      draft.classes,
    );
    if (unavailable.length > 0) {
      return { saved: false, unavailable };
    }

    await transaction`
      DELETE FROM class_bookings_26
      WHERE registration_id = ${participant.id}
    `;

    for (const selection of draft.classes) {
      await transaction`
        INSERT INTO class_bookings_26
          (registration_id, session_id, pool, status)
        VALUES (
          ${participant.id},
          ${selection.sessionId},
          ${poolForSelection(selection)},
          'confirmed'
        )
      `;
    }

    await transaction`
      UPDATE registrations_26
      SET theme_class = ${serializeThemeClass(draft.classes)},
        competition = ${draft.competitions.length > 0 ? "yes" : "no"},
        competitions = ${draft.competitions.join(",")},
        open_mixnmatch_role = ${draft.competitionRoles.open_mixnmatch || ""},
        newcomers_mixnmatch_role = ${draft.competitionRoles.newcomers_mixnmatch || ""},
        strictly_role = ${draft.competitionRoles.strictly || ""},
        lunch = ${draft.lunch.join(",")}
      WHERE id = ${participant.id}
    `;

    return { saved: true };
  });

export const getParticipantChoices = choicesFromParticipant;
