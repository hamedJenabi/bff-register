# Participant app integration and initial festival admin

The participant app is read-only for festival registrations and class bookings. This repo remains the source of truth. The new app API projects existing data and adds access credentials/sessions, announcements, and optional Web Push subscription/delivery records. Participant registrations and bookings remain read-only.

## Configuration and launch

Prepare these server-side variables in ticketing:

| Variable                     | Purpose                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_SIGNING_SECRET`         | A separate random secret of at least 32 characters. Signing-secret rotation invalidates existing credentials.                                                                      |
| `APP_ORIGIN`                 | App HTTPS origin, such as `https://app.bluesfever.eu`. Loopback HTTP origins are allowed for local development.                                                                    |
| `APP_LINK_EXPIRES_AT`        | Explicit timestamp through the festival end, including timezone. If omitted, newly issued access expires after 90 days. Existing links retain their recorded expiry.               |
| `APP_FESTIVAL_START_DATE`    | Reviewed Friday date in `YYYY-MM-DD` format. Supplies Friday–Sunday dates for Home's upcoming-class calculation in Vienna time. If omitted, the app shows an ordered weekend list. |
| `APP_INVITATIONS_ENABLED`    | Enables only the separate app-invitation endpoint after migration and configuration. Defaults to disabled.                                                                         |
| `APP_INVITATION_TEMPLATE_ID` | Required dedicated SendGrid dynamic template ID for app invitations. There is no fallback to the existing registration email template.                                             |

The app server needs `BFF_REGISTER_ORIGIN` pointing to this ticketing server. It communicates server-to-server. Its host-only session cookie is HttpOnly, SameSite=Lax, Secure in production, and bounded by the backend session expiry. No database or signing secret is needed in the frontend repo.

Before hosted deployment, review migrations **00011-attendee-app-access** and **00012-festival-app-admin** and apply it to the intended environment with the existing Ley migration workflow. On 14 October 2026, the requested data demonstration applied this additive migration to the configured local `localhost/bluesfever` database. It adds app access/session tables; participant, booking, and payment records are not changed by the migration. Hosted production has not been migrated by this task.

Use a separate app-invitation email and template, with `firstname`, `lastname`, **`appAccessUrl`**, and `accessExpiresAt` dynamic fields. Click tracking is disabled for these authentication links. Verify that the complete fragment survives template rendering and the intended mail client. Each recipient and credential come from the server's stored registration ID, even if a caller supplies different names or email addresses. SendGrid rejections return an error to the invitation caller; acceptance by SendGrid is not proof of inbox delivery.

The existing `/api/mailall` endpoint, its template, and its dashboard actions are unchanged. App invitations use **`POST /api/app/admin/invite`** with body `{ "id": participantId }`, existing organizer authentication, and the dedicated template. This endpoint sends one invitation per explicit request. A later dedicated app-invitation dashboard can call it for selected participants or all confirmed participants without reusing the registration email buttons. No automatic mail queue or live sends are part of this implementation.

## API contract

| Endpoint                     | Authorization                            | Result                                                                                                                                                                   |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/app/claim`        | Personal access token in JSON body       | Opaque session token and absolute expiry.                                                                                                                                |
| `GET /api/app/me`            | `Authorization: Bearer <session>`        | Own participant projection, confirmed classes, pending-checkout flag, QR, active announcements, Vienna timezone, optional festival dates, and successful-read timestamp. |
| `POST /api/app/logout`       | Session bearer                           | Deletes that session; returns `ok`. Other devices retain their own sessions.                                                                                             |
| `POST /api/app/admin/link`   | Existing organizer cookie + origin check | Body `id` produces the participant's personal `appAccessUrl` and expiry. Requires confirmed admission.                                                                   |
| `POST /api/app/admin/invite` | Existing organizer cookie + origin check | Body `id` sends a separate app invitation using the dedicated template; requires enabled invitations and confirmed admission.                                            |
| `POST /api/app/admin/revoke` | Existing organizer cookie + origin check | Body `id` revokes the participant's access, QR, and all related sessions.                                                                                                |

The app's same-origin `/api/app/claim`, `/api/app/me`, and `/api/app/logout` façade hides the session bearer from browser JavaScript. Access exchange and logout reject cross-origin browser mutations. Personal API responses use `private, no-store`. A participant cannot choose a different registration by adding an ID or email to a request.

Links are opaque, purpose-bound credentials in `/claim#token=...`. GET does not consume them, and email scanners cannot create a participant session by merely following the URL. They are reusable until recorded expiry or organizer revocation, allowing a participant to open their email on another device. Recovery is reopening a valid link or having an organizer reissue an expired/revoked link through the link endpoint or separate app-invitation endpoint. Reissuing valid access keeps the existing link stable; reissuing expired/revoked access generates a new credential and QR and retires old sessions.

Sessions use random secrets; only SHA-256 hashes are stored. Access records contain a random public UUID and nonce, linked to `registrations_26`. Access and QR signatures use distinct purposes; a QR cannot be exchanged for a login session. The QR contains no name, email, or class list. Its actual door verification endpoint and staff authorization are milestone 5.

## Booking projection

- Current confirmed `class_bookings_26` rows are authoritative; deduplicate by stable session ID and preserve the per-class role.
- Provisional bookings do not grant class admission. Active provisional/payment-pending orders produce a separate pending-registration notice; expired provisional holds are excluded from that notice.
- Legacy versioned `theme_class` choices can be shown for confirmed Full/Parent passes when there are **no booking rows and no supplemental-order history**. App reads do not create bookings or mutate payment/registration data.
- When modern history exists, saved legacy choices cannot override its lack of confirmation. Ambiguous historical records require organizer reconciliation rather than automatic admission.
- Personal metadata comes from the effective registration catalog, including database overrides. Missing catalog entries stay explicit instead of inventing room/time details.
- `role` maps to proficiency and `level` to the registration dance role; legacy values such as `fullpass_lead` are decoded to `lead`. Each class's role is read independently. Project only participant-facing fields, excluding raw stored selections, price/payment internals, and secrets.
- The authenticated snapshot also includes the effective class catalog, so signed-in Full Schedule and personal classes share organizer overrides.

## Verification and safe preview

`yarn test:integration` now runs the existing registration tests and the app suite against a disposable PostgreSQL cluster. The app suite uses a separate schema and captures substituted email messages; it covers identity isolation, legacy projection, payment-pending exclusion, schedule refresh, hashing, credential-purpose separation, logout, expiry, revocation, organizer authorization, and distinct recipient links with send failures. Invitation checks also verify that a dedicated template is required, disabled invitations cannot send, and unconfirmed participants are rejected.

`node tests/preview-app.cjs` starts a loopback-only app backend at port 31026 with fictional Daria/Noah registrations. Its `/__fixtures` endpoint returns their personal links for local browser QA. This test-only server never imports `db/db`, reads operational `.env`, or uses email/payment services. Stop it to remove the cluster.

The adjacent app's `yarn test:e2e` starts that fixture server and a production-built app and runs phone-size and desktop Chrome journeys. Real-device installation/offline QA is deferred to milestone 4; real camera/door checks are deferred to milestone 5.

## Initial festival admin and push configuration

The adjacent app hosts `/bff-admin`. It uses the dedicated fixed account `bff2026-admin`; this is separate from the existing ticketing organizer login. The admin can manage app announcements and notifications, and has no implicit access to the existing ticketing dashboard or email actions.

| Backend variable          | Purpose                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ADMIN_PASSWORD_HASH` | `scrypt:<16-byte salt in hex>:<64-byte derived key in hex>`, using N=32768 and a 64 MB memory limit. Generate with `hashAdminPassword` in `lib/app/admin-security.js`; store only in server configuration. Rotation invalidates prior admin sessions. |
| `APP_PUSH_PUBLIC_KEY`     | Stable VAPID public key from `web-push.generateVAPIDKeys()`. This public value is returned only to signed-in participants for subscribing.                                                                                                            |
| `APP_PUSH_PRIVATE_KEY`    | Matching VAPID private key; keep server-only and preserve across deployments.                                                                                                                                                                         |
| `APP_PUSH_SUBJECT`        | Contact URI, e.g. `mailto:registration@bluesfever.eu`.                                                                                                                                                                                                |

Migration 00012 was applied on 14 October only to the verified local `localhost/bluesfever` database. It adds app admin/content/subscription/job tables and does not modify registration or payment records. Local password/hash and VAPID keys were generated in ignored configuration; no credentials belong in source control. Hosted production still needs reviewed migration/configuration.

Admin sessions use random bearers, SHA-256 token hashes, a fixed 30-day expiry, and the current password-hash fingerprint. The app keeps the bearer in `bff_festival_admin`, a host-only HttpOnly/SameSite=Lax cookie with Secure in production. Passwords use scrypt with a random salt. Failed attempts are persisted and limited to ten per 15-minute window for this single admin account. The app façade enforces same-origin mutations and never returns the admin bearer to JavaScript.

| Backend endpoint                    | Authorization          | Behavior                                                                                                                                                                                                           |
| ----------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/app/manage/login`        | Username/password JSON | Returns admin bearer and 30-day expiry to the app server.                                                                                                                                                          |
| `GET /api/app/manage/me`            | Admin bearer           | Session, announcements/history, subscriber counts, and recent notification delivery summaries.                                                                                                                     |
| `POST /api/app/manage/logout`       | Admin bearer           | Revokes current admin session.                                                                                                                                                                                     |
| `POST /api/app/manage/announcement` | Admin bearer           | Create/edit title, description, optional `expiresOn`; optional `id` edits an existing unarchived announcement.                                                                                                     |
| `POST /api/app/manage/archive`      | Admin bearer           | Soft archive body `id`; removes from Home while retaining admin history.                                                                                                                                           |
| `POST /api/app/manage/push`         | Admin bearer           | Queues title/description to currently subscribed confirmed participants; UUID `requestId` makes repeated requests idempotent.                                                                                      |
| `POST /api/app/manage/dispatch`     | Admin bearer           | Sends up to 20 pending deliveries for body `id` and returns current counts.                                                                                                                                        |
| `GET /api/app/updates/config`       | Participant bearer     | Public VAPID key, or null when unconfigured.                                                                                                                                                                       |
| `POST /api/app/updates/subscribe`   | Participant bearer     | Saves the authenticated participant’s device subscription (`endpoint`, `keys.p256dh`, `keys.auth`). Validates HTTPS push-provider destinations and keys; cannot transfer an endpoint owned by another participant. |
| `POST /api/app/updates/unsubscribe` | Participant bearer     | Removes only that participant’s subscription matching body `endpoint`.                                                                                                                                             |

Announcement expiry is a date inclusive through the end of that day in `Europe/Vienna`; null means it remains published until archived. Text is rendered as plain text. Public participant snapshots contain only active announcements; Home also removes expired entries using its minute clock.

Notification consent is explicit in Profile. The permission dialog opens only from the Enable action. Disable and sign-out remove the device’s server subscription. The notification-only service worker displays the supplied title/description and opens participant Home; it does not cache app pages or private data. The manifest/icons provide the Home Screen entry required for [iPhone/iPad Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers). Actual device acceptance and HTTPS deployment are still required. Offline reopening remains a later slice.

Delivery records persist across requests. The admin browser drives batches; if it closes mid-send, reopen history and use Resume for pending delivery. A lost in-flight request becomes uncertain after two minutes, and is not automatically resent. Failed sends remain failed; 404/410 push-service responses remove expired subscriptions. Counts report push-service acceptance, not proof of display/read. There is no scheduler or automatic broadcast on announcement creation.

Verification: 31 isolated database checks cover the existing registration/app behavior plus admin password/session/expiry/throttling, announcement lifecycle, subscription ownership/destination validation, idempotent broadcasts, captured sends, failed/expired cleanup, and uncertain delivery. Browser fixtures also configure a fictional admin and capture push; they never load operational credentials or contact push providers. A notification-worker behavior test covers title/body display and safe Home navigation.
