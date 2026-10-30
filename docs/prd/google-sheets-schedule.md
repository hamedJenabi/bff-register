# Google Sheets schedule

Google Sheets is the authoritative source for the published 2026 schedule. The app reads an atomic, versioned PostgreSQL snapshot, so participant registration and payment never depend on a live Google request. An organizer uses **Dashboard → Schedule → Sync schedule** to validate and publish changes. The dashboard can also edit a selected class's capacity by writing it back to Google Sheets before publishing. Invalid imports and Google failures retain the last successful publication.

## Workbook and first review

Workbook: https://docs.google.com/spreadsheets/d/1AeFOWygI0ZCkolOuxk8uikQY5ZCmVXgeqr_qDgqdzR8/edit

The app reads only `APP_SCHEDULE`. Existing occurrences now use live formulas: edit `CLASSES SCHEDULE` for day, start/end times, room, title, teachers and levels; edit the matched `CLASS DESCRIPTIONS` row's description (G) or **Solo, partner or Talk** (J) for description and format changes. These edits recalculate `APP_SCHEDULE` automatically. An organizer still uses **Dashboard → Schedule → Sync schedule** to validate and publish them to the app. Uppercase formats and surrounding whitespace normalize to `solo`, `partner` or `talk`.

Keep timetable entries in the form `Title (Teachers) (Levels)`; levels may also be unparenthesized or omitted. Time slots use `HH:mm - HH:mm`. Blank descriptions and descriptions marked “Not needed” produce empty app descriptions. Dates, permanent session IDs, capacity cells and bookability remain managed in `APP_SCHEDULE`; capacities can also be changed in the Schedule dashboard. Direct edits to a derived cell replace its live formula.

The formulas cover the 52 mapped occurrences and their explicitly matched description rows. Adding, removing, moving or replacing a class requires reviewing those mappings and preserving the permanent ID of the original occurrence; a copied class must not inherit another class's ID or description mapping. New occurrences need a new permanent ID and reviewed formulas, capacities and bookability before publication.

The initial tab contains 52 occurrences from the current timetable, with 51 bookable occurrences. Cuttin' stays visible in the full catalog but is not selectable through self-service. Descriptions were matched explicitly to their corresponding source rows. Source descriptions marked “Not needed” and missing descriptions remain blank; internal notes are not published. Timetable titles and informational levels are preserved even when the description tab differs. Source cell references are stored as cell notes for review.

Class formats now come from the user's supplied `CLASS DESCRIPTIONS` column J: 37 partner sessions, 13 solo sessions and 2 talks. Partner classes now use **40 total places** as a testing placeholder, shared by **Lead, Follow and Switch**. Follow closes at 20 followers; Lead and Switch remain available until the total reaches 40. Switch counts as one person toward the total and does not consume a Follow place. Selecting Switch opens a popup explaining that the participant is happy to lead or follow to help keep the class balanced. Solo classes retain **30 total places**. **Talks are open with no capacity limit** and keep all capacity cells blank. Dates are optional: leave all dates blank or fill all rows for one Friday–Sunday weekend.

Existing partner rows with reviewed `lead_capacity` and `follow_capacity` values and a blank `total_capacity` normalize to 40 total; their old role allocations no longer set booking limits. Existing published snapshots normalize the same way, preserving sync and capacity editing without rewriting the source workbook. Saving a partner capacity in the dashboard writes `total_capacity` and clears its legacy role columns. New partner rows should use `total_capacity` and leave both role columns blank.

Participant schedule cards and class-dialog role choices do not display capacity or remaining-place counts. Full classes/roles remain unavailable, and server-side capacity checks still apply. Organizers can view capacity details in the dashboard.

### Open production task

- [ ] **Make capacities production-ready before launch.** Confirm actual total room/session capacities with organizers; replace the testing placeholder formulas/values in `APP_SCHEDULE`; sync the reviewed catalog and verify remaining availability. Followers are limited to half the total, rounded down. These test defaults are not production-approved. Talks remain unlimited unless organizers explicitly change the policy. A successful test publication does not complete this task.

## Columns

Keep these exact header names; columns can be reordered. Each nonblank row represents one occurrence.

| Column | Meaning |
| --- | --- |
| `session_id` | Permanent unique ID, lowercase letters/digits/hyphens/underscores, maximum 120 characters. Never reuse or rename an ID after publication. Initial IDs may describe their original time/room, but stay unchanged when metadata changes. |
| `day` | Friday, Saturday or Sunday. |
| `date` | Optional ISO `YYYY-MM-DD`; all dates must describe one weekend and match their weekday. |
| `start`, `end` | Text `HH:mm`, with end after start. |
| `room` | Room name, or TBA while unassigned. |
| `title`, `teachers` | Required participant-facing text, up to 200 characters. |
| `description` | Optional participant-facing text, up to 6000 characters. |
| `levels` | Informational text, up to 200 characters. It does not restrict eligibility. |
| `format` | `solo`, `partner` or `talk`, linked to the matching source cell in `CLASS DESCRIPTIONS` column J. Edit the source cell to update an existing occurrence. For new occurrences, add a reviewed value or explicit source formula. |
| `lead_capacity`, `follow_capacity` | Legacy partner columns retained for compatibility. When both contain reviewed whole numbers 0–1000 and total capacity is blank, the partner class uses the 40-place placeholder. Leave these columns blank when specifying total capacity. |
| `total_capacity` | Whole number 0–1000 for partner or solo classes. Partner placeholder: 40; at most half the total may register as Follow. Leave lead/follow capacities blank. Talks must leave all three capacity fields blank and are unlimited. |
| `bookable` | TRUE or FALSE. FALSE keeps the occurrence in the full catalog but prevents new self-service selections. |

The sync accepts at most 500 sessions in a tab no larger than 2000 rows and 52 columns. It reads the whole bounded tab, so stray rows or unknown columns cannot silently disappear from an import. Duplicate IDs, spreadsheet errors, malformed values, overlapping assigned rooms, and incomplete booking rules prevent publication. TBA rooms are not treated as a single physical room. Participant selections reject overlapping time intervals even if start times differ.

## Server configuration

Apply migrations through `00015-reg2026-switch-role.js` using the existing Ley workflow before deploying the code. Migration 15 permits Switch booking rows without changing existing participant, booking or payment records.

| Variable | Meaning |
| --- | --- |
| `REG2026_SCHEDULE_SHEET_ID` | Workbook ID above; this enables Sheets authority before the first publication. |
| `REG2026_SCHEDULE_SHEET_NAME` | Defaults to `APP_SCHEDULE`. |
| `REG2026_SCHEDULE_SHEET_GID` | Optional numeric tab ID for the dashboard's direct edit link. The current APP_SCHEDULE tab is `1052702601`. |
| `REG2026_GOOGLE_CLIENT_EMAIL` | Service-account email. Viewer access permits sync; Editor access is required for dashboard capacity saves. |
| `REG2026_GOOGLE_PRIVATE_KEY` | Server-only service-account PEM private key. Literal `\n` escapes are supported. |

The existing `REACT_APP_GOOGLE_CLIENT_EMAIL` and `REACT_APP_GOOGLE_SERVICE_PRIVATE_KEY` configuration is supported as a migration fallback. These values are read only on the server; do not use `NEXT_PUBLIC_` variables or commit secrets. Normal sync requests use `spreadsheets.readonly`; dashboard capacity writes request a separate `spreadsheets` token. Tokens are cached separately by scope. Reads and writes have bounded requests and timeouts. The dedicated source workbook does not need public sharing.

When Sheets is configured but no reviewed schedule has been published, participant schedule requests fail closed with an organizer-contact message. The Schedule dashboard remains usable and reports the cells preventing publication. Once published, the last snapshot remains authoritative even if configuration is later removed; it never falls back to mock classes or local overrides. Unconfigured disposable previews retain their fictional mock catalog and legacy editing workflow.

## Publication and booking protection

### Dashboard capacity editing

After the first publication, select a class at `/dashboard/schedule`. Partner and solo classes expose Total capacity, accepting whole numbers from 0 to 1000. The partner follower limit is derived as half the total, rounded down. Talks stay open with no capacity editor. **Save capacity** writes only that class's three capacity cells to Google Sheets, verifies the result, and publishes the new capacity. Existing bookings are preserved even when the new limit is lower than the occupied count. Participant-facing capacity counts remain hidden.

Saving requires the current published version and a Sheet matching the last publication. If Google Sheets contains any unsynced edits, sync them first; a capacity save will not publish those edits silently. Stale dashboard saves are rejected. The source row and capacity columns are found by permanent session ID and header names, so reordered rows/columns remain supported. Manual dashboard values replace the selected row's capacity formulas, with unused pools cleared; after a later class-format change, review that row's capacity fields before syncing.

Capacity saves serialize with catalog publication and booking writes. Participant submissions and organizer class edits also serialize their availability check and reservation, so simultaneous requests cannot both claim the last total or follower place. Active provisional holds count toward both limits; expired holds do not. If Google rejects a write, the published snapshot remains unchanged. If Google saves successfully but readback or publication fails, the Sheet may contain an unpublished capacity edit; review and sync rather than blindly retrying. Avoid concurrent direct Sheet edits during a dashboard save. The production-capacity review task above remains open regardless of test saves.

Live setup: the user approved Editor access for `vsb-register@vsb-register.iam.gserviceaccount.com` on the schedule workbook. The permission is granted and verified with a write request that changed no cells. Ordinary sync continues to use a read-only token; dashboard capacity saves use the separate write scope.

Only authenticated organizers can sync. The browser sends its current publication version, and a stale request is rejected before Google is read and again inside the publishing transaction. Identical normalized content reuses the existing publication. Metadata records source workbook/tab, content hash, publication time and session count. The API never returns credentials or raw Google error bodies.

Publishing uses the same advisory lock as booking writers and stores the whole catalog in one transaction. Session IDs referenced by saved selections, booking rows, or any historical order cannot be removed. Their day, times, known date and partner-class flag are protected. A complete festival weekend may populate previously blank dates once, even after booking; known dates cannot be moved or cleared for referenced sessions. Title, description, teachers, room, levels and capacities can be corrected. Reducing capacity preserves existing places and clamps new availability to zero. Non-bookable sessions remain present for existing attendees. Never reuse an existing ID for a different class.

The published catalog supplies participant registration, capacity accounting, server validation, organizer class details, and attendee-app snapshots. Published calendar dates also supply the attendee app's festival dates; blank dates remain unknown rather than being replaced by an unrelated date setting. Legacy catalogs still support `APP_FESTIVAL_START_DATE`.

## Verification

Run `npm test`, `npm run test:integration`, `npm run lint`, and `npm run build`. Integration tests create and destroy a separate PostgreSQL cluster. They cover source authority, idempotency, stale imports, booking/dependency protection, failed publication rollback, finite capacities and unlimited talks. Adapter tests substitute Google responses and verify read-only authentication, bounds, errors and authorization without calling Google. Live readback of `APP_SCHEDULE` verifies linked timetable details, descriptions, formats and the testing placeholders without publishing automatically.

On 29 October 2026, live formulas were installed for the eight derived timetable/description columns of all 52 existing occurrences. Readback found no formula errors, preserved IDs, dates, formats, capacities and bookability, and passed `parseScheduleRows` from this repository. The resulting catalog contained 37 partner classes, 13 solo classes and 2 talks. Publication remains an explicit dashboard action.
