import { registrationStore as store } from "../../../db/reg2026";
import { resolveParticipant, isRegistrationOpen, publicParticipant } from "../../../lib/reg2026/access";
import { choicesFromParticipant } from "../../../lib/reg2026/serialization";
import { loadRegistrationState } from "../../../lib/reg2026/state";
import { reconcileOrder } from "../../../lib/reg2026/payments";
import { allowMethod, apiError, publicOrder } from "../../../lib/reg2026/http";
import { deliverConfirmation } from "../../../lib/reg2026/confirmations";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    let participant = await resolveParticipant(req.query, store);
    let { order, completed, edit } = await loadRegistrationState(store, participant, req.query.order);
    if (order && ["provisional", "payment_pending"].includes(order.status)) {
      order = await reconcileOrder(store, order);
      participant = await resolveParticipant(req.query, store);
      ({ order, completed, edit } = await loadRegistrationState(store, participant, String(order.id)));
    }
    if (completed && order?.status === "confirmed") await deliverConfirmation(store, order.id);
    const open = completed ? !!edit : isRegistrationOpen();
    return res.json({ participant: publicParticipant(participant), choices: choicesFromParticipant(participant),
      availability: await store.availability(participant.id), schedule: await store.schedule(), order: publicOrder(order), open, completed, edit,
      pendingDraft: ["provisional", "payment_pending"].includes(order?.status) ? order.draft : null });
  } catch (error) { return apiError(res, error); }
}
