# 2026 schedule-registration invitation

SendGrid dynamic template ID: `d-e5d1923545f34993b9694b4dbf215172`

The template must use `{{firstname}}`, `{{regi2026link}}`, and `{{#if isPartyPass}}` exactly. The link and `isPartyPass` value are generated from the confirmed participant's stored registration. The backend disables SendGrid click tracking so the signed link is not rewritten.

**Subject:** Choose your Blues Fever 2026 options

**Body:**

Hey {{firstname}},

Now is the time to choose your path at Blues Fever 2026!

{{#if isPartyPass}}
With your Party Pass, you can enter competitions and book lunch on Saturday and Sunday. If you'd like either option, use your personal link below.

You can skip this email if you don't want any of these options.
{{else}}
Use your personal link to register for classes and competitions, and to book lunch on Saturday and Sunday:
{{/if}}

{{regi2026link}}

If you have any questions or need to change your booking, contact us at registration@bluesfever.eu.

Stay tuned for more Blues Fever news on our website. We’re very much looking forward to meeting you in Vienna in December 2026!

Dance on,  
Your BFFs

Paste the subject and body into the SendGrid dynamic template associated with the ID above before live sending. The local preview captures the exact recipient and link but does not render SendGrid's hosted template.
