# 2026 registration confirmation

SendGrid dynamic template ID: `d-4f77d740ec504650aa9ea1a78e785cae`

**Subject:** Your Blues Fever 2026 registration is confirmed

**Body:**

```handlebars
Hey {{firstname}},

Are you ready to blues with us? Your registration is confirmed. Thank you :)

Your booking:

CLASSES
{{#if classes}}
{{#each classes}}
• {{title}}
  {{day}}, {{start}}–{{end}}
  Teachers: {{teachers}}
  Room: {{room}}
  {{#if role}}Role: {{role}}{{/if}}
{{/each}}
{{else}}
No classes booked.
{{/if}}

COMPETITIONS
{{#if competitions}}
{{#each competitions}}
• {{label}}{{#if role}} — {{role}}{{/if}}
{{/each}}
{{else}}
No competition entries booked.
{{/if}}

LUNCH
{{#if lunch}}
{{#each lunch}}
• {{this}}
{{/each}}
{{else}}
No lunch booked.
{{/if}}

If you have any questions or need to change your booking, contact us at registration@bluesfever.eu.

Stay tuned for more fancy BFF information on our website. We’re very much looking forward to meeting you in Vienna in December 2026!

Dance on,
Your BFFs
```

The backend supplies `firstname`, `classes`, `competitions`, and `lunch` from the confirmed order. Each class includes `title`, `day`, `start`, `end`, `teachers`, `room`, and optional `role`; each competition includes `label` and optional `role`. Empty arrays render the fallback text. Paste the subject and body into this SendGrid dynamic template before live sending. The preview captures the exact recipient and data without contacting SendGrid or rendering its hosted template.
