# 2026 registration setup and verification

Implementation status: the five local steps in [the roadmap](./implementation-roadmap.md) are complete. No operational migration, deployment, real email send or live payment was performed.

## Environment

The flow is closed until `REG2026_ENABLED=true`. Signed participants can still view completion or check pending payment status after closing. Production also requires a valid future `REG2026_CLOSES_AT` to accept new submissions.

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

Audit legacy lunch/competition records before launch: the first registration credits existing saved add-ons and charges only additional selections. The old routes previously recorded amounts due without verified payment. Reconcile unpaid entries before invitations so they do not become free entitlements. If any versioned class choices were populated manually, backfill corresponding confirmed bookings before opening capacity.

The legacy lunch/competition write APIs return 410 while the new flow is enabled and for participants who already have a new-flow order, preventing those routes from overwriting verified choices. After completion, participants must request all changes from organizers; changing structured `theme_class` through the old dashboard field editor does not reconcile class booking rows. Organizer refunds/removals and a capacity editor remain outside this PRD.

## One-time registration

A confirmed `reg2026_orders` row marks the participant as registered, including an empty or class-only submission. No additional migration is needed. The participant row lock prevents concurrent first submissions from creating two confirmed registrations. Identical submission-key retries return the same order; different keys or choices cannot edit a completed registration.

Completed links show only a confirmation, a link back to the festival website and `registration@bluesfever.eu` for all later changes. Competition/lunch controls do not show “Already booked” labels. Legacy add-ons alone do not mark the supplemental form complete; their purchases remain credited. Unfinished checkout stays accessible, and expired or failed attempts may be retried. Browser storage remains disabled.

The optional Voucher field accepts `freepass26` (with surrounding whitespace trimmed). The normalized code is stored in the order draft, and server-owned pricing waives all new competition/lunch charges and Stripe fees. The resulting zero-total order confirms immediately without checkout. Unknown or malformed voucher values are rejected. Pass eligibility, dance roles, five-class/slot limits, capacities and paid add-on protections still apply; original festival pass purchases are untouched. Unit, database and HTTP tests cover the waiver, invalid codes, confirmed capacity and repeat submissions. Browser QA confirmed a paid draft became €0 and completed without Stripe.

## Stripe

Configure a dedicated webhook destination at `https://YOUR_ORIGIN/api/reg2026/webhook` for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`

Checkout amounts, choices and idempotency keys come from persisted server orders. Participant identity, order metadata, currency and amount must match before fulfillment. Repeated verified events do not create duplicate bookings or delivery records. The return page checks server state; a redirect by itself never confirms payment.

Card, SEPA debit and iDEAL are requested by the adapter; verify their availability in the target Stripe account/currency during staging. A completed payment that is still processing holds its reservations until a verified success/failure event. An open checkout expires after an hour; expired provisional rows do not consume class availability. Webhook expiry or a subsequent participant status check records the terminal order state and releases provisional rows. Existing pass choices remain intact throughout a pending, failed or expired first submission.

The form displays subtotal, fee and total before submission. A successful paid submission redirects immediately to the server-created Stripe checkout URL, without an intermediate review page or second checkout click. Controls stay disabled while navigation begins. Reopening or returning from an unpaid checkout supports resume/cancel and status checks. Free submissions complete directly. Submission retries use a request key and the same Stripe order idempotency key. A server failure after Stripe creates a session can be recovered by retrying that order creation. If Stripe is unavailable, no payment is inferred.

## Email templates and operations

Both organizer dashboard routes include a Classes column. Each participant's `View (count)` button opens a Reakit dialog with their saved class titles, day/time, teachers and lead/follow or solo role. The dialog reads the versioned `theme_class` selections; pending checkout drafts are not presented as registered classes. Participants without saved classes see an explicit empty state.

Organizers can use Edit classes, remove selections, add a replacement from a dropdown with its dance role, then Save changes. The authenticated `/api/reg2026/admin-classes` endpoint locks the participant and updates both `theme_class` and confirmed capacity bookings atomically. It checks pass eligibility, five-class/slot/role rules, remaining capacity and the loaded class version. Pending checkout blocks edits so fulfillment cannot overwrite them. Add-ons, financial order snapshots and email delivery records are untouched; saving an admin class edit creates no email or payment action.

Both dashboards end with a Registration link column. Generate link opens a dialog with a read-only URL, Copy link and Open registration. The organizer-only POST `/api/reg2026/link` endpoint reads the selected participant by ID and calls `buildRegistrationPath` on the stored email and first name, using the configured canonical origin. Unconfirmed or ambiguous identities are rejected. Generating a link sends no email and changes no registration or payment state. It uses the existing signed-link format without a separate expiry; completed registrations remain closed to participant edits.

Link-generation tests verify organizer authentication/origin checks, stored identity selection, signature validity, confirmed/unambiguous eligibility and unchanged registration/order/email records. Browser QA on both dashboard routes verified the final column, generated URL, copying, opening the correct participant form, Escape dismissal and restored button focus.

Invitation dynamic data: `firstname`, `lastname`, `registrationUrl`.

Confirmation dynamic data: `firstname`, `lastname`, `classes` (session metadata and role), `competitions` (label and role), and `lunch` (day strings). This is an explicit contract for the templates. The attendee-app link is omitted until its external token/encoding contract is supplied; the implementation does not invent an authentication token.

Log in at `/login/admin`, then use the current dashboard's 2026 delivery panel. Queue invitations, send up to 25 queued messages per action, and inspect sent/failed counts. Failed or interrupted messages can be retried in bounded batches. Invitations are selected from confirmed, unambiguous identities on the server, rechecked before delivery, and successful invitations are not blindly resent. Confirmation delivery is queued within the save transaction and attempted after confirmation; failure never rolls back the booking. A process interrupted during send leaves a durable record eligible for retry after its ten-minute lease expires. Email delivery has an at-least-once retry boundary if a process dies after SendGrid accepts a message but before it records success.

## Verification completed

- `npm test`: signed links/plus addressing, malformed drafts, Party Pass restrictions, slot conflicts, partner and competition roles, five-class festival cap (including rejection of a sixth class across different days), incremental prices and fees, paid-removal restrictions, organizer login/session tampering and expiry.
- `npm run test:integration`: disposable Postgres migrations and real transactions; free saves, concurrent request retries, rejection of further edits, empty-registration completion and concurrent first submissions, provisional booking, substituted checkout adapter, processing/paid/expired transitions, duplicate fulfillment, email failure/retry, invitation deduplication/ambiguous recipients, signed HTTP access, server-owned prices, real local Stripe webhook signature verification, organizer authorization and legacy write protection.
- `npm run lint` and `npm run build`: pass. Remaining lint warnings concern legacy hook dependencies and an existing image element.
- Browser QA with fictional participants and blank Stripe/SendGrid keys: desktop 1440px, tablet 768px and mobile 390px; no horizontal page overflow at tested widths, fresh initialization without browser storage, class-only save and success, roles/fees/errors, Party Pass omission, centered desktop and full-screen mobile dialogs, Escape dismissal and return focus. Fresh page logs show no hydration or dialog-focus warnings.
- One-time browser QA: an empty Party Pass submission completes immediately; reopening the original signed link shows completion and organizer contact with no form inputs. The paid-confirmation fixture also shows completion, and pending checkout shows only payment actions and the total. The completion card fits the 390px mobile viewport.
- Organizer class-view browser QA: both dashboard routes show the saved count and participant-specific dialog; a three-class fixture covers solo, lead and follow roles. Empty registrations, 390px mobile layout, Escape/close dismissal and restored focus to the opening button were checked. A dropdown replacement with a new partner role persisted after reload. Integration tests cover organizer authorization, stale edits, capacity, atomic booking replacement and unchanged payment/email records.
- Direct-checkout browser QA: a fresh paid submission redirected automatically to the local checkout stand-in with the server-calculated amount. Returning without paying showed pending recovery, and resuming reopened the same checkout/order. Real Stripe test-mode handoff remains a staging check.

Browser draft storage is disabled: reloads load only confirmed server choices or a pending server order. The schedule uses two columns on desktop and one on mobile, hides room names and daily counts, and disables other classes in an occupied time slot until its selected class is removed. At five selected classes, all unselected classes are disabled; remove one to choose a replacement. The shared form/API validator enforces the same festival-wide cap. A sticky summary shows the total class count at the left on desktop and above the form on mobile. Hover and dialog transitions are subtle and respect reduced motion.

The participant form and class-role dialog use Reakit form state, checkbox/radio controls, labels, inline messages and submit buttons, following `components/Form/CompForm.js`. Form adapters preserve the signed API draft format and validate paid bookings and nested competition roles. Browser checks cover role errors, slot conflicts, fresh drafts after reload, server-error retention, a confirmed class-only save and mobile layout.

To repeat browser QA, run `npm run preview:test` with PostgreSQL `initdb`/`pg_ctl` on PATH. It starts an isolated local database and a loopback-only Next server at port 31026, prints fictional signed links for fresh Full/Party passes, pending/completed payment fixtures and a participant with three registered classes, uses `.next-preview` to avoid interfering with the main dev server, and destroys its cluster on Ctrl-C. A test-only Node loader substitutes Stripe session creation/retrieval/expiry and redirects paid submissions to a second loopback server labeled Test checkout destination. Its Return without paying link exercises pending recovery; it never simulates a successful payment. Preview organizer credentials are `preview` / `preview`. No live payment or email keys are inherited. Automated integration tests require the same PostgreSQL tools and create/remove their own cluster.

Staging still needs a Stripe test-mode checkout in the target account, a verified SendGrid template render/delivery, final catalog/capacity review, and the closing date. The public pass-purchase flow's server-price/payment completion rewrite and the remaining public/dashboard modernization backlog are separate follow-up work.
