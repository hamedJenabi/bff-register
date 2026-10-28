# Blues Fever registration

Next.js Pages Router app using Postgres, Stripe, SendGrid and Reakit. The public pass-purchase flow lives at `/`; confirmed participants use signed `/reg2026` links for class, competition and lunch choices.

## Development

Install dependencies using the committed `yarn.lock`, configure a local `.env`, and run `npm run dev`. Database migrations use Ley (`npm run migrate -- up`); apply them only against the intended database.

## Checks

```sh
npm test
npm run test:integration
npm run lint
npm run build
```

The integration suite needs PostgreSQL `initdb` and `pg_ctl` on PATH. It creates and destroys an isolated cluster, substitutes Stripe/email adapters, and never reads the operational database. `npm run preview:test` starts a disposable browser-QA environment with fictional participants and no live payment/email credentials.

## 2026 implementation

- [Google Sheets schedule source and publishing](docs/prd/google-sheets-schedule.md)

- [Participant app API, personal links, and SendGrid setup](docs/prd/attendee-app-integration.md)

- [Product requirements](docs/prd/reg2026-registration.md)
- [Audit and large-step roadmap](docs/prd/implementation-roadmap.md)
- [Environment, migrations, webhook and launch inputs](docs/prd/reg2026-launch.md)

The new flow is closed by default. Organizer login now requires a configured `ADMIN_SESSION_SECRET` and a server-issued cookie; browser local-storage flags do not authorize access. See the launch guide before enabling registration. The dashboard has a separate bulk invitation for confirmed participants who have not completed their 2026 choices; it uses [its own SendGrid template](docs/email/schedule-registration-invitation.md). Confirmed choices send an automatic [registration confirmation email](docs/email/registration-confirmation.md) after free submission or verified payment. Legacy pass-purchase emails and the existing dashboard email action remain available.
