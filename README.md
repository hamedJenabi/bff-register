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

- [Product requirements](docs/prd/reg2026-registration.md)
- [Audit and large-step roadmap](docs/prd/implementation-roadmap.md)
- [Environment, migrations, webhook, templates and launch inputs](docs/prd/reg2026-launch.md)

The new flow is closed by default. Organizer login now requires a configured `ADMIN_SESSION_SECRET` and a server-issued cookie; browser local-storage flags do not authorize access. See the launch guide before enabling registration or sending invitations.
