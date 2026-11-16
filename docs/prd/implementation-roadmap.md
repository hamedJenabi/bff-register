# 2026 implementation roadmap

Deferred scope (8 November 2026): combine public pass registration with class, competition, and lunch choices for new participants, with exactly five class sessions required for new Full/Parent Pass purchases and one combined checkout. Preserve `/reg2026` for existing confirmed participants. Implementation is deferred; the policy when five available, non-conflicting sessions cannot be selected remains unresolved. Resume from [the saved decisions and open question](./combined-registration.md).

Schedule update: Google Sheets schedule integration, validated publication and read-only dashboard preview are implemented. See [current Google Sheets setup](./google-sheets-schedule.md). Class formats are linked to the workbook's **Solo, partner or Talk** column in `CLASS DESCRIPTIONS`. Current testing placeholders are 20 lead / 20 follow for partner classes and 30 total for solo classes; talks are open without a capacity limit. **Production capacity review and replacement of those placeholders remain open launch work.** Legacy mock/override editor descriptions below apply to unconfigured previews only.

App status (reviewed 12 November 2026): the adjacent `bff-app` is connected and verified locally against published classes and confirmed participant data. Parties, final-email personal links, organizer announcements/push and class-door scanning/roster downloads are also implemented locally. Dedicated volunteer access and hosted rehearsal remain open. See [the integration record](./attendee-app-integration.md#participant-journey-connected-and-verified-locally), [delivery status](../../../bff-app/docs/prd/implementation-status.md) and [Admin and Volunteers next scope](../../../bff-app/docs/prd/admin-volunteers-completion.md).

Current scope update (28 October 2026): the older registration email panel remains removed. The organizer-triggered schedule invitation uses its own SendGrid template and delivery ledger. Automatic registration confirmation email has been restored for newly confirmed choices, using a separate template and order-specific delivery record; it sends after a free submission or verified Stripe payment. Historical delivery records remain untouched. See [current launch setup](./reg2026-launch.md).

Primary scope: `reg2026-registration.md`. The public-form redesign and wider code/UX backlog remain separate follow-up work, except organizer authorization required for invitations.

## Audit of the starting point

- Present: 51 occurrence-based mock catalog entries, schedule reference, HMAC participant links, versioned `theme_class` serialization, draft validation, capacity/order/booking/email-retry migrations, and an unused free-save database helper.
- Missing: `/reg2026`, authenticated participant APIs, server-owned prices and orders, checkout fulfillment/expiry, confirmation emails, organizer sessions, invitations/retries, and automated verification.
- Existing public registration: dark one-page UI, order summary and local draft work already exist. Pass checkout still trusts browser prices and browser completion; that older flow requires a separate security slice.
- Catalog descriptions, some titles, rooms and partner flags are placeholders. They require organizer review before launch.

## Large steps and commit boundaries

1. **Rules and safety rails** — strict complete-draft validation, incremental add-on pricing and cents-based fee calculation, focused executable tests. No free competition entry; saved paid add-ons cannot be removed through self-service.
2. **Persistent submission and payment** — signed participant resolution, transactional booking edits and provisional orders, retry-safe checkout, verified webhook fulfillment, processing/expiry handling, and durable confirmation delivery records.
3. **Participant journey** — responsive schedule and accessible class details, per-session roles, competition/lunch sections, one-time completion and pending checkout recovery, combined price review, checkout and verified return status.
4. **Organizer delivery** — server-side sessions for dashboard and admin APIs, server-selected invitations, tracked delivery and explicit failed-email retries beside existing dashboard actions.
5. **Integrated verification and launch documentation** — isolated Postgres and substituted payment/email checks, build/lint, responsive/keyboard QA where tooling permits, environment/migration/webhook setup and remaining launch inputs.

The original implementation request authorized local commits for these steps. That historical approval does not authorize commits for a later documentation or planning request. Do not push, deploy, send real invitations, or migrate production during implementation without the applicable authorization. Local development migrations may be applied when needed to test requested features.

## External launch inputs

Final catalog and capacity review; invitation/confirmation/final-email SendGrid templates and credentials; `REG2026_SIGNING_SECRET`, `ADMIN_SESSION_SECRET`, Stripe keys/webhook secret, canonical origin; explicit closing rule; hosted attendee-app origin, signing/expiry configuration and phone rehearsal. The app token contract is implemented. Reconcile any legacy lunch/competition choices that were recorded without payment before treating them as paid add-ons.

## Progress

- Step 1: implemented; rule checks run with `npm test`.
- Step 2: implemented; isolated Postgres tests cover free saves, retries, failed edits, paid fulfillment, processing, expiry and email failure.
- Step 3: implemented; participant page, responsive class schedule/dialogs, reusable add-on sections, one-time completion, combined review, and pending checkout/status actions. Production build passes with pre-existing legacy import warnings.
- Step 4: implemented; signed HttpOnly organizer sessions protect dashboard data, edits and email APIs. Invitations select unambiguous confirmed participants on the server, deduplicate delivery records, and expose bounded queue/send/retry actions. A Classes column opens a participant-specific dialog showing saved sessions and roles.
- Step 5: implemented; automated isolated database/HTTP/webhook checks, non-interactive lint, production build, desktop/tablet/mobile browser QA, and launch setup documentation in `reg2026-launch.md`.
- Schedule defaults: moved to `mockdata/schedule2026.js`; migrations create empty schedule/capacity tables. The registration page uses mock defaults until an organizer saves overrides.
- Schedule editor: `/dashboard/schedule` edits titles, teachers, descriptions, rooms, day/times, class type and capacities. Changes persist as database overrides and feed registration, organizer class selection and confirmation details. Existing bookings keep their day/times and class type; edits do not send emails or change payment records. Local development migrations are applied through `00009`.

The attendee-app token contract and local integration are implemented. Hosted origins, signing/expiry configuration, reviewed catalog/capacities, email templates and real-device rehearsal remain launch inputs. The wider pass-purchase security and UX modernization backlog remains separate follow-up work.
