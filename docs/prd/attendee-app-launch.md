# Attendee app launch and class-door verification

The personal-link journey, bulk final email, full program, and class-door scanner are implemented locally. Hosted rollout and a rehearsal on real phones remain launch checks.

## Problem Statement

Confirmed participants need one final festival email that opens their own weekend on a phone. The app needs to show their confirmed class bookings, the full class and talk program, and the full party program. At a class door, authorized staff need to know whether the person presenting a festival QR is eligible for that specific class session.

The **Send Email to All confirmed** action supplies a unique `appAccessUrl` to the existing final email template. The app displays a participant QR and offers an authenticated scanner in Festival Admin. Full Schedule includes the parties published on the festival website. [Official party schedule](https://www.bluesfever.eu/schedule-venue/#bff-party-schedule)

## Solution

Use the existing bulk final email action as the organizer's entry point. Send one personalized final email per confirmed festival registration, with a personal button that opens the attendee app. Keep the existing **Open my weekend** step. Inside Full Schedule, provide separate **Classes & talks** and **Parties** views. Give authorized door staff an online scanner scoped to a selected class session. If scanning is unavailable, a designated organizer checks the class roster and decides admission.

## User Stories

1. As an organizer, I want to review the confirmed audience before sending the final email, so that I can verify the scope of the send.
2. As an organizer, I want to preview the real email with a controlled test recipient, so that I can verify the link before sending to the festival audience.
3. As an organizer, I want per-recipient send results and safe retries, so that I can resume a partial send without emailing successful recipients again.
4. As a confirmed participant, I want a personal link that opens my own festival registration on my phone, so that I can see my weekend without creating a password.
5. As a participant, I want My Schedule to show my confirmed bookings and dance roles, so that I know which classes to attend.
6. As a participant, I want to browse all published classes and talks with current rooms and times, so that I can plan the weekend.
7. As a Party Pass participant, I want the same party program as other participants, so that I can plan which venues and floors to visit.
8. As a participant, I want after-midnight program entries to appear under the corresponding party night, so that I arrive on the intended evening.
9. As a participant, I want one QR that I can show at any class door, so that I can bring up my credential quickly.
10. As authorized door staff, I want to select a class session by title, time, and room, so that each scan answers the question for the correct door.
11. As authorized door staff, I want clear results for eligible, ineligible, invalid QR, and verification unavailable, so that I can distinguish an admission decision from a technical failure.
12. As the designated organizer, I want an available class roster to consult when scanning fails, so that I can make the door decision while connectivity is restored.
13. As an organizer, I want to manage the Cuttin’ roster separately, so that its door check follows the approved roster for that session.

## Implementation Decisions

- Keep one organizer-triggered final email for all confirmed festival registrations, including Full, Parent, and Party passes. Recheck status and resolve the recipient from the stored registration at send time. Preserve one credential per registration when multiple participants share an email address.
- Recommended link format: reuse the existing app credential and claim contract. Put the participant's name in the email and use the stored email as the delivery address. Generate `https://app.bluesfever.eu/claim#token=…` on the server and resolve the participant from that credential. Disable SendGrid click tracking for the personal link.
- Update the final-email template and bulk action together. Require organizer authorization, confirmation of the audience, and visible progress. Adapt the existing tracked invitation pattern with delivery state specific to the final email. Distinguish provider acceptance, failed attempts, and uncertain outcomes. Review uncertain outcomes before retrying. Keep schedule-registration invitations separate.
- Use `bff-register` as the app's source for the published class catalog and current participant bookings. Continue publishing the reviewed `APP_SCHEDULE` snapshot through registration. Use the public website's published schedule as the authority for the party program, including when it differs from the team sheet. Represent the party program separately from class bookings, with party nights, venues or floors, times, and program details. Preserve the website's after-midnight grouping and show a link to the official program for reference.
- Add an organizer-authorized scanner that submits the personal QR and a stable class-session ID to `bff-register`. Validate the QR's purpose, expiry, revocation, and linked confirmed festival registration on the server. Use current confirmed bookings for ordinary classes and reuse the existing eligibility policy for legacy saved classes so that My Schedule and the door agree. Treat open talks as open to all passes without a class booking check.
- Give Cuttin’ its own organizer-managed roster and use that roster for verification. Confirm who maintains it and how it is available at the door during rehearsal. Scope the scan response to the selected session and the minimum information staff need.
- On camera or connectivity failure, show that verification is unavailable and direct staff to the designated organizer. The organizer checks the class roster and makes the admission decision. Rehearse how the organizer accesses that roster during an outage.

## Testing Decisions

- Extend the existing isolated PostgreSQL and captured SendGrid integration tests. Verify that bulk sends select only confirmed registrations, deliver the correct personal link to each recipient, report partial failures, and resume without duplicate acceptance. Verify staff authorization, exact-session matching, confirmed and provisional bookings, legacy eligibility, expired or revoked QR credentials, and the Cuttin’ roster exception.
- Extend the existing browser journey from captured final email through sign-in, My Schedule, Full Schedule, and QR display. Include a Party Pass, a night spanning midnight, and a separate staff session that exercises scanner results and the unavailable state. Verify that the app shows the published website's party program when it differs from the team sheet.
- Rehearse on the hosted HTTPS origins before the bulk send. Use one organizer-controlled mailbox and real phones to verify email rendering and the complete token fragment, the correct participant's bookings, the reviewed class publication and party program, an eligible and an ineligible door scan, and the organizer roster fallback with connectivity disabled.

## Out of Scope

- Attendance logging, duplicate-entry enforcement, party-door admission, and offline QR authorization.
- Changes to participant class booking, checkout, or payment workflows.
- Sending the live campaign as part of this readiness review.

## Further Notes

Before approving the bulk send, verify the hosted app-to-registration connection, database migrations, signing configuration, link expiry through the festival, active SendGrid template, and approved published schedule. Complete the controlled email and class-door rehearsal.

Apply migration `00019` to create the empty Cuttin’ roster. In the app’s `/bff-admin`, open **Class door scanner**, select Cuttin’, and use **Manage Cuttin’ roster** to add the approved confirmed registrations. There is no automatic import from Solo Battle. Before doors open, the designated organizer downloads each relevant roster and makes it available on a device or on paper. The export records when it was generated. During an outage the organizer uses that copy and checks any booking changes since export.
