import { schedule as mockSchedule } from "./catalog";
import { indexSchedule, mergeSchedule, remainingPlaces, scheduleFields, structuralFields, validateSchedule } from "./schedule";
import { choicesFromParticipant, hasRegisteredClasses, serializeThemeClass } from "./serialization";
import { validateDraft } from "./validation";
import { priceDraft } from "./pricing";
import { RegistrationError, REGISTRATION_COMPLETE_MESSAGE } from "./errors";
import { validatePublishedSessions } from "./sheet-schema";
import { createHash } from "node:crypto";
import { confirmationPayload, CONFIRMATION_WORKFLOW } from "./confirmations";
import { classAvailability, PARTNER_CLASS_CAPACITY } from "./capacity";

const poolFor = (selection, scheduleById) => scheduleById[selection.sessionId].partnerClass ? selection.role : "total";
const activeBooking = "confirmed";

export const createRegistrationStore = (sql) => {
  const latestPublication = async (client = sql) => {
    const [publication] = await client`SELECT * FROM schedule_publications_26 ORDER BY id DESC LIMIT 1`;
    if (publication?.sessions.some((session) => session.partnerClass && session.capacity?.total === undefined)) {
      // Normalize old snapshots and Sheet rows identically, so existing
      // publications can still sync and edit capacities without a manual reset.
      const sessions = validatePublishedSessions(publication.sessions);
      return { ...publication, sessions, source_hash: createHash("sha256").update(JSON.stringify(sessions)).digest("hex") };
    }
    return publication;
  };
  const publicationMetadata = (publication) => publication ? {
    id: Number(publication.id),
    spreadsheetId: publication.spreadsheet_id,
    sheetName: publication.sheet_name,
    sourceHash: publication.source_hash,
    publishedAt: new Date(publication.published_at).toISOString(),
    count: publication.sessions.length,
  } : null;
  const loadLegacySchedule = async (client = sql) => {
    const [snapshot] = await client`SELECT
      COALESCE((SELECT jsonb_agg(row) FROM (SELECT session_id, data, revision FROM schedule_overrides_26) row), '[]'::jsonb) AS overrides,
      COALESCE((SELECT jsonb_agg(row) FROM (SELECT session_id, pool, capacity FROM class_capacities_26) row), '[]'::jsonb) AS limits`;
    return mergeSchedule(snapshot.overrides, snapshot.limits);
  };
  const loadSchedule = async (client = sql) => {
    const publication = await latestPublication(client);
    if (publication) return publication.sessions.map((session) => ({ ...session, version: Number(publication.id) }));
    if (process.env.REG2026_SCHEDULE_SHEET_ID) {
      throw new RegistrationError(503, "The Google Sheets schedule has not been published yet. Please contact the organizers.");
    }
    return loadLegacySchedule(client);
  };
  const saveChoices = async (tx, id, draft) => {
    await tx`UPDATE registrations_26 SET theme_class = ${serializeThemeClass(draft.classes)},
      competition = ${draft.competitions.length ? "yes" : "no"}, competitions = ${draft.competitions.join(",")},
      open_mixnmatch_role = ${draft.competitionRoles.open_mixnmatch || ""},
      newcomers_mixnmatch_role = ${draft.competitionRoles.newcomers_mixnmatch || ""},
      strictly_role = ${draft.competitionRoles.strictly || ""}, lunch = ${draft.lunch.join(",")}
      WHERE id = ${id}`;
  };
  const addBookings = async (tx, id, orderId, draft, status, expiresAt, scheduleById) => {
    for (const selection of draft.classes) {
      await tx`INSERT INTO class_bookings_26 (registration_id, order_id, session_id, pool, status, expires_at)
        VALUES (${id}, ${orderId}, ${selection.sessionId}, ${poolFor(selection, scheduleById)}, ${status}, ${expiresAt})`;
    }
  };
  const queueConfirmation = async (tx, participant, order, draft, sessions) => {
    const payload = confirmationPayload(participant, draft, sessions);
    await tx`INSERT INTO registration_email_retries_26
      (registration_id, order_id, kind, payload, last_error, attempts, delivery_status)
      VALUES (${participant.id}, ${order.id}, 'confirmation', ${tx.json(payload)}, '', 0, 'pending')
      ON CONFLICT (order_id, kind) DO NOTHING`;
  };
  const availability = async (registrationId = -1, client = sql) => {
    const [schedule, bookings] = await Promise.all([
      loadSchedule(client),
      client`SELECT session_id, pool, COUNT(DISTINCT registration_id)::INTEGER AS occupied
        FROM class_bookings_26 WHERE registration_id <> ${registrationId}
        AND (status = 'confirmed' OR (status = 'provisional' AND (expires_at > NOW() OR expires_at IS NULL)))
        GROUP BY session_id, pool`,
    ]);
    const occupied = new Map();
    for (const row of bookings) {
      if (!occupied.has(row.session_id)) occupied.set(row.session_id, {});
      occupied.get(row.session_id)[row.pool] = row.occupied;
    }
    const classes = Object.fromEntries(schedule.map((session) => [session.id, classAvailability(session, occupied.get(session.id))]));
    const [solo] = await client`SELECT COUNT(DISTINCT id)::INTEGER AS occupied FROM (
      SELECT id FROM registrations_26 WHERE status = 'confirmed' AND 'solo_battle' = ANY(string_to_array(competitions, ','))
      UNION SELECT registration_id AS id FROM reg2026_orders
        WHERE (status = 'payment_pending' OR (status = 'provisional' AND expires_at > NOW()))
        AND draft->'competitions' ? 'solo_battle'
      ) entries WHERE id <> ${registrationId}`;
    return { classes, soloBattleRemaining: Math.max(0, 45 - solo.occupied) };
  };
  const store = {
    schedule: loadSchedule,
    schedulePublication: async () => publicationMetadata(await latestPublication()),
    editPublishedCapacity: (id, capacity, expectedVersion, updateSheet) => sql.begin(async (tx) => {
      // Serialize this write with publishing and bookings, including its Sheet update.
      await tx`SELECT pg_advisory_xact_lock(2026, 1)`;
      const current = await latestPublication(tx);
      if (!current) throw new RegistrationError(409, "Sync the schedule once before editing capacities here.");
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== Number(current.id)) {
        throw new RegistrationError(409, "The published schedule changed. Reload before saving capacities.");
      }
      const session = current.sessions.find((entry) => entry.id === id);
      if (!session) throw new RegistrationError(404, "Class not found.");
      if (session.format === "talk") throw new RegistrationError(422, "Talks are open and have no capacity limit.");
      const pools = ["total"];
      if (!capacity || typeof capacity !== "object" || Array.isArray(capacity) ||
          Object.keys(capacity).some((pool) => !pools.includes(pool))) {
        throw new RegistrationError(422, "Submit only the capacity fields for this class.");
      }
      const validation = validateSchedule({ ...session, totalCapacity: capacity.total });
      if (!validation.valid) throw new RegistrationError(422, "Please check the capacity values.", validation.errors);
      const sessions = validatePublishedSessions(current.sessions.map((entry) => entry.id === id ? { ...entry, capacity: validation.value.capacity } : entry));
      const sourceHash = createHash("sha256").update(JSON.stringify(sessions)).digest("hex");
      if (sourceHash === current.source_hash) return publicationMetadata(current);
      await updateSheet({ publication: publicationMetadata(current), id, capacity: validation.value.capacity, sessions });
      const [saved] = await tx`INSERT INTO schedule_publications_26 (spreadsheet_id, sheet_name, source_hash, sessions)
        VALUES (${current.spreadsheet_id}, ${current.sheet_name}, ${sourceHash}, ${tx.json(sessions)}) RETURNING *`;
      return publicationMetadata(saved);
    }),
    publishSchedule: (source, expectedVersion) => sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(2026, 1)`;
      const previous = await latestPublication(tx);
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0 || expectedVersion !== Number(previous?.id || 0)) {
        throw new RegistrationError(409, "The published schedule changed in another session. Reload before syncing again.");
      }
      if (typeof source?.spreadsheetId !== "string" || !source.spreadsheetId.trim() || source.spreadsheetId.length > 200 ||
          typeof source.sheetName !== "string" || !source.sheetName.trim() || source.sheetName.length > 100 ||
          typeof source.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(source.sourceHash)) {
        throw new RegistrationError(422, "The schedule source is invalid. Reload the Google Sheet before syncing again.");
      }
      const sessions = validatePublishedSessions(source.sessions);
      if (previous && previous.source_hash === source.sourceHash && previous.spreadsheet_id === source.spreadsheetId && previous.sheet_name === source.sheetName) {
        return publicationMetadata(previous);
      }
      // All class writers take this same advisory lock before participant locks.
      // Read dependencies inside the lock so publication cannot race fulfillment.
      const current = previous ? previous.sessions : await loadLegacySchedule(tx);
      const currentById = indexSchedule(current);
      const nextById = indexSchedule(sessions);
      const bookings = await tx`SELECT DISTINCT session_id FROM class_bookings_26`;
      // A delayed verified success can fulfill an expired/failed checkout too.
      // Retain every historical order's class IDs and structural requirements.
      const orders = await tx`SELECT draft FROM reg2026_orders`;
      const participants = await tx`SELECT theme_class FROM registrations_26 WHERE theme_class IS NOT NULL AND theme_class <> ''`;
      const referenced = new Set(bookings.map((booking) => booking.session_id));
      for (const order of orders) {
        for (const choice of Array.isArray(order.draft?.classes) ? order.draft.classes : []) {
          if (typeof choice?.sessionId === "string") referenced.add(choice.sessionId);
        }
      }
      for (const participant of participants) {
        for (const choice of choicesFromParticipant(participant).classes) {
          if (typeof choice?.sessionId === "string") referenced.add(choice.sessionId);
        }
      }
      const errors = {};
      // The initial catalog may contain weekdays before calendar dates are known.
      // Populate the whole validated weekend once; known booked dates stay fixed.
      const firstCalendarDates = current.every((session) => !session.date) && sessions.every((session) => !!session.date);
      const protectedFields = ["day", "start", "end", "partnerClass", ...(firstCalendarDates ? [] : ["date"])];
      for (const id of referenced) {
        const next = nextById[id];
        const existing = currentById[id];
        if (!next) errors[id] = "This session is referenced by a registration or order and cannot be removed. Keep its permanent session ID.";
        else if (!existing || protectedFields.some((field) => (existing[field] ?? "") !== (next[field] ?? ""))) {
          errors[id] = "This session has registrations. Its day, date, times and class format must stay unchanged.";
        }
      }
      if (Object.keys(errors).length) throw new RegistrationError(409, "Some changes would invalidate existing registrations. The published schedule was kept.", errors);
      const [publication] = await tx`INSERT INTO schedule_publications_26 (spreadsheet_id, sheet_name, source_hash, sessions)
        VALUES (${source.spreadsheetId}, ${source.sheetName}, ${source.sourceHash}, ${tx.json(sessions)}) RETURNING *`;
      return publicationMetadata(publication);
    }),
    editSchedule: (id, values, version) => sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(2026, 1)`;
      if (process.env.REG2026_SCHEDULE_SHEET_ID || await latestPublication(tx)) {
        throw new RegistrationError(409, "Edit the schedule in Google Sheets, then sync it from the Schedule dashboard.");
      }
      const current = (await loadSchedule(tx)).find((session) => session.id === id);
      if (!current) throw new RegistrationError(404, "Class not found.");
      if (version !== current.version) throw new RegistrationError(409, "This class changed in another session. Reload the schedule before saving.");
      const result = validateSchedule(values);
      if (!result.valid) throw new RegistrationError(422, "Please check the class details.", result.errors);
      const next = result.value;
      if (structuralFields.some((field) => current[field] !== next[field])) {
        const [references] = await tx`SELECT EXISTS(SELECT 1 FROM class_bookings_26 WHERE session_id = ${id})
          OR EXISTS(SELECT 1 FROM reg2026_orders WHERE status IN ('provisional', 'payment_pending', 'confirmed')
          AND draft->'classes' @> ${tx.json([{ sessionId: id }])}) AS booked`;
        const legacy = await tx`SELECT theme_class FROM registrations_26 WHERE theme_class IS NOT NULL AND theme_class <> ''`;
        if (references.booked || legacy.some((person) => choicesFromParticipant(person).classes.some((choice) => choice.sessionId === id))) {
          throw new RegistrationError(409, "This class has registrations. You can edit its title, teachers, description, room and capacity; its day, times and class type must stay the same.");
        }
      }
      const base = mockSchedule.find((session) => session.id === id);
      const data = Object.fromEntries(scheduleFields.filter((field) => next[field] !== base[field]).map((field) => [field, next[field]]));
      await tx`INSERT INTO schedule_overrides_26 (session_id, data, revision) VALUES (${id}, ${tx.json(data)}, 1)
        ON CONFLICT (session_id) DO UPDATE SET data = EXCLUDED.data, revision = schedule_overrides_26.revision + 1, updated_at = NOW()`;
      await tx`DELETE FROM class_capacities_26 WHERE session_id = ${id}`;
      for (const [pool, capacity] of Object.entries(next.capacity)) {
        const defaultLimit = base.partnerClass === next.partnerClass ? base.capacity[pool] : next.partnerClass ? PARTNER_CLASS_CAPACITY : 30;
        if (capacity !== defaultLimit) await tx`INSERT INTO class_capacities_26 (session_id, pool, capacity) VALUES (${id}, ${pool}, ${capacity})`;
      }
      return (await loadSchedule(tx)).find((session) => session.id === id);
    }),
    findParticipants: (identity) => sql`SELECT id, email, firstname, lastname, ticket, theme_class, competitions,
      open_mixnmatch_role, newcomers_mixnmatch_role, strictly_role, lunch FROM registrations_26
      WHERE status = 'confirmed' AND email || '+' || firstname = ${identity}`,
    availability,
    hasOrders: async (id) => (await sql`SELECT EXISTS(SELECT 1 FROM reg2026_orders WHERE registration_id = ${id}) AS present`)[0].present,
    organizerClasses: async (id) => {
      const [participant] = await sql`SELECT id, firstname, lastname, ticket, status, theme_class FROM registrations_26 WHERE id = ${id}`;
      if (!participant) throw new RegistrationError(404, "Participant not found.");
      const classes = choicesFromParticipant(participant).classes;
      const editable = participant.status === 'confirmed' && ['fullpass', 'parentPass'].includes(participant.ticket) && !(await store.activeOrder(id));
      return { classes, version: participant.theme_class || "",
        editable, reopenable: editable && (classes.length > 0 || !!(await store.completedOrder(id))),
        availability: (await availability(id)).classes, schedule: await loadSchedule() };
    },
    editClasses: (id, classes, version) => sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(2026, 1)`;
      const sessions = await loadSchedule(tx);
      const scheduleById = indexSchedule(sessions);
      const [current] = await tx`SELECT * FROM registrations_26 WHERE id = ${id} FOR UPDATE`;
      if (!current) throw new RegistrationError(404, "Participant not found.");
      if (current.status !== 'confirmed') throw new RegistrationError(409, "Class editing is available for confirmed participants.");
      const [pending] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${id} AND status IN ('provisional', 'payment_pending')`;
      if (pending) throw new RegistrationError(409, "Finish or cancel this participant's pending checkout before editing classes.");
      if (version !== (current.theme_class || '')) throw new RegistrationError(409, "These classes changed in another session. Reopen the dialog to load the latest choices.");
      const validated = validateDraft({ classes, competitions: [], competitionRoles: {}, lunch: [] }, current, sessions);
      if (!validated.valid) throw new RegistrationError(422, "Please check the class choices.", validated.errors);
      const selections = validated.value.classes;
      const saved = choicesFromParticipant(current).classes;
      const remaining = await availability(id, tx);
      const unavailable = selections.some((selection) => !saved.some((old) => old.sessionId === selection.sessionId && old.role === selection.role)
        && remainingPlaces(remaining.classes[selection.sessionId]?.[poolFor(selection, scheduleById)]) <= 0);
      if (unavailable) throw new RegistrationError(409, "A selected class or dance role is now full. Choose another place.");
      const [order] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${id} AND status = 'confirmed' AND reopened_at IS NULL ORDER BY confirmed_at DESC, id DESC LIMIT 1`;
      await tx`DELETE FROM class_bookings_26 WHERE registration_id = ${id}`;
      await addBookings(tx, id, order?.id || null, { classes: selections }, 'confirmed', null, scheduleById);
      const nextVersion = serializeThemeClass(selections);
      await tx`UPDATE registrations_26 SET theme_class = ${nextVersion} WHERE id = ${id}`;
      return { classes: selections, version: nextVersion };
    }),
    reopenClasses: (id, version) => sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock_shared(2026, 1)`;
      const [current] = await tx`SELECT * FROM registrations_26 WHERE id = ${id} FOR UPDATE`;
      if (!current) throw new RegistrationError(404, "Participant not found.");
      if (current.status !== 'confirmed' || !['fullpass', 'parentPass'].includes(current.ticket)) {
        throw new RegistrationError(409, "Class registration can be reopened for confirmed Full/Parent passes.");
      }
      const [pending] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${id} AND status IN ('provisional', 'payment_pending')`;
      if (pending) throw new RegistrationError(409, "Finish or cancel this participant's pending checkout before reopening registration.");
      if (version !== (current.theme_class || '')) {
        throw new RegistrationError(409, "These classes changed in another session. Reload the participant before reopening registration.");
      }
      const [completed] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${id} AND status = 'confirmed' AND reopened_at IS NULL LIMIT 1`;
      if (!completed && !hasRegisteredClasses(current)) throw new RegistrationError(409, "This participant can already register.");
      await tx`DELETE FROM class_bookings_26 WHERE registration_id = ${id}`;
      const nextVersion = serializeThemeClass([]);
      await tx`UPDATE registrations_26 SET theme_class = ${nextVersion} WHERE id = ${id}`;
      // Preserve payment history and paid add-ons; retire only the completion lock.
      await tx`UPDATE reg2026_orders SET reopened_at = NOW() WHERE registration_id = ${id} AND status = 'confirmed' AND reopened_at IS NULL`;
      return { classes: [], version: nextVersion, reopened: true };
    }),
    completedOrder: async (id) => (await sql`SELECT * FROM reg2026_orders WHERE registration_id = ${id}
      AND status = 'confirmed' AND reopened_at IS NULL ORDER BY confirmed_at DESC, id DESC LIMIT 1`)[0],
    activeOrder: async (id) => (await sql`SELECT * FROM reg2026_orders WHERE registration_id = ${id}
      AND status IN ('provisional', 'payment_pending') LIMIT 1`)[0],
    order: async (id, registrationId) => (await sql`SELECT * FROM reg2026_orders
      WHERE id = ${id} AND registration_id = ${registrationId} AND reopened_at IS NULL`)[0],
    attachSession: async (id, sessionId) => {
      await sql`UPDATE reg2026_orders SET stripe_session_id = ${sessionId}
        WHERE id = ${id} AND (stripe_session_id IS NULL OR stripe_session_id = ${sessionId})`;
    },
    submit: (participant, draft, requestKey) => sql.begin(async (tx) => {
      // Check and reserve the shared last place under one exclusive lock.
      await tx`SELECT pg_advisory_xact_lock(2026, 1)`;
      const sessions = await loadSchedule(tx);
      const scheduleById = indexSchedule(sessions);
      const [current] = await tx`SELECT * FROM registrations_26 WHERE id = ${participant.id} AND status = 'confirmed' FOR UPDATE`;
      if (!current) throw new RegistrationError(403, "This festival registration is no longer confirmed.");
      const validated = validateDraft(draft, current, sessions);
      if (!validated.valid) throw new RegistrationError(422, "Please check your choices.", validated.errors);
      draft = validated.value;
      const [previous] = await tx`SELECT * FROM reg2026_orders WHERE registration_id = ${current.id} AND request_key = ${requestKey}`;
      if (previous) {
        if (previous.reopened_at) throw new RegistrationError(409, "Registration was reopened. Reload the form before submitting again.");
        const canonical = (value) => JSON.stringify(value, (key, item) =>
          item && !Array.isArray(item) && typeof item === "object"
            ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
        if (canonical(previous.draft) !== canonical(draft)) {
          throw new RegistrationError(409, "This submission key already belongs to different choices.");
        }
        return previous;
      }
      // The participant lock serializes first submissions, including free/empty ones.
      const [completed] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${current.id} AND status = 'confirmed' AND reopened_at IS NULL LIMIT 1`;
      if (completed || hasRegisteredClasses(current)) throw new RegistrationError(409, REGISTRATION_COMPLETE_MESSAGE);
      const [pending] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${current.id}
        AND status IN ('provisional', 'payment_pending')`;
      if (pending) throw new RegistrationError(409, "Finish or cancel your current checkout before submitting new choices.");
      const price = priceDraft(draft, choicesFromParticipant(current));
      if (Object.keys(price.errors).length) throw new RegistrationError(422, "Please check your paid add-ons.", price.errors);
      const remaining = await availability(current.id, tx);
      const unavailable = draft.classes.filter((s) => remainingPlaces(remaining.classes[s.sessionId]?.[poolFor(s, scheduleById)]) <= 0);
      if (unavailable.length) throw new RegistrationError(409, "A selected class or dance role is now full. Your draft has been kept.", {
        classes: unavailable.map((s) => scheduleById[s.sessionId].title).join(", ") + " is unavailable.",
      });
      if (draft.competitions.includes("solo_battle") && !choicesFromParticipant(current).competitions.includes("solo_battle") && remaining.soloBattleRemaining <= 0) {
        throw new RegistrationError(409, "Solo Battle is now full.", { competitions: "Please remove Solo Battle from your draft." });
      }
      const paid = price.totalCents > 0;
      const expiresAt = paid ? new Date(Date.now() + 60 * 60 * 1000) : null;
      const [order] = await tx`INSERT INTO reg2026_orders
        (registration_id, request_key, status, draft, subtotal_cents, fee_cents, total_cents, expires_at, confirmed_at)
        VALUES (${current.id}, ${requestKey}, ${paid ? "provisional" : "confirmed"}, ${tx.json(draft)},
          ${price.subtotalCents}, ${price.feeCents}, ${price.totalCents}, ${expiresAt}, ${paid ? null : new Date()}) RETURNING *`;
      if (!paid) await tx`DELETE FROM class_bookings_26 WHERE registration_id = ${current.id}`;
      await addBookings(tx, current.id, order.id, draft, paid ? "provisional" : "confirmed", expiresAt, scheduleById);
      if (!paid) {
        await saveChoices(tx, current.id, draft);
        await queueConfirmation(tx, current, order, draft, sessions);
      }
      return order;
    }),
    applyPayment: (session, eventType) => sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock_shared(2026, 1)`;
      // A participant row lock uses the same lock order as submission.
      const [candidate] = await tx`SELECT * FROM reg2026_orders WHERE stripe_session_id = ${session.id}`;
      if (!candidate) return null;
      const [participant] = await tx`SELECT * FROM registrations_26 WHERE id = ${candidate.registration_id} FOR UPDATE`;
      const [order] = await tx`SELECT * FROM reg2026_orders WHERE id = ${candidate.id} FOR UPDATE`;
      if (session.currency !== "eur" || session.amount_total !== order.total_cents ||
          session.client_reference_id !== String(order.registration_id) || session.metadata?.reg2026OrderId !== String(order.id)) {
        throw new RegistrationError(400, "Checkout session does not match its registration order.");
      }
      if (order.status === "confirmed") return order;
      const success = session.payment_status === "paid" && session.status === "complete";
      if (success) {
        const sessions = await loadSchedule(tx);
        await tx`DELETE FROM class_bookings_26 WHERE registration_id = ${order.registration_id}`;
        await addBookings(tx, order.registration_id, order.id, order.draft, activeBooking, null, indexSchedule(sessions));
        await saveChoices(tx, order.registration_id, order.draft);
        await tx`UPDATE reg2026_orders SET status = 'confirmed', confirmed_at = NOW(), expires_at = NULL WHERE id = ${order.id}`;
        await queueConfirmation(tx, participant, order, order.draft, sessions);
        return { ...order, status: "confirmed" };
      }
      // Ignore out-of-order notifications after a terminal failure/expiry.
      if (!["provisional", "payment_pending"].includes(order.status)) return order;
      if (eventType === "checkout.session.async_payment_failed" || session.status === "expired") {
        const status = session.status === "expired" ? "expired" : "payment_failed";
        await tx`DELETE FROM class_bookings_26 WHERE order_id = ${order.id} AND status = 'provisional'`;
        await tx`UPDATE reg2026_orders SET status = ${status} WHERE id = ${order.id}`;
        return { ...order, status };
      }
      if (session.status === "complete") {
        await tx`UPDATE reg2026_orders SET status = 'payment_pending', expires_at = NULL WHERE id = ${order.id}`;
        await tx`UPDATE class_bookings_26 SET expires_at = NULL WHERE order_id = ${order.id} AND status = 'provisional'`;
        return { ...order, status: "payment_pending" };
      }
      return order;
    }),
    expireUnattached: async (id) => sql.begin(async (tx) => {
      const [order] = await tx`UPDATE reg2026_orders SET status = 'expired' WHERE id = ${id}
        AND status = 'provisional' AND stripe_session_id IS NULL AND expires_at <= NOW() RETURNING *`;
      if (order) await tx`DELETE FROM class_bookings_26 WHERE order_id = ${id} AND status = 'provisional'`;
      return order;
    }),
    participantById: async (id) => (await sql`SELECT id, email, firstname, lastname, status FROM registrations_26 WHERE id = ${id}`)[0],
    claimConfirmation: (orderId) => sql.begin(async (tx) => {
      const [delivery] = await tx`SELECT e.id, e.payload, e.delivery_status,
          o.status AS order_status, o.reopened_at, r.status AS participant_status
        FROM registration_email_retries_26 AS e
        JOIN reg2026_orders AS o ON o.id = e.order_id
        JOIN registrations_26 AS r ON r.id = e.registration_id
        WHERE e.order_id = ${orderId} AND e.kind = 'confirmation' FOR UPDATE OF e`;
      if (!delivery || delivery.payload?.workflow !== CONFIRMATION_WORKFLOW) return { status: "not_queued" };
      if (delivery.order_status !== "confirmed" || delivery.reopened_at || delivery.participant_status !== "confirmed") return { status: "ineligible" };
      if (delivery.delivery_status === "sent") return { status: "already_sent" };
      if (delivery.delivery_status === "sending") return { status: "sending" };
      await tx`UPDATE registration_email_retries_26 SET delivery_status = 'sending',
        attempts = attempts + 1, updated_at = NOW() WHERE id = ${delivery.id}`;
      return { status: "claimed", id: delivery.id, payload: delivery.payload };
    }),
    finishConfirmation: async (id, status, lastError) => {
      const [finished] = await sql`UPDATE registration_email_retries_26
        SET delivery_status = ${status}, last_error = ${lastError}, updated_at = NOW(),
          resolved_at = CASE WHEN ${status} = 'sent' THEN NOW() ELSE NULL END
        WHERE id = ${id} AND kind = 'confirmation' AND delivery_status = 'sending' RETURNING id`;
      if (!finished) throw new Error("Confirmation delivery record changed during sending.");
    },
  };
  return store;
};
