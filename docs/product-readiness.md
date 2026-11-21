# TechKarvo product readiness audit

## အဆင့် ၂ · ထုတ်လုပ်ရေး အဆင်သင့်ဖြစ်မှုနှင့် လုံခြုံရေး

စစ်ဆေးမှုအခြေခံ commit မှာ `f7f5a9b` ဖြစ်ပြီး staging Playwright ၈ ခုနှင့် regression ၇၂ ခု အောင်ထားသည်။ ဤအပိုင်းတွင် repository ထဲမှ React လမ်းကြောင်း၊ API ခေါ်ဆိုမှု၊ migration၊ RLS စမ်းသပ်ချက်နှင့် deployment configuration ကို သုံးသပ်ထားသည်။ Production Supabase နှင့် Vercel setting များကို အတည်ပြုရန် သီးခြားစစ်ဆေးမှု လိုသည်။

| အဆင့် | တွေ့ရှိချက် | လုပ်ဆောင်ရန် |
| --- | --- | --- |
| Critical | စစ်ဆေးခဲ့သည့် source အတွင်း အတည်ပြုနိုင်သော Critical ပြဿနာ မတွေ့ပါ။ တကယ့်ငွေကြေးအတွက် billing provider၊ webhook အတည်ပြုမှုနှင့် reconciliation မပါသေးပါ။ | အစီအစဉ်ဝယ်ယူခြင်း၊ KAV၊ အပ်ငွေ၊ ထုတ်ငွေနှင့် contract ငွေစာရင်းကို simulation အဖြစ်သာ ထားရန်။ |
| High | Browser build သည် ရွေးမသုံးသော key alias ကို မစစ်ခဲ့ဘဲ Vite environment တစ်ခုလုံးကို client code သို့ ပေးခဲ့သည်။ အသုံးပြုနေသည့် config တွင် လျှို့ဝှက် key အမှန် ထွက်ခဲ့ကြောင်း သက်သေ မတွေ့ပါ။ | Browser environment ကို လိုအပ်သည့် Supabase တန်ဖိုးများအထိ ကန့်သတ်ပြီး key alias နှစ်ခုလုံး စစ်သည်။ Loopback development မှလွဲ၍ HTTPS သုံးရန်။ |
| High | `techkarvo_sandbox_activate_plan` သည် အစီအစဉ်ရွေးချိန်တွင် လက်ရှိလ အသုံးပြုပြီးသော quota ကို ပြန်စသည်။ | Migration 015 က လက်ရှိလ သုံးစွဲမှုကို ဆက်တွက်ပြီး quota မလုံလောက်သော အစီအစဉ်ရွေးချယ်မှုကို ငြင်းသည်။ Role နှစ်ခုအတွက် သီးခြား database စမ်းသပ်ချက် ထည့်ထားသည်။ Remote migration အတွက် အတည်ပြုချက် လိုသည်။ |
| High | Production Auth တွင် SMTP၊ redirect allowlist၊ စကားဝှက်နှင့် email ပြောင်းလဲရေး စည်းမျဉ်း၊ အလွဲသုံးစားမှု ကန့်သတ်ချက်၊ အရန်မှ ပြန်ယူနိုင်မှုတို့ကို repository ဖြင့် အတည်မပြုနိုင်ပါ။ | ထုတ်လုပ်ရေးပတ်ဝန်းကျင်ကို ဖွင့်မီ သတ်မှတ်ချက်နှင့် recovery rehearsal ကို သီးခြားစစ်ရန်။ |
| Medium | Advanced Search အတွက် RPC က plan ကို စစ်သော်လည်း job data က public ဖြစ်ပြီး budget filter က browser ထဲတွင် အလုပ်လုပ်သည်။ Featured job flag နှင့် profile boost အချိန်ကို ဖတ်ရာတွင် လက်ရှိ entitlement နှင့် တိုက်စစ်မှု မပြည့်စုံသေးပါ။ | Paid benefit တစ်ခုချင်းအတွက် အတိအကျ အကျိုးသက်ရောက်မှုနှင့် သက်တမ်းကုန်/plan ပြောင်းသည့် အခြေအနေကို သတ်မှတ်ပြီး server-side မှ စစ်ရန်။ |
| Medium | Financial sandbox ပိတ်သည့် setting ကို deposit၊ withdrawal နှင့် reward အပါအဝင် လုပ်ဆောင်ချက်အချို့က စစ်သော်လည်း plan ဝယ်ယူမှုနှင့် သက်တမ်းတိုးမှုက အတူတူ မစစ်ပါ။ | Sandbox ကို ပိတ်ထားချိန် ခွင့်ပြုမည့် လုပ်ဆောင်ချက်များကို သတ်မှတ်ပြီး lifecycle တစ်လျှောက် စစ်ရန်။ ရှိပြီးသား ledger records ကို ထိန်းရန်။ |
| Medium | Marketplace media bucket သည် public ဖြစ်သည်။ Storage စည်းမျဉ်းများသည် owner path နှင့် file အမျိုးအစား/အရွယ်အစားကို သတ်မှတ်ထားပြီး authenticated feed အတွင်း ပုံကိုလည်း public URL ဖြင့် သုံးသည်။ Application row ကို သက်ဆိုင်ရာ Client/Freelancer က API မှ ဖတ်နိုင်ပြီး ထို row တွင် email ပါသည်။ | Public ပုံနှင့် application contact တို့ကို UI တွင် တင်မီ ရှင်းပြပြီး retention၊ ဖယ်ရှားမှုနှင့် ပုံဆိုင်ရာ ခွင့်ပြုချက်ကို သတ်မှတ်ရန်။ |
| Medium | Vercel config က frame၊ MIME နှင့် referrer header များပေးသော်လည်း CSP မသတ်မှတ်ထားပါ။ Browser အတွင်း Supabase session သိမ်းထားသဖြင့် script ခွင့်ပြုချက်ကို လျှော့ချခြင်းက အရေးကြီးသည်။ | Inline theme script နှင့် ခွင့်ပြုထားသည့် Supabase/Storage origin များကို စာရင်းပြုပြီး staging တွင် CSP report-only မှ စမ်းရန်။ |
| Medium | Job feed၊ application lists နှင့် messaging history တွင် database ရလဒ်ကန့်သတ်ချက်ကို ကျော်သည့်အခါ ဆက်ကြည့်ရန် စနစ်မပြည့်စုံပါ။ Notifications က နောက်ဆုံး ၁၀၀ ခုကိုသာ တင်သည်။ Auth စာမျက်နှာအချို့က service error စာသားကို တိုက်ရိုက်ပြသည်။ | စာမျက်နှာခွဲဖတ်ခြင်း၊ တည်ငြိမ်သော sort key နှင့် စစ်ထားသော error message များ ထည့်ရန်။ |
| Low | Browser tests တွင် dashboard keyboard menu၊ မိုဘိုင်းနှင့် tablet အကျယ်တို့ ပါပြီး Admin၊ Auth recovery နှင့် accessibility အပြည့်အစုံအတွက် သီးခြား browser coverage လိုသည်။ | Keyboard focus၊ screen-reader status နှင့် 320px viewport ကို သက်ဆိုင်ရာ workflow တစ်ခုချင်းစီ စစ်ရန်။ |

**Marketplace နှင့် ခွင့်ပြုချက်။** Job နှင့် application ရေးသားခွင့်ကို role၊ ပိုင်ရှင်နှင့် ဆက်နွှယ်မှုအလိုက် database က စစ်သည်။ Hire မှ contract ဖန်တီးမှု၊ အလုပ်ပြီးဆုံးမှ review ခွင့်၊ စကားဝိုင်းအဖွဲ့ဝင်နှင့် သတိပေးချက်ပိုင်ရှင် စစ်ဆေးမှုတို့ကို migrations နှင့် fixture tests တွင် ထည့်ထားသည်။ Admin RPC များသည် သီးသန့် admin registry ကို စစ်သည်။ Staging Client/Freelancer စမ်းသပ်မှုက အဓိက workflow များကို လွှမ်းခြုံပြီး admin လုပ်ငန်းစဉ်နှင့် production Auth settings အတွက် ထပ်စစ်ရန်လိုသည်။

**အဖွဲ့ဝင်အစီအစဉ်။** Free၊ Plus နှင့် Gold လစဉ် quota များမှာ Client အလုပ်ကြော်ငြာ ၂/၁၀/၃၀ ခုနှင့် Freelancer လျှောက်လွှာ ၅/၃၀/၈၀ ခု ဖြစ်သည်။ Premium ကိုလည်း သီးခြားရှိပြီး ၁၀၀/၂၀၀ သတ်မှတ်ထားသည်။ Plan ကို account role အလိုက် ခွဲထားပြီး job/application insert trigger က အသုံးပြုမှုကို transaction အတွင်း စစ်သည်။ အစီအစဉ်ဝယ်ယူမှုနှင့် အလိုအလျောက်သက်တမ်းတိုးခြင်းကို simulated KAV ဖြင့်သာ ချိတ်ထားသည်။ အသုံးပြုသူသည် ကိုယ်ပိုင် entitlement ကို ဖတ်နိုင်ပြီး ledger table များကို တိုက်ရိုက် အသုံးမပြုနိုင်ပါ။

## ယခင်သုံးသပ်ချက်မှတ်တမ်း

Audit baseline: branch `codex/marketplace-data-foundation`, including migration 013 financial sandbox source work (2026-11-19). This is a code/documentation review plus the staging and browser tests recorded for this development environment. A feature is not marked complete merely because a table or screen exists.

## Current implementation

| Area | Present in repository | Readiness and gap |
| --- | --- | --- |
| Authentication and role separation | Supabase Auth, Client/Freelancer routes, settings, reset flows | Earlier staging role journeys were recorded as passing; the latest authenticated rerun is skipped because QA browser sessions are unavailable. Email-change confirmation depends on buyer SMTP/inbox setup. Production configuration is intentionally outside scope. |
| Marketplace | Jobs, search/filter, apply/withdraw, applicant review, accept/reject, client/freelancer dashboards | Core flows exist; recent authenticated staging rerun is blocked by missing browser sessions. No real payment or secured funding is implied by acceptance. |
| Social network | Professional posts, media, likes/comments, connections, sharing | Present; earlier staging regression passed, but current authenticated retest remains pending. It is not a general-purpose social/moderation operations suite. |
| Messaging and notifications | Job/personal message folders, shared-post context, unread/read state, notifications, per-user hides, redaction | Present; authenticated behavior needs a fresh staging retest. Realtime behavior depends on Supabase project settings/network and should be monitored by a buyer. |
| Contracts and reviews | Active/completed/disputed status, participant access, two-way review flow | Contract tracking exists; there is no funds ledger, real escrow, formal dispute case workflow, provider reconciliation, or legally enforceable payment guarantee. |
| Member safety | Block, mute and report submission with RLS-backed rules | User-side reporting exists; trusted admin moderation is coded but awaits a staging admin identity. Appeals and support SLAs remain unspecified. |
| Demo Mode | Local-only role switch, marketplace/social sample workflows, reset, responsive/theme Playwright coverage | Implemented and isolated from Supabase; no wallet/membership/ad rewards are represented as real value. |
| Admin and ownership controls | Trusted-admin-only Admin route and dashboard; trusted registry RPC, never profile role | Migration 012 is applied to staging. One dedicated temporary QA Admin identity was verified and granted staging-only access; actual UI/login, non-admin and revocation tests await a browser session. Migration 013 is not applied. |
| Memberships | Candidate migration 013 adds role-specific catalog, monthly credits, configured simulated-KAV purchase/renewal and safe Free fallback | Branch-only pending isolated CI and separate staging approval. Catalog prices remain blank until buyer configuration; no real billing or real paid benefits. |
| KAV/USDT | Demo Mode local ledger; candidate migration 013 implements authenticated KAV-only sandbox RPCs | Uses fixed `1 USDT = 1 KAV` for simulation, journal balancing, sample funding/withdrawal, milestone holds/releases/refunds/disputes and configured commission. Migration is not applied to staging. No real provider, funds, or payout. |
| Ads/rewards | Demo Mode bounded reward; candidate migration 013 adds capped authenticated sample credits | Migration is not applied to staging. No real ad network, views, or cash-equivalent rewards. |
| Financial reports | None | No actual financial activity exists; reporting should wait for a reviewed ledger. Demo analytics must be labeled simulated. |
| Configuration/transferability | Vite public Supabase config, Vercel rewrites, CI, migration/test suite | Existing Supabase key name is supported; build rejects privileged keys. Buyer docs exist; Admin settings/catalog foundation is present, but not every branding/pricing/feature value is wired to product behavior. |

## Highest-risk weaknesses

1. Temporary Admin privilege is present only for the verified staging QA identity. Authentication/UI testing and subsequent admin/session revocation remain to be completed.
2. Migration 013 must complete isolated PostgreSQL CI and separate staging approval before persistent sandbox behavior is enabled. Do not claim its controls are live on staging.
3. No real financial system exists. Avoid wallet balances and payment claims; acceptance is not funding.
4. Moderation and audit UI is implemented but awaits a trusted staging admin identity and authenticated workflow verification.
5. Public frontend configuration is necessarily visible. Only publishable keys may be included; trusted jobs/provider integrations need a buyer-owned server environment and secret manager.
6. Production Supabase/Vercel state is deliberately not inspected or modified in this development goal. Buyers need a fresh ownership and production-readiness review.

## Delivery milestones

1. **Transfer and configuration foundation:** safe public-key build guard; complete source/environment/deployment/ownership docs; remove stale setup claims. No migrations.
2. **Central buyer-owned product configuration:** feature flags, brand, membership catalog, commission display settings, demo rate and limits. Keep private financial enforcement server-side; migration approval required if persisted in Supabase.
3. **Admin and support operations:** migration 012 and Admin/Support UI are implemented; staging schema and security checks passed. Next verify member support requests and admin workflows using staging-only test identities, after trusted admin provisioning approval.
4. **Sandbox money model:** Demo Mode is implemented locally. Candidate migration 013 provides authenticated sandbox journal and contract milestone workflows; staging approval and verified Client/Freelancer tests remain pending. No real provider credentials.
5. **Membership and ad reward simulation:** Demo Mode is implemented locally. Candidate migration 013 adds role-specific usage enforcement, plan/config Admin controls and daily reward bounds, pending CI and staging approval. Do not activate billing or third-party ads.
6. **Buyer operations and analytics:** simulated reporting dashboards, exportable diagnostics, incident/support runbooks, localization and performance/accessibility review.
7. **Release hardening:** isolated buyer-owned staging project, full Client/Freelancer/Admin Playwright coverage, security review, CI, deployment rehearsal and transfer checklist.

Each milestone must pass lint, unit tests, production build and relevant Playwright/CI checks before its own feature-branch commit. Database changes require a reviewed additive migration, CI fixture pass, explicit staging approval and post-migration verification. Production and `main` stay outside this goal.
