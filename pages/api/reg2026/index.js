import { registrationStore as store } from "../../../db/reg2026";
import { resolveParticipant, publicParticipant } from "../../../lib/reg2026/access";
import { choicesFromParticipant } from "../../../lib/reg2026/serialization";
import { loadRegistrationState } from "../../../lib/reg2026/state";
import { reconcileOrder } from "../../../lib/reg2026/payments";
import { allowMethod, apiError, publicOrder } from "../../../lib/reg2026/http";
import { deliverConfirmation } from "../../../lib/reg2026/confirmations";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "GET")) return;
  try {
    let participant = await resolveParticipant(req.query, store);
    let state = await loadRegistrationState(store, participant, req.query.order);
    if (["provisional", "payment_pending"].includes(state.order?.status)) {
      const reconciled = await reconcileOrder(store, state.order);
      participant = await resolveParticipant(req.query, store);
      state = await loadRegistrationState(store, participant, String(reconciled.id));
    }
    const { order } = state;
    if (order?.status === "confirmed") await deliverConfirmation(store, order.id);
    return res.json({ participant: publicParticipant(participant), choices: choicesFromParticipant(participant),
      internEnabled: req.query.intern === "true" && await store.internalRegistrationEnabled(),
      availability: await store.availability(participant.id), schedule: await store.schedule(), ...state, order: publicOrder(order),
      pendingDraft: ["provisional", "payment_pending"].includes(order?.status) ? order.draft : null });
  } catch (error) { return apiError(res, error); }
}
