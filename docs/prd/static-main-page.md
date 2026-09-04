# PRD: Static Main Page

Workflow metadata:

- Local-only workflow: do not create a GitHub issue for this PRD.
- Commit workflow: ask the user for approval before staging or committing changes.
- Source pages: Blues Fever homepage, passes and levels, schedule and venues, teachers, musicians, scholarship, and code of conduct pages as available on September 2-4, 2026.

## Problem Statement

The current Blues Fever public homepage on the main domain contains useful festival information, but it still feels like an older WordPress page. The user wants a modern, informative homepage with less text that can be built in the existing registration repo and previewed at `register.bluesfever.eu/main-page` before becoming the main `bluesfever.eu` homepage.

The page should support SEO by eventually being served directly on `bluesfever.eu`, not by redirecting users or search engines to the registration subdomain.

## Solution

Build a static React/Next.js page in the existing Next.js Pages Router app at `/main-page`. The page will use the dark burgundy, cream, rose, and soft panel treatment already introduced in the registration experience, while taking layout inspiration from `dailyperksclub.com`: bold blocks, strong first viewport, short copy, direct calls to action, and compact sections.

The page will reuse public Blues Fever content and imagery from the WordPress site, but compress the copy into a more scannable structure. The page will be static and will not depend on registration APIs, server-side props, database access, or checkout state.

## Current Status

The first implementation slice has been built in the existing registration repo and is previewable as a static Next.js page at `/main-page`. The implementation is still a preview/staging page; production replacement of the WordPress homepage and World4You configuration remain future work.

Completed so far:

- Created a dedicated static homepage route in the existing Next.js Pages Router app.
- Created a dedicated homepage stylesheet so the redesign does not leak into registration, admin, or checkout pages.
- Added a modern hero with the user's supplied Blues Fever event photos as a rotating image slider.
- Added slider dots and a four-second automatic slide interval, with reduced-motion handling.
- Faded the hero image into the burgundy background on desktop.
- Reduced the heading size and weight after the initial version felt too large and heavy.
- Added Lato as the homepage font with Open Sans as fallback.
- Added a light, compact navigation bar based on the Blues in Vienna menu direction.
- Brought over the main Blues Fever menu structure: Home, Scholarship, Previous BFFs, Festival Infos, Competitions, Travel Infos, and About BFF.
- Built desktop grouped dropdown menus for the main menu categories.
- Built a mobile burger menu that slides in from the right.
- Added mobile submenu screens that open on tap and include a back control.
- Raised the mobile drawer and scrim stacking order so the open menu sits above hero images, lineup images, and all page content.
- Reworked "All you need to know" into the second section with five clickable cards: Passes, Schedule, Teachers, Musicians, and Venue.
- Removed visible numbers from the "All you need to know" cards.
- Moved "Pick your own path" into the third section and kept it focused on the class-choice model.
- Removed the separate venue section because venue information now lives in "All you need to know."
- Removed the homepage hover underline behavior and replaced it with smoother block-style hover states.
- Added smooth ease-in-out movement for hover states, menu transitions, cards, dots, drawer, and scrim.
- Reworked the teacher and musician area into a narrow cinematic strip inspired by the user's screenshot.
- Added more teacher and musician entries from Blues Fever's public WordPress pages.
- Added Stef Rosen to the source lineup data.
- Changed the visual strip to randomly choose six people on desktop and four on mobile on each page load.
- Limited the random face strip to face-friendly source images after visual QA showed that some public assets are posters, album art, or distant room shots that do not crop well.
- Adjusted lineup image crop focus upward with `object-position` so narrow crops favor faces rather than torsos or empty backgrounds.
- Kept the registration application and API-backed pages untouched.
- Kept the page static so it remains suitable for a later static export or main-domain deployment slice.

Known implementation caveats:

- The current public Blues Fever image for Stef Rosen appears to be album-art/poster-style imagery rather than a usable portrait. Stef Rosen remains represented in the source lineup data, but is excluded from the random face strip until a better face-forward image is available.
- Some public teacher images are action or context shots rather than true portraits. The current random strip excludes the most problematic assets for the narrow face-crop treatment.
- The active local preview server with the latest code was started at `http://localhost:3002/main-page` because an older/stale server was still occupying port `3001`.

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
21. As a mobile visitor, I want the menu to slide in clearly above the page, so that navigation does not feel broken or hidden behind content.
22. As a mobile visitor, I want submenu categories to open by tap with a clear way back, so that the full menu remains usable on a small screen.
23. As a visitor scanning the lineup, I want the strip to show a small set of face-forward people, so that it feels cinematic rather than like a long directory.
24. As a visitor on mobile, I want the lineup strip to stay compact, so that I can reach the next section without scrolling past many stacked portraits.
25. As an organizer, I want the visible lineup to vary on refresh, so that more teachers and musicians can be represented without overcrowding the homepage.
26. As an organizer, I want non-face-friendly assets kept out of the narrow strip, so that weak crops do not make the homepage feel unfinished.
27. As a maintainer, I want design and QA decisions documented as the page evolves, so that future edits do not reintroduce already-solved layout problems.

## Implementation Decisions

- Add a new static route for the homepage preview.
- Keep the existing registration route and API-backed pages unchanged.
- Use the existing Next.js Pages Router instead of adding the App Router.
- Use a CSS module dedicated to the homepage so the visual refresh does not leak into registration, admin, or status pages.
- Reuse the registration experience palette: deep burgundy background, cream text, muted rose copy, rose accents, and dark panels.
- Add a few warmer and cooler supporting colors so the page does not read as a single-hue design.
- Use public Blues Fever WordPress image URLs for the first version instead of copying assets into the repo.
- Use short, editorial sections rather than the longer WordPress copy.
- Use the public homepage's bold, block-based visual reference as inspiration: strong first viewport, large section headlines, compact blocks, crisp dividers, and direct calls to action.
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
- Make the burger menu slide in from the right, with click-to-open submenu screens and a back control.
- Keep the mobile drawer and its scrim above all page content while open.
- Make the "One weekend. Five essentials." options visually behave as clickable cards.
- Remove visible numbering from the "All you need to know" cards so the cards read as direct topics.
- Use Lato as the homepage typeface, with Open Sans as fallback.
- Expand the lineup area with a larger teacher and musician set, including Stef Rosen, and display it as a narrow cinematic cast strip.
- Randomly choose a smaller visible lineup on each page load: six people on desktop-sized screens and four people on mobile-sized screens.
- Draw the random strip from face-friendly lineup assets only; poster art, distant room shots, and images that cannot crop to a visible face should stay out of the strip until a better source image is available.
- Keep Stef Rosen in the broader lineup data, but exclude the currently available Stef image from the random face strip because the source image is not portrait-friendly.
- Keep the lineup compact on mobile by preserving the narrow side-by-side strip instead of stacking every person vertically.
- Make hover and menu movements smooth with ease-in-out timing.
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
- Mobile menu QA should verify that the right-side drawer and scrim sit above the hero, lineup images, and later page sections.
- Teacher image QA should verify that the random narrow-tile lineup shows six people on desktop and four on mobile, keeps faces visible in the crop, remains scannable, and stays compact without forcing a long vertical scroll.
- Face-crop QA should include checking the actual source images, not only CSS rules, because some public WordPress images contain large blank margins, poster art, or distant subjects.
- If an image cannot reliably show a face in the narrow strip, the acceptance behavior is to remove it from the random face-strip pool until a better source image is available.
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
- The project issue-tracker workflow is local docs only. No GitHub Issue was created; this PRD is the authoritative local artifact unless the workflow changes.
- The latest build verification passed with `/main-page` emitted as a static page. The build still reports unrelated existing warnings about `levelsToShow` imports in admin/API files.
