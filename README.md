# TechKarvo

TechKarvo is a React marketplace for clients to post freelance projects and for freelancers to apply, share work, and communicate with clients.

## Stack

- React 19 and Vite 8
- React Router 7
- Supabase Auth, Postgres, and Row Level Security
- Vercel static hosting with SPA route rewrites

## Local development

Use Node.js 22 or newer.

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and set the Supabase project URL and public anon key.
3. Start the app with `npm run dev`.

The browser client must use only the Supabase anon/publishable key. Never put a service-role key or database password in a `VITE_` variable.

## Quality checks

- `npm run lint`
- `npm test`
- `npm run build`

GitHub Actions runs these checks for pushes and pull requests. A separate job applies the SQL migrations to a disposable PostgreSQL fixture, verifies RLS and table/column privileges, and exercises client/freelancer marketplace workflows. This CI database is isolated from the connected Supabase project.

## Supabase schema

Database changes are versioned in `supabase/migrations/`. Fresh projects start with `202611150000_marketplace_base_schema.sql`, followed by the eight marketplace security and feature migrations. The base migration intentionally fails if core tables already exist; legacy projects require schema review before choosing a migration path. Later migrations add profile fields and RLS boundaries, messaging, notifications, portfolios, reviews, and least-privilege grants. Applying migrations changes the connected database; verify the target and obtain approval before applying them to any shared environment. They have not been applied to the connected TechKarvo projects.

The application relies on RLS for authorization. Client-side route checks are for navigation only and are not a security boundary.

See [the staging verification plan](docs/staging-verification.md) for the isolated database, Auth, and two-role journey setup. It is a runbook only; no live database has been changed.

## Vercel

The GitHub repository is connected to the Vercel project. GitHub reports a successful Vercel deployment check for the current project branch. The deployment dashboard requires Vercel sign-in, so the public deployment URL and rendered production page have not been independently verified here. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project’s Preview and Production environment settings. `vercel.json` routes client-side paths back to `index.html` and sets baseline browser security headers.
