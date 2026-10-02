import { registrationStore as store } from "../../../db/reg2026";
import { getStripe } from "../../../lib/reg2026/payments";
import { allowMethod } from "../../../lib/reg2026/http";

export const config = { api: { bodyParser: false } };
const supported = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]);
export default async function handler(req, res) {
  if (!allowMethod(req, res, "POST")) return;
  let event;
  try {
    if (!process.env.REG2026_STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Webhook is not configured" });
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) return res.status(413).end();
      chunks.push(chunk);
    }
    event = getStripe().webhooks.constructEvent(Buffer.concat(chunks), req.headers["stripe-signature"], process.env.REG2026_STRIPE_WEBHOOK_SECRET);
  } catch { return res.status(400).json({ error: "Invalid webhook signature" }); }
  if (!supported.has(event.type) || !event.data.object.metadata?.reg2026OrderId) return res.json({ received: true });
  try {
    const order = await store.applyPayment(event.data.object, event.type);
    // Stripe may notify us before session attachment; ask it to retry.
    if (!order) return res.status(503).json({ error: "Checkout attachment is pending" });
    return res.json({ received: true });
  } catch (error) {
    console.error("Registration webhook failed:", error.message);
    return res.status(error.status || 503).json({ error: "Could not process payment event" });
  }
}
