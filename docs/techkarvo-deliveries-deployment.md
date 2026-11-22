# Milestone 4.3 အလုပ်ပေးပို့မှုနှင့် staging ဖြန့်ချိရေး

## အတည်ပြုထားသော အခြေခံစည်းမျဉ်း

- Migration 010 က လျှောက်လွှာကို လက်ခံသည့်အချိန်တွင် စာချုပ်ဖန်တီးပြီး အလုပ်ကို ပြီးဆုံးအဖြစ် သတ်မှတ်သည့်အခါ active စာချုပ်ကို ပြီးဆုံးစေသည်။ ရှိပြီးသား စာချုပ်နှင့် စကားဝိုင်း ID များကို 4.3 က ဆက်သုံးသည်။ [Migration 010](../supabase/migrations/202611150010_contracts_blocks_safety.sql)
- Migration 013 ရှိ KAV sandbox milestone အခြေအနေကို Workroom တွင် သီးခြားပြသည်။ ပေးပို့မှုနှင့် အလုပ်လက်ခံမှု RPC များက စာချုပ်အခြေအနေ၊ ငွေစာရင်းနှင့် sandbox milestone ကို ရေးသားခြင်းမရှိပါ။ [Migration 013](../supabase/migrations/202611150013_simulated_financial_memberships.sql)
- Review တစ်ခုစီသည် ပြီးဆုံးထားသော အလုပ်၊ လက်ခံထားသော လျှောက်လွှာ၊ မှန်ကန်သော review ပေးသူနှင့် လက်ခံသူတို့နှင့် ချိတ်ထားရသည်။ လျှောက်လွှာတစ်ခုအတွက် ပါဝင်သူတစ်ဦးစီ တစ်ကြိမ်သာ တင်နိုင်သည်။ Migration 018 က စာချုပ်ချိတ်ပြီးသား လျှောက်လွှာအတွက် စာချုပ်ပြီးဆုံးမှ ထပ်မံတင်ခွင့်ပြုသည်။ စာချုပ်ဇယား မတိုင်မီ အလုပ်ခန့်ထားသူများသည် အရင်သတ်မှတ်ချက်အတိုင်း Reviews စာမျက်နှာကို ဆက်သုံးနိုင်သည်။ [Review မူဝါဒ](../supabase/migrations/202611150002_marketplace_communications_reviews.sql)

## Staging အတည်ပြုချက်

Milestone 4.3 ကို `techkarvo-staging` တွင် အတည်ပြုပြီးဖြစ်သည်။ Migration history **000–018** နှင့် private bucket သတ်မှတ်ချက်ကို ဖတ်ရှုအတည်ပြုခဲ့ပြီး ခွင့်ပြုထားသော Real Storage API QA run က **၁၂ အောင်၊ ၀ မအောင်၊ ၀ ကျော်** ဖြစ်သည်။ [အပြည့်အစုံ စစ်ဆေးရလဒ်နှင့် ထိန်းထားသည့် ဖိုင်များ](staging-verification.md#milestone-43-staging-verified)

## Migration 018 တင်ခဲ့သည့် လုပ်ငန်းစဉ်

1. `techkarvo-staging` (`ntucgiieksrwebwvcmun`) ဟုတ်ကြောင်း authenticated read-only နည်းဖြင့် အတည်ပြုပါ။ Migration history သည် 017 တွင် အဆုံးသတ်ပြီး dry run တွင် `202611150018_contract_deliveries.sql` တစ်ခုတည်း ရွေးထားကြောင်း စစ်ပါ။ စစ်ပြီးသား backup၊ restore အထောက်အထားနှင့် လက်ရှိ ledger baseline ကို အရင်စစ်ပါ။ Delivery bucket အမည်ရှိနေပြီးသားဆိုလျှင် migration က ရပ်မည်။
2. သီးခြားအတည်ပြုချက်ရမှ migration 018 ကို ထည့်ပါ။ ၎င်းက `public.contract_deliveries` ဇယား၊ ပါဝင်သူသာ ဖတ်နိုင်သည့် RLS၊ authenticated အတွက် `techkarvo_submit_delivery`၊ `techkarvo_decide_delivery` နှင့် `techkarvo_delivery_object_allowed`၊ Storage မူဝါဒ ခုနစ်ခုနှင့် Review insert ကန့်သတ်ချက်တစ်ခုကို ထည့်မည်။ ရှိပြီးသား မှတ်တမ်းများကို backfill လုပ်ခြင်း၊ ဖျက်ခြင်း သို့မဟုတ် မွမ်းမံခြင်း မပါဝင်ပါ။ [Migration 018](../supabase/migrations/202611150018_contract_deliveries.sql)
3. Storage မူဝါဒများမှန်ကြောင်း တိုက်စစ်ပြီးမှ Dashboard သို့မဟုတ် Storage API မှ `techkarvo-contract-deliveries` ကို private bucket အဖြစ် သီးခြားဖန်တီးပါ။ `public: false`၊ ဖိုင်တစ်ခုလျှင် `5242880` bytes နှင့် `application/pdf`၊ `image/png`၊ `image/jpeg` ကိုသာ လက်ခံရန် သတ်မှတ်ပါ။ Project-wide limit ကိုလည်း စစ်ပါ။ Upload စီမံချက်က `<contract UUID>/<freelancer UUID>/<request UUID>/<1–3>.<extension>` ကို သုံးသည်။ ပါဝင်သူများသည် အပြီးသတ်ပေးပို့ချက်နှင့် ချိတ်ထားသော ဖိုင်ကိုသာ စက္ကန့် ၆၀ သက်တမ်းရှိ download URL တောင်းနိုင်သည်။ ဖိုင်အစားထိုးခြင်းနှင့် ဖျက်ခြင်းကို browser role များအတွက် ပိတ်ထားသည်။ [Supabase bucket စည်းမျဉ်း](https://supabase.com/docs/guides/storage/buckets/creating-buckets) · [သက်တမ်းသတ်မှတ် download](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl)
4. Migration history၊ RLS၊ function grants၊ private bucket configuration နှင့် ledger baseline ကို ဖတ်ရှုစစ်ဆေးပါ။ Staging မှတ်တမ်းရေးခွင့် သီးခြားရမှ QA စာချုပ်ဖြင့် upload၊ ကွန်ရက်ပြတ်ပြီး ပြန်တင်ခြင်း၊ private download နှင့် URL သက်တမ်းကုန်မှု၊ မသက်ဆိုင်သူအတွက် ပိတ်ပင်မှု၊ client revision/approval နှင့် ပြီးဆုံးစာချုပ် review ကို စစ်ပါ။

## စစ်ဆေးမှုအကန့်အသတ်နှင့် လည်ပတ်ရေး

- PostgreSQL စမ်းသပ်မှုက Storage metadata နှင့် RLS ကို fixture ဖြင့် စစ်သည်။ စက်တွင်း Playwright က တုပထားသော API ကို သုံးသည်။ ခွင့်ပြုခဲ့သည့် staging QA run တွင် တကယ့် Storage API ၏ `owner_id`၊ MIME၊ size၊ retry ပဋိပက္ခ response နှင့် signed URL သက်တမ်းကို အတည်ပြုခဲ့သည်။ Malware စစ်ဆေးမှုသည် သီးခြား လိုအပ်ချက်ဖြစ်သည်။
- Upload အပြီး ပေးပို့မှု မပြီးသောဖိုင်ကို ပါဝင်သူများက ဖတ်၍မရပါ။ ပြန်ကြိုးစားခြင်းက မူလ request/path ကို ဆက်သုံးသည်။ စာမျက်နှာ refresh လုပ်ခြင်း သို့မဟုတ် ထွက်ခြင်းနှင့်အတူ ယာယီ draft ပျောက်နိုင်သည်။ အသုံးမပြုတော့သည့် ဖိုင်များအတွက် အရင်ဆုံး ဖတ်ရှုစစ်ဆေးသည့် retention စီမံချက်၊ Storage quota နှင့် abuse rate limit ကို အများပြည်သူထံ မဖွင့်မီ သီးခြားသတ်မှတ်ရန် လိုသည်။
- ပြဿနာတွေ့ပါက feature branch ၏ frontend ကို ယခင် release သို့ ပြန်ညွှန်းနိုင်သည်။ ထည့်ပြီးသား delivery၊ bucket၊ စာချုပ်၊ စကားဝိုင်းနှင့် ငွေစာရင်းကို ထိန်းထားပြီး မူဝါဒပြင်ဆင်မှု သို့မဟုတ် ဖိုင်ဖျက်မှုကို အတည်ပြုချက်အသစ်ဖြင့်သာ ဆောင်ရွက်ပါ။
