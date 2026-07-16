// Elderly-realism QA corpus — 2026-07-16.
//
// Purpose: drive the REAL Telegram pipeline (router → meta-intent → follow-up
// → victim-intent → runCheck → formatting) with messages written the way real
// and elderly users in Uzbekistan actually type: phonetic typos, Uzbek
// Cyrillic mixed with Russian, Uzbek Latin with Russian loanwords, STT-style
// run-on voice transcripts, bare fragments without context, and multi-turn
// "question + 2 follow-ups" chains.
//
// This corpus is observational: the paired test files record what the bot
// actually replied (route, level, reasons, reply text, keyboard) into a JSON
// report for human review. Only universal invariants are asserted in-test.
//
// Scenario families are grounded in documented Uzbekistan scam patterns
// (see ai_docs/PROJECT_OVERVIEW.md and ai_docs/SCAM_COVERAGE.md):
// bank "security service" calls, Central Bank impersonation, "safe account"
// transfers, SMS/OTP theft, card-data requests, APK installs, Telegram
// account-deletion phishing, relative-in-trouble, lottery/commission,
// pension/subsidy bait, fake jobs with fees, delivery fees, OLX deal-code
// theft, investment/crypto bots, and already-victim aftermath.

export type QaLang = "ru" | "uz" | "en";

export type QaExpectation =
  /** A clear scam pattern: reply must communicate danger + one safe action. */
  | "danger"
  /** User already did the dangerous thing: reply must switch to rescue steps. */
  | "victim_sos"
  /** Question about the bot itself: warm meta reply, not a risk card. */
  | "meta"
  /** Gratitude: short warm reply, not a risk card. */
  | "gratitude"
  /** Legitimate question / neutral artifact: honest answer, no false alarm. */
  | "neutral"
  /** Fragment with too little context: safe clarifying question, not noise. */
  | "clarify";

export interface ElderlyQaRow {
  id: string;
  family: string;
  persona:
    | "ru-elderly-typos"
    | "uz-cyrillic"
    | "uz-latin-mixed"
    | "code-switching"
    | "voice-stt"
    | "fragment"
    | "en-plain";
  /** Telegram client language_code (what the phone is set to). */
  clientLang: QaLang;
  /** The language the user is actually writing in (ideal reply language). */
  expectLang: QaLang;
  expectation: QaExpectation;
  /** Turn 1 is the opening message; turns 2..n are follow-ups in the same chat. */
  turns: string[];
}

export const ELDERLY_DIRECT_CORPUS: readonly ElderlyQaRow[] = [
  // ── 1. Bank "security service" call / SMS code ─────────────────────────────
  {
    id: "ru-bank-code-01",
    family: "bank_security_sms_code",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "здраствуйте мне пазванили из банка сказали что карта заблакирована и нужно прадиктовать код из смс скажите это правда",
      "они сказали что срочно надо иначе деньги прападут",
      "что мне им сказать",
    ],
  },
  {
    id: "uz-cyr-bank-code-01",
    family: "bank_security_sms_code",
    persona: "uz-cyrillic",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    turns: [
      "Менга банкдан қўнғироқ қилишди картангиз блокланган дейишяпти СМС даги кодни айтинг дейишяпти нима қилай",
      "улар ҳозир телефонда кутиб туришибди",
    ],
  },
  {
    id: "uz-lat-bank-code-01",
    family: "bank_security_sms_code",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: [
      "Menga bankdan qo'ng'iroq qilishdi karta zablokirovana deyishdi sms kodni so'rashyapti",
      "rostdan firibgarlarmi",
      "endi nima qilay",
    ],
  },
  {
    id: "mix-bank-code-01",
    family: "bank_security_sms_code",
    persona: "code-switching",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: ["мне позвонили ака сказали sms kod ayting я не поняла это банк или кто"],
  },
  {
    id: "voice-bank-code-01",
    family: "bank_security_sms_code",
    persona: "voice-stt",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "алло алло мне тут позвонили говорят из банка говорят карта заблокирована надо назвать номер карты и код который придет в смс я уже почти сказала но решила сначала спросить у вас",
    ],
  },
  {
    id: "voice-uz-bank-code-01",
    family: "bank_security_sms_code",
    persona: "voice-stt",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: [
      "bankdan qo'ng'iroq qilishdi deyishyapti kod kerak deyishyapti hozir telefonda turishibdi nima deyin",
    ],
  },
  {
    id: "frag-code-01",
    family: "bank_security_sms_code",
    persona: "fragment",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    turns: ["код из смс сказать?"],
  },
  {
    id: "frag-uz-code-01",
    family: "bank_security_sms_code",
    persona: "fragment",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "clarify",
    turns: ["СМС кодни айтайми"],
  },

  // ── 2. "Safe account" transfer / Central Bank impersonation ───────────────
  {
    id: "ru-safe-account-01",
    family: "safe_account_transfer",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "звонили сказали из центрабанка что мои деньги в опасности и надо перевести их на безапасный счет пока не украли",
      "а если это правда банк как проверить",
      "дай номер банка",
    ],
  },
  {
    id: "uz-cyr-safe-account-01",
    family: "safe_account_transfer",
    persona: "uz-cyrillic",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Хавфсиз ҳисобга пул ўтказинг дейишяпти Марказий банкданмиз дейишяпти нима бу"],
  },
  {
    id: "uz-lat-safe-account-01",
    family: "safe_account_transfer",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["pul o'tkazing bezopasniy schyot deyishyapti markaziy bankdanmiz deb qo'rqitishyapti"],
  },
  {
    id: "frag-safe-account-01",
    family: "safe_account_transfer",
    persona: "fragment",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    turns: ["безопасный счет что это"],
  },
  {
    id: "voice-safe-account-01",
    family: "safe_account_transfer",
    persona: "voice-stt",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "они говорят что если я не переведу деньги на безопасный счет то все деньги пропадут говорят срочно срочно надо сегодня",
    ],
  },

  // ── 3. Card data / "wrong transfer" refund ────────────────────────────────
  {
    id: "ru-card-data-01",
    family: "card_data_request",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: ["просят номер карты и срок действия и три цифры сзади чтобы вернуть ошибочный перевод"],
  },
  {
    id: "uz-cyr-card-data-01",
    family: "card_data_request",
    persona: "uz-cyrillic",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Карта рақамини ва орқасидаги уч рақамни сўрашяпти пул қайтарамиз дейишяпти"],
  },

  // ── 4. Relative in trouble ─────────────────────────────────────────────────
  {
    id: "ru-relative-01",
    family: "relative_in_trouble",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "внучек попал в аварию звонили просят деньги на операцию срочно перевести",
      "я уже перевела 2 миллиона",
      "куда звонить",
    ],
  },
  {
    id: "uz-cyr-relative-01",
    family: "relative_in_trouble",
    persona: "uz-cyrillic",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Набирам авариага тушди деб пул сўрашяпти телефонда йиғлаяпти овози ўхшайди"],
  },
  {
    id: "voice-relative-01",
    family: "relative_in_trouble",
    persona: "voice-stt",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "мне сказали что мой сын попал в полицию и нужно заплатить штраф пятьсот долларов наличными курьеру который сейчас приедет",
    ],
  },

  // ── 5. Lottery / prize / commission ───────────────────────────────────────
  {
    id: "ru-lottery-01",
    family: "lottery_commission",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "мне сказали я выиграла 2 миллиона сум надо оплатить камисию 50 тысяч и пришлют деньги",
      "объясни простыми словами",
      "спасибо дорогой",
    ],
  },
  {
    id: "uz-cyr-lottery-01",
    family: "lottery_commission",
    persona: "uz-cyrillic",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Ютуқ ютдингиз дейишди аммо аввал комиссия тўлашим керак эмиш шу тўғрими"],
  },
  {
    id: "uz-lat-lottery-01",
    family: "lottery_commission",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Yutuq yutdingiz deyishdi komissiya to'lang deyishyapti 100 ming so'm"],
  },

  // ── 6. Pension / subsidy / government grant ───────────────────────────────
  {
    id: "ru-pension-01",
    family: "pension_subsidy",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: ["пришло смс что пенсию пересчитают и надо подтвердить карту по ссылке"],
  },
  {
    id: "uz-cyr-subsidy-01",
    family: "pension_subsidy",
    persona: "voice-stt",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: [
      "менга телеграмдан ёзишяпти сиз субсидия ютиб олдингиз картангизни рақамини юборинг дейишяпти",
    ],
  },
  {
    id: "uz-cyr-pension-01",
    family: "pension_subsidy",
    persona: "uz-cyrillic",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Пенсия учун карта рақамини сўрашяпти ижтимоий ҳимояданмиз дейишяпти"],
  },

  // ── 7. APK / fake "security app" ──────────────────────────────────────────
  {
    id: "ru-apk-01",
    family: "apk_install",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "сказали установить приложение для защиты карты прислали файл apk в телеграме",
      "я уже установила",
      "как удалить",
    ],
  },
  {
    id: "uz-lat-apk-01",
    family: "apk_install",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["prilojeniye o'rnating deyishdi zashita karti deb apk fayl yuborishdi telegramda"],
  },
  {
    id: "uz-cyr-apk-01",
    family: "apk_install",
    persona: "uz-cyrillic",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["APK файл юборишди ўрнатинг дейишяпти банк ҳимояси деб ишонсам бўладими"],
  },

  // ── 8. Telegram account takeover ("Cancel" phishing, login code) ──────────
  {
    id: "ru-tg-takeover-01",
    family: "telegram_takeover",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "какойто человек в телеграме пишет что мой акаунт удалят если не нажму отмена и не отправлю код",
    ],
  },
  {
    id: "uz-cyr-tg-takeover-01",
    family: "telegram_takeover",
    persona: "uz-cyrillic",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    turns: [
      "Телеграмда аккаунтингиз ўчирилади деб ёзишяпти бекор қилиш тугмасини босинг дейишяпти",
      "нима қилай",
      "рахмат",
    ],
  },
  {
    id: "uz-lat-tg-takeover-01",
    family: "telegram_takeover",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Telegramda akkauntingiz o'chiriladi deb yozishyapti Otmena bosing deyishyapti"],
  },

  // ── 9. OLX / marketplace deal code ────────────────────────────────────────
  {
    id: "voice-olx-01",
    family: "marketplace_code",
    persona: "voice-stt",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "квартиру продаю покупатель говорит скинь мне код из смс для оформления сделки на олх говорит без кода сделка не пройдет",
    ],
  },

  // ── 10. Fake job / easy money ─────────────────────────────────────────────
  {
    id: "uz-lat-job-01",
    family: "fake_job_fee",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: [
      "ishga taklif qilishyapti kuniga 500 ming so'm uydan turib deyishyapti faqat avval komissiya 200 ming to'lash kerak ekan",
    ],
  },
  {
    id: "ru-job-01",
    family: "fake_job_fee",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: ["предлагают работу на дому 300 тысяч в день но сначала взнос за обучение 150 тысяч"],
  },

  // ── 11. Delivery / parcel fee ─────────────────────────────────────────────
  {
    id: "uz-lat-delivery-01",
    family: "delivery_fee",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    turns: ["dostavka uchun 45000 to'lang link yuborishdi shu to'g'rimi posilka keldi deyishyapti"],
  },
  {
    id: "frag-delivery-01",
    family: "delivery_fee",
    persona: "fragment",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    turns: ["50000 сум комиссия за посылку"],
  },

  // ── 12. Investment / crypto bot ───────────────────────────────────────────
  {
    id: "ru-invest-01",
    family: "investment_bot",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    turns: [
      "проверь t.me/invest_daromad_bot обещают 20 процентов в день гарантированно",
      "точно?",
      "я им уже 500000 отправил",
    ],
  },

  // ── 13. Already-victim aftermath (must route to rescue, not generic check) ─
  {
    id: "ru-victim-code-01",
    family: "victim_aftermath",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "victim_sos",
    turns: ["я уже сказала код из смс что теперь делать"],
  },
  {
    id: "ru-victim-code-02",
    family: "victim_aftermath",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "victim_sos",
    turns: ["продиктовала номер карты и код с обратной стороны им по телефону"],
  },
  {
    id: "ru-victim-transfer-01",
    family: "victim_aftermath",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "victim_sos",
    turns: ["перевела деньги вчера на этот счет а теперь трубку не берут"],
  },
  {
    id: "ru-victim-apk-01",
    family: "victim_aftermath",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "victim_sos",
    turns: ["установила приложение которое прислали теперь смс приходят странные"],
  },
  {
    id: "uz-lat-victim-code-01",
    family: "victim_aftermath",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "victim_sos",
    turns: ["SMS kodni aytib yubordim nima qilay endi"],
  },
  {
    id: "uz-lat-victim-transfer-01",
    family: "victim_aftermath",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "victim_sos",
    turns: ["pul o'tkazib yubordim aldashganga o'xshayman endi kech bo'ldimi"],
  },
  {
    id: "uz-cyr-victim-tg-01",
    family: "victim_aftermath",
    persona: "uz-cyrillic",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "victim_sos",
    turns: ["Телеграмимга кириб олишди аккаунтим ўғирланди ҳамма контактларимга ёзишяпти"],
  },
  {
    id: "ru-victim-family-01",
    family: "victim_aftermath",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "victim_sos",
    turns: ["муж перевел 5 миллионов сум мошенникам вчера вечером что делать куда звонить"],
  },
  {
    id: "uz-lat-victim-card-01",
    family: "victim_aftermath",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "victim_sos",
    turns: ["kartamni raqamini aytdim endi nima bo'ladi"],
  },

  // ── 14. Trust / meta questions about the bot ──────────────────────────────
  {
    id: "ru-meta-who-01",
    family: "bot_trust",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "meta",
    turns: ["ты кто такой это бесплатно?"],
  },
  {
    id: "ru-meta-scam-01",
    family: "bot_trust",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "meta",
    turns: ["а вы не мошенники сами? откуда мне знать"],
  },
  {
    id: "uz-lat-meta-who-01",
    family: "bot_trust",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "meta",
    turns: ["Siz kimsiz botmisiz odammisiz"],
  },
  {
    id: "ru-meta-how-01",
    family: "bot_trust",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "meta",
    turns: ["как ты проверяешь номера расскажи"],
  },
  {
    id: "uz-gratitude-01",
    family: "gratitude",
    persona: "uz-latin-mixed",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "gratitude",
    turns: ["рахмат катта рахмат"],
  },
  {
    id: "ru-gratitude-01",
    family: "gratitude",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "gratitude",
    turns: ["спасибо дорогой дай бог здоровья"],
  },

  // ── 15. Neutral / legitimate questions (false-positive control group) ─────
  {
    id: "ru-neutral-phone-01",
    family: "neutral_check",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "neutral",
    turns: ["это номер банка? +998712000000", "перепроверь ещё раз", "почему ты так решил"],
  },
  {
    id: "uz-cyr-neutral-1344-01",
    family: "neutral_check",
    persona: "uz-cyrillic",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "neutral",
    turns: ["Ишонч телефони қайси банкники 1344ми"],
  },
  {
    id: "ru-neutral-grandson-01",
    family: "neutral_check",
    persona: "ru-elderly-typos",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "neutral",
    turns: ["внук прислал ссылку youtube.com/watch?v=abc123 это безопасно открыть"],
  },
  {
    id: "en-plain-code-01",
    family: "bank_security_sms_code",
    persona: "en-plain",
    clientLang: "en",
    expectLang: "en",
    expectation: "danger",
    turns: [
      "someone called saying they are from my bank and asked for the sms code is it a scam",
      "what should i do",
      "thank you",
    ],
  },
  {
    id: "en-plain-victim-01",
    family: "victim_aftermath",
    persona: "en-plain",
    clientLang: "en",
    expectLang: "en",
    expectation: "victim_sos",
    turns: ["i already told them the code from the sms what do i do now"],
  },

  // ── 16. Bare fragments / ambiguous numerics ───────────────────────────────
  {
    id: "frag-numeric-01",
    family: "ambiguous_fragment",
    persona: "fragment",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    turns: ["482913"],
  },
  {
    id: "frag-numeric-02",
    family: "ambiguous_fragment",
    persona: "fragment",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "neutral",
    turns: ["1344"],
  },
  {
    id: "frag-help-01",
    family: "ambiguous_fragment",
    persona: "fragment",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    turns: ["помогите"],
  },
  {
    id: "frag-uz-help-01",
    family: "ambiguous_fragment",
    persona: "fragment",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "clarify",
    turns: ["ёрдам беринг илтимос"],
  },
  {
    id: "frag-uz-lat-help-01",
    family: "ambiguous_fragment",
    persona: "fragment",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "clarify",
    turns: ["yordam bering iltimos qo'rqyapman"],
  },

  // ── 17. Language-mismatch stress: UZ text on RU client and vice versa ─────
  {
    id: "mismatch-uz-on-ru-01",
    family: "language_mismatch",
    persona: "uz-cyrillic",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    turns: ["Пул ўтказинг дейишяпти банк ходимиман дейишяпти лекин рақами бошқа давлатники"],
  },
  {
    id: "mismatch-ru-on-uz-01",
    family: "language_mismatch",
    persona: "ru-elderly-typos",
    clientLang: "uz",
    expectLang: "ru",
    expectation: "danger",
    turns: ["мне пишут в телеграме что надо срочно продиктовать код иначе карту заберут"],
  },
  {
    id: "mismatch-uz-lat-on-en-01",
    family: "language_mismatch",
    persona: "uz-latin-mixed",
    clientLang: "en",
    expectLang: "uz",
    expectation: "danger",
    turns: ["telefon qilishdi bankdan deb kod so'rashyapti aytmadim to'g'ri qildimmi"],
  },
];

// ── Inline corpus ────────────────────────────────────────────────────────────

export interface ElderlyInlineQaRow {
  id: string;
  family: string;
  /** The user's stored session language (stale by design in some rows). */
  sessionLang: QaLang;
  /** Telegram client language_code. */
  clientLang: QaLang;
  /** The language the query text is written in (ideal reply language). */
  expectLang: QaLang;
  expectation: QaExpectation;
  query: string;
}

export const ELDERLY_INLINE_CORPUS: readonly ElderlyInlineQaRow[] = [
  // Danger phrases with elderly typos and mixed scripts.
  {
    id: "inl-ru-code-01",
    family: "bank_security_sms_code",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "просят прадиктовать код из смс говорят из банка",
  },
  {
    id: "inl-uz-cyr-code-01",
    family: "bank_security_sms_code",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    query: "СМС даги кодни айтинг дейишяпти банкдан деб",
  },
  {
    id: "inl-uz-lat-code-01",
    family: "bank_security_sms_code",
    sessionLang: "ru",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    query: "sms kodni ayting deyishyapti bankdanmiz deb",
  },
  {
    id: "inl-ru-safe-account-01",
    family: "safe_account_transfer",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "переведите деньги на безапасный счет срочно",
  },
  {
    id: "inl-uz-lat-safe-account-01",
    family: "safe_account_transfer",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    query: "bezopasniy schyotga pul o'tkazing deyishyapti",
  },
  {
    id: "inl-ru-apk-01",
    family: "apk_install",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "прислали apk файл сказали установить для защиты карты",
  },
  {
    id: "inl-uz-cyr-tg-01",
    family: "telegram_takeover",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    query: "аккаунтингиз ўчирилади бекор қилиш тугмасини босинг",
  },
  {
    id: "inl-ru-lottery-01",
    family: "lottery_commission",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "вы выиграли 2 миллиона оплатите комиссию 50 тысяч",
  },
  {
    id: "inl-uz-lat-job-01",
    family: "fake_job_fee",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "danger",
    query: "ishga olamiz kuniga 500 ming avval 200 ming komissiya to'lang",
  },
  {
    id: "inl-ru-victim-01",
    family: "victim_aftermath",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "victim_sos",
    query: "я уже сказала код из смс что делать",
  },
  {
    id: "inl-uz-lat-victim-01",
    family: "victim_aftermath",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "victim_sos",
    query: "sms kodni aytib yubordim nima qilay",
  },

  // Artifacts: phones, short codes, links, usernames.
  {
    id: "inl-phone-uz-official-01",
    family: "neutral_check",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "neutral",
    query: "+998712000000",
  },
  {
    id: "inl-shortcode-01",
    family: "neutral_check",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "neutral",
    query: "1344",
  },
  {
    id: "inl-bare-6digit-01",
    family: "ambiguous_fragment",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    query: "482913",
  },
  {
    id: "inl-foreign-phone-01",
    family: "foreign_caller",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "neutral",
    query: "+4915731234567 звонили сказали из хамкорбанка",
  },
  {
    id: "inl-lookalike-domain-01",
    family: "brand_lookalike",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "kapita1bank.uz",
  },
  {
    id: "inl-invest-bot-01",
    family: "investment_bot",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "t.me/invest_daromad_bot обещают 20% в день",
  },
  {
    id: "inl-username-01",
    family: "neutral_check",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "neutral",
    query: "@click_uzbekistan_support",
  },

  // Fragments and near-empty queries.
  {
    id: "inl-frag-code-01",
    family: "ambiguous_fragment",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    query: "код сказать?",
  },
  {
    id: "inl-frag-uz-code-01",
    family: "ambiguous_fragment",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "uz",
    expectation: "clarify",
    query: "kod aytish kerakmi",
  },
  {
    id: "inl-frag-help-01",
    family: "ambiguous_fragment",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    query: "помогите",
  },
  {
    id: "inl-single-word-01",
    family: "ambiguous_fragment",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    query: "мошенники",
  },

  // Privacy: secrets typed into inline (must never be echoed).
  {
    id: "inl-secret-otp-01",
    family: "privacy_secret",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    query: "мне пришел код 482913 от банка сказать его оператору?",
  },
  {
    id: "inl-secret-card-01",
    family: "privacy_secret",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "clarify",
    query: "карта 8600 1234 5678 9012 просят подтвердить",
  },

  // Language mismatch stress.
  {
    id: "inl-mismatch-uz-on-ru-01",
    family: "language_mismatch",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "uz",
    expectation: "danger",
    query: "Bank operatsiyasini bekor qilish uchun SMS kodni ayting deyishyapti",
  },
  {
    id: "inl-mismatch-ru-on-uz-01",
    family: "language_mismatch",
    sessionLang: "uz",
    clientLang: "uz",
    expectLang: "ru",
    expectation: "danger",
    query: "срочно продиктуйте код иначе карту заблокируем говорят",
  },
  {
    id: "inl-mismatch-en-01",
    family: "language_mismatch",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "en",
    expectation: "danger",
    query: "they are asking for my sms code saying they are the bank",
  },

  // Typos inside artifacts.
  {
    id: "inl-typo-url-01",
    family: "brand_lookalike",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query: "проверь сайт click-uz.top пишут вернут деньги",
  },
  {
    id: "inl-multiline-01",
    family: "bank_security_sms_code",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "danger",
    query:
      "переслали сообщение\nваша карта заблокирована\nперейдите по ссылке bit.ly/3xk и подтвердите данные",
  },
  {
    id: "inl-gratitude-01",
    family: "gratitude",
    sessionLang: "ru",
    clientLang: "ru",
    expectLang: "ru",
    expectation: "gratitude",
    query: "спасибо большое",
  },
];
