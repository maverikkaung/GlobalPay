# TechKarvo product readiness audit

Audit baseline: branch `codex/marketplace-data-foundation`, including migration 012 Admin UI changes (2026-11-19). This is a code/documentation review plus the staging and browser tests recorded for this development environment. A feature is not marked complete merely because a table or screen exists.

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
| Admin and ownership controls | Trusted-admin-only Admin route and responsive dashboard UI; role check relies on trusted registry RPC, never profile role | Migration 012, RLS, and role workflows pass disposable CI/security tests. It is not applied to staging; real admin behavior and trusted buyer bootstrap remain unverified. |
| Memberships | Demo Mode tier selector for Free/Plus/Gold/Premium | Local selection only; no persistent entitlements, renewal, expiry, pricing, billing, or paid benefits. |
| KAV/USDT | Demo Mode-only local wallet and balanced sample ledger | Uses fixed `1 USDT = 1 KAV`, sandbox credits, milestone holds/releases/refunds/disputes and sample commission. Nothing persists outside local demo storage; no real provider, funds, or withdrawal exists. |
| Ads/rewards | Demo Mode-only bounded reward simulation | Simulates up to five sample 1 KAV rewards per local demo role. No real ad network, view verification, or persistent fraud controls. |
| Financial reports | None | No actual financial activity exists; reporting should wait for a reviewed ledger. Demo analytics must be labeled simulated. |
| Configuration/transferability | Vite public Supabase config, Vercel rewrites, CI, migration/test suite | Existing Supabase key name is supported; build now rejects privileged keys. Buyer guide and configuration templates are being added. Provider/brand/pricing settings need a centralized buyer-owned configuration milestone. |

## Highest-risk weaknesses

1. Admin operations are not enabled or live-tested in staging. Do not bootstrap an admin until migration 012 is separately approved and the exact Auth user is verified.
2. No database-owned configuration model for branding, tier catalog, commissions, ad reward limits, or support workflow.
3. No real financial system exists. Avoid wallet balances and payment claims; acceptance is not funding.
4. Reports have no moderation response lifecycle or owner audit UI.
5. Public frontend configuration is necessarily visible. Only publishable keys may be included; trusted jobs/provider integrations need a buyer-owned server environment and secret manager.
6. Production Supabase/Vercel state is deliberately not inspected or modified in this development goal. Buyers need a fresh ownership and production-readiness review.

## Delivery milestones

1. **Transfer and configuration foundation:** safe public-key build guard; complete source/environment/deployment/ownership docs; remove stale setup claims. No migrations.
2. **Central buyer-owned product configuration:** feature flags, brand, membership catalog, commission display settings, demo rate and limits. Keep private financial enforcement server-side; migration approval required if persisted in Supabase.
3. **Admin and support operations:** migration 012 and the Admin route/dashboard pass isolated PostgreSQL security workflows and local checks. Request staging approval before applying; then provision a staging-only administrator through a trusted operation and verify actual queue/configuration workflows.
4. **Sandbox money model:** implemented in Demo Mode with a fixed `1 USDT = 1 KAV`, balanced local sample entries, milestone holds/releases/refunds/disputes, commission, visible simulation labels, and no network calls. CI unit and browser regression coverage added. No real provider credentials.
5. **Membership and ad reward simulation:** basic tier selection and bounded demo reward are implemented locally. Editable buyer catalog, entitlement lifecycle, deterministic anti-abuse controls, and Admin settings remain incomplete. Do not activate billing or third-party ads.
6. **Buyer operations and analytics:** simulated reporting dashboards, exportable diagnostics, incident/support runbooks, localization and performance/accessibility review.
7. **Release hardening:** isolated buyer-owned staging project, full Client/Freelancer/Admin Playwright coverage, security review, CI, deployment rehearsal and transfer checklist.

Each milestone must pass lint, unit tests, production build and relevant Playwright/CI checks before its own feature-branch commit. Database changes require a reviewed additive migration, CI fixture pass, explicit staging approval and post-migration verification. Production and `main` stay outside this goal.
