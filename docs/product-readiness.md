# TechKarvo product readiness audit

Audit baseline: branch `codex/marketplace-data-foundation`, commit `530138a` (2026-11-19). This is a code/documentation review plus the staging and browser tests recorded for this development environment. A feature is not marked complete merely because a table or screen exists.

## Current implementation

| Area | Present in repository | Readiness and gap |
| --- | --- | --- |
| Authentication and role separation | Supabase Auth, Client/Freelancer routes, settings, reset flows | Staging role journeys pass. Email-change confirmation depends on buyer SMTP/inbox setup. Production credentials/configuration are intentionally outside scope. |
| Marketplace | Jobs, search/filter, apply/withdraw, applicant review, accept/reject, client/freelancer dashboards | Core flows exist and staging E2E passes. No real payment or secured funding is implied by acceptance. |
| Social network | Professional posts, media, likes/comments, connections, sharing | Present and covered in authenticated staging regression. It is not a general-purpose social/moderation operations suite. |
| Messaging and notifications | Job/personal message folders, shared-post context, unread/read state, notifications, per-user hides, redaction | Present and tested in staging. Realtime behavior still depends on Supabase project settings/network and should be monitored by a buyer. |
| Contracts and reviews | Active/completed/disputed status, participant access, two-way review flow | Contract tracking exists; there is no funds ledger, real escrow, formal dispute case workflow, provider reconciliation, or legally enforceable payment guarantee. |
| Member safety | Block, mute and report submission with RLS-backed rules | User-side reporting exists. Owner moderation queue, case assignment, appeals, support SLAs, and audit dashboard are missing. |
| Demo Mode | Local-only role switch, marketplace/social sample workflows, reset, responsive/theme Playwright coverage | Implemented and isolated from Supabase; no wallet/membership/ad rewards are represented as real value. |
| Admin and ownership controls | No Admin route or Admin dashboard; unsupported role has no quick actions | Critical sale-readiness gap. Migration 012 is a draft intended to add a trusted admin registry/RPC foundation; neither CI nor staging verification is complete. UI and buyer bootstrap flow remain incomplete. |
| Memberships | None | Free/Plus/Gold/Premium catalog, entitlements, renewal, expiry, tier settings, and buyer configuration are not implemented. No subscription sales should be enabled. |
| KAV/USDT | Architecture document only | No wallet UI, ledger, balance, payment provider, sandbox adapter, or transfer integration exists. `1 USDT = 1 KAV` is a requested demo simulation rule only. |
| Ads/rewards | None | No real ads, rewarded events, fraud checks, or reward ledger. A sandbox-only simulation can be built without a network provider. |
| Financial reports | None | No actual financial activity exists; reporting should wait for a reviewed ledger. Demo analytics must be labeled simulated. |
| Configuration/transferability | Vite public Supabase config, Vercel rewrites, CI, migration/test suite | Existing Supabase key name is supported; build now rejects privileged keys. Buyer guide and configuration templates are being added. Provider/brand/pricing settings need a centralized buyer-owned configuration milestone. |

## Highest-risk weaknesses

1. No owner Admin Dashboard or trusted admin authorization model. Do not expose a hidden route backed only by editable profile metadata.
2. No database-owned configuration model for branding, tier catalog, commissions, ad reward limits, or support workflow.
3. No real financial system exists. Avoid wallet balances and payment claims; acceptance is not funding.
4. Reports have no moderation response lifecycle or owner audit UI.
5. Public frontend configuration is necessarily visible. Only publishable keys may be included; trusted jobs/provider integrations need a buyer-owned server environment and secret manager.
6. Production Supabase/Vercel state is deliberately not inspected or modified in this development goal. Buyers need a fresh ownership and production-readiness review.

## Delivery milestones

1. **Transfer and configuration foundation:** safe public-key build guard; complete source/environment/deployment/ownership docs; remove stale setup claims. No migrations.
2. **Central buyer-owned product configuration:** feature flags, brand, membership catalog, commission display settings, demo rate and limits. Keep private financial enforcement server-side; migration approval required if persisted in Supabase.
3. **Admin and support operations:** review and verify migration 012 in isolated PostgreSQL, then request staging approval; build Admin route, buyer bootstrap guide, reports queue, moderation actions, support cases and audit views. Trusted admin role must be enforced in database/server.
4. **Sandbox money model:** Demo Mode-only wallet transactions at fixed `1 USDT = 1 KAV`, milestones/fees/refunds/disputes, replay/idempotency, visible simulation labels and no network calls. No real provider credentials.
5. **Membership and ad reward simulation:** editable tier catalog and entitlement simulation, deterministic demo events, limits and abuse testing. Do not activate billing or third-party ads.
6. **Buyer operations and analytics:** simulated reporting dashboards, exportable diagnostics, incident/support runbooks, localization and performance/accessibility review.
7. **Release hardening:** isolated buyer-owned staging project, full Client/Freelancer/Admin Playwright coverage, security review, CI, deployment rehearsal and transfer checklist.

Each milestone must pass lint, unit tests, production build and relevant Playwright/CI checks before its own feature-branch commit. Database changes require a reviewed additive migration, CI fixture pass, explicit staging approval and post-migration verification. Production and `main` stay outside this goal.
