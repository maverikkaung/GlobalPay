# Admin/support migration 012 review notes

**State:** draft pending disposable PostgreSQL CI and separate staging approval. Do not apply this migration to staging or production as part of code review.

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

## Required verification before staging approval

1. CI applies migrations 000–012 to an empty disposable PostgreSQL fixture.
2. Assertions verify RLS on all new tables, anon denial, no self-admin grant, insert-column constraints, no direct audit writes, and function grants.
3. Role tests verify admin and non-admin behavior for settings, catalog, support queue, moderation queue, audit, and aggregate analytics.
4. Review the deployment's initial administrator bootstrap. No user is auto-promoted. The buyer/staging owner must verify a specific Auth user UUID and add it through a trusted SQL Editor or reviewed backend operation after migration approval.
5. Only after CI and security review pass should a separate approval be requested to apply this exact migration to staging reference `ntucgiieksrwebwvcmun`.
