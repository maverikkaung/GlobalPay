# TechKarvo product readiness audit

Audit baseline: branch `codex/marketplace-data-foundation`, including migration 013 financial sandbox source work (2026-11-19). This is a code/documentation review plus the staging and browser tests recorded for this development environment. A feature is not marked complete merely because a table or screen exists.

## Current implementation

| Area | Present in repository | Readiness and gap |
| --- | --- | --- |
| Authentication and role separation | Supabase Auth, Client/Freelancer routes, settings, reset flows | Earlier staging role journeys were recorded as passing; the latest authenticated rerun is skipped because QA browser sessions are unavailable. Email-change confirmation depends on buyer SMTP/inbox setup. Production configuration is intentionally outside scope. |
| Marketplace | Jobs, search/filter, apply/withdraw, applicant review, accept/reject, client/freelancer dashboards | Core flows exist; recent authenticated staging rerun is blocked by missing browser sessions. No real payment or secured funding is implied by acceptance. |
| Social network | Professional posts, media, likes/comments, connections, sharing | Present; earlier staging regression passed, but current authenticated retest remains pending. It is not a general-purpose social/moderation operations suite. |
| Messaging and notifications | Job/personal message folders, shared-post context, unread/read state, notifications, per-user hides, redaction | Present; authenticated behavior needs a fresh staging retest. Realtime behavior depends on Supabase project settings/network and should be monitored by a buyer. |
| Contracts and reviews | Active/completed/disputed status, participant access, two-way review flow | Contract tracking exists; there is no funds ledger, real escrow, formal dispute case workflow, provider reconciliation, or legally enforceable payment guarantee. |
| Member safety | Block, mute and report submission with RLS-backed rules | User-side reporting exists; trusted admin moderation is coded but awaits a staging admin identity. Appeals and support SLAs remain unspecified. |
| Demo Mode | Local-only role switch, marketplace/social sample workflows, reset, responsive/theme Playwright coverage | Implemented and isolated from Supabase; no wallet/membership/ad rewards are represented as real value. |
| Admin and ownership controls | Trusted-admin-only Admin route and dashboard; trusted registry RPC, never profile role | Migration 012 is applied to staging. One dedicated temporary QA Admin identity was verified and granted staging-only access; actual UI/login, non-admin and revocation tests await a browser session. Migration 013 is not applied. |
| Memberships | Candidate migration 013 adds role-specific catalog, monthly credits, configured simulated-KAV purchase/renewal and safe Free fallback | Branch-only pending isolated CI and separate staging approval. Catalog prices remain blank until buyer configuration; no real billing or real paid benefits. |
| KAV/USDT | Demo Mode local ledger; candidate migration 013 implements authenticated KAV-only sandbox RPCs | Uses fixed `1 USDT = 1 KAV` for simulation, journal balancing, sample funding/withdrawal, milestone holds/releases/refunds/disputes and configured commission. Migration is not applied to staging. No real provider, funds, or payout. |
| Ads/rewards | Demo Mode bounded reward; candidate migration 013 adds capped authenticated sample credits | Migration is not applied to staging. No real ad network, views, or cash-equivalent rewards. |
| Financial reports | None | No actual financial activity exists; reporting should wait for a reviewed ledger. Demo analytics must be labeled simulated. |
| Configuration/transferability | Vite public Supabase config, Vercel rewrites, CI, migration/test suite | Existing Supabase key name is supported; build rejects privileged keys. Buyer docs exist; Admin settings/catalog foundation is present, but not every branding/pricing/feature value is wired to product behavior. |

## Highest-risk weaknesses

1. Temporary Admin privilege is present only for the verified staging QA identity. Authentication/UI testing and subsequent admin/session revocation remain to be completed.
2. Migration 013 must complete isolated PostgreSQL CI and separate staging approval before persistent sandbox behavior is enabled. Do not claim its controls are live on staging.
3. No real financial system exists. Avoid wallet balances and payment claims; acceptance is not funding.
4. Moderation and audit UI is implemented but awaits a trusted staging admin identity and authenticated workflow verification.
5. Public frontend configuration is necessarily visible. Only publishable keys may be included; trusted jobs/provider integrations need a buyer-owned server environment and secret manager.
6. Production Supabase/Vercel state is deliberately not inspected or modified in this development goal. Buyers need a fresh ownership and production-readiness review.

## Delivery milestones

1. **Transfer and configuration foundation:** safe public-key build guard; complete source/environment/deployment/ownership docs; remove stale setup claims. No migrations.
2. **Central buyer-owned product configuration:** feature flags, brand, membership catalog, commission display settings, demo rate and limits. Keep private financial enforcement server-side; migration approval required if persisted in Supabase.
3. **Admin and support operations:** migration 012 and Admin/Support UI are implemented; staging schema and security checks passed. Next verify member support requests and admin workflows using staging-only test identities, after trusted admin provisioning approval.
4. **Sandbox money model:** Demo Mode is implemented locally. Candidate migration 013 provides authenticated sandbox journal and contract milestone workflows; staging approval and verified Client/Freelancer tests remain pending. No real provider credentials.
5. **Membership and ad reward simulation:** Demo Mode is implemented locally. Candidate migration 013 adds role-specific usage enforcement, plan/config Admin controls and daily reward bounds, pending CI and staging approval. Do not activate billing or third-party ads.
6. **Buyer operations and analytics:** simulated reporting dashboards, exportable diagnostics, incident/support runbooks, localization and performance/accessibility review.
7. **Release hardening:** isolated buyer-owned staging project, full Client/Freelancer/Admin Playwright coverage, security review, CI, deployment rehearsal and transfer checklist.

Each milestone must pass lint, unit tests, production build and relevant Playwright/CI checks before its own feature-branch commit. Database changes require a reviewed additive migration, CI fixture pass, explicit staging approval and post-migration verification. Production and `main` stay outside this goal.
