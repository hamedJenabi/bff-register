# Participant app invitation

Draft for the near-festival email, reviewed on 29 October 2026. Use a dedicated SendGrid dynamic template configured as `APP_INVITATION_TEMPLATE_ID`. This template is separate from schedule-registration and registration-confirmation emails.

**Subject:** Your Blues Fever weekend is ready

**Body:**

Hey {{firstname}},

Blues Fever is getting close! Your festival app brings together your personal schedule, registration details, and the full program of classes and talks.

Use your personal link to open the app, then tap **Open my weekend**:

{{appAccessUrl}}

You can open it in your phone's browser. Keep this email so you can return to your weekend or open the app on another device. Your link is personal, so please keep it to yourself.

Your confirmed class bookings appear in **My Schedule**. You can explore the festival program in **Full Schedule** and check your pass, lunch, and competition choices in **Profile**.

Questions about your registration or trouble opening the app? Contact us at registration@bluesfever.eu.

See you on the dance floor!

Your BFFs

For an HTML button, use `<a href="{{appAccessUrl}}">Open the festival app</a>`. Preserve the complete URL, including `#token=…`, in both HTML and plain-text versions. The backend disables SendGrid click tracking for these links. Verify the rendered template and intended mail client before a live send.

Available dynamic fields are `firstname`, `lastname`, `appAccessUrl`, and `accessExpiresAt`. The backend selects the stored confirmed participant and generates the link; do not construct URLs using an email address in the template. Enable `APP_INVITATIONS_ENABLED` only with the dedicated template configured. The existing organizer-protected `POST /api/app/admin/invite` sends one participant per request. Near-event timing, any bulk selection, and a live send remain rollout steps.
