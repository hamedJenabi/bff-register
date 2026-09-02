# PRD: Static Main Page

Workflow metadata:

- Local-only workflow: do not create a GitHub issue for this PRD.
- Commit workflow: ask the user for approval before staging or committing changes.
- Source pages: Blues Fever homepage, passes and levels, schedule and venues, teachers, musicians, scholarship, and code of conduct pages as available on September 2, 2026.

## Problem Statement

The current Blues Fever public homepage on the main domain contains useful festival information, but it still feels like an older WordPress page. The user wants a modern, informative homepage with less text that can be built in the existing registration repo and previewed at `register.bluesfever.eu/main-page` before becoming the main `bluesfever.eu` homepage.

The page should support SEO by eventually being served directly on `bluesfever.eu`, not by redirecting users or search engines to the registration subdomain.

## Solution

Build a static React/Next.js page in the existing Next.js Pages Router app at `/main-page`. The page will use the dark burgundy, cream, rose, and soft panel treatment already introduced in the registration experience, while taking layout inspiration from `dailyperksclub.com`: bold blocks, strong first viewport, short copy, direct calls to action, and compact sections.

The page will reuse public Blues Fever content and imagery from the WordPress site, but compress the copy into a more scannable structure. The page will be static and will not depend on registration APIs, server-side props, database access, or checkout state.

## User Stories

1. As a festival visitor, I want the homepage to immediately communicate Blues Fever Festival, Vienna, and the 10-13 December 2026 dates, so that I know I am in the right place.
2. As a prospective attendee, I want a short summary of the weekend, so that I understand the mix of social dancing, classes, panel talks, competitions, and live music.
3. As a prospective attendee, I want prominent registration links, so that I can quickly move from interest to action.
4. As a prospective attendee, I want the page to use real Blues Fever pictures, so that the festival feels tangible and trustworthy.
5. As a returning attendee, I want the page to feel more modern than the old WordPress homepage, so that the festival brand feels current.
6. As a mobile visitor, I want the page to be easy to scan without long paragraphs, so that I can decide whether to register quickly.
7. As a desktop visitor, I want a visually rich page with useful sections, so that it feels like a polished festival homepage rather than a plain registration form.
8. As a dancer comparing options, I want the pass types summarized, so that I understand Full Pass, Party Pass, and Parent Pass at a glance.
9. As a dancer choosing classes, I want the choose-your-own-path model explained briefly, so that I understand the class structure without reading the full schedule page.
10. As a music-focused visitor, I want the page to mention live bands and parties, so that I understand the weekend is not only classes.
11. As a competition-minded dancer, I want competitions represented briefly, so that I know they are part of the festival.
12. As a visitor planning travel, I want the page to identify the main venues and Vienna context, so that I know where the festival happens.
13. As a scholarship applicant or donor, I want the page to surface care, code of conduct, and scholarship values, so that accessibility and community expectations are visible.
14. As an organizer, I want the page to link to existing WordPress detail pages, so that long-form information can remain there for now.
15. As an organizer, I want the page to be static, so that it can later be exported and uploaded to World4You with less hosting risk.
16. As an organizer, I want the registration app to remain untouched, so that the current checkout flow is not disrupted.
17. As a maintainer, I want the homepage implemented as a separate route and stylesheet, so that it is easy to revise without affecting registration/admin pages.
18. As a maintainer, I want no new runtime dependencies for the first version, so that the static page stays simple.
19. As a maintainer, I want SEO metadata included, so that the eventual main-domain homepage has a strong title, description, canonical URL, and social preview image.
20. As a future implementation agent, I want deployment notes captured, so that the page can later be exported or moved to the main domain deliberately.

## Implementation Decisions

- Add a new static route for the homepage preview.
- Keep the existing registration route and API-backed pages unchanged.
- Use the existing Next.js Pages Router instead of adding the App Router.
- Use a CSS module dedicated to the homepage so the visual refresh does not leak into registration, admin, or status pages.
- Reuse the registration experience palette: deep burgundy background, cream text, muted rose copy, rose accents, and dark panels.
- Add a few warmer and cooler supporting colors so the page does not read as a single-hue design.
- Use public Blues Fever WordPress image URLs for the first version instead of copying assets into the repo.
- Use short, editorial sections rather than the longer WordPress copy.
- Use the public homepage's bold, block-based visual reference as inspiration: strong first viewport, large section headlines, numbered rows, crisp dividers, and direct calls to action.
- Fade the hero image into the burgundy background on desktop so the visual feels integrated rather than boxed.
- Make "All you need to know" the second section after the hero, covering passes, schedule, teachers, musicians, and venue links.
- Make "Pick your own path" the third section, focused only on the class-choice model and weekend flow.
- Feature four named public Blues Fever people images: Dexter Santos, Catherine Palmier, Jontavious Willis, and Janice Harrington.
- Remove the standalone venue section because venue information is represented inside "All you need to know."
- Override the global link hover underline inside the static homepage so interactions stay closer to the block-style reference.
- Use the user's supplied Blues Fever photos as the hero imagery instead of the WordPress artwork.
- Build the hero image area as a rotating slider that changes every 4 seconds and provides dot controls.
- Reduce heading size and weight so the page feels less heavy while keeping a modern editorial rhythm.
- Bring over the main Blues Fever menu structure, including grouped Festival Infos, Competitions, Travel Infos, About BFF, Scholarship, and Previous BFFs navigation.
- Use the Blues in Vienna menu as a navigation reference: simple brand text, calm light surface, compact menu items, and a clear registration action.
- Make the mobile navigation a burger menu instead of a horizontally scrolling menu.
- Make the "One weekend. Five essentials." options visually behave as clickable cards.
- Use Lato as the homepage typeface, with Open Sans as fallback.
- Expand the lineup area with a larger teacher set and narrower portrait-style image tiles.
- Use direct links to existing pages for details: passes and levels, schedule and venues, teachers, musicians, scholarship, code of conduct, and registration.
- Include canonical metadata for the future main-domain URL, while keeping the route previewable on the registration subdomain.
- Avoid fade-in text effects.
- Avoid adding a new homepage app or export workflow in this implementation slice; the route will be prepared so a later static export/deployment slice can package it for World4You.
- Do not change WordPress hosting, DNS, or World4You configuration in this implementation slice.

## Testing Decisions

- The primary acceptance seam is the public static homepage route as a visitor sees it.
- A good test verifies that `/main-page` renders without server-side data, shows the expected festival content, contains working navigation and registration/detail links, and remains independent from the registration checkout route.
- Build verification is required because this repo currently relies on the Next.js build as the practical safety check.
- Visual QA should cover desktop and mobile widths and check that the first viewport, image grid, CTA areas, and short-copy sections do not overlap or clip.
- Hero slider QA should verify that all five supplied images are reachable from public assets, the slide changes every 4 seconds, and dot buttons change the active image.
- Menu QA should verify that desktop grouped menus open on hover/focus and that mobile navigation remains reachable without overlapping the hero.
- Teacher image QA should verify that the expanded narrow-tile lineup remains scannable on desktop and stacks cleanly on mobile.
- SEO QA should verify the title, description, canonical URL, Open Graph image, and main heading.
- Accessibility QA should verify landmark structure, meaningful link labels, readable contrast, visible focus states, and reduced-motion compatibility.
- No database, checkout, Stripe, SendGrid, or admin testing is needed for this static route.

## Out of Scope

- Replacing the current `bluesfever.eu` WordPress homepage in production.
- Configuring World4You hosting.
- Creating a reverse proxy from `bluesfever.eu` to `register.bluesfever.eu`.
- Building a separate static export app.
- Downloading and optimizing every Blues Fever image into the repo.
- Changing registration form behavior.
- Changing registration API routes.
- Changing pass prices, dates, capacities, or checkout rules.
- Rewriting long-form WordPress detail pages.
- Adding animation-heavy effects or fade-in text.

## Further Notes

- The intended deployment direction remains: use this repo as the source of the new homepage, then eventually serve the built static homepage directly from `bluesfever.eu` for SEO rather than relying on a redirect.
- `register.bluesfever.eu/main-page` should be treated as a preview/staging route until the production domain setup is decided.
- If the preview route is publicly indexable before the main-domain launch, add a noindex rule or canonicalize it carefully to avoid duplicate-indexing risk.
