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

GitHub Actions runs these checks for pushes and pull requests.

## Supabase schema

Database changes are versioned in `supabase/migrations/`. The app requires the existing `profiles`, `jobs`, and `job_applications` tables plus the matching migrations. Applying a migration changes the connected database; inspect and approve the target project before running any migration against it.

The application relies on RLS for authorization. Client-side route checks are for navigation only and are not a security boundary.

## Vercel

Connect the GitHub repository to Vercel, use the Vite preset, and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project’s environment settings. `vercel.json` routes client-side paths back to `index.html` and sets baseline browser security headers.
