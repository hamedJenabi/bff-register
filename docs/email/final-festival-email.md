# Final festival email

**Subject**

Your Blues Fever weekend is almost here!

**Preview text**

Open your personal festival app and check your schedule before you arrive.

**Body**

```text
Hey there {{firstname}},

Are you ready to blues with us? Blues Fever is right around the corner, and we can’t wait to see you in Vienna!

YOUR FESTIVAL APP

Open your personal link and tap “Open my weekend” to see your festival registration, your booked classes, and the full program of classes, talks, and parties. Keep this email handy so you can open the app again during the festival. Your link is personal, so please keep it to yourself.

{{appAccessUrl}}

SCHEDULE & VENUES

You’ll also find the latest schedule, party program, and venue information here:
https://www.bluesfever.eu/schedule-venue/

YOUR BOOKING

Ticket: {{ticket}}{{#if level}} · {{level}}{{/if}}

CLASSES
{{#if classes}}
{{#each classes}}
• {{title}}
  {{#if day}}{{day}}, {{start}}–{{end}}{{/if}}
  {{#if teachers}}Teachers: {{teachers}}{{/if}}
  {{#if room}}Room: {{room}}{{/if}}
  {{#if role}}Role: {{role}}{{/if}}
{{/each}}
{{else}}
No classes booked.
{{/if}}

COMPETITIONS
{{#if competitions}}
Competition divisions: {{competitions}}
{{#if open_mixnmatch_role}}Open Mix & Match: {{open_mixnmatch_role}}{{/if}}
{{#if newcomers_mixnmatch_role}}Newcomers Mix & Match: {{newcomers_mixnmatch_role}}{{/if}}
{{#if strictly_role}}Strictly: {{strictly_role}}{{/if}}
{{else}}
Competition: {{competitionAnswer}}
{{/if}}

LUNCH
{{lunch}}

Questions about your booking or trouble opening the app? Write to us at registration@bluesfever.eu.

See you on the dance floor!

Dance on,
Your BFFs
```

In the HTML version, use `<a href="{{appAccessUrl}}">Open my festival app</a>` for the button and keep the full link in the plain-text version. The backend disables SendGrid click tracking. In the controlled send, check that the link still contains its `#token=…` fragment and opens the intended registration.

Update the existing **final email** dynamic template used by **Send Email to All confirmed**. The separate app invitation and schedule registration templates have their own send actions. Booklet, lunch offer, auditions, dress theme, and holiday details from the prior email are omitted pending this year's confirmation.

The final email sends a `classes` array with the same confirmed bookings and published details shown in My Schedule. `competitions` and `lunch` are text fields in this template. The separate registration confirmation email sends those fields as arrays.

Apply the final email delivery migration (`00018`) and confirm the attendee access migration, app origin, signing secret, and expiry before enabling `FINAL_EMAIL_ENABLED=true`. Use **Send final email to selected confirmed participants** with one organizer-controlled registration for the hosted rehearsal. This uses the same template and delivery record as the bulk action. The bulk action skips registrations already accepted by SendGrid and holds uncertain attempts for manual review in SendGrid activity. The registration preview simulates sending without contacting SendGrid.
