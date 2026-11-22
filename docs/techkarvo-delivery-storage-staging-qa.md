# Milestone 4.3 · လက်တွေ့ Storage API အတွက် staging QA အစီအစဉ်

ဤစာတမ်းသည် အောင်မြင်ပြီးဖြစ်သော staging run တစ်ကြိမ်၏ ခွင့်ပြုချက်အတိုင်းအတာနှင့် စစ်ဆေးစာရင်း ဖြစ်သည်။ [Staging အတည်ပြုရလဒ်](staging-verification.md#milestone-43-staging-verified)

## ပစ်မှတ်နှင့် အထောက်အထား

- `techkarvo-staging` (`ntucgiieksrwebwvcmun`) ၏ အတည်ပြုထားသော migration history သည် 000–018 ဖြစ်သည်။ Public/Storage RLS policy ၁၈၈ ခု၊ Storage policy ၁၁ ခု၊ delivery function သုံးခုနှင့် မူလ schema/grant အုပ်စု ၃၁/၃၁ ကိုက်ညီသည်။ `techkarvo-contract-deliveries` သည် private ဖြစ်ပြီး `5242880` bytes နှင့် `application/pdf`၊ `image/png`၊ `image/jpeg` ကိုသာ ခွင့်ပြုသည်။ Baseline တွင် delivery နှင့် delivery object ၀ စီ ဖြစ်သည်။
- Membership plan ၈၊ entitlement နှင့် လစဉ် quota ၂၃ စီ၊ usage event ၂၉ ရှိသည်။ Ledger account ၂၂၊ transaction ၃၆၊ journal entry ၇၂ ဖြစ်ပြီး စစ်ထားသည့် ledger စည်းမျဉ်းချိုးဖောက်မှု ၀ ဖြစ်သည်။ Marketplace snapshot `2026-11-22T13:21:08Z` တွင် jobs ၄၉၊ applications ၄၈၊ contracts ၄၅၊ reviews ၂၊ profiles ၂၃၊ notifications ၂၄၂၊ conversations ၄၈၊ messages ၆၃၊ hides ၄ ရှိသည်။
- Run အတွက် အမည်ဖယ် SHA-256 လက်ဗွေ၊ တည်ငြိမ်သော fixture UUID များနှင့် account/contract allowlist ကို repository ပြင်ပ သီးသန့်ဖိုလ်ဒါမှာ သိမ်းထားသည်။ Identity allowlist တွင် Client၊ Freelancer နှင့် ထိန်းရမည့် ပြီးဆုံးစာချုပ် ID ပါသည်။ Fixture စာရင်းတွင် job၊ application နှင့် V1/V2 request UUID ပါသည်။ Repository၊ trace နှင့် log များတွင် account ID၊ credential၊ session state သို့မဟုတ် signed URL မထည့်ပါ။
- ကနဦးစစ်ဆေးထားသည့် baseline ကို ထိန်းထားပါ။ Run မစမီ staging identity၊ history၊ bucket၊ policy/grants၊ အကောင့်များ၊ existing data လက်ဗွေ၊ QA entitlement နှစ်ခု၏ အပြည့်နှင့် ခွင့်ပြုထားသည့် column နှစ်ခု ဖယ်ထားသော လက်ဗွေများကို ပြန်တိုက်စစ်ပါ။ မရှင်းပြနိုင်သော ကွာခြားမှု ရှိလျှင် ရပ်ပါ။

## QA အကောင့်များနှင့် စာချုပ်ပြင်ဆင်ပုံ

1. ယခင် ခွင့်ပြုထားသည့် staging run ၏ setup အထောက်အထားက ခွဲခြားပေးသည့် Client/Freelancer အတွဲတစ်တွဲတည်းကို သုံးပါ။ အီးမေးလ် အတည်ပြုပြီး Marketplace role နှင့် လက်ရှိ plan ကိုက်ညီသည်။ Auto-renew ပိတ်ထားပြီး ကျန် quota Client ၉၉၊ Freelancer ၂၉ ဖြစ်သည်။ အတွဲတွင် active စာချုပ် ၀၊ ပြီးဆုံးစာချုပ် ၁ ရှိသည်။ ပြီးဆုံးစာချုပ်နှင့် ၎င်း၏ job၊ application၊ reviews၊ messages၊ files နှင့် ဆက်စပ်အချက်အလက်များကို ထိန်းထားပါ။
2. Outsider အတွက် ပိုင်ရှင်က သတ်မှတ်သော ရှိပြီးသား သီးသန့် QA အကောင့်တစ်ခုကိုသာ သုံးပါ။ အကောင့်သည် ပါဝင်သူနှစ်ဦးနှင့် ကွဲပြီး Admin/Support ခွင့်မရှိရပါ။ အမည်တွင် QA ပါခြင်းတစ်ခုတည်းဖြင့် အတည်မယူပါ။ အကောင့်ကို သတ်မှတ်ပြီး ဖတ်ရှုရုံ စစ်ဆေးမှု မအောင်မချင်း run မစပါနှင့်။ Anonymous အတွက် session မပါသော context သုံးပါ။
3. Role တစ်ခုစီအတွက် သီးခြား ယာယီ browser context သုံးပြီး staging origin/ref၊ authenticated user ID နှင့် role ကို သီးသန့် allowlist ဖြင့် တိုက်ပါ။ ရှိပြီးသား session ဖိုင်များကို ထိန်းထားပါ။ Refresh token ကူးယူပြန်သုံးခြင်း၊ run အတွင်း auto-refresh နှင့် session persistence ကို ရှောင်ပါ။ Login အသစ်လိုပါက သတ်မှတ်ပြီးသား QA အကောင့်တစ်ခုလျှင် ပိုင်ရှင်ကိုယ်တိုင် တစ်ကြိမ်သာ ဝင်ရန် သီးခြား scope ထဲ ထည့်ပါ။ မျှော်မှန်း Auth side effects မှာ အကောင့်တစ်ခုလျှင် session row ၁၊ legacy refresh-token row အများဆုံး ၁၊ sign-in timestamp နှင့် ဝန်ဆောင်မှု audit ဖြစ်ရပ်များ ဖြစ်သည်။ Login ပြီးနောက် Auth baseline သီးခြားယူပါ။ သက်တမ်းကုန်လျှင် ရပ်ပါ။
4. ခွင့်ပြုချက်ရပြီးမှ reserved job/application UUID မရှိသေးကြောင်း စစ်ပါ။ Client က ရိုးရိုး marketplace authorization အောက်တွင် QA run tag ပါ synthetic job တစ်ခု တင်ပါ။ Job သည် ဖွင့်ထားချိန် staging အလုပ်စာရင်းတွင် မြင်နိုင်သည်။ Freelancer က သက်ဆိုင်ရာ job သို့ application တစ်ခု တင်ပြီး Client က ထို application တစ်ခုတည်းကို `Accepted` သတ်မှတ်ပါ။ Hire trigger မှ active contract တစ်ခု ထွက်ရမည်။ Contract ID၊ job ID၊ application ID နှင့် ပါဝင်သူနှစ်ဦးကို ပြန်တိုက်ပါ။ အခြားသူ၏ application ပေါ်လာလျှင် ရပ်ပါ။ [Contract trigger](../supabase/migrations/202611150010_contracts_blocks_safety.sql)

## စမ်းသပ်စဉ်နှင့် အောင်မြင်သတ်မှတ်ချက်

| စဉ် | စစ်ဆေးချက် |
|---|---|
| ၁ · Upload ပယ်ချမှု | V1 ၏ reserved `1.pdf` လမ်းကြောင်းတွင် disallowed `text/plain` MIME ပါ synthetic bytes နှင့် `5242881` bytes PDF တို့ကို သီးခြားတစ်ကြိမ်စီ တောင်းပါ။ နှစ်ခုလုံး ပယ်ချပြီး Storage metadata row မရှိရ။ တစ်ခုခု လက်ခံလျှင် ရပ်ပြီး အဲဒီ key ကို အစီရင်ခံပါ။ |
| ၂ · Upload နှင့် retry | အရွယ်အစား `5242880` bytes တိတိ synthetic PDF ကို Freelancer က V1 path သို့ `upsert:false`၊ `cacheControl:0` ဖြင့် တင်ပါ။ ပထမ response ကို တစ်ကြိမ် ကြားဖြတ်ပါ။ Owner၊ MIME၊ size၊ reserved path ကို ဖတ်ရှုတိုက်ပါ။ ပျောက်သွားသော response ပြန်စမ်းရန် မူလ path၊ UUID နှင့် bytes ကိုသာ သုံးပါ။ ရှိပြီးသား object တွင် duplicate response လက်ခံနိုင်ပြီး metadata နဲ့ fixture ကိုက်ညီမှ ဆက်ပါ။ Object တစ်ခုသာ ဖြစ်ရမည်။ |
| ၃ · မတင်သွင်းရသေးသော ဖိုင် | Upload အောင်ပြီး V1 မတင်မီ Client၊ တင်သူ Freelancer၊ outsider နှင့် anonymous တို့က ဖိုင်ဖတ်၍ မရ၊ signed URL ထုတ်၍ မရကြောင်း စစ်ပါ။ စမ်းသပ်တောင်းဆိုမှုများကို run ၏ reserved path များတွင်သာ ကန့်သတ်ပါ။ |
| ၄ · V1 နှင့် private download | Freelancer က မူလ V1 request UUID၊ expected latest `null` နှင့် reserved PDF path ဖြင့် `techkarvo_submit_delivery` ခေါ်ပါ။ V1 `submitted` တစ်ခုသာ ဖြစ်ရမည်။ ပါဝင်သူနှစ်ဦးစီက မိမိ session ဖြင့် စက္ကန့် ၆၀ သက်တမ်း signed URL ထုတ်ပြီး download SHA-256 ကို fixture နှင့် တိုက်ပါ။ Outsider နှင့် anonymous ရဲ့ တိုက်ရိုက်ဖတ်မှု၊ public endpoint နှင့် signed URL အသစ်ထုတ်မှု ပယ်ချခံရမည်။ |
| ၅ · သက်တမ်းကုန်မှု | Signed URL ကို memory ထဲမှာသာ ထားပါ။ Cache မသုံးသော context တွင် စက္ကန့် ၆၀ မကုန်မီ ထုတ်ပြီးသား လင့်ခ်ဖြင့် download အောင်ကြောင်း၊ ထုတ်ပြီး ၇၅ စက္ကန့်ခန့် အကြာမှာ လင့်ခ်ဟောင်း ပယ်ချကြောင်း စစ်ပါ။ ပါဝင်သူက လင့်ခ်အသစ် ထုတ်ပြီး download ပြန်အောင်ရမည်။ |
| ၆ · Revision နှင့် V2 | Client က V1 ကို feedback ဖြင့် `revision_requested` တစ်ကြိမ် သတ်မှတ်ပါ။ Freelancer က reserved `1.png` နှင့် `2.jpg` တင်ပြီး V2 request UUID၊ V1 expected latest နှင့် attachment နှစ်ခု ဖြင့် တင်ပါ။ Workroom တွင် V1၊ feedback၊ V2၊ timestamp နှင့် attachment linkage တို့ မြင်ရမည်။ မူလ payload တူညီသော submit/decision retry က မှတ်တမ်းသစ် မထပ်စေရ။ V1 အပေါ် stale decision သို့မဟုတ် conflicting decision အသစ်ကို ပယ်ချရမည်။ |
| ၇ · Approval နှင့် completion | Client က V2 ကို `approved` တစ်ကြိမ် သတ်မှတ်ပါ။ Contract ဆက် active ဖြစ်ပြီး review မရသေးရပါ။ ထို့နောက် Client က ထို QA job တစ်ခု၏ status ကို `completed` သတ်မှတ်ပါ။ Contract completion trigger လည်ပြီး သက်ဆိုင်ရာ Client/Freelancer နှစ်ဖက် review eligibility ပေါ်လာမှုကို ဖတ်ရှုစစ်ပါ။ Review မတင်ပါ။ Ledger နှင့် sandbox milestone လက်ဗွေများ တူညီရမည်။ |

စမ်းသပ်ဖိုင်များအားလုံးကို local synthetic fixtures အဖြစ် ထုတ်ပါ။ Signed URL သည် သက်တမ်းအတွင်း URL ရရှိသူက သုံးနိုင်သော လျှို့ဝှက်လင့်ခ် ဖြစ်သည်။ Trace၊ HAR၊ screenshots၊ application log နှင့် ပြန်သုံးရန် fixture တို့တွင် URL မသိမ်းပါ။ [Supabase private download နှင့် သက်တမ်း](https://supabase.com/docs/guides/storage/serving/downloads)

## အတိအကျ ရေးသားခွင့်

| ဇယား | အသစ်ထည့်မှု | ပြင်ဆင်မှု |
|---|---:|---|
| `jobs` | ၁ | Run job status `completed` တစ်ကြိမ် |
| `job_applications` | ၁ | Run application status `Accepted` တစ်ကြိမ် |
| `contracts` | Hire trigger ၁ | Run contract ၏ status နှင့် `completed_at` တစ်ကြိမ် |
| `contract_deliveries` | V1၊ V2 စုစုပေါင်း ၂ | V1 revision နှင့် V2 approval စုစုပေါင်း ၂ |
| `notifications` | `application_received` နှင့် `application_accepted` စုစုပေါင်း ၂ | ၀ |
| `membership_entitlements` | ၀ | QA နှစ်ဦးစီ၏ `credits_used +1` နှင့် `updated_at` စုစုပေါင်း ၂ ကြိမ် |
| `membership_credit_events` | `job_post` နှင့် `job_application` စုစုပေါင်း ၂ | ၀ |

App ဇယားစုစုပေါင်း **insert ၉ ခု၊ update ၇ ကြိမ်၊ delete ၀ ခု** ဖြစ်သည်။ Storage metadata နှင့် သီးခြားခွင့်ပြုမှ ဖြစ်နိုင်သော login side effects ကို သီးခြားတွက်သည်။ Job/application write နှစ်ကြိမ်စလုံးမတိုင်မီ role၊ quota၊ လက်ရှိ cycle၊ plan နှင့် auto-renew ပိတ်ထားမှုကို ပြန်စစ်ပါ။ Cycle အဆုံးအထိ အနည်းဆုံး ၂ နာရီ ကျန်ရမည်။ Usage key များက `job:<job_uuid>` နှင့် `application:<application_uuid>` ဖြစ်သည်။ မျှော်မှန်း quota Client ၉၉ → ၉၈၊ Freelancer ၂၉ → ၂၈ ဖြစ်သည်။ [Membership trigger](../supabase/migrations/202611150017_harden_membership_quota_and_sandbox_pause.sql) · [Notification trigger](../supabase/migrations/202611150008_preserve_withdrawn_applications.sql)

Bucket တစ်ခုတည်းတွင် QA Freelancer ပိုင် အောက်ပါ reserved object အများဆုံး **၃ ခု** ကိုသာ တင်နိုင်သည်။ API upload တောင်းဆိုမှု အများဆုံး **၆ ကြိမ်** တွင် invalid ၂၊ V1 နှင့် မူလ path retry ၂၊ V2 ဖိုင်နှစ်ခုအတွက် ၂ ပါဝင်သည်။

- `<qa-contract-uuid>/<qa-freelancer-uuid>/<v1-request-uuid>/1.pdf`
- `<qa-contract-uuid>/<qa-freelancer-uuid>/<v2-request-uuid>/1.png`
- `<qa-contract-uuid>/<qa-freelancer-uuid>/<v2-request-uuid>/2.jpg`

Run တစ်ကြိမ်၊ tester တစ်ဦး၊ အလိုအလျောက် retry ၀ သုံးပါ။ Response မသေချာပါက reserved job/application UUID၊ delivery request UUID၊ ဆုံးဖြတ်ချက်နှင့် object ကို ဖတ်ရှုပြီးမှ ဆက်လုပ်ပါ။ ပြီးပြီးသား write ကို UUID အသစ်ဖြင့် ထပ်မလုပ်ပါ။ တူညီသော request UUID ဖြင့် payload ပြောင်းခြင်း၊ overwrite၊ move၊ prefix အလိုက် လုပ်ဆောင်ခြင်းနှင့် service key သုံးခြင်းကို တားပါ။ [Delivery နှင့် Storage RLS](../supabase/migrations/202611150018_contract_deliveries.sql)

## Cleanup နှင့် ရပ်ရမည့်အခြေအနေ

**Remote database delete ၀၊ Storage delete ၀** ဖြစ်သည်။ အသစ်ဖန်တီးသမျှ QA fixture နှင့် တင်ပြီး commit မဖြစ်သေးသော object ရှိလျှင် အဲဒီအတိုင်း ထိန်းထားပါ။ အမှားဖြစ်ပြီး ရပ်ရပါက ရပ်ခဲ့သည့် အဆင့်၊ မူလ run key၊ အရေအတွက်နှင့် ပိုင်ဆိုင်မှုကို မှတ်တမ်းတင်ပါ။ အနာဂတ် cleanup က သီးခြားအတည်ပြုချက်နှင့် run provenance ကိုက်ညီမှု လိုသည်။

အသစ်ဖြစ်လာသော row များ၏ job/application/contract ဆက်နွယ်မှု၊ ၎င်းတို့နှင့်ပတ်သက်သော quota/notification၊ delivery version နှင့် object ပိုင်ဆိုင်မှုတို့ကို ဖြုတ်တွက်ပြီး pre-run fingerprint များနှင့် ပြန်တိုက်ပါ။ ရှိပြီးသား ပြီးဆုံးစာချုပ်၊ reviews၊ messages၊ Auth sessions၊ backups၊ buckets၊ ledger နှင့် သက်ဆိုင်မှုမရှိသော data ကို ထိန်းထားပါ။ Plan ပြောင်းမှု၊ renewal၊ ငွေပေးချေမှု၊ chat/profile ရေးသားမှု၊ migration နှင့် QA review ရေးသားမှု အားလုံး scope ပြင်ပဖြစ်သည်။ သတ်မှတ်ထားသော အကန့်အသတ်၊ state သို့မဟုတ် ownership မကိုက်ပါက ဆက်မလုပ်ပါ။

Staging run မစမီ အထက်ပါ QA write/no-delete scope၊ လိုအပ်သည့် manual login နှင့် ရှိပြီးသား outsider QA account ကို ပိုင်ရှင် အတည်ပြုရမည်။
