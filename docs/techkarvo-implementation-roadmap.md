# TechKarvo အကောင်အထည်ဖော် အစီအစဉ်

**Milestone 4.0 · `fa25e2fb415d64cbc5060fffd5e52afc17090a98` ကို အခြေခံသော အဆိုပြုအစီအစဉ်**

အလုပ်ရှာဖွေရာမှ လျှောက်လွှာတင်နိုင်မှုကို အရင် တည်ငြိမ်စေမယ်။ ပြီးမှ ဆွေးနွေးမှု၊ စာချုပ်၊ ပေးပို့မှု၊ ပေးချေမှုအခြေအနေနှင့် review တို့ကို တစ်ခရီးစဉ်အဖြစ် ချိတ်မယ်။ နောက်အဆင့်ကို စတင်ရန် ရှေ့အဆင့်၏ လက်ခံသတ်မှတ်ချက်မီရမယ်။ [ထုတ်ကုန်လိုအပ်ချက်](techkarvo-product-requirements.md) · [UX စစ်ဆေးချက်](techkarvo-ux-audit.md) · [ဒီဇိုင်းစနစ်](techkarvo-design-system.md)

## ၁။ ပထမဆုံး UX အဆင့် · 4.1 အလုပ်ရှာဖွေမှုမှ လျှောက်လွှာသို့

**အကျုံးဝင်မှု။** `/jobs`၊ `/jobs/:id` နှင့် `/apply/:id` ကိုသာ ပြင်မယ်။ လက်ရှိအခွင့်အရေးနှင့် login ပြန်လမ်းကို ဆက်သုံးမယ်။ နောက်ပြန်သွားလျှင် ရှာဖွေမှု ပြန်ရခြင်း၊ ဝန်ဆောင်မှုပြတ်တောက်မှုကို ပြန်ကြိုးစားနိုင်ခြင်း၊ အလုပ်ပိတ်ခြင်းနှင့် လျှောက်လွှာတင်ပြီးကြောင်း ရှင်းလင်းခြင်းကို ဆောင်ရွက်မယ်။ `Jobs.jsx`၊ `JobDetails.jsx`၊ `ApplyForm.jsx` နှင့် သက်ဆိုင်သည့် အခြေခံ style/စမ်းသပ်ချက်အထိ ကန့်သတ်မယ်။ App shell၊ theme အားလုံး၊ chat၊ စာချုပ်နဲ့ KAV ပိုင်းကို နောက်အဆင့်မှာ ဆက်လုပ်မယ်။ [အလုပ်များ](../src/Jobs.jsx) · [Job detail](../src/JobDetails.jsx) · [လျှောက်လွှာ](../src/ApplyForm.jsx)

| လုပ်ဆောင်ချက် | လက်ခံနိုင်မည့်အခြေအနေ | စမ်းသပ်မှု |
| --- | --- | --- |
| ရှာဖွေမှုကို ပြန်ရစေခြင်း | URL မှ `q`၊ `category`၊ `sort` ကို validate လုပ်မယ်။ Detail သို့သွား/ပြန်၊ browser Back၊ refresh နှင့် share link က ရလဒ်အခြေအနေကို ပြန်ဖွင့်မယ်။ အမည်မသိ filter နှင့် အခွင့်မရှိသည့် advanced filter ကို လက်ရှိစည်းမျဉ်းအတိုင်း ထိန်းမယ်။ | URL parse/serialize unit tests၊ invalid/encoded params၊ Back/Forward/refresh browser tests၊ role နှစ်မျိုးနှင့် anonymous။ |
| Detail နှင့် ပြန်ကြိုးစားမှု | Loading၊ ရလဒ်မရှိ၊ အလုပ်ပိတ်၊ network/service error များ သီးခြား ပြမယ်။ ပြန်ကြိုးစားလျှင် တူညီသော ID ကို ဖတ်မယ်။ ပိတ်ထားသောအလုပ်တွင် လျှောက်ရန် action ပိတ်ထားမယ်။ | Isolated fixture တွင် timeout နောက်အောင်ခြင်း၊ row ပျောက်၊ ပိတ်ပြီး၊ နှောင့်နှေးသော response merge၊ empty filter နှင့် retry။ |
| Role နှင့် login ပြန်လမ်း | ဧည့်သည် လျှောက်ရန်နှိပ် → login → သက်ဆိုင်ရာ Freelancer proposal ကို ဆက်ဖွင့်မယ်။ Client က ကိုယ်ပိုင်အလုပ် စီမံရာသို့ သွားနိုင်ပြီး အခွင့်မရှိသည့် proposal မပို့နိုင်ရ။ | ရှိပြီးသား `RequireAuth`၊ URI နှင့် ပျက်ပြယ်သည့် return intent စစ်ခြင်း၊ မမှန်သည့် Client လျှောက်မှု SQL/RLS regression။ |
| လျှောက်လွှာကို ရှင်းလင်းတင်ခြင်း | မျှဝေမည့် email နှင့် rate unit ရှင်းပြ၊ server response ကို စောင့်၊ တင်နေချိန် နှစ်ကြိမ်မပို့၊ အောင်မြင်ပြီးလျှင် «လျှောက်လွှာများ» ကို သွားနိုင်ရ။ Duplicate/quota/closed/network စာသား သီးခြားဖြစ်ကာ error မှာ ရိုက်ထားတာကို form ထဲ ထိန်းရ။ | Local mock/fixture မှ `23505`၊ quota၊ closed-job၊ denied၊ timeout နှင့် success။ ပုံမှန်လမ်းကြောင်းမှ ဒေတာရေးခွင့်နှင့် အသုံးပြုမှု trigger ကို ထပ်စစ်။ |
| လက်လှမ်းမီမှု | 320၊ 390၊ 768၊ 1280px၊ 200% zoom၊ keyboard နှင့် အလင်း/အမှောင်မှာ အလုပ်ရှာ → detail → proposal ပြီးစီးနိုင်ရ။ Error summary ကို focus ဖြင့် တွေ့နိုင်ပြီး status ကို screen reader ကြားနိုင်ရ။ | Isolated Playwright viewport/keyboard၊ contrast စစ်ဆေးမှုနှင့် screen reader တစ်မျိုးဖြင့် လူကိုယ်တိုင် စစ်ဆေးမှတ်တမ်း။ |

**မှီခိုမှု။** လက်ရှိ public jobs read၊ `/apply/:id` role guard၊ owner/RLS စည်းမျဉ်း၊ လက်ရှိ quota trigger၊ `Login` ၏ in-app ပြန်လမ်းနှင့် သတ်မှတ်ထားသော QA fixture ကို အသုံးပြုမယ်။ Schema ပြောင်းလဲမှု လိုလာပါက ဤအဆင့်မှ ခွဲပြီး သီးခြားခွင့်ပြုချက် တောင်းမယ်။

**အန္တရာယ်နှင့် တားဆီးပုံ။** URL ပြောင်းရင်း လက်ရှိ link မပျက်ဖို့ ပုံမှန် link ရော query ပါ link ရော စစ်မယ်။ URL ထဲတွင် email၊ cover letter၊ token မရှိရ။ Client-side စစ်ထုတ်မှုကို ဆာဗာခွင့်အဖြစ် မယူရ။ Network retry က proposal submit မထပ်စေရန် သက်ဆိုင်ရာ database uniqueness နှင့် လက်ရှိမှတ်တမ်း ပြန်ဖတ်ခြင်းကို အားကိုးမယ်။

**ပြီးမြောက်စံ။** အထက်ပါ browser စမ်းသပ်မှုများ၊ လက်ရှိ lint/unit/build/SQL နှင့် လက်ခံသတ်မှတ်ချက် ပြန်လည်သုံးသပ်မှု အောင်မှ feature branch အဆင့်ပြီးမြောက်တယ်။ တင်မည့် UI ကို staging တွင် ဖတ်ရှုရုံ စစ်နိုင်တယ်။ Authenticated staging ရေးသားမှုကို သီးခြားခွင့်ပြုပြီးမှ ပြန်စစ်မယ်။ ဤစာတမ်းသည် အဆိုပြုချက်ဖြစ်ပြီး 4.1 ကုဒ်ကို Milestone 4.0 တွင် စတင်မပြင်ထားပါ။

## ၂။ အဆင့်လိုက် အကောင်အထည်ဖော်မှု

| အဆင့် | ပေးရမည့်အရာနှင့် လက်ခံသတ်မှတ်ချက် | မှီခိုမှု၊ အန္တရာယ်နှင့် စမ်းသပ်မှု |
| --- | --- | --- |
| **4.0 · အခြေခံ** | Repository audit၊ အခြေအနေပါ feature စာရင်း၊ role အလိုက် PRD၊ desktop/tablet/mobile လမ်းညွှန်၊ design tokens၊ acceptance roadmap။ | Milestone 3 အထောက်အထားနှင့် source links ကို တိုက်စစ်။ Markdown/UTF-8၊ local links၊ lint၊ unit၊ build၊ isolated browser။ |
| **4.1 · ရှာဖွေ → လျှောက်လွှာ** | ရှာဖွေမှုကို ပြန်ရခြင်း၊ သီးခြား load/error states၊ အလုပ်မှ လျှောက်လွှာသို့ role-aware ဆက်လက်သွားနိုင်ခြင်း။ | အထက်ပါ နယ်ပယ်၊ ခွင့်နှင့် စမ်းသပ်မှုအတိုင်း။ |
| **4.2 · ဆွေးနွေးမှုနှင့် အလုပ်ခန်း အကျဉ်းချုပ်** | လက်ခံထားသော application မှ ခွင့်ရှိသူက အလုပ်ခန်းဖတ်နိုင်၊ အလုပ်စာတွဲသို့ အပြန်အလှန်သွားနိုင်၊ မူလ chat deep link ဆက်သုံးနိုင်ရ။ ပေးချေမှုအခြေအနေတွင် sandbox အမှတ်အသား ရှိရ။ | အပ်နှံမှု trigger၊ `contracts` participant RLS၊ thread linkage နှင့် status mapping လိုသည်။ Accepted၊ declined/withdrawn၊ disputed၊ closed၊ မသက်ဆိုင်သူ၊ hidden thread restoration၊ 320px back/focus စစ်။ Read loader ကြောင့် စာတွဲဖန်တီးခြင်း/ဖတ်ပြီး မှတ်ခြင်း မဖြစ်စေရန် စစ်။ |
| **4.3 · ပေးပို့မှုနှင့် သုံးသပ်ချက်** | စာချုပ်/ပန်းတိုင် ချိတ်ထားသော ပေးပို့မှု၊ revision request၊ အတည်ပြုခြင်း၊ မှတ်တမ်းနှင့် review ဝင်ရာနေရာ။ ရှိပြီးသား sandbox milestone အခြေအနေကို သီးခြား ဖတ်နိုင်ရ။ | Deliverable schema၊ private storage၊ file verification စည်းမျဉ်းနှင့် review eligibility လိုသည်။ Owner/other-user access၊ လင့်ခ်သက်တမ်း၊ file type/size၊ မအောင်မြင်သော upload၊ concurrent approval၊ review နှစ်ကြိမ်တင်ခြင်းနှင့် ပြီးဆုံးမှုမတိုင်မီ review တားမှုကို စစ်။ |
| **4.4 · ပရိုဖိုင်၊ လက်ရာနှင့် အဖွဲ့ဝင်ဆက်တင်** | role ခွဲထားသော ပရိုဖိုင် preview၊ လက်ရာစီမံမှု၊ ကွန်ရက်ဝင်ရာနေရာ၊ plan compare/အုပ်ချုပ်မှုနှင့် privacy/ဘာသာစကား ဆက်တင် အဆင့်လိုက်။ | မြင်ခွင့်နှင့် media policy၊ role plan catalog၊ Entitlement API နှင့် localization အခြေခံလိုသည်။ Public/member/owner နှိုင်း၊ light/dark၊ `en`/`my`၊ quota မပြန်စမှု၊ plan expired/paused၊ ဆက်တင် အတည်ပြုပြီးပြန်ထွက်မှု စစ်။ |
| **4.5 · Support နှင့် moderation** | တာဝန်ပေးထားသည့် case ဝန်ထမ်းသီးခြားမြင်ကွင်း၊ အပြန်အလှန်ကူညီစာ၊ escalation၊ ပိုင်ရှင်ထံ status၊ အစီရင်ခံချက်ဆုံးဖြတ်မှု audit။ | ခွင့်ပုံစံနှင့် retention သတ်မှတ်ချက် အတည်ပြုပြီးမှ schema မူကြမ်း။ ဝန်ထမ်းမဟုတ်သူ၊ မခန့်ထားသော case၊ အခွင့်လွှဲပြီးပြီးချိန်၊ Audit trail၊ ထိန်းထားသည့်သက်သေ၊ ကိုယ်ရေးဒေတာ မပေါက်ကြားမှု စစ်။ |
| **4.6 · လိုင်စင်ရ ပေးချေမှု ဒီဇိုင်းနှင့် provider စမ်းသပ်ပတ်ဝန်းကျင်** | နိုင်ငံ၊ currency၊ စာချုပ်ပုံစံနှင့် provider အတည်ပြုချက်ရပြီးမှ provider test environment အတွက် checkout/status/reconciliation ဒီဇိုင်း။ Provider မှတ်တမ်းနဲ့ UI status ကို အတည်ပြုနိုင်ရ။ | ဥပဒေ/လုပ်ငန်းတာဝန်ခံ၊ လိုင်စင်ရ provider၊ threat model၊ ဖြန့်ချိရန် အတည်ပြုချက် အားလုံး လိုသည်။ Provider စမ်းသပ်ပတ်ဝန်းကျင်၌ event အတု၊ ထပ်တူပို့မှု၊ နောက်ကျမှု၊ ငွေပြန်အမ်းမှု၊ အငြင်းပွားမှု၊ network outage၊ စာရင်းမညီမှုနှင့် လုံခြုံရပ်ဆိုင်းမှု စစ်။ Production ဖွင့်ခြင်းကို သီးခြား ဆုံးဖြတ်မယ်။ |
| **4.7 · ဆက်သွယ်ရေးနှင့် ပညာရှင်ကွန်ရက် တိုးချဲ့မှု** | စာရှာနိုင်မှု၊ စာအစဉ်လိုက် ထပ်တင်မှု၊ အုပ်စုဖွဲ့မှုနှင့် audience ဆက်တင်တို့ကို တစ်ခုချင်း စမ်းသပ်မယ်။ အသံ/ဗီဒီယိုခေါ်ဆိုမှုကို လိုအပ်ချက်၊ privacy နှင့် စနစ်စွမ်းရည် စိစစ်ပြီးမှ ထည့်သွင်းရန် ဆုံးဖြတ်မယ်။ | 4.2 မှ thread identity၊ 4.3 မှ file access၊ 4.5 မှ moderation နှင့် ဒေတာသိမ်းဆည်းမှုတို့ လိုသည်။ Block ခံထားရသူ၊ အုပ်စုမှ ထွက်သွားသူ၊ စာအများကြီး/နှေးသောကွန်ရက်၊ ခေါ်ဆိုခွင့် ငြင်းခြင်းနှင့် အခြားစက်မှ လက်ခံမှုတို့ကို စစ်။ လက်ရှိ hosting က camera/microphone ကို ပိတ်ထားသဖြင့် ခေါ်ဆိုမှုအတွက် policy ကို သီးခြားစစ်မယ်။ [Hosting policy](../vercel.json) |

အဆင့်များသည် လုပ်ဆောင်စဉ်နှင့် စမ်းသပ်မှုအတွက် အစီအစဉ် ဖြစ်သည်။ Support ခွင့်နှင့် ကိုယ်ရေးစည်းမျဉ်းအတွက် လိုအပ်ချက် သတ်မှတ်ခြင်းကို အစောပိုင်းကတည်းက လုပ်နိုင်တယ်။ 4.7 သည် သက်ဆိုင်ရာ စာတွဲ၊ ဖိုင်နှင့် moderation အဆင့်များပေါ်မှာ မှီခိုတယ်။ အဝေး DB တွင် အချက်အလက်ရေးရန် သီးခြားခွင့်ပြုချက် လိုတယ်။

## ၃။ အန္တရာယ်နှင့် ဆုံးဖြတ်ရန် လိုသေးသည့်အချက်များ

| အန္တရာယ် | ဆုံးဖြတ်ချက်မီမှ ဆက်လုပ်ရမည့်အရာ | လိုအပ်သည့် သက်သေ |
| --- | --- | --- |
| Route ပြောင်း၍ ရှိပြီးသား လုပ်ငန်းစဉ်နှင့် notification link ပျက်ခြင်း | လက်ရှိ route ကို မူတည်၍ အဆင့်လိုက် ညှိပြီး query/back contract သတ်မှတ်။ | ယခင် link fixture၊ အကောင့်ဝင်/ထွက်၊ mobile back၊ notification နှင့် bookmark အခြေအနေ။ |
| အလုပ်၊ စာချုပ်၊ ပေးပို့မှုနှင့် ပေးချေမှုအခြေအနေ ရောထွေးခြင်း | Status owner နှင့် allowed transitions ကို domain တစ်ခုစီ သတ်မှတ်။ | Lifecycle matrix၊ stale status မြင်ကွင်း၊ USD နှင့် simulated KAV စာသား၊ double submission စစ်ချက်။ |
| Private ဖိုင်နဲ့ စာလုံခြုံရေး | အလုပ်ခန်းဖိုင်အတွက် သီးခြားသိုလှောင်မှု၊ အသုံးပြုသူခွင့်နှင့် retention ကို သတ်မှတ်။ | မသက်ဆိုင်သူ access မရမှု၊ upload verification၊ ငြင်းခံရသော/သက်တမ်းကုန် file link၊ audit မှတ်တမ်း။ |
| Staff လုပ်ပိုင်ခွင့် ကျယ်လွန်းခြင်း | Admin/Support action၊ အမှုတွဲပိုင်ရှင်နှင့် ဆုံးဖြတ်ခွင့်ကို တာဝန်အလိုက် သတ်မှတ်။ | Assignment scope၊ cross-case denial၊ actor/reason audit၊ လွှဲပြောင်းချိန် အခွင့်ချိန်ညှိမှု။ |
| အစစ်အမှန် ငွေကြေးအပေါ် လုပ်ပိုင်ခွင့် မသေချာခြင်း | နိုင်ငံ၊ provider လိုင်စင်နှင့် ဝန်ဆောင်မှုစည်းကမ်း၊ တာဝန်ယူမည့်အဖွဲ့၊ ခွင့်ပြုချက်ကို သီးခြားအတည်ပြု။ | ဆုံးဖြတ်ချက်မှတ်တမ်း၊ အကောင့်တိုက်စစ်မှု rehearsal၊ မအောင်မြင်လျှင် ရပ်ဆိုင်းပြီး စာရင်းသမိုင်း ထိန်းနိုင်မှု။ |
| UI အကျယ်၊ စာသားနှင့် မှန်ကန်သော အချိန်ဇုန် | Screen size၊ zoom၊ keyboard နှင့် Burmese shaping/long strings ကို acceptance အဖြစ် သတ်မှတ်။ | နှစ်ရောင်နှင့် နှစ်ဘာသာ screen captures၊ manual screen reader၊ ရက်စွဲ/ငွေကြေး fixtures။ |
| Staging စမ်းသပ်မှုကြောင့် အပိုဒေတာပြောင်းခြင်း | ရေးသားမှု လိုမှ အတည်ပြုထားသော dedicated fixture၊ run ID နှင့် စာရင်းအပြန်အလှန် စစ်မယ်။ | Exact write scope၊ တစ်ကြိမ်သုံး run ID၊ post cleanup ownership၊ စမ်းသပ်မီ/ပြီး ledger fingerprint။ [Staging runbook](staging-verification.md) |

## ၄။ အဆင့်တိုင်း ဖြန့်ချိမီ စစ်ရမည့်အချက်

1. သက်ဆိုင်ရာ source နှင့် စမ်းသပ်ချက်ကို လင့်ခ်ထားပြီး UI တစ်ခုချင်း၏ scope၊ states နှင့် ခွင့်တောင်းရမည့် အလုပ်တို့ကို စာရင်းပြုလုပ်ပါ။
2. `npm run lint`၊ `npm test`၊ `npm run build` နှင့် သက်ဆိုင်ရာ local Playwright ကို စစ်ပါ။ DB/RPC ပြောင်းလဲမှုပါလျှင် ကွန်ရက်မချိတ်သည့် PostgreSQL fixture၊ role/RLS နှင့် migration order ဆက်စစ်ပါ။ [CI](../.github/workflows/ci.yml)
3. အလင်း/အမှောင်၊ responsive၊ keyboard/screen reader၊ loading/error/empty နှင့် လက်ရှိ deep links ကို release မတိုင်မီ ဆက်စစ်ပါ။ နောက်ဆုံး user-visible ဆုံးဖြတ်ချက်ကို စာတမ်းနှင့် အတူတူ ပြန်ညှိပါ။
4. Feature branch CI အောင်ပြီးမှ staging preview ကို စစ်ပါ။ ဒေတာရေးသော browser run၊ အဝေး migration၊ provider integration နှင့် production release တို့အတွက် တစ်ခုချင်း သီးခြားခွင့်ပြုချက်ယူပါ။ Ledger သို့မဟုတ် သမိုင်းမှတ်တမ်းကို rollback အဖြစ် ဖယ်ရှားခြင်းမျိုး မသုံးရ။
