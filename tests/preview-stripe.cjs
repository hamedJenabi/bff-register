// Loaded only by the disposable preview process, never by the application.
const { randomUUID } = require('node:crypto');

if (process.env.BFF_PREVIEW !== 'true' || process.env.NODE_ENV !== 'development') {
  throw new Error('The checkout stand-in is restricted to the development preview.');
}
const origin = new URL(process.env.PREVIEW_CHECKOUT_ORIGIN);
if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1') {
  throw new Error('The preview checkout destination must be loopback-only.');
}
const sessions = new Map();
const requestKeys = new Map();
class PreviewStripe {
  constructor(key) {
    if (key !== 'sk_test_preview_only') throw new Error('Unexpected preview Stripe key.');
    this.checkout = { sessions: {
      create: async (options, { idempotencyKey }) => {
        if (requestKeys.has(idempotencyKey)) return sessions.get(requestKeys.get(idempotencyKey));
        const id = `cs_preview_${randomUUID()}`;
        const amount = options.line_items[0].price_data.unit_amount;
        const destination = new URL('/checkout', origin);
        destination.searchParams.set('order', options.metadata.reg2026OrderId);
        destination.searchParams.set('amount', String(amount));
        destination.searchParams.set('return', options.cancel_url);
        const session = { id, url: destination.href, status: 'open', payment_status: 'unpaid',
          amount_total: amount, currency: 'eur', client_reference_id: options.client_reference_id,
          metadata: options.metadata, expires_at: options.expires_at };
        sessions.set(id, session);
        requestKeys.set(idempotencyKey, id);
        return session;
      },
      retrieve: async (id) => {
        if (!sessions.has(id)) throw new Error('Preview checkout session not found.');
        return sessions.get(id);
      },
      expire: async (id) => {
        if (!sessions.has(id)) throw new Error('Preview checkout session not found.');
        const session = { ...sessions.get(id), status: 'expired' };
        sessions.set(id, session);
        return session;
      },
    } };
  }
}
module.exports = PreviewStripe;
