# PRD: Code And UX Improvement Backlog

Workflow metadata:

- Local-only workflow: do not create a GitHub issue for this PRD.
- Commit workflow: ask the user for approval before staging or committing changes.
- Source: project scan on July 4, 2026.

## Problem Statement

The Blues Fever registration app works and currently builds, but important product behavior is spread across client components, API routes, utility constants, dashboard pages, and year-specific database tables. This makes registration, checkout, ticket capacity, email sending, and dashboard operations harder to reason about and riskier to change.

The public registration UI is already moving toward a better one-page checkout, but the wider product still has inconsistent event-year copy, older fallback pages, a dated admin dashboard, weak server-side admin protection, duplicated business rules, no automated tests, and no non-interactive lint setup.

## Solution

Create a prioritized improvement backlog that first protects high-risk operational paths, then stabilizes shared registration rules, then finishes the public UX redesign, and finally modernizes dashboard workflows and developer safety rails.

The work should keep the existing Next.js Pages Router, Reakit form layer, Postgres database, SendGrid email flow, Stripe checkout flow, and local PRD workflow in the near term. Larger migrations can happen after the critical security, pricing, validation, and UX inconsistencies are under control.

## User Stories

1. As an organizer, I want admin-only pages and APIs protected on the server, so that registration data cannot be read or changed through client-side bypasses.
2. As an organizer, I want checkout prices calculated on the server, so that registrants cannot manipulate payment amounts from the browser.
3. As an organizer, I want registration completion tied safely to Stripe payment state, so that confirmed registrations and capacity updates reflect real paid sessions.
4. As an organizer, I want ticket capacity changes to be explicit and consistently named, so that status changes do not accidentally move capacity in the wrong direction.
5. As an organizer, I want one source of truth for event-year dates, prices, vouchers, pass availability, lunch pricing, and copy, so that each new Blues Fever year does not require a scattered hunt through the codebase.
6. As a registrant, I want every page in the registration journey to say the same event year, so that I know I am registering for the current event.
7. As a registrant, I want the success, cancel, already-registered, sold-out, waiting-list, lunch, and competition flows to visually match the redesigned registration page, so that the experience feels trustworthy end to end.
8. As a registrant, I want checkout validation to match the visible form, so that required country, parent partner, donation amount, T-shirt size, and conditional choices cannot be skipped accidentally.
9. As a registrant, I want disabled passes and add-ons to explain availability with current dates and capacity state, so that I understand whether something is unavailable now, sold out, or internal-only.
10. As a registrant, I want payment failures and API errors to be shown clearly, so that I am not left on a loading state without guidance.
11. As a keyboard user, I want all public registration controls, summary toggles, modals, dashboard actions, and links to have visible focus and semantic labels, so that I can use the app without a mouse.
12. As a screen-reader user, I want form fields, errors, selected ticket cards, country selection, and modal controls to be announced correctly, so that the registration path is understandable.
13. As an organizer, I want bulk email and bulk status actions to have clearer confirmation, progress, and error states, so that high-impact dashboard work is harder to misfire.
14. As an organizer, I want dashboard filters, counts, exports, and totals to use the same pricing and status rules as registration, so that operations reports are consistent.
15. As a maintainer, I want lint, build, and tests to run non-interactively, so that regressions are caught before deployment.
16. As a maintainer, I want focused tests around pricing, validation, checkout, registration, and admin authorization, so that event-year edits are safer.
17. As a maintainer, I want dead imports, unused state, commented-out legacy branches, and duplicated email template assembly removed or consolidated, so that future changes are smaller and clearer.
18. As a maintainer, I want a small domain glossary for tickets, passes, tracks, competitions, registration statuses, and capacity movement, so that names in code match organizer language.

## Implementation Decisions

- Treat server-side admin protection as the first improvement slice.
- Replace local-storage-only admin checks with a server-verifiable session mechanism.
- Require admin authorization inside admin data pages and admin API routes.
- Treat checkout price as server-owned state.
- Recompute the Stripe line item from server-side registration rules rather than trusting a client-supplied price.
- Tie the accepted registration payload to a server-verifiable checkout session before creating or confirming the registration.
- Extract registration rules into shared modules for pricing, event dates, pass availability, voucher handling, validation, capacity changes, and status transitions.
- Keep the public form on one page, but make its validation and disabled checkout state use the same rule module as the server.
- Centralize event-year configuration so 2026 copy, dates, product names, Open Graph image, vouchers, lunch price, and pass gates are not scattered across pages and APIs.
- Rename capacity helpers around the domain action they perform, such as reserve capacity, release capacity, reserve waiting-list spot, and release waiting-list spot.
- Normalize registration status spelling and transitions, especially canceled versus cancelled.
- Keep the existing database tables for the immediate backlog; schema cleanup can follow after behavior is protected.
- Update confirmation, cancellation, sold-out, already-registered, waiting-list, lunch, competition, login, user detail, and dashboard views to align with the public registration visual direction.
- Consolidate email template construction into reusable helpers per message type.
- Remove unused imports, unused state, old commented branches, and stale 2023/2024/2025 references as part of scoped cleanup tasks.
- Add a committed ESLint configuration before relying on lint as a check.
- Introduce automated tests gradually at the highest practical seams instead of starting with many low-level component tests.

## Testing Decisions

- The first testing seam is server-side unit coverage for registration rules: pricing, vouchers, pass availability, validation, status transitions, and capacity movement.
- The second testing seam is API-level coverage for checkout, registration completion, login/session behavior, admin edits, mail-all, lunch, and competition updates.
- The third testing seam is one high-level browser journey for public registration, covering draft restore, validation, order summary, checkout handoff, and success/cancel behavior with mocked Stripe.
- Dashboard tests should prioritize authorization, filtering/export behavior, bulk status changes, and bulk email safety.
- Visual QA should cover public registration, success, cancel, already-registered, sold-out, waiting-list, lunch, competition, login, dashboard, and user detail pages at mobile and desktop widths.
- Accessibility QA should cover keyboard navigation, focus visibility, labels, form errors, disabled states, modal close behavior, and reduced-motion behavior.
- Build verification should remain required.
- Lint verification should become required after a non-interactive ESLint config is committed.
- No broad end-to-end payment test should hit live Stripe; use test mode or mocked session creation and retrieval.

## Out of Scope

- Migrating from the Pages Router to the App Router.
- Migrating from Reakit to Ariakit.
- Replacing Postgres migrations or changing hosting.
- A full dashboard product redesign before admin security and shared rules are fixed.
- Changing the Blues Fever registration business model.
- Creating GitHub issues; this repo currently publishes PRDs locally.

## Further Notes

- The current build passes.
- The current lint command prompts for setup and should not be treated as a real lint gate yet.
- The existing public registration redesign PRD remains valid, but this backlog argues that shared rule extraction and server-owned checkout should happen before or alongside further visual polish.
- Highest-risk areas are admin protection, checkout trust, registration confirmation, capacity movement, and scattered event-year rules.
