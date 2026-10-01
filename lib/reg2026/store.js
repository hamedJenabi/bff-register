import { schedule, scheduleById } from "./catalog";
import { choicesFromParticipant, serializeThemeClass } from "./serialization";
import { validateDraft } from "./validation";
import { priceDraft } from "./pricing";
import { RegistrationError, REGISTRATION_COMPLETE_MESSAGE } from "./errors";

const poolFor = (selection) => scheduleById[selection.sessionId].partnerClass ? selection.role : "total";
const activeBooking = "confirmed";

export const createRegistrationStore = (sql) => {
  const saveChoices = async (tx, id, draft) => {
    await tx`UPDATE registrations_26 SET theme_class = ${serializeThemeClass(draft.classes)},
      competition = ${draft.competitions.length ? "yes" : "no"}, competitions = ${draft.competitions.join(",")},
      open_mixnmatch_role = ${draft.competitionRoles.open_mixnmatch || ""},
      newcomers_mixnmatch_role = ${draft.competitionRoles.newcomers_mixnmatch || ""},
      strictly_role = ${draft.competitionRoles.strictly || ""}, lunch = ${draft.lunch.join(",")}
      WHERE id = ${id}`;
  };
  const addBookings = async (tx, id, orderId, draft, status, expiresAt) => {
    for (const selection of draft.classes) {
      await tx`INSERT INTO class_bookings_26 (registration_id, order_id, session_id, pool, status, expires_at)
        VALUES (${id}, ${orderId}, ${selection.sessionId}, ${poolFor(selection)}, ${status}, ${expiresAt})`;
    }
  };
  const enqueueConfirmation = async (tx, order) => {
    await tx`INSERT INTO registration_email_retries_26
      (registration_id, order_id, kind, payload, last_error, attempts, delivery_status)
      VALUES (${order.registration_id}, ${order.id}, 'confirmation', ${tx.json(order.draft)}, '', 0, 'pending')
      ON CONFLICT (order_id, kind) DO NOTHING`;
  };
  const availability = async (registrationId = -1) => {
    const [limits, bookings] = await Promise.all([
      sql`SELECT session_id, pool, capacity FROM class_capacities_26`,
      sql`SELECT session_id, pool, COUNT(DISTINCT registration_id)::INTEGER AS occupied
        FROM class_bookings_26 WHERE registration_id <> ${registrationId}
        AND (status = 'confirmed' OR (status = 'provisional' AND (expires_at > NOW() OR expires_at IS NULL)))
        GROUP BY session_id, pool`,
    ]);
    const overrides = Object.fromEntries(limits.map((row) => [`${row.session_id}:${row.pool}`, row.capacity]));
    const occupied = Object.fromEntries(bookings.map((row) => [`${row.session_id}:${row.pool}`, row.occupied]));
    const classes = {};
    for (const session of schedule) {
      classes[session.id] = {};
      for (const [pool, defaultLimit] of Object.entries(session.capacity)) {
        const key = `${session.id}:${pool}`;
        const capacity = overrides[key] ?? defaultLimit;
        classes[session.id][pool] = { capacity, remaining: Math.max(0, capacity - (occupied[key] || 0)) };
      }
    }
    const [solo] = await sql`SELECT COUNT(DISTINCT id)::INTEGER AS occupied FROM (
      SELECT id FROM registrations_26 WHERE status = 'confirmed' AND 'solo_battle' = ANY(string_to_array(competitions, ','))
      UNION SELECT registration_id AS id FROM reg2026_orders
        WHERE (status = 'payment_pending' OR (status = 'provisional' AND expires_at > NOW()))
        AND draft->'competitions' ? 'solo_battle'
      ) entries WHERE id <> ${registrationId}`;
    return { classes, soloBattleRemaining: Math.max(0, 45 - solo.occupied) };
  };
  const store = {
    findParticipants: (identity) => sql`SELECT id, email, firstname, lastname, ticket, theme_class, competitions,
      open_mixnmatch_role, newcomers_mixnmatch_role, strictly_role, lunch FROM registrations_26
      WHERE status = 'confirmed' AND email || '+' || firstname = ${identity}`,
    availability,
    hasOrders: async (id) => (await sql`SELECT EXISTS(SELECT 1 FROM reg2026_orders WHERE registration_id = ${id}) AS present`)[0].present,
    organizerClasses: async (id) => {
      const [participant] = await sql`SELECT id, firstname, lastname, ticket, status, theme_class FROM registrations_26 WHERE id = ${id}`;
      if (!participant) throw new RegistrationError(404, "Participant not found.");
      return { classes: choicesFromParticipant(participant).classes, version: participant.theme_class || "",
        editable: participant.status === 'confirmed' && ['fullpass', 'parentPass'].includes(participant.ticket) && !(await store.activeOrder(id)),
        availability: (await availability(id)).classes };
    },
    editClasses: (id, classes, version) => sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM registrations_26 WHERE id = ${id} FOR UPDATE`;
      if (!current) throw new RegistrationError(404, "Participant not found.");
      if (current.status !== 'confirmed') throw new RegistrationError(409, "Class editing is available for confirmed participants.");
      const [pending] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${id} AND status IN ('provisional', 'payment_pending')`;
      if (pending) throw new RegistrationError(409, "Finish or cancel this participant's pending checkout before editing classes.");
      if (version !== (current.theme_class || '')) throw new RegistrationError(409, "These classes changed in another session. Reopen the dialog to load the latest choices.");
      const validated = validateDraft({ classes, competitions: [], competitionRoles: {}, lunch: [] }, current);
      if (!validated.valid) throw new RegistrationError(422, "Please check the class choices.", validated.errors);
      const selections = validated.value.classes;
      const saved = choicesFromParticipant(current).classes;
      const remaining = await availability(id);
      const unavailable = selections.some((selection) => !saved.some((old) => old.sessionId === selection.sessionId && old.role === selection.role)
        && (remaining.classes[selection.sessionId]?.[poolFor(selection)]?.remaining || 0) <= 0);
      if (unavailable) throw new RegistrationError(409, "A selected class or dance role is now full. Choose another place.");
      const [order] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${id} AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 1`;
      await tx`DELETE FROM class_bookings_26 WHERE registration_id = ${id}`;
      await addBookings(tx, id, order?.id || null, { classes: selections }, 'confirmed', null);
      const nextVersion = serializeThemeClass(selections);
      await tx`UPDATE registrations_26 SET theme_class = ${nextVersion} WHERE id = ${id}`;
      return { classes: selections, version: nextVersion };
    }),
    completedOrder: async (id) => (await sql`SELECT * FROM reg2026_orders WHERE registration_id = ${id}
      AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 1`)[0],
    activeOrder: async (id) => (await sql`SELECT * FROM reg2026_orders WHERE registration_id = ${id}
      AND status IN ('provisional', 'payment_pending') LIMIT 1`)[0],
    order: async (id, registrationId) => (await sql`SELECT * FROM reg2026_orders
      WHERE id = ${id} AND registration_id = ${registrationId}`)[0],
    attachSession: async (id, sessionId) => {
      await sql`UPDATE reg2026_orders SET stripe_session_id = ${sessionId}
        WHERE id = ${id} AND (stripe_session_id IS NULL OR stripe_session_id = ${sessionId})`;
    },
    submit: (participant, draft, requestKey) => sql.begin(async (tx) => {
      const [current] = await tx`SELECT * FROM registrations_26 WHERE id = ${participant.id} AND status = 'confirmed' FOR UPDATE`;
      if (!current) throw new RegistrationError(403, "This festival registration is no longer confirmed.");
      const validated = validateDraft(draft, current);
      if (!validated.valid) throw new RegistrationError(422, "Please check your choices.", validated.errors);
      draft = validated.value;
      const [previous] = await tx`SELECT * FROM reg2026_orders WHERE registration_id = ${current.id} AND request_key = ${requestKey}`;
      if (previous) {
        const canonical = (value) => JSON.stringify(value, (key, item) =>
          item && !Array.isArray(item) && typeof item === "object"
            ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
        if (canonical(previous.draft) !== canonical(draft)) {
          throw new RegistrationError(409, "This submission key already belongs to different choices.");
        }
        return previous;
      }
      // The participant lock serializes first submissions, including free/empty ones.
      const [completed] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${current.id} AND status = 'confirmed' LIMIT 1`;
      if (completed) throw new RegistrationError(409, REGISTRATION_COMPLETE_MESSAGE);
      const [pending] = await tx`SELECT id FROM reg2026_orders WHERE registration_id = ${current.id}
        AND status IN ('provisional', 'payment_pending')`;
      if (pending) throw new RegistrationError(409, "Finish or cancel your current checkout before submitting new choices.");
      const price = priceDraft(draft, choicesFromParticipant(current));
      if (Object.keys(price.errors).length) throw new RegistrationError(422, "Please check your paid add-ons.", price.errors);
      const remaining = await availability(current.id);
      const unavailable = draft.classes.filter((s) => (remaining.classes[s.sessionId]?.[poolFor(s)]?.remaining || 0) <= 0);
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
      await addBookings(tx, current.id, order.id, draft, paid ? "provisional" : "confirmed", expiresAt);
      if (!paid) {
        await saveChoices(tx, current.id, draft);
        await enqueueConfirmation(tx, order);
      }
      return order;
    }),
    applyPayment: (session, eventType) => sql.begin(async (tx) => {
      // A participant row lock uses the same lock order as submission.
      const [candidate] = await tx`SELECT * FROM reg2026_orders WHERE stripe_session_id = ${session.id}`;
      if (!candidate) return null;
      await tx`SELECT id FROM registrations_26 WHERE id = ${candidate.registration_id} FOR UPDATE`;
      const [order] = await tx`SELECT * FROM reg2026_orders WHERE id = ${candidate.id} FOR UPDATE`;
      if (session.currency !== "eur" || session.amount_total !== order.total_cents ||
          session.client_reference_id !== String(order.registration_id) || session.metadata?.reg2026OrderId !== String(order.id)) {
        throw new RegistrationError(400, "Checkout session does not match its registration order.");
      }
      if (order.status === "confirmed") return order;
      const success = session.payment_status === "paid" && session.status === "complete";
      if (success) {
        await tx`DELETE FROM class_bookings_26 WHERE registration_id = ${order.registration_id}`;
        await addBookings(tx, order.registration_id, order.id, order.draft, activeBooking, null);
        await saveChoices(tx, order.registration_id, order.draft);
        await tx`UPDATE reg2026_orders SET status = 'confirmed', confirmed_at = NOW(), expires_at = NULL WHERE id = ${order.id}`;
        await enqueueConfirmation(tx, order);
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
    deliveriesForOrder: (id) => sql`SELECT id, delivery_status FROM registration_email_retries_26 WHERE order_id = ${id}`,
    claimDelivery: async (id) => (await sql`UPDATE registration_email_retries_26
      SET delivery_status = 'sending', attempts = attempts + 1, updated_at = NOW()
      WHERE id = ${id} AND (delivery_status IN ('pending', 'failed') OR
        (delivery_status = 'sending' AND updated_at < NOW() - INTERVAL '10 minutes')) RETURNING *`)[0],
    finishDelivery: async (id, error) => {
      await sql`UPDATE registration_email_retries_26 SET delivery_status = ${error ? "failed" : "sent"},
        last_error = ${error || ""}, resolved_at = ${error ? null : new Date()}, updated_at = NOW() WHERE id = ${id}`;
    },
    confirmedRecipients: () => sql`SELECT id, email, firstname, lastname FROM registrations_26 AS r
      WHERE status = 'confirmed' AND (
        SELECT COUNT(*) FROM registrations_26 AS duplicate
        WHERE duplicate.status = 'confirmed' AND duplicate.email || '+' || duplicate.firstname = r.email || '+' || r.firstname
      ) = 1 ORDER BY id`,
    queueInvitation: async (id, message) => {
      await sql`INSERT INTO registration_email_retries_26
        (registration_id, kind, payload, last_error, attempts, delivery_status)
        VALUES (${id}, 'invitation', ${sql.json(message)}, '', 0, 'pending')
        ON CONFLICT (registration_id, kind) WHERE kind = 'invitation' DO NOTHING`;
    },
    deliverySummary: async () => {
      const rows = await sql`SELECT kind, delivery_status, COUNT(*)::INTEGER AS count FROM registration_email_retries_26 GROUP BY kind, delivery_status`;
      return rows;
    },
    deliveryBatch: (retry) => retry
      ? sql`SELECT id FROM registration_email_retries_26 WHERE delivery_status = 'failed'
          OR (delivery_status = 'sending' AND updated_at < NOW() - INTERVAL '10 minutes') ORDER BY id LIMIT 25`
      : sql`SELECT id FROM registration_email_retries_26 WHERE delivery_status = 'pending' ORDER BY id LIMIT 25`,
    participantById: async (id) => (await sql`SELECT id, email, firstname, lastname, status FROM registrations_26 WHERE id = ${id}`)[0],
  };
  return store;
};
