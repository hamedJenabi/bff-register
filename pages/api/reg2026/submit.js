import { registrationStore as store } from "../../../db/reg2026";
import { assertRegistrationOpen, resolveParticipant } from "../../../lib/reg2026/access";
import { checkoutForOrder, reconcileOrder, getStripe, canonicalOrigin } from "../../../lib/reg2026/payments";
import { deliverOrderConfirmation } from "../../../lib/reg2026/email";
import { choicesFromParticipant } from "../../../lib/reg2026/serialization";
import { validateDraft } from "../../../lib/reg2026/validation";
import { priceDraft } from "../../../lib/reg2026/pricing";
import { RegistrationError } from "../../../lib/reg2026/errors";
import { allowMethod, apiError, publicOrder } from "../../../lib/reg2026/http";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  try {
    assertRegistrationOpen();
    const participant = await resolveParticipant(req.body, store);
    if (typeof req.body.requestKey !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(req.body.requestKey)) {
      throw new RegistrationError(422, "A valid submission key is required.");
    }
    const active = await store.activeOrder(participant.id);
    if (active) await reconcileOrder(store, active);
    // Check payment configuration before allocating new provisional places.
    const validated = validateDraft(req.body.draft, participant);
    if (validated.valid && priceDraft(validated.value, choicesFromParticipant(participant)).totalCents > 0) {
      getStripe(); canonicalOrigin();
    }
    const order = await store.submit(participant, req.body.draft, req.body.requestKey);
    let checkoutUrl = null;
    if (order.status === "provisional") checkoutUrl = await checkoutForOrder(store, participant, order);
    if (order.status === "confirmed") await deliverOrderConfirmation(store, order.id);
    return res.json({ order: publicOrder(order), checkoutUrl });
  } catch (error) { return apiError(res, error); }
}
