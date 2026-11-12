import Stripe from "stripe";
import { RegistrationError } from "./errors";
import { buildRegistrationPath } from "./security";

let stripe;
export const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new RegistrationError(503, "Checkout is temporarily unavailable.");
  stripe ||= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe;
};
export const canonicalOrigin = () => {
  const origin = process.env.REG2026_ORIGIN;
  if (!origin) throw new RegistrationError(503, "The registration origin is not configured.");
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.hostname === "localhost")) {
    throw new RegistrationError(503, "The registration origin must use HTTPS.");
  }
  return url.origin;
};
export const checkoutForOrder = async (store, participant, order, payment = getStripe()) => {
  if (order.status !== "provisional") return null;
  if (order.stripe_session_id) {
    const session = await payment.checkout.sessions.retrieve(order.stripe_session_id);
    return session.status === "open" ? session.url : null;
  }
  const returnUrl = canonicalOrigin() + buildRegistrationPath(participant) + `&order=${order.id}`;
  const session = await payment.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card", "sepa_debit", "ideal"],
    client_reference_id: String(participant.id), metadata: { reg2026OrderId: String(order.id) },
    customer_email: participant.email,
    expires_at: Math.floor(new Date(order.expires_at).getTime() / 1000),
    line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: order.total_cents,
      product_data: { name: "Blues Fever 2026 competition and lunch choices (including Stripe fee)" } } }],
    success_url: returnUrl, cancel_url: returnUrl + "&checkout=cancelled",
  }, { idempotencyKey: `reg2026-order-${order.id}` });
  await store.attachSession(order.id, session.id);
  return session.url;
};
export const reconcileOrder = async (store, order, payment = getStripe()) => {
  if (!order || !["provisional", "payment_pending"].includes(order.status)) return order;
  if (!order.stripe_session_id) return (await store.expireUnattached(order.id)) || order;
  const session = await payment.checkout.sessions.retrieve(order.stripe_session_id);
  return store.applyPayment(session, "reconcile");
};
