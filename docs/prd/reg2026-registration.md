# PRD: 2026 Class, Competition, and Lunch Registration

Status: Product decisions resolved for the first implementation. External email templates, the attendee-app token contract, and final class catalog content remain launch dependencies.

Workflow: Keep this PRD locally under `docs/prd/`, as configured for this repository. No remote issue or commit is part of this phase.

## Problem Statement

Participants who already have a Blues Fever 2026 pass need one place to choose class sessions, enter competitions, and book lunch. The existing registration and lunch forms do not provide a combined, personalized journey with class availability and a single confirmation.

## Solution

Create a new `/reg2026` page with three sections: schedule registration, competition registration, and lunch. Resolve the participant on the server from the incoming personalized link and supply the page with the participant data needed for the form.

Present the supplied Friday-to-Sunday schedule as a desktop grid and a mobile list grouped by day and time slot. Selecting a class opens a centered desktop modal or a full-screen mobile modal with the title, teacher, description, and lead/follow choices when it is a partner class. Participants can add and remove sessions, subject to one class per time slot, the agreed daily allowance, and available capacity. Party Pass participants do not see the schedule section.

Start the competition section with “Do you want to compete?” and reveal the applicable choices when the participant answers yes. Include Saturday and Sunday lunch choices based on the existing lunch form. A final submission creates provisional choices and, when money is due, starts Stripe checkout. Confirm paid choices after Stripe verifies payment; class-only submissions confirm immediately. Store schedule choices in `registrations_26.theme_class`. Send a confirmation email after confirmation, with the attendee-app link once its contract is ready.

## User Stories

1. As a participant, I want to open my personalized registration link, so that I can register my festival choices.
2. As a participant, I want the page to identify my existing festival registration, so that I do not need to register for another pass.
3. As a participant, I want to see which person and pass the form belongs to, so that I can verify I opened the correct link.
4. As a participant, I want schedule, competition, and lunch choices on one page, so that I can finish them together.
5. As a participant with a Party Pass, I want the class-registration section omitted, so that I only see relevant choices.
6. As a participant eligible for classes, I want to browse the supplied festival schedule by day, time, and room, so that I can plan my attendance.
7. As a participant, I want each scheduled class occurrence to be identifiable, so that repeated titles are not confused.
8. As a participant, I want to open a class from its schedule cell, so that I can learn about it before selecting it.
9. As a participant, I want to see a class title, teacher, and description, so that I can make an informed choice.
10. As a desktop participant, I want class details in a centered modal, so that I can refer back to the schedule easily.
11. As a mobile participant, I want class details in a full-screen modal, so that its content and controls are usable on my phone.
12. As a participant choosing a partner class, I want to select lead or follow, so that I reserve the appropriate kind of place.
13. As a participant choosing a non-partner class, I want to proceed without a dance-role question, so that I do not answer an irrelevant question.
14. As a participant, I want to confirm a class selection in its modal, so that opening details alone does not select it.
15. As a participant, I want selected classes to be visibly marked, so that I can recognize my choices in the grid.
16. As a participant, I want a clear view of my selected classes, so that I can review my schedule before final submission.
17. As a participant, I want to deselect a class, so that I can revise my plan.
18. As a participant, I want at most one class per time slot, so that I cannot accidentally book overlapping sessions in the same slot.
19. As a participant, I want a maximum of five class sessions across the festival explained and enforced, so that I know how many sessions I can choose.
20. As a participant, I want unavailable places to be clearly marked, so that I do not attempt to book a full class or role.
21. As a participant, I want remaining availability to reflect registrations, so that displayed choices are meaningful.
22. As a participant, I want fully booked classes disabled in the schedule, so that their availability is immediately clear.
23. As a participant, I want availability checked when I submit, so that I can see whether a place appears to be available before checkout.
24. As a participant, I want an understandable message when a requested place becomes unavailable, so that I can revise my selection.
25. As a participant, I want to answer whether I want to compete, so that competition details only appear when relevant.
26. As a participant who wants to compete, I want to choose from the agreed 2026 competitions, so that I can enter the contests I want.
27. As a participant entering a competition that requires a role, I want to select lead or follow, so that my entry is complete.
28. As a participant entering a competition without roles, I want to omit unnecessary role questions, so that entering remains straightforward.
29. As a participant, I want class registration and competition entry distinguished, so that attending a competition class does not unintentionally enter me in a contest.
30. As a participant, I want to choose Saturday lunch, Sunday lunch, both, or neither, so that my meals match my plans.
31. As a participant, I want the lunch price and included items stated clearly, so that I understand my booking.
32. As a participant, I want competition charges and any pass benefit explained, so that I understand the cost of my entries.
33. As a participant, I want a combined amount and Stripe checkout, so that I can pay for my selections.
34. As a participant, I want one final submission for the three sections, so that I do not have to complete separate forms.
35. As a participant, I want errors shown alongside the relevant choices, so that I can correct them before submitting.
36. As a participant, I want a clear save confirmation, so that I know my registration was recorded.
37. As a participant, I want an email containing all saved choices, so that I have a reference outside the form.
38. As a participant, I want an attendee-app link in that email, so that I can open the app from my confirmation.
39. As a participant using a keyboard, I want to navigate the schedule, modal, and form controls, so that I can complete registration without a mouse.
40. As a participant using a screen reader, I want labeled choices and announced errors, so that I can understand the form state.
41. As an organizer, I want supplemental choices saved against the correct existing participant, so that records stay connected to the purchased pass.
42. As an organizer, I want class availability tracked across participants, accepting that simultaneous submissions may overbook a class by one or two dancers.
43. As an organizer, I want schedule choices stored in the requested schedule field, so that the registration table contains the participant's selections.
44. As an organizer, I want confirmation emails to describe saved choices, so that messages agree with registration records.
45. As a maintainer, I want the screenshot schedule represented as replaceable mock data, so that a database-backed schedule can be introduced later.
46. As a maintainer, I want the new registration flow to use the existing competition and lunch content appropriately, so that its business rules remain recognizable.
47. As a participant, I want adding a class to remain a draft action, so that I can plan before reserving places with my final submission.
48. As a participant, I want my link to show a completion message after registering once, so that I know I am finished.
49. As a participant, I want to resume unfinished checkout or retry a failed payment, so that I can complete my one-time registration.
50. As a participant, I want organizer contact details after registering, so that I can request later changes.

## Implementation Decisions

### Confirmed by the request

- Introduce `/reg2026` as a new page.
- Resolve a confirmed, unambiguous existing participant on the server and pass only the necessary data to the page. The personalized link retains the requested `/reg2026?user=email+firstname` identity value and adds a signature for access.
- Provide schedule registration, competition registration, and lunch in that order, with one final submit action.
- Hide schedule registration for Party Pass participants. The persisted ticket value in the current app is `partyPass`.
- Use the supplied screenshot as the mock schedule source. Later schedule data will come from a database.
- The mock catalog defines each session's stable ID, title, teachers, description, time, room, and partner-class flag. Store capacity limits in Postgres: 20 lead and 20 follow places for partner classes, or 30 total places for non-partner classes.
- Clicking a schedule cell opens a class modal, centered on desktop and full-screen on mobile.
- The modal includes an explicit action to select the class. A participant can deselect a class.
- Enforce at most one class per time slot and a maximum of five class sessions in total across the festival, regardless of day.
- Every class session is independently selectable, including numbered and repeated track sessions. Selecting one never automatically books other occurrences.
- Adding or removing sessions changes a draft. On final submission, check displayed availability and create provisional bookings before Stripe checkout; retain the draft when a place has become unavailable. Provisional bookings expire after one hour without payment. A small race-related overbooking of one or two dancers is acceptable.
- Registration is one-time. After a free submission or verified successful payment, reopening the link shows only a completion message and organizer contact; no registration fields are available. Enforce this on the server, including for registrations with no choices. Identical request retries remain idempotent.
- Decrease displayed availability as provisional and paid bookings are recorded, and disable fully booked classes for new selections. Store bookings persistently across server instances.
- Use the commented competition section in the current public registration form as the competition reference, with a reusable competition section.
- Use the existing food form as the lunch reference.
- Save the result in `registrations_26`, using `theme_class` for schedule choices.
- Send an email containing the saved registration information. The SendGrid template ID will be supplied by the user.
- Include an attendee-app link with requested shape `https://app.bluesfever.eu?token=firstname+email+id`; the token contract and encoding require agreement.
- Lunch and competition additions are paid through Stripe, including the existing checkout fee; class-only submissions have no payment step. Full Pass holders no longer receive a free competition entry.
- Display subtotal, Stripe fee, and charged total in the form. After a successful paid submission, redirect directly to the server-created Stripe checkout without a second review screen or checkout click. On return from Stripe, show payment-pending status until a server-verified payment event confirms the booking. A never-completed checkout and its provisional booking expire after one hour; a completed payment still processing remains pending until Stripe reports success or failure.
- After completion, all changes, added entries, removals and refunds go through organizers. Pending, failed or expired payment attempts can still be completed or retried; they do not count as successful registrations.
- If a confirmation email fails, keep the booking confirmed and the participant's success page accurate; record the failed send for an organizer retry.

### Repository findings that constrain the design

- The app uses the Next.js Pages Router, so server-side participant loading fits its existing routing model.
- The registration table already has lunch, competition, competition-role, and schedule fields. The schedule field is currently text; a versioned serialization contract needs to be agreed before storing structured choices.
- There is no schedule inventory table or class-booking flow today. Add persistent capacity limits and bookings; the mock schedule metadata alone cannot provide shared availability across users or server instances.
- Existing participant lookup matches email and first name and requires confirmed status. Initial registration normalizes email but not first name. Duplicate matching records are not ruled out by the schema.
- Full and Parent passes currently advertise 6 hours 15 minutes of classes, equivalent to five of the screenshot's 75-minute sessions. The user's corrected rule for this page is five classes in total across the festival, matching that pass copy. Both passes are class-eligible, and dance roles are selected per partner session.
- Stored registration field names are misleading: `level` carries dance role and `role` carries proficiency level. Per-class dance roles must not be inferred from column names.
- The commented competition reference lists Solo Battle, Open MixMatch, Newcomers MixMatch, Strictly, and Fever Showcase. Open MixMatch, Newcomers MixMatch, and Strictly request lead/follow; the other two do not.
- The commented competition reference uses a Solo Battle cap of 45 and advertises €10 per entry with one free entry for Full Pass holders. The 2026 decision keeps the cap and price but removes the free entry.
- The current food form offers Saturday and Sunday lunch at €15 per meal, including a main course, dessert, and one drink. The 2026 form keeps that price and dietary-options copy, collects no dietary preference, and takes payment through Stripe. An older lunch-page calculation uses a different price.
- Existing separate lunch and competition saves each replace the amount due. A combined submission needs one agreed calculation and must avoid losing charges from another section.
- Existing pass checkout trusts a client-submitted amount, and the success page sends participant data from browser local storage to `/api/register`. This is not a suitable payment-confirmation mechanism for class capacity or the combined form; the new flow needs server-owned checkout state and verified payment fulfillment.
- The old competition and food components each contain their own form and submit controls. Their section content needs adaptation for a single combined form.
- Existing email helpers do not reliably report delivery-request failures. The new flow needs explicit saved-registration versus email-send status.
- The current dashboard includes “Send Email to All confirmed” and sends one `/api/mailall` request per browser-supplied user. The dashboard's `localStorage` login flag does not protect its server-rendered participant data, and `/api/mailall` does not authenticate requests. The new invitation action must use server-side authorization and select confirmed recipients on the server.
- No compatible attendee-app token consumer was found in this repository.

### Technical approach for implementation

- Update the participant's existing registration, without modifying purchased-pass details, identity, admission status, or original ticket price.
- Validate and save the complete draft atomically on final submission, retaining the confirmed draft-until-submit behavior.
- `class_capacities_26` is the Postgres capacity table, keyed by stable session ID and capacity pool (`lead`, `follow`, or `total`); seed it from the agreed defaults after catalog review. Add a booking table for provisional and confirmed selections. Compute remaining places from the stored limit minus active bookings; do not maintain a separately decremented remaining-count field. A best-effort availability check is sufficient; strict concurrency serialization is not required because a small race-related overbooking is acceptable.
- Keep one stable identifier for each scheduled occurrence in the mock catalog, plus day, start/end time, room, description, and partner flag. The same identifier links catalog entries to capacity and booking rows.
- Store enough versioned schedule information to reconstruct the participant's selections, including session identifiers and selected dance roles.
- Preserve other sections and draft choices when validation or availability fails.
- Reuse the existing burgundy visual language and accessible dialog primitives, adapting the mobile dialog to the requested full-screen behavior.
- Build the requested `user` value from the stored email and first name, URL-encode the complete value, and add an HMAC signature. Compare the complete identity value against confirmed records and reject zero or multiple matches. Reuse the link while registration is open.
- Keep checkout amount and pending choices on the server, associate them with the Stripe session, and confirm payment through a verified Stripe webhook. Do not rely on the browser return page or a client-submitted amount to fulfill an order.
- Authenticate the organizer on the server for the new bulk-invitation endpoint. Query confirmed recipients on the server; do not trust a browser-supplied recipient list. Keep delivery results so a failed invitation can be retried without blindly resending to everyone.
- Persist a confirmation-email retry record when SendGrid fails after the booking is confirmed.

## Testing Decisions

Testing boundary: the participant-facing page, invitation action, and load/save/payment HTTP endpoints, backed by an isolated test database with substituted Stripe and email adapters. Test observable outcomes rather than component structure or implementation details.

- Exercise identifying a participant, showing the correct sections, choosing sessions and roles, entering competitions, choosing lunch, submitting, and observing saved data and the email request.
- Verify Party Pass class restrictions on the server as well as in the page.
- Verify one session per time slot, the agreed overall allowance, role-specific availability, non-partner capacity, and deselection behavior.
- Verify that changing a stored capacity limit changes availability without redeploying the mock catalog, and that expired provisional bookings no longer occupy places.
- Submit concurrent requests for the last place and verify the best-effort availability check and the accepted small race-related overbooking behavior.
- Verify request retries do not consume capacity or charge twice, according to the agreed save semantics.
- Verify the agreed behavior when saving succeeds and email sending fails.
- Verify that a completed free, paid or empty registration rejects further submissions without changing its bookings. Test concurrent first submissions, identical retries, and unfinished payment recovery. All later changes stay organizer-managed.
- Check malformed or ambiguous participant links, plus-addressed emails, and the agreed policy for unconfirmed participants.
- Verify desktop and mobile layouts, full-screen mobile dialogs, keyboard operation, modal focus management, labels, and error announcements.
- Existing prior art is the public registration redesign PRD's journey-based QA and the improvement backlog's API/integration recommendations. The repository currently has no configured automated test framework.
- Run the repository's applicable build/lint checks when implementation begins. No runtime implementation has been made in this draft.

## Out of Scope

- Replacing the original pass-purchase flow.
- Rebuilding the administrative dashboard beyond the new invitation action and the server-side authorization it requires.
- Implementing the attendee app at the destination domain.
- A schedule-management admin interface, unless later explicitly requested.
- General framework upgrades or unrelated legacy cleanup.

Production database-backed schedule authoring is deferred by the request. Persistent booking capacity is a separate requirement and cannot be assumed deferred with the catalog.

## Further Notes

### Interview round 1 — resolved

1. The user corrected the limit to up to five classes in total across the festival, still one per time slot. The eight available time slots do not increase this cap.
2. Reserve places on final submission, with server-side availability revalidation and draft retention on conflict.
3. Every session is an independent selection, including repeated and numbered track sessions.
4. The user changed this to a one-time registration. Return links show completion and organizer contact after successful submission/payment; self-service edits are disabled.

### Interview round 2 — resolved

5. Only confirmed participants may use `/reg2026`. Full and Parent passes can book classes; Party Pass can use competitions and lunch but not classes. A missing or ambiguous identity match must not select an arbitrary registration; direct the participant to registration support.
6. The personalized `/reg2026` link keeps the requested email and first-name identity values and adds a signature that authorizes first registration and payment status access. The link remains usable to resume checkout or view completion, with no fixed per-link expiry. Closing the form centrally or rotating the signing secret can disable access. The exact signed URL encoding remains to be designed.

7. Saturday and Sunday lunch cost €15 each; each competition entry costs €10; classes have no extra charge. No pass includes a free competition entry. Stripe checkout is required for the combined amount. The draft becomes a provisional booking before checkout; an unpaid booking expires after one hour. One or two overbooked dancers due to simultaneous submissions are acceptable.
8. The user changed this to one successful registration per participant. After payment or free confirmation, every change goes through organizers. Existing paid add-ons remain credited on the first submission.

### Interview round 3 — resolved

9. Participants may choose lead or follow independently for each partner class session, regardless of the dance role selected when buying a pass.

10. Offer Solo Battle, Open MixMatch, Newcomers MixMatch, Strictly, and Fever Showcase. Solo Battle alone has a capacity limit of 45 entries; the other four remain open until organizers close registration. Ask for lead/follow in Open MixMatch, Newcomers MixMatch, and Strictly; the other two have no role question. Do not carry over temporary sold-out restrictions from the older form.

11. Build the first catalog with clearly labeled placeholder descriptions and editable sample partner flags. Seed Postgres capacity limits of 20 lead and 20 follow for partner classes, or 30 total for non-partner classes. A catalog review is required before real participants use `/reg2026`; screenshot gaps must not be presented as verified festival facts.
12. “Cuttin' for Solo competitors only” is outside this registration flow. Remove it from the selectable schedule; organizers will handle it manually.
13. “Jukin (III–IV)” remains selectable by all class-eligible participants. The level label is informational and imposes no eligibility restriction.
14. Add a new dashboard button beside “Send Email to All confirmed” to send each confirmed participant a personalized, signed `/reg2026` invitation using a dedicated SendGrid template. Pass the personalized URL as `registrationUrl`; the template ID will be supplied before sending real emails. The new send path must authenticate the organizer on the server.
15. The attendee app's `token` contract is still being built. Keep the confirmation-email app URL configurable and do not treat the requested `firstname+email+id` sketch as a verified authentication protocol. The final link is an external launch dependency.
16. Lunch selection remains Saturday and/or Sunday only. State that dietary options are available, without collecting a preference in this form.
17. A paid submission stays provisional while Stripe payment is pending. Confirm saved choices and send the registration confirmation email only after Stripe reports successful payment. A class-only submission has no Stripe step and can confirm immediately.
18. Add the existing checkout fee calculation, approximately 1.4% plus €0.25, to paid supplemental orders. Show the fee and charged total before the Stripe redirect; calculate them on the server from validated selections.
19. Selecting a class disables other classes in its time slot. Remove the selection before choosing a replacement; selections reserve places only on final submission.
20. Desktop shows the schedule as a room-by-time grid. Mobile shows a day-by-day list grouped by time slot, with a class card for each room; class details open full-screen.
21. Browser draft storage is disabled. Unsaved choices reset on reload. Pending payment choices are recovered from the server; confirmed registrations show only completion.
22. If SendGrid fails after payment and booking confirmation, keep the booking confirmed, show the participant success, and queue the failed confirmation email for organizer retry.
23. Add a Classes column to the organizer dashboard with a registered class count and a button opening participant-specific details. Show saved class titles, day/time, teachers and lead/follow or solo roles in an accessible dialog, including an explicit empty state. Organizers can remove classes and add replacements from a dropdown, with roles, then save atomically without email or payment actions. Preserve five-class, time-slot, eligibility and capacity rules; prevent stale edits and edits during pending checkout. Pending checkout drafts are not confirmed registrations.
24. Add an optional Voucher input at the end of `/reg2026`. The code `freepass26` makes all selected competition entries and lunch meals free, including checkout fees. Confirm these submissions without Stripe, while preserving class/pass/role/capacity rules and one-time registration. Reject unknown codes. Previously purchased festival passes remain unchanged.
25. Submit paid choices directly to Stripe without an intermediate checkout-review screen. Keep resume/cancel/status recovery for participants who return without paying or reopen a pending registration.

### Launch inputs and deferred details

- Review and replace placeholder titles, descriptions, partner flags, missing room labels, and actual dates before sending invitations. The first catalog is mock data, not verified festival content.
- Supply dedicated SendGrid template IDs for the invitation and confirmation emails. The invitation template must accept `registrationUrl`; confirmation variables can be finalized with the template.
- Confirm the attendee app's final token contract and URL before including a working app link in confirmation emails. The app is being built separately.
- Configure the registration closing rule, Stripe webhook secret, SendGrid credentials, and signing secret in the deployment environment.
- Seed `class_capacities_26` after the partner flags and class catalog are reviewed. Implement the remaining serialization and migrations for `theme_class`, provisional bookings, checkout state, and email retries during the build. Preserve existing pass purchases and credit legacy paid add-ons on the first registration. Initial limit changes can be made in Postgres; an admin capacity editor is outside this phase.

## Decision Log

- **Goal:** Let confirmed 2026 participants register classes, competitions, and lunch through one personalized page.
- **Scope:** `/reg2026`, persistent booking state, Stripe checkout and webhook confirmation, confirmation email, a signed-link invitation button beside the existing dashboard email action, and organizer visibility of registered classes.
- **Non-goals:** Replace pass purchase, build the attendee app, add schedule administration, or automate paid add-on refunds.
- **UX and behavior:** Full and Parent passes can choose classes; Party Pass cannot. Choose at most one class per slot and five in total across the festival. Partner-class roles are chosen per session. Mobile uses a time-slot list and full-screen details. Browser draft storage is disabled; unsaved choices reset on reload. Registration is one-time; completed links show only confirmation and organizer contact.
- **Payment:** Lunch is €15 per day and competitions are €10 each. Add the existing Stripe fee; `freepass26` waives all supplemental charges and fees. Create provisional bookings before paid checkout; expire uncompleted checkouts after one hour; confirm and email only after verified payment. Class-only and valid voucher submissions confirm immediately.
- **Data and compatibility:** Keep pass-purchase fields intact. Store versioned class selections in `theme_class`; store per-session capacity limits and active bookings in Postgres. Derive remaining places from those records. Use signed, reusable participant links and server-side organizer authorization for invitations.
- **Edge cases:** Reject missing or ambiguous participants. Reject all changes to a completed registration and preserve its bookings. Accept small race-related overbooking. Remove “Cuttin'” from self-service; “Jukin (III–IV)” has no enforced restriction. Retain confirmed bookings when email fails and queue retry.
- **Verification:** Test participant access, booking rules, payment and expiry transitions, one-time completion, retries, invite authorization, email failure, responsive layout, and keyboard accessibility.
- **Open launch inputs:** Final catalog review, SendGrid template IDs, attendee-app URL contract, deployment secrets, and the registration closing rule.

## Sources

- User request and attached schedule screenshot dated 2026-09-30.
- [Schedule transcription](./reg2026-schedule-reference.md).
- Existing registration, food, competition, database, API, and email code inspected read-only.
- [Local issue-tracker workflow](../agents/issue-tracker.md).
- [Public registration redesign PRD](./public-registration-form-redesign.md).
- [Code and UX improvement backlog](./code-and-ux-improvement-backlog.md).
- [Stripe guidance on server-side payment fulfillment](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted).

Implementation update: the participant journey, persistent orders/bookings, verified Stripe fulfillment, organizer sessions/invitations, durable email retries and automated/browser verification are now implemented locally. See [the implementation roadmap](./implementation-roadmap.md) and [launch setup](./reg2026-launch.md). No production deployment or operational database migration was performed in this implementation pass. Final catalog, SendGrid templates, attendee-app token contract and deployment configuration remain launch inputs.
