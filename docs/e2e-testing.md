# TechKarvo browser regression tests

CI runs `npm run test:e2e` against the local Vite build. These public/demo tests need no account secrets and verify the visitor demo, role switching, hiring sample, feed actions, theme persistence, keyboard use, responsive widths, and the absence of Supabase requests from Demo Mode.

The authenticated staging test is opt-in and must use dedicated staging QA accounts only. On Windows, run `npm run test:e2e:prepare` to open two independent, Playwright-managed Chrome profiles at the staging login page. Sign in to the Client window with the QA Client account and the Freelancer window with the QA Freelancer account. Never use production or personal accounts. After both role dashboards are visible, confirm readiness to the agent; the helper verifies each session locally and captures browser state without printing tokens or account details. It stores the states in a Windows-user-restricted temporary directory outside the repository and removes the duplicate browser profiles. Do not copy, upload, or commit these temporary session files. Then run `npm run test:e2e`; it detects both states and targets staging automatically.

Alternatively, authenticated staging tests can use the following protected process environment variables when both QA account credential pairs are available:

- `TK_QA_CLIENT_EMAIL`
- `TK_QA_CLIENT_PASSWORD`
- `TK_QA_FREELANCER_EMAIL`
- `TK_QA_FREELANCER_PASSWORD`
- Optional `TK_QA_CLIENT_NEXT_PASSWORD` to exercise password change.

The financial sandbox browser test uses the same dedicated staging accounts. It checks each role's four-plan catalog and responsive layout, then records a simulated 0.01 KAV credit and equal simulated withdrawal per account. The paired journal entries are immutable QA evidence; the test returns each available balance to its starting amount and moves no real funds. Do not run this test with personal or production accounts.

Playwright writes run artifacts to a unique operating-system temporary directory rather than cleaning a repository `test-results/` folder. This protects any pre-existing untracked test files in the project workspace.

Never put these values in this repository, Playwright configuration, CI logs, or command-line arguments. To run against local code with staging data, set the variables only in a protected terminal session and run `npm run test:e2e`. The staging test uses only the dedicated QA accounts. It creates clearly named QA jobs, applications, social posts, messages, reviews, and one explicitly labeled QA report; it deletes only its own test post/message records where those delete flows are under test. It uploads small QA images under those QA account folders. It does not delete existing marketplace records or apply migrations.

If neither the temporary QA session states nor the credential pairs are available, authenticated tests are reported as skipped. CI continues to run the public/demo browser regression automatically. Running authenticated tests on every GitHub push would require the staging QA credentials to be stored as protected GitHub Actions secrets; no such secrets are created by this project change.
