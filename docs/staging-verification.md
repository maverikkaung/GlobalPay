# TechKarvo staging verification and migration runbook

## အဆင့် ၃.၁ · Migration မတင်မီ အတည်ပြုချက်

**ရလဒ်။** `6fe270a` ၏ migration 015 → 016 → 017 ကို staging မှ ရယူထားသော အမည်ဖယ် projection ပြန်ထည့်ထားသည့် သီးခြား PostgreSQL တွင် အစီအစဉ်အတိုင်း စမ်းသပ်ပြီး အောင်မြင်သည်။ Remote staging migration history က 000–014 အထိ ဖြစ်သည်။ အပြည့်အစုံ backup နှင့် restore မအတည်ပြုရသေးသဖြင့် deployment ဆက်လုပ်ရန် အဆင်သင့်အဖြစ် မသတ်မှတ်ရသေးပါ။

### အရန်သိမ်းမှုနှင့် ပြန်ထည့်စမ်းသပ်မှု

- Auth နှင့် Storage ဒေတာပါဝင်သည့် အပြည့်အစုံ logical dump ကို အလိုအလျောက် ခွင့်ပြုချက်စစ်ဆေးမှုက တားခဲ့သည်။ ရှိပြီးသား backup များကို မဖွင့်ဘဲ ထိန်းထားသည်။
- Staging reference `ntucgiieksrwebwvcmun` ကို အတိအကျသတ်မှတ်ပြီး read-only transaction တစ်ခုဖြင့် migration version များ၊ membership/usage၊ sandbox configuration နှင့် simulated ledger တို့၏ အမည်ဖယ် projection ကို ရယူသည်။ Account ID များအစား စဉ်နံပါတ် သုံးထားပြီး Auth row၊ Storage object၊ အမည်၊ စာသားမှတ်ချက်၊ မူလ reference နှင့် idempotency key များ မပါဝင်ပါ။
- Projection နှင့် SHA-256 ကို repository ပြင်ပ `LOCALAPPDATA` အောက်ရှိ Windows အသုံးပြုသူတစ်ဦးသာ ဝင်ရောက်နိုင်သော ဖိုလ်ဒါအသစ်တွင် သိမ်းပြီး မူလ byte များနှင့် checksum ကို ပြန်တိုက်စစ်သည်။ PostgreSQL ကို memory ထဲတွင် စတင်၍ migration 000–014 နှင့် Auth/Storage စမ်းသပ်ပုံစံကို တည်ဆောက်ပြီး projection ကို ပြန်ထည့်သည်။ စစ်ထားသော အချက်အလက်အုပ်စုများသည် staging projection နှင့် တူညီသည်။
- စစ်ဆေးထားသည့် membership/configuration/ledger ဇယား ၇ ခု၏ column အမျိုးအစား၊ RLS policy၊ anonymous/authenticated ခွင့်ပြုချက်နှင့် သက်ဆိုင်ရာ function ၅ ခု၏ definition hash နှင့် execute ခွင့်တို့ ကိုက်ညီသည်။ Migration version ၁၅ ခု၊ plan ၈ ခု၊ entitlement ၂၁ ခု၊ usage event ၂၂ ခု၊ ledger account ၁၆ ခု၊ transaction ၂၄ ခုနှင့် entry ၄၈ ခု ကိုက်ညီသည်။ စာရင်းမညီသည့် transaction ၀ ခုနှင့် လက်ကျန်အနုတ်ဖြစ်သော အသုံးပြုသူ ledger account ၀ ခု ဖြစ်သည်။

### Migration တစ်ခုချင်းစီ၏ ပြောင်းလဲမှု

| Migration | သီးခြား database တွင် အတည်ပြုခဲ့သော ပြောင်းလဲမှု |
| --- | --- |
| 015 | `techkarvo_sandbox_activate_plan` ကို အစားထိုးပြီး plan ရွေးချိန် လက်ရှိလ quota သုံးစွဲမှုကို ဆက်တွက်သည်။ |
| 016 | `techkarvo_membership_benefit_until` နှင့် `techkarvo_current_featured_job_ids` ကို ထည့်သည်။ `techkarvo_enforce_feature_entitlements`၊ `techkarvo_has_membership_feature`၊ `techkarvo_sandbox_claim_ad_reward`၊ `techkarvo_set_profile_boost`၊ `techkarvo_user_analytics` နှင့် `freelancer_public_profiles` view ကို အစားထိုးသည်။ ပထမ helper ကို browser role များအား execute ခွင့်မပေးဘဲ ဖွင့်ထားသည့် အလုပ်များ၏ badge စစ်သည့် RPC ကို anonymous/authenticated အတွက် သတ်မှတ်ထားသည်။ |
| 017 | `techkarvo_consume_usage_credit` နှင့် `techkarvo_sandbox_activate_plan` ကို အစားထိုးသည်။ Quota ပြောင်းလဲမှု၊ sandbox ပိတ်ချိန် debit၊ လတစ်လတည်း ထပ်ဖြတ်ခြင်းတို့ကို ထိန်းချုပ်သည်။ |

အဆင့်တိုင်းပြီးနောက် plan၊ entitlement၊ usage event၊ ledger account၊ transaction၊ entry၊ sandbox configuration နှင့် စမ်းသပ်အတွက် ပြန်ထည့်ထားသည့် migration history row များ၏ snapshot တူညီသည်။ Function သို့မဟုတ် view ဖယ်ရှားခြင်း မရှိပါ။ Hosted migration runner ၏ history record ထည့်ခြင်းကို ဤသီးခြား SQL စမ်းသပ်မှုတွင် မလုပ်ပါ။

### ဆက်မလုပ်မီ ဖြေရှင်းရမည့်အချက်

1. Staging အပြည့်အစုံ backup ကို ပိုင်ရှင်ခွင့်ပြုထားသည့် နည်းလမ်းဖြင့် ဖန်တီးပြီး အသုံးချနိုင်ကြောင်း သီးခြား database တွင် restore စမ်းသပ်ရန် လိုသည်။ Projection သည် မူလ Auth၊ Storage၊ application ဒေတာ၊ မူလ identifier နှင့် journal reference များကို ပြန်မတည်ဆောက်နိုင်ပါ။ Backup ဖိုင်များ သို့မဟုတ် credentials ကို Git၊ CI သို့မဟုတ် ချတ်တွင် မတင်ရပါ။
2. လက်တွေ့အသုံးချမည့်အချိန် staging reference၊ migration history၊ ရှိပြီးသားလ သုံးစွဲမှုနှင့် ledger အခြေအနေကို ပြန်စစ်ရပါမည်။ စစ်ဆေးမှုနောက်ပိုင်း staging data ပြောင်းနိုင်ပြီး snapshot သည် ထုတ်ယူချိန်အခြေအနေကိုသာ ပြသည်။
3. Migration **015 တစ်ခုတည်း** အတွက် သီးခြားအတည်ပြုချက် မရမချင်း remote မတင်ရပါ။ 016/017 အတွက် သီးခြားအတည်ပြုချက် လိုပြီး 015 တင်ထားရုံဖြင့် entitlement နှင့် sandbox pause ပြင်ဆင်ချက်များ အသက်မဝင်သေးပါ။
4. Authenticated staging workflow များက staging data သို့မဟုတ် QA session ကို ပြောင်းနိုင်သဖြင့် public Playwright စမ်းသပ်မှုကိုသာ run ခဲ့သည်။ Local lint၊ production build၊ unit/regression ၇၄ ခု၊ သီးခြား SQL စမ်းသပ်ချက် ၁၁ ခုနှင့် public staging Playwright ၄ ခု အောင်မြင်သည်။

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
- အဆင့် ၃.၁ ၏ read-only စစ်ဆေးမှုအရ migration history သည် `202611150014` အထိ ဖြစ်သည်။ 013 ၏ simulation-only membership/ledger schema နှင့် 014 ၏ deferred ledger balance ပြင်ဆင်ချက် တင်ထားပြီး 015–017 သည် feature branch ပေါ်တွင် ရှိသည်။ လက်ရှိအခြေအနေ၊ backup ကန့်သတ်ချက်နှင့် deployment အတည်ပြုချက်ကို အထက်ပါ အဆင့် ၃.၁ တွင် ကြည့်ပါ။

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
