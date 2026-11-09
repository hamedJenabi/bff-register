import { registrationStore as store } from "../../../db/reg2026";
import { assertRegistrationOpen, canEditConfirmedRegistration, resolveParticipant } from "../../../lib/reg2026/access";
import { checkoutForOrder, reconcileOrder, getStripe, canonicalOrigin } from "../../../lib/reg2026/payments";
import { choicesFromParticipant, hasRegisteredClasses } from "../../../lib/reg2026/serialization";
import { requiredClassesError, validateDraft } from "../../../lib/reg2026/validation";
import { priceDraft } from "../../../lib/reg2026/pricing";
import { RegistrationError } from "../../../lib/reg2026/errors";
import { confirmedChoicesVersion } from "../../../lib/reg2026/state";
import { allowMethod, apiError, publicOrder } from "../../../lib/reg2026/http";
import { deliverConfirmation } from "../../../lib/reg2026/confirmations";

export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  try {
    let participant = await resolveParticipant(req.body, store);
    if (typeof req.body.requestKey !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(req.body.requestKey)) {
      throw new RegistrationError(422, "A valid submission key is required.");
    }
    const active = await store.activeOrder(participant.id);
    if (active) {
      await reconcileOrder(store, active);
      participant = await resolveParticipant(req.body, store);
    }
    const completed = await store.completedOrder(participant.id);
    const editing = !!completed || hasRegisteredClasses(participant);
    if (!editing) assertRegistrationOpen();
    const { editVersion, requestKey, draft } = req.body;
    const saved = choicesFromParticipant(participant);
    // Check payment configuration before allocating new provisional places.
    if (!editing || (canEditConfirmedRegistration(participant.ticket) && editVersion === confirmedChoicesVersion(participant, completed))) {
      const validated = validateDraft(draft, participant, await store.schedule(), editing ? saved : undefined);
      if (validated.valid && !requiredClassesError(participant.ticket, validated.value.classes.length)) {
        const price = priceDraft(validated.value, saved, editing);
        if (!Object.keys(price.errors).length && price.totalCents > 0) {
          getStripe(); canonicalOrigin();
        }
      }
    }
    const order = await store.submit(participant, draft, requestKey, editVersion);
    if (order.status === "confirmed") await deliverConfirmation(store, order.id);
    let checkoutUrl = null;
    if (order.status === "provisional") checkoutUrl = await checkoutForOrder(store, participant, order);
    return res.json({ order: publicOrder(order), checkoutUrl });
  } catch (error) { return apiError(res, error); }
}
