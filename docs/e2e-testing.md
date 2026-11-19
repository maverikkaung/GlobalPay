# TechKarvo browser regression tests

CI runs `npm run test:e2e` against the local Vite build. These public/demo tests need no account secrets and verify the visitor demo, role switching, hiring sample, feed actions, theme persistence, keyboard use, responsive widths, and the absence of Supabase requests from Demo Mode.

The authenticated staging test is opt-in. It runs only when `PLAYWRIGHT_BASE_URL` is exactly `https://techkarvo-staging.vercel.app` and both staging QA account email/password pairs are supplied through the process environment:

- `TK_QA_CLIENT_EMAIL`
- `TK_QA_CLIENT_PASSWORD`
- `TK_QA_FREELANCER_EMAIL`
- `TK_QA_FREELANCER_PASSWORD`
- Optional `TK_QA_CLIENT_NEXT_PASSWORD` to exercise password change.

Never put these values in this repository, Playwright configuration, CI logs, or command-line arguments. To run against local code with staging data, set the variables only in a protected terminal session and run `npm run test:e2e`. The staging test uses only the dedicated QA accounts. It creates clearly named QA jobs, applications, social posts, messages, reviews, and one explicitly labeled QA report; it deletes only its own test post/message records where those delete flows are under test. It uploads small QA images under those QA account folders. It does not delete existing marketplace records or apply migrations.

If the account values are unavailable, authenticated tests are reported as skipped. CI continues to run the public/demo browser regression automatically. Running authenticated tests on every GitHub push would require the staging QA credentials to be stored as protected GitHub Actions secrets; no such secrets are created by this project change.
