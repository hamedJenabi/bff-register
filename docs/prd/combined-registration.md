# Combined public registration and festival choices

Decision date: 8 November 2026.

Status: product discussion paused at the user's request. Save these decisions for a later implementation session. No combining work is implemented or authorized to start in this session.

## Agreed direction

Keep two entry points backed by shared booking and availability rules:

- The public registration form at `/` becomes the complete journey for all new participants, covering personal details, festival pass, class sessions when eligible, competitions, lunch, and one combined payment.
- `/reg2026` remains available for existing confirmed participants who still need to register their festival choices. Do not remove it or require those participants to purchase their pass again.

The new public journey is:

1. Enter personal details and choose a festival pass.
2. For a Full Pass or Parent Pass, select exactly five class sessions before proceeding to payment. Selecting classes is mandatory; buying the pass first and choosing classes later is not the intended new-participant journey.
3. For a Party Pass, skip the schedule entirely.
4. Choose competition entries and lunch bookings.
5. Submit the combined registration, temporarily hold the selected places, and proceed to one checkout for the pass and selected paid add-ons.
6. After server-verified payment confirmation, confirm the pass and assign the saved class sessions, competition entries, and lunch bookings to the same participant's festival registration.

Class sessions must be distinct and have no time-slot conflicts. Existing dance-role and capacity rules still matter. The exactly-five requirement is a future rule for new Full/Parent Pass registrations; this discussion did not change the existing `/reg2026` class allowance or retroactively require five classes for existing participants.

## Current implementation and implications

These are code findings and implementation considerations, rather than a completed technical design:

- `/reg2026` already has persisted order drafts, provisional class bookings, capacity checks, payment verification, repeat-request protection, and confirmation delivery. Both entry points should use the same capacity accounting so a place held through either journey is unavailable to the other.
- The supplemental flow currently requires an already confirmed participant in its access lookup, submission transaction, and parts of its availability accounting. New unpaid registrations cannot simply be passed through those checks. Extending access and pending-registration accounting must preserve the existing confirmed-participant route.
- Existing provisional class bookings hold places during checkout. Extending this to a combined purchase requires pass availability to be reserved consistently with class and competition places; the current supplemental hold does not reserve a new festival pass.
- Existing supplemental checkout holds last one hour while checkout remains open. Processing payments retain their holds until success or failure is verified. The combined flow's expiry, cancellation, retry, and delayed-payment behavior still needs explicit design.
- The public pass checkout currently accepts a browser-supplied amount, and its return page posts registration data from browser storage. A combined purchase needs server-owned pricing and saved choices, with verified payment fulfillment, so a browser redirect or missing browser draft cannot determine whether a registration is confirmed.
- A shared validator must distinguish the new exactly-five requirement from the existing supplemental maximum of five. Changing the common limit alone would break the intended legacy journey.

## Unresolved decision at the stopping point

**If a new participant cannot select five available class sessions without time conflicts, should their Full/Parent Pass purchase be blocked even when pass inventory remains?**

This was the last interview question and the user did not answer it. Do not infer approval for blocking pass sales, allowing fewer classes, a waiting list, or organizer exceptions.

## Remaining risks and assumptions to validate

- Exactly five sessions may be impossible near sell-out, for a particular dance role, or with the participant's competition choices. Validate that pass inventory and the published schedule can support this requirement.
- Existing and new participants will compete for the same remaining places. Both flows must count provisional and confirmed bookings consistently, including bookings tied to a new unpaid registration.
- Payment must confirm one saved combined registration without duplicate participants, capacity changes, charges, or confirmations when requests or payment events repeat.
- Combining pass and add-on pricing requires later review of existing vouchers, discounts, zero-total registrations, confirmation emails, and the participant's recovery route after an unfinished checkout. These details were not decided during this discussion.

## Resume here

Start the next planning session with the unresolved five-class availability decision. Then test the proposed journey against a nearly full schedule and concurrent submissions through `/` and `/reg2026`, and define the shared order/payment lifecycle before implementing it.

Related documentation: [existing supplemental registration requirements](./reg2026-registration.md), [current launch behavior](./reg2026-launch.md), [implementation roadmap](./implementation-roadmap.md), and [public-form redesign](./public-registration-form-redesign.md). This future scope extends beyond the older UI-only redesign; current runtime behavior remains as documented until combining is implemented.
