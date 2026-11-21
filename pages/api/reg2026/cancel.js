import { registrationStore as store } from "../../../db/reg2026";
import { assertRegistrationEditable, resolveParticipant } from "../../../lib/reg2026/access";
import { getStripe } from "../../../lib/reg2026/payments";
import { RegistrationError } from "../../../lib/reg2026/errors";
import { allowMethod, apiError, publicOrder } from "../../../lib/reg2026/http";
export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  try {
    const participant = await resolveParticipant(req.body, store);
    assertRegistrationEditable(req.body);
    let order = await store.activeOrder(participant.id);
    if (!order) return res.json({ order: null });
    if (order.status === "provisional" && !order.stripe_session_id) {
      const cancelled = await store.expireUnattached(order.id, { cancel: true });
      if (cancelled) return res.json({ order: publicOrder(cancelled) });
      // Session creation can win the race; cancel that specific session in Stripe.
      order = await store.order(order.id, participant.id);
      if (!["provisional", "payment_pending"].includes(order?.status)) {
        return res.json({ order: publicOrder(order) });
      }
    }
    if (order.status !== "provisional" || !order.stripe_session_id) {
      throw new RegistrationError(409, "Payment is processing or checkout is still being created. Please check its status shortly.");
    }
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.expire(order.stripe_session_id);
    return res.json({ order: publicOrder(await store.applyPayment(session, "checkout.session.expired")) });
  } catch (error) { return apiError(res, error); }
}
