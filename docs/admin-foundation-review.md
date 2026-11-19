# Admin/support migration 012 review notes

**State:** disposable PostgreSQL CI/security workflow passed. Applied only to staging project `ntucgiieksrwebwvcmun` after explicit approval on 2026-11-19. Do not apply this migration to production.

## Objects and access boundary

- `platform_admins` is a separate trusted identity registry. Existing `profiles.account_type` stays Client/Freelancer and cannot grant administration. `anon` and `authenticated` have no direct table privileges. Only trusted service/database-owner operations may provision or revoke administrators.
- `techkarvo_is_platform_admin()` is a fixed-search-path, stable security-definer function that returns only whether the current `auth.uid()` is in the admin registry. Authenticated users can call it; anonymous users cannot.
- `platform_settings` exposes only rows marked public to authenticated members. Admin writes go through a checked RPC and add an audit event. It stores configuration only, not secrets.
- `membership_tiers` seeds Free, Plus, Gold, and Premium catalog entries. Plus/Gold/Premium begin disabled; no prices or benefits are fabricated. Any configured price is labeled and constrained as simulation-only. No user entitlement, checkout, subscription, payment, or balance is created.
- `support_cases` permits a member to insert only requester/subject/description/category and read only their own cases. The support queue is admin-readable; state, urgency, and assignment change only through an admin RPC.
- Existing `user_reports` remain reporter-readable. Admin queue access is added through RLS; review status and notes are set only via a checked RPC. The moderation note is stored in admin-only audit data, never exposed to the reported member.
- `admin_audit_log` is readable by admins and has no direct authenticated write/update/delete grant. Admin RPCs append bounded, structured events.
- `techkarvo_admin_marketplace_summary()` returns aggregate non-financial counts only and raises an authorization error for non-admin accounts.

## Data impact and rollback

The migration creates new tables, indexes, functions, policies and four catalog seed rows. It alters no existing user, job, application, conversation, message, review, or report values and deletes no records. Existing report SELECT boundary is replaced to include authorized admins.

The script is transactional. A failure before `COMMIT` rolls back the transaction. After a successful commit, do not run `DROP TABLE` as a quick rollback: support and audit records may have been created. A safe operational rollback is to disable the Admin UI, revoke authenticated execute privileges on the admin RPC functions, disable non-Free catalog rows, and retain records for review. Any destructive schema rollback requires a separate backup, data-retention review, migration, and approval.

## Staging verification

1. CI applies migrations 000–012 to an empty disposable PostgreSQL fixture.
2. Assertions verify RLS on all new tables, anon denial, no self-admin grant, insert-column constraints, no direct audit writes, and function grants.
3. Role tests verify admin and non-admin behavior for settings, catalog, support queue, moderation queue, audit, and aggregate analytics.
4. The staging apply is recorded in migration history; read-only checks confirmed RLS on each new table, no authenticated table privileges on the admin registry, anonymous denial for the admin predicate, authenticated access to the predicate, fixed search paths on security-definer functions, and unchanged marketplace row counts.
5. No user is auto-promoted. Verify a specific Auth user UUID and obtain separate approval before registering a staging administrator through a trusted SQL Editor or reviewed backend operation.
