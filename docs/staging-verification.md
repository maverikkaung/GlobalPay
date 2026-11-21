# TechKarvo staging verification and migration runbook

## Milestone 3.2 · စာလက်ခံမှု ပြန်လည်အတည်ပြုခြင်း

ယခင် ၇/၈ ရလဒ်တွင် personal conversation စာဝင်ခဲ့သည်။ အရင်က ဖျောက်ထားသည့် Client စကားဝိုင်းကို ပြန်ပြရန် browser က `conversation_hides` မှတ်တမ်းကို ဖယ်ရှားရန် ကြိုးစားပြီး စမ်းသပ်မှု၏ guard က တားခဲ့သည်။ ဖယ်ရှားမှုကျသည်နှင့် စကားဝိုင်းစာရင်း ဖတ်ရှုမှုတစ်ခုလုံး ရပ်သွားသော အက်ပ်ပြဿနာနှင့် ယခင် hide ပါသော QA စကားဝိုင်းကို ပြန်သုံးသည့် စမ်းသပ်ဒေတာပြဿနာ နှစ်ခုရှိသည်။ Guard က ယခင်မှတ်တမ်းကို ကာကွယ်ခဲ့သည်။

ပြင်ဆင်ပြီးနောက် စကားဝိုင်းပါဝင်သူက ပို့သော စာအသစ်ကို PostgreSQL timestamp ဖြင့် စစ်ကာ ဖယ်ရှားမှု ငြင်းခံရလျှင်လည်း စကားဝိုင်းနှင့် စာကို ပြသည်။ ပုံမှန်ပြန်ဖွင့်မှုအတွက် ရေးသားမှုတွင် အကောင့်၊ စကားဝိုင်းနှင့် မူလ `hidden_at` အတိအကျ ကိုက်ရမည်။ အခြားအကောင့်၏ hide ကို ဖတ်ခြင်း သို့မဟုတ် ဖယ်ရှားခြင်းကို SQL fixture က ငြင်းပယ်ကြောင်း စစ်သည်။ QA guard က ယခင် profile ပုံအပါအဝင် လက်ရှိ run တွင် ဖန်တီးကြောင်း သက်သေမရှိသော record အားလုံးနှင့် conversation hide ဖယ်ရှားမှုများကို တားသည်။ Staging suite တွင် အတည်ပြုထားသည့် စကားဝိုင်းနှင့် စာပေါ်တွင်ပင် လက်ခံမှု၊ ဖတ်ပြီးကြောင်းနှင့် စာဖယ်ရှားမှုကို ဆက်စစ်သည်။

စက်တွင်း browser ၆ အောင်၊ ၀ ကျ၊ ၀ ကျော် ဖြစ်သည်။ ၎င်းတွင် ဖယ်ရှားမှု ငြင်းခံရသည့် စာလက်ခံမှုနှင့် စာဟောင်း၊ timestamp တူသော စာ၊ ကိုယ်တိုင်ပို့သော စာတို့ကြောင့် ဖျောက်ထားမှု မပြောင်းသည့် စမ်းသပ်မှုနှစ်ခု ပါဝင်သည်။ ယူနစ် ၇၆/၇၆၊ သီးခြား SQL ၁၁/၁၁၊ lint နှင့် production build အောင်သည်။ Staging အများသုံး browser ၄ အောင်၊ ၀ ကျ၊ ၀ ကျော် ဖြစ်သည်။ Remote history သည် 017 မှာ ဆုံးပြီး `conversation_hides` တွင် RLS ဖွင့်ထားသည်။ မူဝါဒ ၇ ခုရှိပြီး anonymous role တွင် `DELETE` ခွင့်မရှိပါ။

`5b1b260` ကို Vercel staging တင်ပြီးနောက် သက်တမ်းရှိသော QA session နှစ်ဖက်ဖြင့် ဖတ်ရှုရုံ browser စမ်းသပ်မှု **၁ အောင်၊ ၀ ကျ၊ ၀ ကျော်** ဖြစ်သည်။ ရေးသားမှု၊ session refresh နှင့် realtime ဆက်သွယ်မှုတို့ကို browser တွင် တားထားစဉ် ယခင်စမ်းသပ်စာကို Client ဘက်၌ မြင်ခဲ့သည်။ မူလ hide နှင့် စာ၏ ဖတ်ပြီးအခြေအနေ အပါအဝင် ရွေးထားသည့် တန်ဖိုးများ မစမီနှင့် ပြီးနောက် အတိအကျ တူသည်။ Backend သို့ ရေးသားမှု ၀ ခု ပို့ခဲ့သည်။ GitHub Actions ၏ `verify` နှင့် `database-migrations` နှစ်ခုလုံး အောင်သည်။

ဒေတာရေးသော staging suite အပြည့်အစုံကို ဤအဆင့်တွင် မလုပ်ခဲ့ပါ။ နောက်တစ်ကြိမ် မလုပ်မီ ယခင် hide နှင့် အခြား QA မှတ်တမ်းများကို ထိန်းထားနိုင်သည့် သီးခြား QA စကားဝိုင်းကို အတည်ပြုပြီး ရေးသားမှုနှင့် ဖယ်ရှားမှု အတိုင်းအတာကို ဖော်ပြကာ ခွင့်ပြုချက် ရယူရမည်။

## Migration 015–017 · နောက်ဆုံး staging အတည်ပြုချက်

အကောင့်အတည်ပြုထားသော read-only ဆက်သွယ်မှုဖြင့် `techkarvo-staging` (`ntucgiieksrwebwvcmun`) နှင့် remote history **000–017** ကို အတည်ပြုသည်။ QA ဒေတာရေးသည့် စမ်းသပ်မှု မစမီ JSONB row များကို key ၏ UTF-8 byte အစီအစဉ်အလိုက် စီပြီး timestamp များကို UTC သို့ ပြောင်းကာ SHA-256 သီးခြား baseline များ သိမ်းထားသည်။

| အုပ်စု | Row | မရေးမီ SHA-256 |
| --- | ---: | --- |
| အစီအစဉ် catalog | 8 | `90b251f1080984f1459acbe44a8cb4cc4d982727664e45a4dc5b109577da4ccf` |
| Membership entitlement | 21 | `ea0ca155ff77c607c335ac43bd05bec1c5697543ebe38858f4c6b91ef548a714` |
| လစဉ် quota | 21 | `6594687e14978a931c8f96d86ca6563c130453e222377d50a124611dc05bbbd9` |
| အသုံးပြုမှုမှတ်တမ်း | 23 | `583645392e3d78bfc02d7e894a456051d1b4c059fb9e95bf0cc24d5549603719` |
| Sandbox configuration | 1 | `e30eeaefb641b2d58a26b6e6a02db7a2c483db514fb62c894c30ced1124761c0` |
| စမ်းသပ် ledger | 88 | `f8e3e759c43a22d9033a8f7156b4d3188ae94bbb91d37f0891e00c10d4cd5bf0` |

Ledger အုပ်စုတွင် account ၁၆ ခု၊ transaction ၂၄ ခုနှင့် entry ၄၈ ခု ပါဝင်သည်။ ယခင်ဖြစ်ရပ်၏ `renewal_consent` event တစ်ခုနှင့် တူညီသော transaction တွင် ပြောင်းခဲ့သည့် `auto_renew`/`updated_at` အထောက်အထားကို အောက်ပါ ဖြစ်ရပ်မှတ်တမ်းတွင် ထိန်းထားသည်။ မူလ account ID နှင့် row တန်ဖိုးများ မပါဝင်ပါ။ စစ်ဆေးမှုအစတွင် RLS policy ၁၇၅ ခု၊ function grants နှင့် role ခွဲခြားမှု ကိုက်ညီပြီး ledger စည်းမျဉ်းချိုးဖောက်မှု ၀ ခု ဖြစ်သည်။

အများသုံးနှင့် Client ဖတ်ရှုရုံ Playwright ရွေးချယ်မှုတွင် ၅ အောင်၊ ၀ ကျ၊ ၀ ကျော် ဖြစ်သည်။ QA ရေးသားမှုနှင့် simulated ledger entry အသစ်အတွက် သီးခြားခွင့်ပြုချက်ရပြီးမှ အပြည့်အစုံ run စသည်။ ပုံဖိုင် cleanup ကို account ပိုင်ကြောင်း၊ လက်ရှိ QA profile တွင် ရည်ညွှန်းထားကြောင်း၊ အခြား profile/post က မသုံးကြောင်းနှင့် စမ်းသပ်ပုံဖိုင်၏ byte တူကြောင်း စစ်ထားသည့် ဖိုင်များအထိ ကန့်သတ်သည်။ Post နှင့် message ဖယ်ရှားမှုကို ယခု run ထဲမှ အောင်မြင်သော insert နှင့် ပိုင်ရှင်ကို တိုက်စစ်ထားသည့် record ID များအထိ ကန့်သတ်သည်။ သက်သေမရှိသော ဖယ်ရှားမှုကို တားပြီး အမျိုးအစားကိုသာ ဖော်ပြသည်။

**ခွင့်ပြုထားသည့် အပြည့်အစုံ run တစ်ကြိမ်။** Playwright **၇ အောင်၊ ၁ ကျ၊ ၀ ကျော်** ဖြစ်သည်။ အများသုံး ၄ ခု၊ QA နှစ်ဖက် လော့ဂ်အင်နှင့် ချိတ်ဆက်မှု၊ Client applicant filters နှင့် နှစ် role ၏ financial sandbox အောင်သည်။ Marketplace အပြည့်အစုံစမ်းသပ်မှုတွင် Freelancer မှ ပို့သော စမ်းသပ် message ရှိကြောင်း တွေ့သော်လည်း Client ဘက်၌ မပေါ်ခြင်းကြောင့် ကျသည်။ ထို message ထက် အရင်ကတည်းက ရှိသော Client conversation hide ကို ဖတ်ရှုရုံ စစ်၍ တွေ့သည်။ App က message အသစ်ရလျှင် hide row ကို ဖျက်ကာ စကားဝိုင်း ပြန်ပြသည့် လုပ်ဆောင်ချက် ရှိသည်။ ဤအချိန်တွင် guard က ခွင့်ပြုစာရင်းပြင်ပ deletion request တစ်ခုကို တားခဲ့ပြီး နောက်ပိုင်း ကဏ္ဍများကို မရောက်ခဲ့ပါ။ ခွင့်ပြုထားသည့် run ကို မထပ်လုပ်ခဲ့ပါ။

QA run ပြီးနောက် အမည်ဖယ် row fingerprint ဖြင့် **မူလ ledger row ၈၈/၈၈** အတိအကျ တူကြောင်း စစ်သည်။ Simulated deposit ၂ ခု၊ withdrawal ၂ ခုနှင့် ၎င်းတို့၏ entry ၈ ခု ထပ်တိုးသည်။ Ledger account ၁၆ ခု၊ transaction ၂၈ ခု၊ entry ၅၆ ခု ရှိပြီး စာရင်းစည်းမျဉ်းချိုးဖောက်မှု ၀ ခု ဖြစ်သည်။ RLS policy ၁၇၅ ခု၊ grants၊ role separation နှင့် remote history 017 တူညီသည်။ ယခင် `renewal_consent` event တစ်ခုကို ထိန်းထားပြီး usage event စုစုပေါင်း ၂၅ ခု ဖြစ်လာသည်။

| အုပ်စု | Row | Run ပြီးနောက် SHA-256 |
| --- | ---: | --- |
| `membership_catalog` | 8 | `90b251f1080984f1459acbe44a8cb4cc4d982727664e45a4dc5b109577da4ccf` |
| `entitlements` | 21 | `27c640ed587941aca3086508002bb5e2c1d0421738bdac8d74b5e13f0f3f1578` |
| `monthly_quota` | 21 | `8b3b60d879e0049113297756913899b2b65c574126fe5eb1f1d0e1969db7a359` |
| `usage_events` | 25 | `1ac52006f952d05117103ae13b9bb94cd22a5d3b570fcd0871af44675567eba9` |
| `sandbox_configuration` | 1 | `e30eeaefb641b2d58a26b6e6a02db7a2c483db514fb62c894c30ced1124761c0` |
| `financial_ledger` | 100 | `46d915e320e1066d39fafef8bcdfa75d750f74b101914c741bdc77d75bd456ea` |

Unit/regression **၇၆/၇၆**၊ သီးခြား SQL **၁၁/၁၁**၊ lint နှင့် production build အောင်သည်။ Guard ၏ စမ်းသပ်ကုဒ်ကို local တွင် ထားထားပြီး အပြည့်အစုံ workflow အောင်မြင်မှု မရသဖြင့် branch သို့ အတည်ပြုမှတ်တမ်းကိုသာ တင်ရန် ရွေးထားသည်။ နောက်တစ်ကြိမ် အပြည့်အစုံ ပြန်စမ်းမည်ဆိုလျှင် ယခင်ရှိပြီးသား hide ကို ထိန်းထားနိုင်မည့် သီးခြား QA အခြေအနေ သို့မဟုတ် ထို row ကို ဖယ်ရှားခွင့် သီးခြား လိုသည်။

## Migration 017 · Membership fingerprint ဖြစ်ရပ် စစ်ဆေးချက်

**အတည်ပြုချက်။** Authenticated read-only ဆက်သွယ်မှုက `techkarvo-staging` (`ntucgiieksrwebwvcmun`) နှင့် migration history **000–017** ကို ပြန်အတည်ပြုသည်။ 017 တင်ပြီးနောက် membership fingerprint မကိုက်ခြင်းသည် အချက်အလက် အမှန်ပြောင်းလဲမှုဖြစ်သည်။ ပြောင်းလဲမှုမှာ သက်တမ်းတိုးရွေးချယ်မှုဆိုင်ရာ သီးခြား transaction တစ်ခု ဖြစ်သည်။

**တိုက်စစ်နည်း။** Post-016 backup ဖိုင် ၃ ခု၏ SHA-256 ပြန်ကိုက်ကြောင်း စစ်ပြီး ကွန်ရက်မရှိသော သီးခြား PostgreSQL တွင် read-only mount မှ ပြန်ထည့်သည်။ Restore database တွင် မူလ MD5 တွက်နည်းပြန်သုံးရာ မတင်မီ guard fingerprint နှင့် အတိအကျ ကိုက်သည်။ ထို့နောက် row key ကို အမည်ဖယ်၍ byte အလိုက် စီပြီး JSONB column များ၊ UTC သို့ ပြောင်းထားသော timestamp များနှင့် SHA-256 တို့ဖြင့် ဇယား၊ row နှင့် column အလိုက် ပြန်တိုက်စစ်သည်။ စစ်ထားသော schema မကွာဘဲ နှစ်ဖက် timezone တူသည်။ Timestamp ဖော်ပြပုံတစ်ခုတည်းကြောင့် ကွာသည့် row **၀ ခု** ဖြစ်သည်။

| စစ်ဆေးသည့်အပိုင်း | မတင်မီ → လက်ရှိ | ကွာခြားချက် |
| --- | --- | --- |
| `membership_plans` | ၈ → ၈ | Catalog နှင့် row များ တူညီသည်။ |
| `membership_entitlements` | ၂၁ → ၂၁ | Row တစ်ခုတွင် `auto_renew` နှင့် `updated_at` သာ ပြောင်းသည်။ |
| လစဉ် quota နှင့် သုံးပြီးသား credits | ၂၁ → ၂၁ | သက်တမ်းအပိုင်း၊ ခွင့်ပြု quota နှင့် သုံးပြီးသား credit အားလုံး တူညီသည်။ |
| `membership_credit_events` | ၂၂ → ၂၃ | `renewal_consent` event တစ်ခုသာ ထပ်တိုးသည်။ အရင် row ၂၂ ခု တူညီသည်။ |
| `financial_sandbox_config` | ၁ → ၁ | Row နှင့် configuration တူညီသည်။ |

**ဖြစ်ရပ်၏ သက်သေ။** Event အသစ်နှင့် ပြောင်းသွားသော entitlement row တို့၏ transaction နှင့် မှတ်တမ်းတင်ချိန် ကိုက်ညီသည်။ Event ၏ အမျိုးအစား၊ key ပုံစံနှင့် actor/subject ဆက်စပ်မှုသည် 017 က မပြောင်းခဲ့သော `techkarvo_set_membership_auto_renew` လုပ်ဆောင်ပုံနှင့် ကိုက်ညီသည်။ ထို transaction သည် 017 ၏ function definition နှစ်ခုကို ရေးသည့် transaction နှင့် သီးခြားဖြစ်ပြီး transaction ID စဉ်အရ အရင်ဖြစ်သည်။ 017 SQL ၏ အပေါ်ဆုံးအဆင့်တွင် function နှစ်ခု အစားထိုးခြင်းသာ ရှိသည်။ တောင်းဆိုချက်သည် UI၊ automation သို့မဟုတ် အခြား client မည်သည့်နေရာမှ လာကြောင်း ဤအထောက်အထားဖြင့် သီးခြားမသိနိုင်ပါ။ အကောင့်အမည်၊ ID၊ ရွေးချယ်ထားသော တန်ဖိုးနှင့် transaction ID များကို မှတ်တမ်းထဲ မထည့်ထားပါ။

**လုံခြုံရေးနှင့် ငွေစာရင်း။** RLS policy **၁၇၅/၁၇၅**၊ table RLS flags၊ activation/usage trigger grants၊ feature grants နှင့် role ခွဲခြားမှုတို့ မတင်မီ baseline နှင့် ကိုက်ညီသည်။ Ledger account **၁၆** ခု၏ လက်ကျန်နှင့် ledger transaction **၂၄** ခု၊ entry **၄၈** ခု အားလုံး တူညီသည်။ မညီသော journal၊ အနုတ်လက်ကျန်၊ owner/actor/entry/reward ဆက်စပ်မှတ်တမ်း ပျောက်မှုနှင့် စမ်းသပ်အဖြစ် မသတ်မှတ်သော transaction **၀** ခု ဖြစ်သည်။

**နောက်အဆင့်။** မူလ baseline နှင့် ရှင်းပြပြီးသော ကွာခြားချက် နှစ်ခုစလုံးကို ထိန်းထားရန်။ နောင်တင်ပြီး စစ်ဆေးရာတွင် ဇယားအလိုက် တည်ငြိမ်သော fingerprint သုံးပြီး မျှော်လင့်မထားသော ကွာခြားချက်ရှိလျှင် ဆက်ရပ်ရန်။ ယခုအထောက်အထားအရ ပြင်ဆင်ရေးသားမှု သို့မဟုတ် rollback လိုအပ်ကြောင်း မတွေ့ပါ။ Remote ပြင်ဆင်မှု လိုလာလျှင် သီးခြား အတိအလင်း ခွင့်ပြုချက် ရယူရမည်။

## Migration 017 · မတင်မီ အတည်ပြုချက်

Authenticated read-only query ဖြင့် `techkarvo-staging` (`ntucgiieksrwebwvcmun`) နှင့် migration history **000–016** ကို အတည်ပြုသည်။ ခွင့်ပြုထားသော reference နှင့် hash တူသည့် SQL ဖိုင်များ ပါဝင်သော သီးသန့် workdir ဖြင့် dry run လုပ်ရာ **`202611150017_harden_membership_quota_and_sandbox_pause.sql` တစ်ဖိုင်တည်း** ရွေးသည်။ 017 ကို remote တွင် မတင်ရသေးပါ။

| စစ်ဆေးချက် | ရလဒ် |
| --- | --- |
| Backup အသစ် | 016 တင်ပြီးနောက် staging PostgreSQL roles၊ schema နှင့် data ကို private ACL ပါသော `LOCALAPPDATA` ဖိုလ်ဒါအသစ်တွင် သိမ်းသည်။ ဖိုင်လမ်းကြောင်း၊ အရွယ်အစားနှင့် SHA-256 ကို ၃/၃ အတည်ပြုသည်။ |
| Restore | ကွန်ရက်မရှိသော PostgreSQL 17 container ထဲ read-only mount မှ ပြန်ထည့်သည်။ Schema၊ history၊ function definitions/grants၊ membership/usage နှင့် ledger အပါအဝင် ၂၄/၂၄၊ RLS policy ၁၇၅/၁၇၅ ကိုက်ညီသည်။ Container ကို ရပ်ပြီး backup ကို ထိန်းထားသည်။ |
| Staging baseline | Plan ၈ ခု၊ entitlement ၂၁ ခု၊ usage event ၂၂ ခု၊ ledger account ၁၆ ခု၊ transaction ၂၄ ခု၊ entry ၄၈ ခု ဖြစ်သည်။ စာရင်းမညီမှု၊ အနုတ်လက်ကျန်၊ ဆက်စပ် row ပျောက်မှု၊ စမ်းသပ်အဖြစ် မသတ်မှတ်မှုနှင့် role မကိုက်မှု ၀ ခု ဖြစ်သည်။ Browser role များ၏ အတွင်းသုံး function ခွင့်နှင့် တိုက်ရိုက် ledger/entitlement ခွင့်ကို တိုက်စစ်ထားသည်။ |
| 017 စမ်းသပ်ချက် | သီးခြား PostgreSQL မှာ quota လျှော့ချမှုနှင့် လက်ရှိလ သုံးပြီးသား credit ကို ထိန်းခြင်း၊ sandbox ပိတ်ထားချိန် paid purchase/reward/deposit/withdrawal ငြင်းခြင်း၊ ငွေမဖြတ်ဘဲ Free သို့ ပြောင်းခြင်း၊ အကျုံးဝင်သော renewal တစ်ကြိမ်သာ ဖြတ်ခြင်းနှင့် ထပ်ဖြတ်ခြင်းကို တားခြင်းတို့ အောင်သည်။ အမည်ဖယ် projection ပေါ် 017 စမ်းသပ်ရာ ပြောင်းလဲသည့် function နှစ်ခုသာ တွေ့ပြီး ရှိပြီးသား membership၊ quota နှင့် ledger row များ တူညီသည်။ |
| Regression | Unit/regression ၇၄/၇၄၊ သီးခြား SQL ၁၁/၁၁၊ lint နှင့် production build အောင်သည်။ |

**ကျန်ရှိသော အန္တရာယ်နှင့် ခွင့်ပြုချက်။** Backup သည် ထုတ်ယူချိန်အခြေအနေကိုသာ ဖုံးလွှမ်းပြီး Storage ဖိုင်များ၏ မူလအကြောင်းအရာ မပါဝင်ပါ။ 017 တင်ပြီးနောက် plan limit လျော့လျှင် အကျုံးဝင် quota ချက်ချင်းလျော့ပြီး sandbox ပိတ်ထားစဉ် သက်တမ်းကုန်သော paid plan ကို နောက်ထပ် အသုံးပြုချိန် Free သို့ ပြောင်းနိုင်သည်။ Remote မတင်မီ reference၊ history၊ ledger baseline၊ backup checksum နှင့် 017 တစ်ဖိုင်တည်း ရွေးထားမှုကို ပြန်စစ်ပြီး သီးခြား အတိအလင်း အတည်ပြုချက် ရယူရမည်။

## Migration 016 · တင်ပြီးနောက် အတည်ပြုချက်

Authenticated read-only query ဖြင့် `techkarvo-staging`၊ project reference `ntucgiieksrwebwvcmun` နှင့် migration history **000–016** ကို အတည်ပြုသည်။ 017 ကျန်သည်။ ယခင် entitlement query ရပ်ခဲ့မှုကို ပြန်စမ်းရာ target အတိအကျ မှန်ပြီး SQL က `techkarvo_current_featured_job_ids` အတွက် execute ခွင့်မရှိကြောင်း ပြန်သည်။ Management read-only role တွင် အများသုံး RPC နှင့် အတွင်းသုံး helper နှစ်ခုလုံး၏ execute ခွင့် မရှိပါ။ ယခင် စစ်ဆေးချက်က CLI exit code နှင့် target label ကို အခြေအနေတစ်ခုတည်းထဲ ထည့်ထားသဖြင့် SQL ခွင့်ပြုချက်အမှားကို identity အမှားဟု ဖော်ပြခဲ့သည်။

**စစ်ဆေးပုံ ပြင်ဆင်ချက်။** Authenticated target အမည်နှင့် reference ကို အရင် သီးခြားစစ်ပြီး SQL exit code ကို သီးခြား စစ်သည်။ Database catalog နှင့် profile view ကို management read-only ဆက်သွယ်မှုကနေ စစ်သည်။ အများသုံး featured RPC ကို anonymous browser မှ ခေါ်ပြီး စစ်သည်။ သက်တမ်း၊ role၊ active အခြေအနေနှင့် catalog ပြောင်းလဲမှုကို သီးခြား database မှာ အခြေအနေတစ်ခုချင်း ပြောင်းပြီး စမ်းသည်။ ခွင့်ပြုချက် မပြောင်းဘဲ စစ်ဆေးခဲ့သည်။

| စစ်ဆေးချက် | အတည်ပြုရလဒ် |
| --- | --- |
| RLS နှင့် ခွင့်ပြုချက် | RLS policy ၁၇၅ ခု၊ ရှိပြီးသား function grant များ၊ unrelated function များ၏ fingerprint နှင့် profile view ခွင့်ပြုချက်တို့ pre-deployment baseline နှင့် ကိုက်ညီသည်။ `anon` နှင့် `authenticated` သည် အတွင်းသုံး helper ကို တိုက်ရိုက် execute မလုပ်နိုင်သည်။ နှစ် role လုံးက အများသုံး featured RPC ကို execute လုပ်နိုင်သည်။ |
| Membership အကျိုးခံစားခွင့် | Staging catalog မှ အကောင့်/အကျိုးခံစားခွင့် အတွဲ ၁၂၆ ခုအနက် ၁၁၉ ခု အကျုံးမဝင်ဟု သီးခြားတွက်ချက်သည်။ အဲဒီတွက်ချက်မှုနှင့် freelancer profile view ရလဒ် ၁၁ ခုလုံး ကိုက်ညီသည်။ Anonymous browser က featured RPC ကို ခေါ်နိုင်ပြီး browser တုံ့ပြန်ချက်ထဲမှာသာ ထည့်ထားသော စမ်းသပ် ID ကို RPC က ပြန်မပေးခဲ့ပါ။ |
| ရှိပြီးသားဒေတာ | Plan ၈ ခု၊ entitlement ၂၁ ခု၊ usage event ၂၂ ခု၊ ledger account ၁၆ ခု၊ transaction ၂၄ ခုနှင့် entry ၄၈ ခု၏ fingerprint မပြောင်းပါ။ Job၊ application နှင့် profile fingerprint လည်း တူညီသည်။ စာရင်းမညီမှု၊ အနုတ်လက်ကျန်၊ ဆက်စပ်သာဓကပျောက်မှု၊ စမ်းသပ်အဖြစ် မသတ်မှတ်ထားသော transaction နှင့် membership role မကိုက်မှု ၀ ခု ဖြစ်သည်။ |
| စမ်းသပ်ချက် | Unit/regression ၇၄/၇၄၊ 016 အထိ သီးခြား PostgreSQL ၁၁/၁၁၊ အများသုံး staging Playwright ၄/၄ နှင့် anonymous jobs/RPC စမ်းသပ်ချက် ၁/၁ အောင်သည်။ Lint နှင့် production build အောင်သည်။ |

အကောင့်ဝင်ရသော staging စမ်းသပ်မှုများကို QA session ဖိုင်နှင့် staging record မပြောင်းစေရန် မရွေးခဲ့ပါ။ စစ်ဆေးထားသောအပိုင်းများတွင် ဖြေရှင်းရန် အတားအဆီး မကျန်ပါ။ 017 remote deployment အတွက် သီးခြားအတည်ပြုချက် လိုသည်။

## Migration 015 · မတင်မီ စစ်ဆေးချက် ပြန်လည်အတည်ပြုခြင်း

### အမှားဖြစ်ရသည့် အကြောင်းရင်း

- **Dry run။** ယာယီ workdir အသစ်ဖြင့် ပြန်လုပ်ရာ ပထမ dry run ၏ target line တွင် `ntucgiieksrwebwvcmun` ပါပြီး `techkarvo-staging` အမည် မပါပါ။ တူညီသော workdir ကို ထပ်သုံးသောအခါ အမည်နှင့် reference နှစ်ခုလုံး ပါသည်။ အမည်နှင့် ကွင်းစကွင်းပိတ်ပါသည့် ပုံစံတစ်မျိုးတည်းကို လိုအပ်ခဲ့သော စစ်ဆေးချက်ဟောင်းက ပထမ output ကို ငြင်းခဲ့သည်။ ပထမနှင့် ဒုတိယ dry run နှစ်ခုလုံး exit code 0 ဖြစ်ပြီး `202611150015_preserve_membership_cycle_usage.sql` တစ်ဖိုင်တည်း ရွေးခဲ့သည်။
- **Backup manifest။** Windows PowerShell တွင် `@(Get-Content -Raw … | ConvertFrom-Json)` က ဖိုင် ၃ ခုပါ JSON array ကို အပြင်ဘက် array တစ်ခုထဲ ထပ်ထည့်ခဲ့သည်။ ဖိုင် ၃ ခုအစား count ၁ ဖြစ်ပြီး မျှော်မှန်းထားသည့် filename စစ်ဆေးချက်လည်း မကိုက်ခဲ့ပါ။ `ConvertFrom-Json -InputObject` ဖြင့် အရင် parse လုပ်ပြီး row တစ်ခုချင်းစီကို `foreach` ဖြင့် စစ်ရာ ဖိုင် ၃ ခုလုံး တွေ့ရသည်။

### အတည်ပြုထားသော စည်းမျဉ်းနှင့် ရလဒ်

1. **Target နှင့် ရွေးချယ်မှုကို သီးခြားစစ်ရန်။** Dry run တစ်ခုတည်းဖြင့် project identity မဆုံးဖြတ်ပါနှင့်။ Project reference အတိအကျကို သတ်မှတ်ပြီး authenticated `supabase db query --read-only` ဖြင့် project အမည်နှင့် reference တို့ကို အတည်ပြုပါ။ 015 ထက်နောက်ကျသော migration မပါသည့် workdir တွင် dry run ၏ exit code 0၊ target line ထဲ exact reference နှင့် ရွေးထားသော filename တစ်ဖိုင်တည်းကို ထပ်စစ်ပါ။ အမည်မပါသော target line ကို လက်ခံရန် authenticated identity စစ်ဆေးချက် သီးခြားအောင်ထားရပါမည်။ Reference၊ history သို့မဟုတ် ရွေးချယ်မှု မကိုက်လျှင် ရပ်ပါ။
2. **Manifest အပြည့်အစုံ စစ်ရန်။** `roles.sql`၊ `schema.sql` နှင့် `data.sql` တစ်မျိုးစီသာ ပါရမည်။ Backup ဖိုလ်ဒါ၏ private ACL၊ ဖိုင်တည်နေရာ၊ reparse point မဟုတ်ကြောင်း၊ byte အရွယ်အစားနှင့် SHA-256 ကို တစ်ခုချင်းစစ်ခဲ့ပြီး ၃/၃ ကိုက်ညီသည်။ မူရင်း backup ဖိုင်များကို ဖတ်ရှုရုံ သုံးခဲ့သည်။
3. **Restore အောင်မြင်မှု။** PostgreSQL container ကို network ဖြုတ်ပြီး backup mount ကို read-only ထားသည်။ Container စတင်နေချိန် schema restore က ရပ်သွားသဖြင့် healthy ဖြစ်ကြောင်းနှင့် schema transaction မဝင်ခဲ့ကြောင်း စစ်ပြီးမှ ပြန်စမ်းရာ roles၊ schema နှင့် data ပြန်ထည့်ခြင်း အောင်သည်။ Auth/Storage metadata၊ migration history၊ membership နှင့် ledger ပါဝင်သော တိုက်စစ်ချက် ၁၉/၁၉ နှင့် RLS policy ၁၇၅/၁၇၅ ကိုက်ညီသည်။ Storage ဖိုင်၏ မူလအကြောင်းအရာသည် PostgreSQL အရန်ဖိုင်၏ အကျုံးဝင်မှု အပြင်ဘက်တွင် ရှိသည်။
4. **Staging လတ်တလောအခြေအနေ။** Project `techkarvo-staging`၊ reference `ntucgiieksrwebwvcmun` ကို သီးခြား authenticated read-only query ဖြင့် အတည်ပြုသည်။ Migration 000–014 တင်ထားပြီး repository တွင် 015၊ 016၊ 017 ကျန်သည်။ Ledger transaction ၂၄ ခု၊ entry ၄၈ ခု ရှိပြီး စာရင်းမညီမှု၊ အနုတ်လက်ကျန်၊ ဆက်စပ်မှတ်တမ်းပျောက်မှုနှင့် စမ်းသပ်အဖြစ် မသတ်မှတ်ထားသော transaction အားလုံး ၀ ခု ဖြစ်သည်။ ဤစစ်ဆေးမှုက deployment အတည်ပြုချက် မပေးပါ။

## အဆင့် ၃.၁ · Migration မတင်မီ အတည်ပြုချက်

**ယခင်ရလဒ်။** `6fe270a` ၏ migration 015 → 016 → 017 ကို staging မှ ရယူထားသော အမည်ဖယ် projection ပြန်ထည့်ထားသည့် သီးခြား PostgreSQL တွင် အစီအစဉ်အတိုင်း စမ်းသပ်ပြီး အောင်မြင်သည်။ ထိုစစ်ဆေးချိန်တွင် remote staging migration history က 000–014 အထိ ဖြစ်ပြီး အပြည့်အစုံ PostgreSQL backup နှင့် restore အတည်ပြုချက် ကျန်ခဲ့သည်။ နောက်ဆက်တွဲ အတည်ပြုချက်ကို အထက်တွင် မှတ်တမ်းတင်ထားသည်။

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
