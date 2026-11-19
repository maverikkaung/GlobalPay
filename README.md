# TechKarvo

TechKarvo is a transferable React/Supabase freelance marketplace for Clients and Freelancers. The repository includes job discovery and applications, profiles/portfolio, a professional social feed, messaging, notifications, contracts/reviews, member safety controls, and an isolated local-only Demo Mode.

**Build-to-sell status:** this is an active software project, not an operating financial business. It does not accept funds or provide real escrow, payouts, crypto exchange, or paid memberships. Wallet and membership behavior is specification/demo-only. See [current readiness](docs/product-readiness.md) and the [buyer transfer guide](docs/buyer-transfer-guide.md).

## Stack

- React 19, Vite 8, React Router 7
- Supabase Auth, Postgres, Storage, and Row Level Security
- Vercel static hosting with SPA rewrites and baseline security headers
- Node.js 22+, npm, ESLint, Node test runner, and Playwright

## Local setup

1. Install Node.js 22 or newer.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and set the URL and **publishable** key for a project you control.
4. Run `npm run dev`.

`VITE_SUPABASE_PUBLISHABLE_KEY` is preferred. `VITE_SUPABASE_ANON_KEY` remains a compatibility alias for existing Vercel configuration. Only a publishable/anon key belongs in browser configuration. The Vite build rejects a modern secret key or legacy `service_role` JWT in those public variables. Never put a database password, Supabase secret key, or provider credential in any `VITE_` variable.

## Quality checks

```text
npm run lint
npm test
npm run build
npm run test:e2e
```

GitHub Actions runs lint, unit tests, build and isolated public/demo browser tests. Its separate PostgreSQL job applies the ordered migrations to a disposable CI database and exercises schema, RLS, and Client/Freelancer workflows. CI does not connect to Supabase staging or production.

## Database and environments

Migrations are numbered `202611150000` through `202611150012`. Fresh databases require the base schema first; do not apply it to a database with existing marketplace tables. **Staging** (`techkarvo-staging`, `ntucgiieksrwebwvcmun`) was set up through migration 011 according to project history. Migration 012 adds the trusted admin/support/catalog foundation; disposable CI and security tests pass, but it has not been applied to staging. The Admin UI is included and remains unavailable until the migration is separately approved and applied. **Production schema and migration state are not to be inferred from staging.** Any future migration requires target/schema review and separate approval before applying to staging; never run the CI fixture against a live project.

RLS is the data authorization boundary; React route guards only control navigation. Review all migrations, storage policies and database tests before buyer deployment. Read [staging verification](docs/staging-verification.md) and [the buyer guide](docs/buyer-transfer-guide.md).

## Deployment and transfer

The staging deployment is `https://techkarvo-staging.vercel.app`, tied to the feature branch. Production is outside this development goal. New owners must use their own GitHub, Supabase, Vercel, domain, support, and payment-provider accounts and rotate all project credentials during transfer. Follow the buyer guide; no domain, hosting upgrade, paid API, provider, or subscription is required for the $0 demo/software build.
