# TechKarvo staging verification and migration runbook

## Current development staging reference

- Supabase project: `techkarvo-staging`
- Project reference: `ntucgiieksrwebwvcmun`
- Region: Tokyo (`ap-northeast-1`)
- Staging site: `https://techkarvo-staging.vercel.app`
- Staging Vercel deployment branch: `codex/marketplace-data-foundation`
- The project history records migrations `202611150000` through `202611150011` applied to this staging project. Migration `202611150012_admin_support_configuration.sql` is a draft not yet verified in disposable CI or applied to staging; it needs separate approval after review. Production remains a separate system and is outside this runbook.

The values above identify the development environment only. Before each operation, confirm the current target in the Supabase/Vercel dashboard or authenticated CLI. Never infer a target from a local link file alone. No migration in this runbook is pre-approved for a future change.

## Future staging migration procedure

1. Confirm project name and reference are exactly `techkarvo-staging` / `ntucgiieksrwebwvcmun`; stop on mismatch.
2. Inspect schema, migration history, row counts and data categories. Stop if unplanned objects, records, or migration conflicts appear.
3. Review the entire proposed SQL: table/column constraints, foreign keys, grants, RLS, functions/triggers, storage rules, indexes, data updates, and rollback/recovery limits.
4. Run the complete migration sequence against the disposable PostgreSQL fixture in CI. Verify fresh database assertions, RLS workflows, and expected rollback/recovery behavior.
5. Take a staging-only backup and perform a dry-run. Capture a list of only the intended pending migrations.
6. Request separate explicit approval naming the migration and staging reference. Approval is for staging only and does not authorize production or future migrations.
7. Apply only the approved migration(s). Verify `supabase_migrations.schema_migrations`, schema/grants/RLS, logs, and authenticated Client/Freelancer journeys. Stop if results differ from review.

Never run migrations against production without separate explicit approval. The CI PostgreSQL service is disposable and is not a staging or production backup.

## Staging identity and environment

- Use the staging Supabase URL and a public publishable key only in browser configuration. The Vite public variable is `VITE_SUPABASE_PUBLISHABLE_KEY`; `VITE_SUPABASE_ANON_KEY` is retained for compatibility.
- Never put a Supabase secret/service-role key, database password, payment provider secret, or private signing key into any `VITE_` variable, source file, test fixture, trace, screenshot, log, or report.
- Configure staging-only Auth Site URL and redirect URLs. Use separate controlled Client/Freelancer inboxes and never share passwords or session tokens in chat.
- Keep uploads in their intended bucket: public profile/post images may use reviewed public-image policies; private messages/documents must use private storage and participant-authorized access.
- Staging test accounts and data are disposable only with owner confirmation. Do not delete or modify other accounts/data as part of cleanup.

## Two-role workflow verification

Run against `https://techkarvo-staging.vercel.app` using separate browser contexts and staging-only test users. Do not enable trace/video recording for authenticated tests unless every artifact is proven to exclude auth state and headers.

1. Verify signup, login/logout, role-specific routes, session recovery, password reset, email-confirmation behavior, and buyer-configured Auth redirects.
2. As Client, create a text-only job and check validation, editability, discovery, and the client dashboard.
3. As Freelancer, search/filter, apply, reject duplicate applications, and verify application status and withdrawal behavior.
4. As Client, review applicants and accept/reject. Confirm applicant/application history and contract transitions remain consistent.
5. Exercise job and personal message separation, unread counts, read receipts, realtime delivery/poll fallback, shared-post previews, Delete for Me and authorized Delete for Everyone.
6. Exercise image uploads, post creation/edit/delete, likes/comments, connections, notifications, block/unblock/mute/report, and active-contract safeguards.
7. Complete a contract, submit both reviews, and verify participants/ratings and one-review constraints. Confirm no payment or escrow is implied by contract state.
8. Test account settings, safe email/password flows, keyboard operation, dark/light themes, and desktop/tablet/mobile viewports.
9. Run a separate Admin/support test only after a trusted admin model exists; the current product baseline does not have an Admin Dashboard or moderation queue.

Record test results as pass/fail plus commit/deployment and sanitized error text. Never record emails, passwords, API keys, authorization headers, JWTs, recovery links, or raw network bodies.
