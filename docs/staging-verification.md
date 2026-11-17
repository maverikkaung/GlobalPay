# TechKarvo staging setup and verification

This plan is for a dedicated, disposable Supabase staging project. It is documentation only: no project has been created or linked, and no migration or auth setting has been changed. Do not point these steps at production.

## Prerequisites

- A dedicated Supabase staging project with no production data and a known project reference.
- An authorized operator with access to that staging project's SQL editor or Supabase CLI, plus permission to inspect schema, Auth configuration, and logs.
- A staging-only deployment target (preferably a Vercel Preview environment) configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for staging. Never put a service-role key or database password in a `VITE_` variable.
- Two controlled test email inboxes, one for a Client and one for a Freelancer. Keep credentials in the password manager; do not put passwords or keys in tickets, chat, or test output.
- A migration window and an approved rollback/recovery owner. Take a staging-only backup/snapshot before applying schema changes.

## Prepare the staging database

1. Confirm the project reference and dashboard hostname identify staging. Record the target in the change log without recording credentials.
2. Inspect the current schema and migration history. This repo expects existing `profiles`, `jobs`, and `job_applications` tables; the GitHub fixture is intentionally minimal and is not proof that a real project's schema matches. Compare columns, constraints, grants, policies, and existing rows against the migrations before proceeding.
3. Confirm the target contains no production data. Capture a staging backup/snapshot and verify the recovery procedure.
4. Review the ordered migrations `supabase/migrations/202611150001_...sql` through `202611150008_...sql`, including the policies, triggers, grants, backfills, and preservation behavior. The migrations are intended to preserve existing marketplace records, but must still be reviewed against the actual staging schema.
5. On a machine authenticated only to the staging project, inspect the migration plan (`supabase db push --dry-run` when supported by the installed CLI). Review the target reference and every pending migration. Stop if the target or schema is uncertain.
6. After a separately approved staging change window, apply migrations to staging only. Confirm the migration history, run `supabase/tests/migration_assertions.sql` and `supabase/tests/marketplace_rls_workflows.sql` where compatible, inspect database logs, and verify the app can read/write each expected table under authenticated user roles. Never use a service-role key from the browser.
7. Keep this staged schema and test data isolated. Do not apply the migrations to production without a separate explicit approval.

## Configure staging Auth and preview

In the staging Supabase project's Auth settings, configure the staging preview origin as the Site URL and add only the required staging callback/redirect URLs (including the app's login, signup confirmation, and password-reset return routes). Confirm email confirmation behavior and SMTP delivery using the controlled test inboxes. Do not change production Auth settings.

Add the staging URL and anon/publishable key to the Vercel Preview environment only, then redeploy the preview. Verify the built page loads the staging host and that the browser sends no service-role credential. A public anon key is expected in browser requests; do not copy it into this document or logs.

## Authentication and two-role journey

Use the preview deployment and the two staging-only inboxes. Record pass/fail, timestamp, browser, and sanitized error text; never record passwords, tokens, full request headers, or session data.

1. Sign up the Client and Freelancer accounts with the correct account types; complete email confirmation if enabled.
2. Log in and log out as each role. Check refresh/session restoration, expired-session handling, and the password-reset email/link flow.
3. Confirm each role lands on its own dashboard and is redirected away from the other role's protected routes.
4. As Client, create a job, edit it if supported, and confirm it appears in discovery and the client dashboard. Check validation for required fields and invalid budget values.
5. As Freelancer, search/filter jobs, open the job detail, submit an application, and confirm duplicate submission is rejected. Verify the application appears in the freelancer dashboard and client applicant list.
6. As Client, review the applicant and accept or reject an application. Confirm status changes appear on both dashboards. Verify a job with application history remains available according to the preservation rules.
7. As the matched parties, exchange messages, check unread/read notification state, and verify messaging access ends under the configured closed-application rules.
8. Complete the supported work lifecycle and submit a review from each side. Verify rating visibility, one-review constraints, and that unrelated users cannot read private review records.
9. Exercise profile editing and freelancer portfolio add/edit/delete, including URL validation and empty/long input boundaries.
10. In a second browser session, test privacy boundaries: a user must not edit another user's profile, job, application, message, portfolio, or review, nor enumerate private records. Confirm expected denials in RLS/database responses.
11. Check the full journey at desktop and narrow mobile widths, keyboard-only navigation, visible focus, form labels/errors, loading/empty/error states, and no horizontal overflow.
12. After sign-off, remove only the staging test records/accounts if approved. Preserve evidence of migration verification and the exact commit/deployment tested.

## What is needed to run this plan

Provide or create the dedicated staging project and identify its project reference; grant an authorized operator access to that staging project; configure the staging-only Preview variables and Auth redirects; and supply controlled access to two test inboxes. No secret needs to be sent in chat. Before anyone applies migrations, approve the staging migration window and confirm the staging target/schema review. Production authentication and the client/freelancer end-to-end journey remain unverified until this staging walkthrough (and a separate real production auth smoke test) passes.
