# PRD: Public Registration Form Redesign

Workflow metadata:

- Local-only workflow: do not create a GitHub issue for this PRD.
- Commit workflow: ask the user for approval before staging or committing changes.

## Problem Statement

The current public registration form handles the core Blues Fever registration workflow, but it feels like a long plain form rather than a modern, trustworthy event registration checkout. Registrants must work through many conditional choices in one vertical page: personal data, pass selection, track selection, competitions, donation, voucher, terms, and checkout. The information is complete, but it is dense, visually dated, and harder to scan on mobile.

The first redesign phase should improve the public registration experience without changing the operational behavior behind it. The business rules, registration data shape, pricing, checkout API, validation expectations, ticket capacities, closed/open registration rules, and current event-year content should remain stable for now. Later phases will modernize internals, update event dates, migrate UI primitives, upgrade React and Next.js, and align the dashboard.

## Solution

Redesign the public registration form as a calm, premium, Blues Fever-branded one-page registration checkout. The form remains the first thing users can act on, keeps dark mode only, adds clear validation nudges, local draft restore, a live order summary, and visual treatment that uses real Blues Fever assets sparingly.

The redesigned form should cover the entire current registration flow, including all conditional sections, on one continuous page. Users should be able to scan the whole form, understand what is missing before checkout, see pricing update as they make selections, and complete registration through the existing checkout behavior. The redesign should make the current form feel trustworthy and modern while keeping phase 1 implementation risk low.

## User Stories

1. As a registrant, I want the public registration page to look modern and trustworthy, so that I feel confident entering personal and payment-related information.
2. As a registrant, I want the form to be the first meaningful thing I see, so that I can start registration without scrolling past a marketing page.
3. As a registrant, I want the registration flow to remain on one page, so that I can scan all sections without moving through a stepper.
4. As a registrant, I want conditional sections to appear in place, so that I can revise earlier answers without feeling trapped.
5. As a registrant, I want incomplete required fields to be visibly marked, so that I know what still needs attention.
6. As a registrant, I want final checkout blocked until required fields are valid, so that I do not submit an incomplete registration.
7. As a registrant, I want inline validation nudges, so that I can fix errors where they happen.
8. As a registrant, I want the form to work beautifully on mobile, so that I can register from my phone.
9. As a registrant, I want the form to work well on tablet and desktop, so that the layout feels intentional on every device.
10. As a registrant, I want the registration page to use a focused dark mode, so that the page feels atmospheric and premium without adding theme-choice complexity.
11. As an organizer, I want no light/dark switch in phase 1, so that the public registration page has one consistent branded visual language.
12. As a registrant, I want the footer to remain readable in dark mode, so that supporting links do not disappear visually.
13. As a registrant, I want Blues Fever visual assets used sparingly, so that the page feels branded without distracting from registration.
14. As a registrant, I want a compact event header, so that I can confirm I am registering for the right event.
15. As a registrant, I want to enter my personal data at the top of the form, so that the form starts with familiar fields.
16. As a registrant, I want country selection to remain part of personal data, so that my registration record is complete.
17. As a registrant, I want clear pass cards, so that I can compare Full Pass, Party Pass, and Parent Pass quickly.
18. As a registrant, I want unavailable passes to look disabled and explain why, so that I do not waste time selecting something I cannot buy.
19. As a registrant, I want sold-out states to be clear, so that I understand capacity limits before checkout.
20. As a registrant, I want the Parent Pass partner field to appear only when relevant, so that the form stays focused.
21. As a registrant buying a Full Pass, I want track choices organized clearly, so that I can choose the right class track.
22. As a registrant, I want sold-out tracks to be visibly disabled, so that I can avoid invalid track selections.
23. As a registrant, I want long track notes shortened on the main path, so that I can scan the available options quickly.
24. As a registrant, I want expandable detail panels for longer notes, so that I can still read important context when needed.
25. As a registrant, I want competition participation to be presented as a clear add-on decision, so that I know whether competitions are available.
26. As a registrant, I want competition role questions to appear only for competitions that need them, so that I do not answer irrelevant questions.
27. As a registrant, I want competition sold-out states to be visible, so that I understand why an option may be unavailable.
28. As a registrant, I want donation options to feel respectful and optional, so that I can support the scholarship and discount fund without pressure.
29. As a registrant, I want donation amount entry to appear only after I choose to donate, so that the form remains uncluttered.
30. As a registrant, I want voucher entry to be easy to find, so that I can apply a code before checkout.
31. As a registrant, I want voucher warnings to be clear, so that I understand whether a voucher affects my total.
32. As a registrant, I want a live order summary throughout the form, so that I always know what I have selected.
33. As a desktop registrant, I want the order summary to remain visible beside the form, so that I can track price changes as I work.
34. As a mobile registrant, I want the order summary to be compact and collapsible, so that it helps without covering the form.
35. As a registrant, I want the summary to show pass, track, competitions, donation, and total price, so that checkout is transparent without repeating every form control.
36. As a registrant, I want terms and checkout to live at the bottom of the one-page form, so that I can complete registration without a separate review step.
37. As a registrant, I want my in-progress form saved locally, so that refreshing the browser does not erase my work.
38. As a returning registrant, I want the form to restore my local draft, so that I can continue where I left off.
39. As a registrant, I want draft restore to stay local and unobtrusive, so that it helps me without adding another registration mode.
40. As a keyboard user, I want every section, input, card, summary control, and checkout action to be keyboard accessible, so that I can complete registration without a mouse.
41. As a screen-reader user, I want form controls and errors to have meaningful labels, so that I can understand and complete each section.
42. As a low-vision user, I want sufficient contrast in dark mode, so that the form remains readable.
43. As a motion-sensitive user, I want reduced-motion preferences respected, so that animations do not make the form uncomfortable.
44. As an organizer, I want the phase 1 redesign to preserve current registration behavior, so that operations are not disrupted.
45. As an organizer, I want event dates and opening rules noted for later update, so that the UI work does not accidentally redefine event-year business rules.
46. As an organizer, I want the temporary `intern=true` registration access treated as operational state, so that it does not become a public design concept.
47. As an organizer, I want the full current form redesigned, including conditional sections, so that no registration path is left visually outdated.
48. As a future maintainer, I want phase 1 to keep Reakit, so that the redesign avoids coupling UI polish to a form-library migration.
49. As a future maintainer, I want modernization work documented as a later phase, so that Ariakit, React, Next.js, validation, API boundaries, and data cleanup can be planned deliberately.
50. As a future implementation agent, I want the PRD split into smaller follow-up tasks, so that each slice is reviewable and testable.

## Implementation Decisions

- Phase 1 is a UI/UX modernization of the public registration form, not a behavioral rewrite.
- Preserve the existing registration data shape, checkout behavior, pricing rules, validation requirements, ticket capacity handling, and registration open/closed rules.
- Preserve existing user-facing registration copy for phase 1; only fix typos when explicitly needed.
- Preserve the existing form layer for phase 1, including Reakit form state and current submission behavior.
- Redesign the public registration form as a one-page registration checkout.
- The first screen should be form-first, with a compact branded event header rather than a marketing-style hero.
- Use dark mode only for phase 1; do not provide a light/dark toggle.
- Do not store theme preference locally in phase 1 because there is only one supported visual mode.
- Make the flow responsive across mobile, tablet, and desktop.
- Do not use step navigation or a stepper; render the form sections continuously on one page.
- Prevent final checkout until required data is valid.
- Add a live order summary throughout the flow.
- On desktop, the order summary should behave like a persistent side summary.
- On mobile, the order summary should be compact and collapsible.
- Include selected pass, track, competition choices, donation, and total price in the summary.
- Do not include voucher state or current step in the order summary; voucher entry and voucher warnings stay in the add-ons area.
- Do not include a separate final review step; terms acceptance and the checkout action live at the bottom of the one-page form.
- Save in-progress registration data locally in the browser.
- Do not add a separate start-over/reset control in this one-page version.
- Keep draft saving local only; do not add backend draft persistence in phase 1.
- Shorten long explanatory copy on the main path and move longer details into expandable panels.
- Treat accessibility as a core requirement: keyboard navigation, visible focus states, screen-reader labeling, dark-mode contrast, and reduced-motion support.
- Use real Blues Fever assets sparingly to provide atmosphere without hiding the form or making the layout visually noisy.
- Treat `intern=true` as a temporary operational workaround while registration is closed, not as a design concept. Do not create a special internal-mode visual language for phase 1.
- Redesign every current form section, including conditional sections for parent partner, track selection, competitions, competition roles, t-shirt options where present, donations, voucher, terms, and checkout.
- Keep current event-year copy, dates, and date-gated behavior stable for phase 1; update dates/status/content in a later follow-up.
- Avoid new runtime dependencies unless clearly necessary.
- Later modernization should include Ariakit migration, newer React, newer Next.js, validation cleanup, form-state cleanup, pricing-rule extraction, API-boundary cleanup, data model cleanup, and dashboard alignment.
- After this PRD, implementation should be split into multiple smaller local tasks: layout shell and dark theme, one-page section layout, ticket/track sections, add-ons and checkout, live summary, local drafts, accessibility polish, and visual QA.

## Testing Decisions

- The primary acceptance seam is the public registration journey, verified as an external user flow.
- A good test verifies user-visible behavior rather than internal component structure.
- The journey should cover loading the public registration page, entering personal data, selecting a pass, selecting a track when required, choosing add-ons, seeing the order summary update without voucher/current-step rows, saving/restoring a local draft, receiving validation nudges, accepting terms at the bottom of the one-page form, and reaching the existing checkout path with preserved payload behavior.
- Visual QA is required across desktop, tablet, and mobile.
- Visual QA is required in dark mode.
- Visual QA should confirm there is no overlapping text, broken sticky/collapsible summary, inaccessible contrast, awkward mobile navigation, clipped controls, or unreadable footer content.
- Accessibility checks should include keyboard-only navigation, visible focus, labeled controls, understandable errors, and reduced-motion behavior.
- Because the current repo does not appear to have an automated test suite, phase 1 should at minimum use build/lint verification plus manual or browser-based journey QA.
- If an automated journey test is introduced, prefer one high-level public registration flow test over many low-level component tests.
- Component tests are not required for phase 1 unless behavior is extracted into new reusable modules.
- Future modernization phases should add deeper automated coverage around extracted pricing, validation, and form-state logic.

## Out of Scope

- Dashboard redesign.
- Backend draft persistence.
- Database schema changes.
- Checkout API changes.
- Pricing-rule changes.
- Ticket capacity-rule changes.
- Updating event dates, registration opening dates, or event-year content.
- Replacing Reakit with Ariakit.
- Upgrading React.
- Upgrading Next.js.
- Full design-system rewrite.
- Admin/internal dashboard alignment.
- Adding broad new UI dependencies.
- Creating the smaller implementation task plan; that comes after PRD approval.

## Further Notes

- The current registration is still closed, and `intern=true` is being used as a temporary way to access the form. This should be documented in implementation notes but not turned into a user-facing design mode.
- The public registration redesign is the first part of a larger modernization path. Once the public form UI is complete, the project should modernize internals and then move to the dashboard.
- The project is using a local-only workflow for now. Do not publish this PRD as a GitHub issue unless the user explicitly changes that decision.
- Before committing this PRD or related setup docs, ask the user for approval.
