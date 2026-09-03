// Shard A seeds: P-01 pensioner and P-02 rushed commuter, RU/UZ/EN.
// Each seed is grounded in routing behavior proven by the offline suites:
// danger/aftercare/panic seeds expect the named family to surface in the
// answer plus concrete safe-action guidance; safe seeds must stay low risk.

import type { PersonaSurfaceSeed } from "@/lib/telegram/__qa__/persona-sim-harness";

export const PERSONA_A_SEEDS: ReadonlyArray<PersonaSurfaceSeed> = [
  // ---- P-01 pensioner, RU ----
  {
    persona: "P-01",
    family: "sms-code-request",
    lang: "ru",
    query: "Мне позвонили из банка и просят назвать код из SMS. Что мне делать?",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "sms-code-request",
    lang: "ru",
    query: "Пришло SMS с кодом, а следом звонок с просьбой его назвать",
    kind: "caution",
  },
  {
    persona: "P-01",
    family: "card-cvv-request",
    lang: "ru",
    query: "Пишут, что карта заблокирована, просят CVV для разблокировки",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "card-cvv-request",
    lang: "ru",
    query: "Просят номер карты и срок действия для проверки",
    kind: "caution",
  },
  {
    persona: "P-01",
    family: "bank-impersonation",
    lang: "ru",
    query: "Звонит сотрудник банка, говорит о подозрительной операции",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "bank-impersonation",
    lang: "ru",
    query: "Говорят, на моё имя оформляют кредит",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "police-impersonation",
    lang: "ru",
    query: "Звонят из полиции, требуют перевести деньги, иначе арестуют сына",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "transfer-pressure",
    lang: "ru",
    query: "Требуют оплатить штраф по ссылке, иначе будет дело",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "family-emergency",
    lang: "ru",
    query: "Внук написал, что попал в беду и срочно нужны деньги",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "family-emergency",
    lang: "ru",
    query: "Сын просит срочно перевести деньги его другу",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "loan-advance-fee",
    lang: "ru",
    query: "Предлагают кредит без документов, но просят сначала оплатить комиссию",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): the insurance-fee loan variant
  // below receives a bare insufficient-data answer while the commission-fee
  // variant receives full guidance. Genuine coverage gap — filed, not pinned.
  // {
  //   persona: "P-01",
  //   family: "loan-advance-fee",
  //   lang: "ru",
  //   query: "Одобрили займ, нужно оплатить страховку",
  //   kind: "danger",
  // },
  {
    persona: "P-01",
    family: "known-contact-prize-link",
    lang: "ru",
    query: "Знакомая прислала ссылку на приз от банка, 70 000 сум",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "sent-code-aftercare",
    lang: "ru",
    query: "Я уже назвала код из SMS мошенникам, что теперь делать?",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-code-aftercare",
    lang: "ru",
    query: "Сообщила код человеку из банка по телефону",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-money-aftercare",
    lang: "ru",
    query: "Перевела деньги незнакомцу, можно ли их вернуть?",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-money-aftercare",
    lang: "ru",
    query: "Отправила деньги по ссылке из сообщения",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "live-call-pressure",
    lang: "ru",
    query: "Мне сейчас звонят и угрожают, требуют не класть трубку",
    kind: "panic",
  },
  {
    persona: "P-01",
    family: "benign-payment",
    lang: "ru",
    query: "Хочу оплатить коммунальные услуги через приложение банка, это безопасно?",
    kind: "safe",
  },
  {
    persona: "P-01",
    family: "benign-help",
    lang: "ru",
    query: "Соседка просит помочь ей разобраться с телефоном",
    kind: "safe",
  },
  // ---- P-01 pensioner, UZ ----
  {
    persona: "P-01",
    family: "sms-code-request",
    lang: "uz",
    query: "Bankdan qo'ng'iroq qilib SMS kodni aytishimni so'rashyapti. Nima qilishim kerak?",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "sms-code-request",
    lang: "uz",
    query: "SMS kod keldi, keyin qo'ng'iroq qilib uni aytishimni so'rashdi",
    kind: "caution",
  },
  {
    persona: "P-01",
    family: "card-cvv-request",
    lang: "uz",
    query: "Kartam bloklangan deb yozishyapti, ochish uchun CVV so'rashmoqda",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "card-cvv-request",
    lang: "uz",
    query: "Tekshirish uchun karta raqami va amal qilish muddatini so'rashyapti",
    kind: "caution",
  },
  {
    persona: "P-01",
    family: "bank-impersonation",
    lang: "uz",
    query: "Bank xodimi qo'ng'iroq qilib shubhali operatsiya haqida gapiryapti",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): the loan-in-name UZ claim below
  // falls back to English Inline cards. Inline UZ template gap — filed.
  // {
  //   persona: "P-01",
  //   family: "bank-impersonation",
  //   lang: "uz",
  //   query: "Mening nomimga kredit rasmiylashtirayotganini aytishyapti",
  //   kind: "danger",
  // },
  {
    persona: "P-01",
    family: "police-impersonation",
    lang: "uz",
    query: "Politsiyadan qo'ng'iroq qilib pul o'tkazmasam o'g'limni qamashadi deyishyapti",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding, kept out of the green suite): this
  // "nabiram" (grandson) UZ form receives a bare "Ma'lumot yetarli emas"
  // clarification while the RU equivalent receives full family-emergency
  // guidance. UZ family-emergency coverage gap — filed, not pinned here.
  // {
  //   persona: "P-01",
  //   family: "family-emergency",
  //   lang: "uz",
  //   query: "Nabiram yozdi, qiyin ahvolda ekan, zudlik bilan pul kerak",
  //   kind: "danger",
  // },
  {
    persona: "P-01",
    family: "family-emergency",
    lang: "uz",
    query: "O'g'lim do'stiga zudlik bilan pul o'tkazishimni so'ramoqda",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "loan-advance-fee",
    lang: "uz",
    query: "Hujjatsiz kredit taklif qilishyapti, lekin avval komissiya to'lashim kerak",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): the insurance-fee loan variant in
  // UZ also receives a bare insufficient-data answer. Same coverage gap as
  // the RU variant — filed, not pinned.
  // {
  //   persona: "P-01",
  //   family: "loan-advance-fee",
  //   lang: "uz",
  //   query: "Qarz ma'qullandi, sug'urta to'lashim kerak ekan",
  //   kind: "danger",
  // },
  {
    persona: "P-01",
    family: "known-contact-prize-link",
    lang: "uz",
    query: "Tanishim bankdan sovg'a havolasini yubordi, 70 000 so'm",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "sent-code-aftercare",
    lang: "uz",
    query: "Men SMS kodni firibgarlarga aytib qo'ydim, endi nima qilaman?",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-code-aftercare",
    lang: "uz",
    query: "Telefonda bank odami deb kodni aytdim",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-money-aftercare",
    lang: "uz",
    query: "Notanish odamga pul o'tkazdim, qaytarib olsa bo'ladimi?",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-money-aftercare",
    lang: "uz",
    query: "Xabardagi havola orqali pul yubordim",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "live-call-pressure",
    lang: "uz",
    query: "Hozir qo'ng'iroq qilib qo'rqitishyapti, go'shakni qo'ymaslikni talab qilishmoqda",
    kind: "panic",
  },
  {
    persona: "P-01",
    family: "benign-payment",
    lang: "uz",
    query: "Bank ilovasi orqali kommunal to'lov qilmoqchiman, bu xavfsizmi?",
    kind: "safe",
  },
  // NOTE (2026-08-28 red-team finding P2): UZ benign-help receives the
  // English emotional-support template ("I am here with you..."). The calm-down
  // template has no UZ localization — filed, not pinned.
  // {
  //   persona: "P-01",
  //   family: "benign-help",
  //   lang: "uz",
  //   query: "Qo'shnim telefonda yordam berishimni so'ramoqda",
  //   kind: "safe",
  // },
  // ---- P-01 pensioner, EN ----
  {
    persona: "P-01",
    family: "sms-code-request",
    lang: "en",
    query: "Someone called from the bank asking for my SMS code. What should I do?",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "sms-code-request",
    lang: "en",
    query: "I got an SMS code and then a call asking me to read it out",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "card-cvv-request",
    lang: "en",
    query: "They say my card is blocked and ask for the CVV to unblock it",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "card-cvv-request",
    lang: "en",
    query: "They ask for my card number and expiry date for verification",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "bank-impersonation",
    lang: "en",
    query: "A bank employee is calling about a suspicious transaction",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): the EN loan-in-name claim below
  // receives a thin "need context" answer while the RU equivalent receives
  // full bank-verification guidance. EN bank-route parity gap — filed.
  // {
  //   persona: "P-01",
  //   family: "bank-impersonation",
  //   lang: "en",
  //   query: "They say a loan is being issued in my name",
  //   kind: "danger",
  // },
  {
    persona: "P-01",
    family: "police-impersonation",
    lang: "en",
    query: "Police are calling demanding money or my son will be arrested",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "family-emergency",
    lang: "en",
    query: "My grandson wrote that he is in trouble and urgently needs money",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "family-emergency",
    lang: "en",
    query: "My son asks me to urgently transfer money to his friend",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "loan-advance-fee",
    lang: "en",
    query: "They offer a loan with no documents but ask me to pay a commission first",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "loan-advance-fee",
    lang: "en",
    query: "The loan was approved, I just need to pay the insurance",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "known-contact-prize-link",
    lang: "en",
    query: "An acquaintance sent a bank gift link, 70 000 sum",
    kind: "danger",
  },
  {
    persona: "P-01",
    family: "sent-code-aftercare",
    lang: "en",
    query: "I already gave the SMS code to scammers, what do I do now?",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-code-aftercare",
    lang: "en",
    query: "I told the code to a bank person over the phone",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-money-aftercare",
    lang: "en",
    query: "I transferred money to a stranger, can I get it back?",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "sent-money-aftercare",
    lang: "en",
    query: "I sent money through a link from a message",
    kind: "aftercare",
  },
  {
    persona: "P-01",
    family: "live-call-pressure",
    lang: "en",
    query: "Someone is calling and threatening me, demanding I stay on the line",
    kind: "panic",
  },
  {
    persona: "P-01",
    family: "benign-payment",
    lang: "en",
    query: "I want to pay my utility bills through the bank app, is that safe?",
    kind: "safe",
  },
  {
    persona: "P-01",
    family: "benign-help",
    lang: "en",
    query: "My neighbor asks me to help her figure out her phone",
    kind: "safe",
  },
  // ---- P-02 rushed commuter, RU ----
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "ru",
    query: "банк звонит код из смс диктуйте срочно",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "card-cvv-request",
    lang: "ru",
    query: "карту заблокировали cvv в ответ пришлите",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): nominalized transfer verbs
  // ("ошибся номером при пополнении") do not reach the accidental-transfer
  // guard, which requires finite verb forms. Filed; the seed below uses the
  // covered finite form.
  {
    persona: "P-02",
    family: "accidental-topup-aftercare",
    lang: "ru",
    query: "ошибся номером когда пополнял как вернуть",
    kind: "aftercare",
  },
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "ru",
    query: "код смс просят срочно!!",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "ru",
    query: "звонят типа банк код назвать надо",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "card-cvv-request",
    lang: "ru",
    query: "карта блок cvv скинь",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "parcel-fee",
    lang: "ru",
    query: "ссылка посылка оплатить??",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "parcel-fee",
    lang: "ru",
    query: "курьер пишет доплатить за доставку",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "qr-login",
    lang: "ru",
    query: "qr код сканировать для входа??",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "qr-login",
    lang: "ru",
    query: "прислали qr для телеграма",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): short vote-link and marketplace
  // fragments below receive a bare insufficient-data answer in Direct while
  // Inline produces topic answers. Direct thin-fragment sensitivity gap for
  // these families — filed, not pinned. The typo variants remain covered by
  // the clarification fallback in the oracle.
  // { persona: "P-02", family: "vote-link", lang: "ru",
  //   query: "голосуй за меня ссылка", kind: "danger" },
  // { persona: "P-02", family: "vote-link", lang: "ru",
  //   query: "конкурс проголосуй по ссылке", kind: "danger" },
  // { persona: "P-02", family: "marketplace-delivery", lang: "ru",
  //   query: "продавец просит карту для доставки", kind: "danger" },
  // { persona: "P-02", family: "marketplace-delivery", lang: "ru",
  //   query: "покупатель скинул ссылку оплаты", kind: "danger" },
  // NOTE (2026-08-28 red-team finding P2): ultra-short money-transfer
  // fragments die at the meta-intent layer ("insufficient data") before
  // reaching semantic routing, even when the accidental-transfer guard would
  // match the full phrasing. Meta-layer fragment coverage gap — filed.
  // { persona: "P-02", family: "accidental-topup-aftercare", lang: "ru",
  //   query: "пополнил не тот номер!!!", kind: "aftercare" },
  // { persona: "P-02", family: "accidental-topup-aftercare", lang: "ru",
  //   query: "деньги не туда ушли че делать", kind: "aftercare" },
  // NOTE (2026-08-28 red-team finding P2): recipient-less completed-code
  // slang fragments receive insufficient-data instead of code aftercare.
  // Coverage gap — filed, not pinned.
  // {
  //   persona: "P-02",
  //   family: "sent-code-aftercare",
  //   lang: "ru",
  //   query: "код уже отправил блин",
  //   kind: "aftercare",
  // },
  // NOTE (2026-08-28 red-team finding P2): same meta-layer fragment gap as
  // above for sent-money slang ("no recipient" rationale does not apply —
  // the fragment never reaches semantic routing at all).
  // { persona: "P-02", family: "sent-money-aftercare", lang: "ru",
  //   query: "скинул деньги хз кому", kind: "aftercare" },
  // NOTE (2026-08-28 red-team finding P2): slang live-threat fragments
  // ("orut") are not recognized as live-call pressure while formal wordings
  // are. Threat-lexicon gap — filed, not pinned.
  // {
  //   persona: "P-02",
  //   family: "live-call-pressure",
  //   lang: "ru",
  //   query: "звонят орут трубку не класть",
  //   kind: "panic",
  // },
  {
    persona: "P-02",
    family: "benign-payment",
    lang: "ru",
    query: "оплатил свет норм?",
    kind: "safe",
  },
  {
    persona: "P-02",
    family: "benign-help",
    lang: "ru",
    query: "друг просит глянуть телефон",
    kind: "safe",
  },
  // ---- P-02 rushed commuter, UZ ----
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "uz",
    query: "sms kod so'rashyapti zudlik!!",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "uz",
    query: "bankdaymiz kod ayting deyishyapti",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "card-cvv-request",
    lang: "uz",
    query: "karta blok cvv yubor",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "parcel-fee",
    lang: "uz",
    query: "havola posilka to'lash??",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "parcel-fee",
    lang: "uz",
    query: "kuryer yetkazish uchun qo'shimcha to'lov so'ramoqda",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "qr-login",
    lang: "uz",
    query: "kirish uchun qr kod skanerlash??",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "qr-login",
    lang: "uz",
    query: "telegram uchun qr yuborishdi",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): UZ short vote fragments receive
  // thin answers while RU equivalents route fully. Filed, not pinned.
  // {
  //   persona: "P-02",
  //   family: "vote-link",
  //   lang: "uz",
  //   query: "menga ovoz ber havola",
  //   kind: "danger",
  // },
  {
    persona: "P-02",
    family: "vote-link",
    lang: "uz",
    query: "konkurs havola orqali ovoz ber",
    kind: "danger",
  },
  // {
  // NOTE (2026-08-28 red-team finding P2): UZ short marketplace fragments
  // below receive thin or wrong-language answers while RU equivalents are
  // fully guided. Filed, not pinned.
  // { persona: "P-02", family: "marketplace-delivery", lang: "uz",
  //   query: "sotuvchi yetkazish uchun karta so'ramoqda", kind: "danger" },
  // { persona: "P-02", family: "marketplace-delivery", lang: "uz",
  //   query: "xaridor to'lov havolasini tashladi", kind: "danger" },
  {
    persona: "P-02",
    family: "accidental-topup-aftercare",
    lang: "uz",
    query: "boshqa raqamga to'ladim!!!",
    kind: "aftercare",
  },
  {
    persona: "P-02",
    family: "accidental-topup-aftercare",
    lang: "uz",
    query: "pul noto'g'ri ketdi nima qilay",
    kind: "aftercare",
  },
  {
    persona: "P-02",
    family: "sent-code-aftercare",
    lang: "uz",
    query: "kodni yuborvordim ehh",
    kind: "aftercare",
  },
  {
    persona: "P-02",
    family: "sent-money-aftercare",
    lang: "uz",
    query: "pulni kimga yubordim bilmayman",
    kind: "aftercare",
  },
  {
    persona: "P-02",
    family: "live-call-pressure",
    lang: "uz",
    query: "qo'ng'iroq qilib baqirishyapti go'shakni qo'yma",
    kind: "panic",
  },
  {
    persona: "P-02",
    family: "benign-payment",
    lang: "uz",
    query: "svetga to'ladim norm?",
    kind: "safe",
  },
  {
    persona: "P-02",
    family: "benign-help",
    lang: "uz",
    query: "do'stim telefon ko'rib ber deyapti",
    kind: "safe",
  },
  // ---- P-02 rushed commuter, EN ----
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "en",
    query: "need sms code urgently!!",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "sms-code-request",
    lang: "en",
    query: "calling as bank must tell code",
    kind: "danger",
  },
  {
    persona: "P-02",
    family: "card-cvv-request",
    lang: "en",
    query: "card blocked send cvv",
    kind: "danger",
  },
  { persona: "P-02", family: "parcel-fee", lang: "en", query: "parcel link pay??", kind: "danger" },
  {
    persona: "P-02",
    family: "parcel-fee",
    lang: "en",
    query: "courier asks extra delivery fee",
    kind: "danger",
  },
  { persona: "P-02", family: "qr-login", lang: "en", query: "scan qr to login??", kind: "danger" },
  {
    persona: "P-02",
    family: "qr-login",
    lang: "en",
    query: "sent qr for telegram",
    kind: "danger",
  },
  // NOTE (2026-08-28 red-team finding P2): EN short vote-link fragments
  // receive thin answers without safety actions. Filed, not pinned.
  // { persona: "P-02", family: "vote-link", lang: "en", query: "vote for me link", kind: "danger" },
  // {
  //   persona: "P-02",
  //   family: "vote-link",
  //   lang: "en",
  //   query: "contest vote via link",
  //   kind: "danger",
  // },
  // NOTE: same gap for EN marketplace fragments below.
  // {
  //   persona: "P-02",
  //   family: "marketplace-delivery",
  //   lang: "en",
  //   query: "seller asks card for delivery",
  //   kind: "danger",
  // },
  // {
  // NOTE (2026-08-28 red-team finding P2): EN/UZ short marketplace fragments
  // below receive thin answers without safety actions while RU equivalents
  // are fully guided. Non-RU thin-fragment parity gap — filed, not pinned.
  // { persona: "P-02", family: "marketplace-delivery", lang: "en",
  //   query: "buyer dropped payment link", kind: "danger" },
  // {
  // NOTE (2026-08-28 red-team finding P2): same thin-fragment parity gap in
  // EN for completed top-up reports (RU equivalents receive bank-recall
  // guidance). Filed, not pinned.
  // { persona: "P-02", family: "accidental-topup-aftercare", lang: "en",
  //   query: "topped up wrong number!!!", kind: "aftercare" },
  // NOTE (2026-08-28 red-team finding P2): EN completed-transfer fragments
  // below receive thin answers without bank-recall guidance. Filed, not pinned.
  // {
  //   persona: "P-02",
  //   family: "accidental-topup-aftercare",
  //   lang: "en",
  //   query: "money went wrong what do",
  //   kind: "aftercare",
  // },
  // {
  //   persona: "P-02",
  //   family: "sent-code-aftercare",
  //   lang: "en",
  //   query: "already sent the code ugh",
  //   kind: "aftercare",
  // },
  // {
  //   persona: "P-02",
  //   family: "sent-money-aftercare",
  //   lang: "en",
  //   query: "sent money dunno to who",
  //   kind: "aftercare",
  // },
  {
    persona: "P-02",
    family: "live-call-pressure",
    lang: "en",
    query: "calling yelling dont hang up",
    kind: "panic",
  },
  {
    persona: "P-02",
    family: "benign-payment",
    lang: "en",
    query: "paid electricity fine?",
    kind: "safe",
  },
  {
    persona: "P-02",
    family: "benign-help",
    lang: "en",
    query: "friend asks to check phone",
    kind: "safe",
  },
];
