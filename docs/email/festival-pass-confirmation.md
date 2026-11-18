# Festival pass payment confirmation

SendGrid dynamic template ID: `d-9a1d3b06c6fb43f69a1ee68b940ebe35`

Used after a new paid festival registration and when an organizer sends a pass confirmation from the dashboard. This is separate from the confirmation of saved class, competition, and lunch choices.

The backend supplies the existing booking fields plus `regi2026link` (the signed personal `/reg2026` URL) and `isPartyPass` (a boolean derived from the participant's ticket). It uses the same link builder as the schedule invitation and disables SendGrid click tracking to preserve the signed URL. `REG2026_ORIGIN` must be the public HTTPS registration origin in production, and `REG2026_SIGNING_SECRET` must match the schedule registration service.

Insert this block after the booking details and before the contact paragraph. The outer condition keeps the block hidden for older senders until the backend change is deployed.

```handlebars
{{#if regi2026link}}
{{#if isPartyPass}}
With your Party Pass, you can enter competitions and book lunch on Saturday and Sunday. If you'd like either option, use your personal link below.

You can skip this email if you don't want any of these options.
{{else}}
Use your personal link to register for classes and competitions, and to book lunch on Saturday and Sunday. Note that although we have many class options to choose from, the classes have limited spots and are first come first served :)
{{/if}}

Your personal Link: {{regi2026link}}
{{/if}}
```

In the HTML version, render the last line as `<a href="{{regi2026link}}">Your personal Link</a>`. Preserve the rest of the existing template.
