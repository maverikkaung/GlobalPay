# TechKarvo buyer transfer and deployment guide

This guide describes handing the software to a new owner. It does not grant the buyer access to the current owner's accounts or authorize real financial activity. Replace all project references, test data, URLs and credentials with buyer-owned values during transfer.

## What is included today

- React/Vite source, marketplace and social workflows, Supabase migrations/RLS tests, Demo Mode, Playwright tests, CI, deployment rewrite/security headers, and technical plans.
- Staging-only project history is for development verification, not a production database template containing transferable customer data.
- The $0 product has no paid services or active money movement. No domain, Vercel upgrade, provider/API subscription, or real crypto integration is required to run locally or use the demo.

## Buyer-owned accounts required for deployment

1. GitHub organization/repository with the buyer as owner and branch protection/CI settings under buyer control.
2. A fresh Supabase organization/project, buyer-controlled Auth email provider, database, storage buckets and backups.
3. A Vercel project in a buyer-owned team. Import only the intended branch; set its deployment branch before connecting production traffic.
4. A buyer-owned domain only if desired; purchase is optional and outside this $0 build.
5. A password manager/secrets manager and at least two buyer-controlled test inboxes.
6. A payment provider only if later required. Begin with sandbox credentials. Real provider accounts and integrations are intentionally absent.

## Local setup

1. Install Node.js 22 or newer and Git.
2. Clone the buyer-owned repository and check out the selected release branch/tag.
3. Run `npm ci`.
4. Copy `.env.example` to `.env` and set a buyer-owned Supabase URL and public publishable key. Never use a secret/service-role key in a `VITE_` variable.
5. Run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
6. Run only the local Vite app and Demo Mode until a staging schema is reviewed and approved.

The app accepts `VITE_SUPABASE_PUBLISHABLE_KEY`. `VITE_SUPABASE_ANON_KEY` remains a compatibility alias for existing deployment configuration. The build rejects known modern secret and legacy service-role keys in these public variables. Rejection is a safety net, not permission to put secrets into browser builds.

## Supabase setup and migration controls

- Create separate buyer-owned development, staging, and production projects. Never reuse the seller's project or credentials.
- Migrations `202611150000`–`202611150011` form the current marketplace schema sequence. Review the SQL, RLS, triggers, grants, storage policies, and CI fixture before applying it to a buyer project.
- Migration `202611150000` creates core tables and is for a fresh database only. Stop if tables or data already exist; do not try to make it fit by deleting records.
- Use a staging backup/snapshot, verify the exact project reference, inspect pending migrations, run a dry-run, then obtain approval from the buyer's database owner before applying.
- Configure Site URL and Auth redirects only in the buyer's corresponding environment. Use controlled inboxes to verify confirmation and reset emails.
- Validate public/private Storage bucket rules and RLS using separate Client, Freelancer, and Admin test identities. Keep private documents and message attachments private.
- Production migration and RLS approvals belong to the buyer's release process. CI uses a disposable local PostgreSQL database and never proves that a live environment is safe.

## Vercel configuration

1. Create a distinct buyer-owned Vercel project and connect the buyer-owned Git repository.
2. Select the intended branch as the deployment/production branch before routing any customer domain. Confirm the deployment source commit and aliases.
3. Add only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the environment that targets the matching buyer Supabase project. Do not enter provider secrets in Vite variables.
4. Set buyer-owned auth redirect URLs to the buyer staging origin and its required callback/reset routes.
5. Deploy to staging, inspect the bundle for the correct Supabase host, run browser smoke tests, and verify GitHub Actions.
6. Production domains, variables, deployment aliases, and rollback controls must be reviewed separately by the buyer. Do not use seller production settings as defaults.

## Product settings buyers should own

The product should ultimately expose buyer-owned configuration for branding/logo/colors, public site name, category catalog, membership tier names/entitlements/prices, commission display/limits, demo-only conversion rate/reward limits, support contacts, enabled feature flags and localization. Until the configuration milestone is implemented, treat these as code-level settings and have the buyer request/review changes; do not claim an Admin UI exists.

Financial authorization, commissions, membership entitlements, and rewards must be enforced by trusted server/database logic, never by client settings alone. Price and commission changes require tests and an audit trail. Do not enable a paid tier or real charge as a deployment smoke test.

## Ownership transfer checklist

- Transfer repository ownership and review all branches, issues, Actions workflows, deployment hooks and GitHub secrets; rotate CI credentials.
- Create buyer-owned Supabase projects; migrate only reviewed schema, not seller users, QA data, keys, logs or auth sessions.
- Reconfigure buyer-owned Vercel environments and branch protections; remove seller members, tokens, deploy hooks and aliases after buyer verification.
- Replace Supabase keys, OAuth credentials, SMTP settings, domains, redirect URLs, storage settings, webhooks, support addresses and any future provider sandbox credentials.
- Run the security and E2E checklists in the buyer's staging environment, confirm backup/restore, and record the tested commit/deployment.
- Revoke the seller's access only after the buyer confirms recovery access. Remove test accounts and records only after the buyer identifies them and approves the cleanup.
- Settle code/IP assignment, third-party asset licenses, privacy notices, terms, jurisdiction and support ownership outside the code transfer process.

## Known limitations at transfer baseline

There is no Admin Dashboard, role-provisioning console, membership billing/entitlements, ad/reward service, KAV ledger, USDT provider adapter, real escrow, refund/withdrawal processor, complete dispute case management, or financial reporting. The social report submission has no owner moderation queue. Production infrastructure has not been audited or approved for a buyer. `1 USDT = 1 KAV` is a fixed demo reference only. These are product milestones, not hidden features.
