# Registration System Modernization PRD

## Problem Statement

The registration system needs to keep the existing registration and Stripe checkout flow working while improving the attendee registration experience and making the admin dashboard more useful for live event operations. Admins need to manage remaining ticket capacity, search and filter registrations, edit attendee records, export data, send emails, and manually move waiting-list users without changing Stripe state.

The current dashboard had operational features, but the UX was hard to scan, capacity was display-only, attendee editing happened one field at a time, and local database/network failures could leave the browser appearing blank during development.

## Solution

Modernize the registration form and dashboard with a responsive dark UI. Add dashboard controls for database-only registration management, remaining capacity updates, CSV export, email actions, and attendee editing. Keep Stripe checkout and registration confirmation behavior unchanged. Add graceful handling for database failures so pages show a clear unavailable state instead of a blank screen.

## User Stories

1. As an attendee, I want a modern registration form, so that registration feels clear and trustworthy.
2. As an attendee, I want the existing Stripe checkout flow to continue working, so that I can pay securely.
3. As an attendee, I want the page to show a clear unavailable message if ticket availability cannot load, so that I am not left on a blank screen.
4. As an admin, I want dashboard summary metrics, so that I can quickly understand registration status.
5. As an admin, I want search across names, email, country, ticket, track, status, lunch, and competitions, so that I can find attendees quickly.
6. As an admin, I want filters for status, ticket, track, lunch, competition, and donation, so that I can work with focused registration lists.
7. As an admin, I want selectable rows and bulk status changes, so that I can update multiple database records efficiently.
8. As an admin, I want registration status changes to be database-only, so that I do not accidentally refund, cancel, or mutate Stripe payments.
9. As an admin, I want CSV export from the current dashboard view, so that I can use registration data outside the app.
10. As an admin, I want to send final emails to selected attendees or all confirmed attendees, so that event communication is easier.
11. As an admin, I want to edit attendee fields from a full detail form, so that I can fix registration data without direct database access.
12. As an admin, I want one-click actions to cancel, confirm, or promote a waiting-list registration in the database, so that common operations are fast.
13. As an admin, I want to edit remaining ticket spots from the dashboard, so that availability can be managed without SQL.
14. As an admin, I want waiting-list promotion to remain manual, so that I control who gets a spot.
15. As an admin, I want active capacity counts to exclude waiting-list, canceled, and out records, so that reported spot usage matches the operational rule.

## Implementation Decisions

- The public registration form UI is modernized with a dark design, but the registration form state, validation, and Stripe checkout handoff remain in place.
- The Stripe checkout route and Stripe session retrieval registration route are intentionally not redesigned in this scope.
- Admin dashboard actions are database-only. They do not trigger Stripe refunds, Stripe cancellations, or payment reconciliation.
- The dashboard uses the existing ticket `capacity` field as "remaining spots" because the current registration flow decrements that value when a paid registration is confirmed.
- Capacity editing is implemented as an admin API that updates a ticket's remaining spot count by ticket id.
- Capacity input rejects blank, negative, non-integer, and missing values.
- Active registration counts include `registered`, `email-sent`, `reminder`, and `confirmed`.
- Active registration counts exclude `waitinglist`, `canceled`, and `out`.
- Waiting-list promotion remains manual and is represented as a database status change.
- Dashboard filtering, dashboard stats, and active capacity counting are extracted into reusable helper functions.
- The dashboard is rebuilt around summary cards, quick status filters, detailed filters, a searchable table, selected-row actions, CSV export, and capacity editing.
- The attendee detail page is rebuilt as a full editable admin form instead of a one-field modal editor.
- The attendee detail page includes actions for save, cancel registration, mark confirmed, promote waiting-list users, and send email.
- Public page text editing is skipped for this version.
- Google Fonts stylesheet links were removed from pages because they caused Next dev stylesheet warnings and contributed to a white-screen issue under restricted network conditions.
- A defensive global `body { display: block !important; }` was added to prevent Next dev's temporary FOUC guard from leaving the body hidden.
- Server-side page data loading now catches database errors and returns safe fallback props for the public registration page and dashboard.
- A small server-side timeout helper was added so database hangs fail into the fallback state instead of leaving the browser waiting.

## Testing Decisions

- Use focused helper tests for dashboard behavior because the repo had no existing test suite.
- Test that active registrations exclude waiting-list, canceled, and out statuses.
- Test dashboard stats for total, active, confirmed, waiting-list, canceled, revenue, and donation.
- Test dashboard search/filter behavior using representative attendee records.
- Test active ticket count behavior by ticket level.
- Continue using `yarn build` as the broad integration check for Next pages and API route compilation.
- Browser smoke-check the public registration page and dashboard when the local database/dev server allows.

## Out of Scope

- Public page text editing.
- Real Stripe refunds, Stripe cancellations, dashboard-side Stripe payment mutations, or payment reconciliation.
- Full authentication/security overhaul for the dashboard.
- Automatic waiting-list promotion.
- Schema redesign to separate total capacity from remaining capacity.
- A full end-to-end browser test suite.
- Publishing the PRD to an issue tracker in this session.

## Further Notes

Current branch: `feat/new-2026`.

Current working tree status at the time this PRD was written:

- Implementation changes are uncommitted.
- Dev server was stopped.
- No commit was made.
- `gh` is not installed, and no issue-tracker publishing tool was available, so this PRD was saved locally instead of published.

Files changed or added during the session:

- `components/Form/RegistrationForm.js`
- `components/Form/RegistrationForm.module.scss`
- `components/Header/Header.module.scss`
- `db/db.js`
- `package.json`
- `pages/accept/index.js`
- `pages/accept/lunch.js`
- `pages/alreadyRegistered/index.js`
- `pages/api/tickets.js`
- `pages/cancel/index.js`
- `pages/competition-2024.js`
- `pages/dashboard/Dashboard.module.scss`
- `pages/dashboard/[token].js`
- `pages/dashboard/admin.js`
- `pages/dashboard/user/[id].js`
- `pages/dashboard/user/user.module.scss`
- `pages/index.js`
- `pages/login/admin.js`
- `pages/lunch.js`
- `pages/soldout/index.js`
- `pages/waitinglist/index.js`
- `styles/Home.module.scss`
- `styles/globals.scss`
- `test/dashboard-utils.test.mjs`
- `utils/dashboard.mjs`
- `utils/serverData.js`
- `to-prd.md`

Verification completed before stopping:

- `yarn test` passed.
- `yarn build` passed.
- Earlier browser smoke checks showed the new registration UI and dashboard UI rendering while the DB was reachable.
- Later local browser checks exposed a white-screen issue. Investigation found the DOM was present but `body` stayed hidden by Next dev's `body{display:none}` FOUC guard. Mitigations were added by removing Google Fonts stylesheet links and adding `body { display: block !important; }`.
- The final browser screenshot verification after the global display fix was interrupted by the user, so it should be the first thing to re-check when resuming.

Known local development issue:

- The local environment showed PostgreSQL connection errors such as `Client network socket disconnected before secure TLS connection was established`.
- The public registration page and dashboard now catch DB failures and should show fallback unavailable states instead of crashing.
- The local dev server also showed intermittent Next dev chunk errors such as `Cannot find module './chunks/db_db_js.js'`; a clean dev-server restart may be needed before final browser QA.

Suggested resume steps:

1. Run `git status --short` to confirm the uncommitted files.
2. Run `yarn test`.
3. Run `yarn build`.
4. Start the dev server with `yarn dev`.
5. Open `http://localhost:3000/` and confirm the white screen is gone.
6. If the database is unavailable, confirm the registration page shows the "Registration is temporarily unavailable" fallback.
7. Log in to `/login/admin` and open `/dashboard/fdjhfdskjfhdskjh`.
8. Confirm dashboard rendering, filters, CSV export link, capacity editor, and attendee detail page.
9. If the UI is approved, stage and commit the changes.
