# TechKarvo staging verification and migration runbook

## အဆင့် ၃ · Staging migration အဆင်သင့်ဖြစ်မှု

၂၀၂၆-၁၁-၂၁ ရက်တွင် သတ်မှတ်ထားသော `techkarvo-staging` project ကို read-only transaction ဖြင့် စစ်ဆေးခဲ့သည်။ PostgreSQL 17.12 တွင် migration 000–014 ကို မှတ်တမ်းတင်ထားပြီး 015 ကို မတွေ့ပါ။ အစီအစဉ် ၈ ခုနှင့် entitlement ၂၁ ခုရှိပြီး role မကိုက်ညီမှု ၀ ခု ဖြစ်သည်။ Simulated ledger transaction ၂၄ ခုနှင့် journal entry ၄၈ ခုရှိပြီး စုစုပေါင်း မညီသည့် transaction ၀ ခု ဖြစ်သည်။ စစ်ဆေးခဲ့သော membership၊ configuration နှင့် ledger ဇယားများတွင် RLS ဖွင့်ထားသည်။ Ledger balance trigger နှစ်ခုလုံး deferred ဖြစ်ပြီး အတွင်းသုံး balance/quota function များကို browser role က တိုက်ရိုက် ခေါ်ခွင့်မရှိပါ။

| အစီအစဉ် | ပြောင်းလဲမှုနှင့် စစ်ဆေးရန် |
| --- | --- |
| 013 · တင်ပြီး | Role အလိုက် plan နှင့် လစဉ် quota၊ sandbox configuration၊ ledger၊ အကျိုးခံစားခွင့်နှင့် RLS ကို ဖန်တီးသည်။ ရှိပြီးသား staging တွင် ပြန်အသုံးချရန် မလိုပါ။ |
| 014 · တင်ပြီး | Deferred balance စစ်ဆေးသည့် function ကို အစားထိုးသည်။ Staging မှာ function နှင့် trigger သတ်မှတ်ချက်ကို စစ်ပြီးဖြစ်သည်။ |
| 015 · အတည်ပြုချက် လို | 013 ၏ plan ရွေးချယ်သည့် RPC ကို အစားထိုးပြီး 014 ၏ balance စစ်ဆေးမှုအောက်တွင် အလုပ်လုပ်သည်။ လက်ရှိလ credits သုံးပြီးသားကို ဆက်တွက်သည်။ Migration ကိုယ်တိုင် entitlement သို့မဟုတ် ledger row မပြောင်းပါ။ |
| 016 · အတည်ပြုချက် လို | 015 ပြီးလျှင် အစီအစဉ် role၊ သက်တမ်း၊ active အခြေအနေနှင့် လက်ရှိ catalog entitlement ကို စစ်သည်။ ရှိပြီးသား badge/boost သတ်မှတ်ချက်ကို ထိန်းပြီး လက်ရှိအကျိုးခံစားခွင့်ကို ဖတ်သည့်အချိန်မှာ တွက်သည်။ |
| 017 · အတည်ပြုချက် လို | 016 ပြီးလျှင် quota လျော့သည့်အခါ လက်ရှိ catalog limit ကို ချက်ချင်း သုံးသည်။ Quota တိုးသည့်အခါ ထုတ်ပေးထားသည့် လစဉ် limit ကို ကျော်မသုံးနိုင်ပါ။ သက်တမ်းကုန် သို့မဟုတ် ရပ်ထားသော plan အတွက် role အလိုက် Free limit ကို သုံးပြီး လက်ရှိလ အသုံးပြုမှုကို ဆက်တွက်သည်။ Sandbox ပိတ်ထားချိန် ဝယ်ယူမှုအသစ်နှင့် အလိုအလျောက် debit ကို တားသည်။ |

**Sandbox ပိတ်ထားချိန်။** 013 က ဆုကြေးယူမှု၊ simulated အပ်ငွေ/ထုတ်ငွေကို ပိတ်ထားပြီးသား ဖြစ်သည်။ 017 က paid plan ဝယ်ယူမှုအသစ်ကို ထပ်ပိတ်ပြီး သက်တမ်းတိုးရန် လရောက်သော်လည်း debit မလုပ်ဘဲ Free သို့ ပြောင်းသည်။ Free ရွေးချယ်မှုနှင့် ရရှိပြီးသား quota အတွင်း သာမန် marketplace လုပ်ဆောင်ချက်ကို ဆက်ခွင့်ပြုသည်။ အလိုအလျောက်သက်တမ်းတိုးပြီး လတစ်လတည်းမှာ paid plan ကို ပြန်ရွေးသော်လည်း နောက်တစ်ကြိမ် မဖြတ်ပါ။ ဤအစီအစဉ်အားလုံးမှာ စမ်းသပ်ငွေစာရင်းသာ ဖြစ်သည်။

**သီးခြား database စမ်းသပ်ချက်။** Migration 014 ပါသော စမ်းသပ် database တွင် သုံးထားသည့် quota နှင့် simulated journal ကို ဖန်တီးပြီး 015၊ 016၊ 017 ကို တစ်ခုချင်း အသုံးချခဲ့သည်။ အဆင့်တိုင်းပြီးနောက် entitlement၊ usage event၊ ledger transaction နှင့် entry row များကို မူလအခြေအနေနှင့် တိုက်စစ်ရာ တူညီသည်။

**အသုံးမချမီ။** Project reference နှင့် migration history ကို ပြန်တိုက်စစ်ပါ။ အသုံးချမည့် migration တစ်ခုချင်းစီကို ပိုင်ရှင်ထံမှ သီးခြားအတည်ပြုချက် ရယူပါ။ Schema၊ role/grant၊ entitlement/အသုံးပြုမှု၊ ledger နဲ့ migration history အားလုံး ပါဝင်သော သီးသန့် backup အသစ်ကို အတည်ပြုထားသည့် နည်းလမ်းနှင့် ဖန်တီးပြီး သီးခြား database ပေါ်မှာ ပြန်ထည့်စမ်းပါ။ ရှိပြီးသား backup ဖိုင်များကို ဤစစ်ဆေးမှုတွင် မဖွင့်ခဲ့သဖြင့် လတ်တလောဖြစ်မှုနှင့် ပြန်ထည့်လို့ရမှုကို အတည်မပြုရသေးပါ။ အသုံးမချမီ dry run ထဲတွင် အတည်ပြုထားသည့် migration များသာ ပေါ်ရပါမည်။

**အသုံးချပြီးနောက်။** အစီအစဉ်အတိုင်း migration version တစ်ခုချင်းစီနှင့် function grant၊ search path၊ RLS၊ deferred balance trigger တို့ကို ဖတ်ရှုရုံ ပြန်စစ်ပါ။ အသုံးမချမီ ဖမ်းထားသော ledger transaction/entry အရေအတွက်နှင့် မညီသည့် journal အရေအတွက်၊ entitlement role နှင့် လက်ရှိလအသုံးပြုမှုကို ပြန်တိုက်စစ်ပါ။ Data ရေးသားသည့် QA workflow များကို သီးခြားအတည်ပြုချက်ရပြီးမှ run ပါ။

**ပြန်လည်ရယူရန်။** Migration transaction မအောင်ပါက ရပ်ပြီး SQL အမှားနှင့် migration history ကို စစ်ပါ။ Commit ပြီးမှ ပြဿနာတွေ့လျှင် အသစ်ထည့်ထားသော function/view ကို reviewed forward migration နဲ့ ပြင်ပါ။ Ledger သို့မဟုတ် usage history ကို ဖြတ်တောက်ခြင်း၊ အဟောင်းဖြင့် အစားထိုးခြင်း မပြုဘဲ သီးခြား database ထဲမှာ backup ကို ပြန်ထည့်ပြီး ပြန်လည်ရယူမည့် အစီအစဉ်ကို စစ်ဆေးပါ။

## ယခင်စစ်ဆေးမှုမှတ်တမ်း

## Current development staging reference

- Supabase project: `techkarvo-staging`
- Project reference: `ntucgiieksrwebwvcmun`
- Region: Tokyo (`ap-northeast-1`)
- Staging site: `https://techkarvo-staging.vercel.app`
- Staging Vercel deployment branch: `codex/marketplace-data-foundation`
- Migration history was verified through `202611150012` on this staging project. Migration 012 was applied after exact project-reference, migration-history, schema, and single-migration dry-run checks. Post-apply checks confirmed RLS, grants, fixed search paths, seeded simulation-only catalog entries, and unchanged marketplace data counts. A temporary staging QA Admin was granted only after its exact Auth UID and email-confirmed identity were verified; its authenticated UI tests and privilege/session revocation remain pending a browser session. Migration 013 is currently a branch-only candidate and has not been applied. Production remains a separate system and is outside this runbook.

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
9. Test the Admin/support console only after a staging administrator is provisioned through a trusted operation. Migration 012 does not self-assign administrator access, and the UI alone grants no privileges. Customer Support page allows members to create and view their own requests under RLS.

Record test results as pass/fail plus commit/deployment and sanitized error text. Never record emails, passwords, API keys, authorization headers, JWTs, recovery links, or raw network bodies.
