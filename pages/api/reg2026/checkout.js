import { registrationStore as store } from "../../../db/reg2026";
import { resolveParticipant } from "../../../lib/reg2026/access";
import { checkoutForOrder, reconcileOrder } from "../../../lib/reg2026/payments";
import { allowMethod, apiError, publicOrder } from "../../../lib/reg2026/http";
export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  try {
    const participant = await resolveParticipant(req.body, store);
    let order = await store.activeOrder(participant.id);
    if (!order) return res.json({ order: null, checkoutUrl: null });
    order = await reconcileOrder(store, order);
    const checkoutUrl = order.status === "provisional" ? await checkoutForOrder(store, participant, order) : null;
    return res.json({ order: publicOrder(order), checkoutUrl });
  } catch (error) { return apiError(res, error); }
}
