# 2026 registration setup and verification

Implementation status: the five local steps in [the roadmap](./implementation-roadmap.md) are complete. No operational migration, deployment, real email send or live payment was performed.

## Environment

The flow is closed until `REG2026_ENABLED=true`. Signed participants can still read their saved choices and check pending payment status after closing. Production also requires a valid future `REG2026_CLOSES_AT` to accept new submissions.

| Variable | Purpose |
| --- | --- |
| `REG2026_ENABLED` | Explicitly open the new choices flow (`true`) |
| `REG2026_CLOSES_AT` | ISO timestamp with timezone; mandatory in production |
| `REG2026_ORIGIN` | Canonical HTTPS origin for invitations and checkout return URLs (never derived from browser headers) |
| `REG2026_SIGNING_SECRET` | Strong random HMAC secret for reusable participant links; rotating it invalidates existing links |
| `ADMIN_USER`, `HASHED_PASS` | Existing organizer username and credential comparison; the existing credential format is preserved |
| `ADMIN_SESSION_SECRET` | Separate strong random secret for eight-hour signed organizer cookies |
| `STRIPE_SECRET_KEY` | Stripe account key; use test mode for staging |
| `REG2026_STRIPE_WEBHOOK_SECRET` | Signing secret for `/api/reg2026/webhook` |
| `SENDGRID_API_KEY` | SendGrid delivery credentials |
| `REG2026_EMAIL_FROM` | Verified sender (default `registration@bluesfever.eu`) |
| `REG2026_INVITATION_TEMPLATE_ID` | Invitation template |
| `REG2026_CONFIRMATION_TEMPLATE_ID` | Confirmation template |
| `REG2026_CATALOG_REVIEWED` | Set `true` only after final catalog/capacity review; otherwise invitations cannot be queued |

Do not commit secret values. Cookie `Secure` is enabled in production, so production organizer login requires HTTPS. Login fails closed when its credentials or session secret are missing.

## Database and catalog

Use the existing Ley workflow (`npm run migrate -- up`) against a backed-up staging database first. Apply migrations through `00008-reg2026-order-safety.js` before deploying these routes. Migration 7 seeds the mock session capacities; review them before enabling registration. Migration 8 adds submission idempotency, one active order per participant, processing-payment status, and delivery deduplication.

Review all placeholder class descriptions, missing titles, room labels and partner flags in `lib/reg2026/catalog.js`. Keep stable occurrence IDs aligned with `class_capacities_26`; partner sessions use lead/follow pools, other sessions use total. Update capacity limits in Postgres. Final festival dates/content remain organizer inputs.

Audit legacy lunch/competition records before launch: the new flow treats existing saved add-ons as already booked and charges only additions. The old routes previously recorded amounts due without verified payment. Reconcile unpaid entries before invitations so they do not become free entitlements. If any versioned class choices were populated manually, backfill corresponding confirmed bookings before opening capacity.

The legacy lunch/competition write APIs return 410 while the new flow is enabled and for participants who already have a new-flow order, preventing those routes from overwriting verified choices. Keep class edits in the new flow; changing structured `theme_class` through the old dashboard field editor does not reconcile class booking rows. Organizer refunds/removals and a capacity editor remain outside this PRD.

## Stripe

Configure a dedicated webhook destination at `https://YOUR_ORIGIN/api/reg2026/webhook` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Checkout amounts, choices and idempotency keys come from persisted server orders. Participant identity, order metadata, currency and amount must match before fulfillment. Repeated verified events do not create duplicate bookings or delivery records. The return page checks server state; a redirect by itself never confirms payment.

Card, SEPA debit and iDEAL are requested by the adapter; verify their availability in the target Stripe account/currency during staging. A completed payment that is still processing holds its reservations until a verified success/failure event. An open checkout expires after an hour; expired provisional rows do not consume class availability. Webhook expiry or a subsequent participant status check records the terminal order state and releases provisional rows. Previous confirmed choices remain intact throughout pending, failed and expired edits.

After submitting paid choices, the page shows the server-validated subtotal, fee and total and offers secure checkout. Reopening a pending registration supports checkout resume/cancel. Submission retries use a persisted request key and the same Stripe order idempotency key. A server failure after Stripe creates a session can be recovered by retrying that order creation. If Stripe is unavailable, no payment is inferred.

## Email templates and operations

Invitation dynamic data: `firstname`, `lastname`, `registrationUrl`.

Confirmation dynamic data: `firstname`, `lastname`, `classes` (session metadata and role), `competitions` (label and role), and `lunch` (day strings). This is an explicit contract for the templates. The attendee-app link is omitted until its external token/encoding contract is supplied; the implementation does not invent an authentication token.

Log in at `/login/admin`, then use the current dashboard's 2026 delivery panel. Queue invitations, send up to 25 queued messages per action, and inspect sent/failed counts. Failed or interrupted messages can be retried in bounded batches. Invitations are selected from confirmed, unambiguous identities on the server, rechecked before delivery, and successful invitations are not blindly resent. Confirmation delivery is queued within the save transaction and attempted after confirmation; failure never rolls back the booking. A process interrupted during send leaves a durable record eligible for retry after its ten-minute lease expires. Email delivery has an at-least-once retry boundary if a process dies after SendGrid accepts a message but before it records success.

## Verification completed

- `npm test`: signed links/plus addressing, malformed drafts, Party Pass restrictions, slot conflicts, partner and competition roles, eight independent weekend sessions, incremental prices and fees, paid-removal restrictions, organizer login/session tampering and expiry.
- `npm run test:integration`: disposable Postgres migrations and real transactions; free saves, concurrent request retries, failed-edit preservation, provisional booking, substituted checkout adapter, processing/paid/expired transitions, duplicate fulfillment, email failure/retry, invitation deduplication/ambiguous recipients, signed HTTP access, server-owned prices, real local Stripe webhook signature verification, organizer authorization and legacy write protection.
- `npm run lint` and `npm run build`: pass. Remaining lint warnings concern legacy hook dependencies and an existing image element.
- Browser QA with fictional participants and blank Stripe/SendGrid keys: desktop 1440px, tablet 768px and mobile 390px; no horizontal page overflow at tested widths, fresh initialization without browser storage, class-only save and success, roles/fees/errors, Party Pass omission, centered desktop and full-screen mobile dialogs, Escape dismissal and return focus. Fresh page logs show no hydration or dialog-focus warnings.

Browser draft storage is disabled: reloads load only confirmed server choices or a pending server order. The schedule uses two columns on desktop and one on mobile, hides room names and daily counts, and disables other classes in an occupied time slot until its selected class is removed. A sticky summary shows the total class count at the left on desktop and above the form on mobile. Hover and dialog transitions are subtle and respect reduced motion.

The participant form and class-role dialog use Reakit form state, checkbox/radio controls, labels, inline messages and submit buttons, following `components/Form/CompForm.js`. Form adapters preserve the signed API draft format and validate paid bookings and nested competition roles. Browser checks cover role errors, slot conflicts, fresh drafts after reload, server-error retention, a confirmed class-only save and mobile layout.

To repeat browser QA, run `npm run preview:test` with PostgreSQL `initdb`/`pg_ctl` on PATH. It starts an isolated local database and a loopback-only Next server at port 31026, prints fictional signed links, uses `.next-preview` to avoid interfering with the main dev server, and destroys its cluster on Ctrl-C. Preview organizer credentials are `preview` / `preview`. No live payment or email keys are inherited. Automated integration tests require the same PostgreSQL tools and create/remove their own cluster.

Staging still needs a Stripe test-mode checkout in the target account, a verified SendGrid template render/delivery, final catalog/capacity review, and the closing date. The public pass-purchase flow's server-price/payment completion rewrite and the remaining public/dashboard modernization backlog are separate follow-up work.
