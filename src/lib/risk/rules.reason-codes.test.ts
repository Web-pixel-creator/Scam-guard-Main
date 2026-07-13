// Feature: telegram-bot-mvp, Task 3.3 — unit tests for the four new reason codes.
// Covers R14.4 (asks_to_scan_qr), R14.5 (relative_in_distress),
// R14.6 (requests_card_digits) and R14.7 (threatens_account_block + uses_urgency).
//
// Positive examples are written in Russian and Uzbek (Latin) and MUST trigger the
// code; negative examples are neutral phrases that MUST NOT trigger it. We assert
// membership in the reasons array (toContain / not.toContain) rather than strict
// set equality, because realistic messages can legitimately fire several codes.
import { describe, it, expect } from "vitest";
import { evaluateTelegram, evaluateText, scoreFromCodes } from "./rules";

describe("evaluateText — received verification-code requests", () => {
  it.each([
    "Menga latifa ayt, keyin kelgan kodni yubor",
    "Kelgan kodni menga yuboring",
    "Sizga keladigan kodni aytib bering",
  ])("detects the Uzbek request: %s", (text) => {
    expect(evaluateText(text)).toContain("asks_for_sms_code");
  });

  it.each(["Kod shahri haqida ayting", "Buyurtma raqamini yuboring"])(
    "does not flag a neutral non-verification code phrase: %s",
    (text) => {
      expect(evaluateText(text)).not.toContain("asks_for_sms_code");
    },
  );
});

describe("evaluateText — benign completed Uzbek family actions", () => {
  it.each([
    ["Otam ijara pulini to'ladi.", "asks_to_transfer_to_safe_account"],
    ["Opam menga oziq-ovqat uchun pul yubordi.", "asks_to_transfer_to_safe_account"],
    ["Onam menga eshik kodini aytdi.", "asks_for_sms_code"],
  ] as const)("does not turn completed everyday context into %s: %s", (text, code) => {
    expect(evaluateText(text)).not.toContain(code);
  });

  it.each([
    ["Pulni shu hisobga o'tkazing.", "asks_to_transfer_to_safe_account"],
    ["Oziq-ovqat uchun pulni shu kartaga yuboring.", "asks_to_transfer_to_safe_account"],
    ["U pulni shu kartaga o'tkazishni so'rayapti.", "asks_to_transfer_to_safe_account"],
    ["SMS orqali kelgan kodni ayting.", "asks_for_sms_code"],
  ] as const)("keeps the paired direct danger %s as %s", (text, code) => {
    expect(evaluateText(text)).toContain(code);
  });
});

describe("evaluateText — legal-threat word boundaries", () => {
  it("does not read 'государственный' as the standalone word 'суд'", () => {
    expect(
      evaluateText("Я отправил скан паспорта через официальный государственный портал."),
    ).not.toContain("threatens_legal_action");
  });

  it.each([
    "Если не заплатите, подадим в суд.",
    "Они угрожают судом и арестом.",
    "Говорят, что начнут судебное дело.",
    "SUDga chaqirilgansiz, hujjatni oching.",
  ])("keeps a real legal threat: %s", (text) => {
    expect(evaluateText(text)).toContain("threatens_legal_action");
  });
});

describe("evaluateText — asks_to_scan_qr (R14.4)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — verb after the QR mention (branch: qr.?код .{0,30} (скан|войти|подтверд|вериф))
    {
      name: "RU вход через QR с просьбой отсканировать",
      text: "Наведите камеру на QR-код и отсканируйте, чтобы войти",
    },
    { name: "RU подтверждение через QR", text: "QR код, отсканируйте для подтверждения личности" },
    // RU — branch: скан .{0,15} qr
    {
      name: "RU отсканируйте QR для входа",
      text: "Отсканируйте QR код, чтобы войти в личный кабинет",
    },
    // UZ — branch: qr.?kod .{0,30} (skaner|kiring|tasdiq)
    { name: "UZ skanerlang va kiring", text: "QR kodni skanerlang va tizimga kiring" },
    { name: "UZ tasdiqlash uchun QR", text: "Tasdiqlash uchun QR kodni skaner qiling" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU нейтральная фраза без QR", text: "Я сегодня купил билеты в кино на вечер" },
    {
      name: "RU показать чужой QR на входе (без сканирования/входа-глагола)",
      text: "Покажите ваш QR-код на входе в музей",
    },
    {
      name: "RU ресторанное QR-меню без входа/оплаты/кодов",
      text: "Посетите сайт chenson.uz. Узнайте больше о нашем меню, акциях и онлайн-бронировании столов. Зарегистрируйтесь в Telegram-боте, отсканировав QR-код ниже.",
    },
    { name: "UZ нейтральная покупка", text: "Men bugun dokondan non sotib oldim" },
    { name: "UZ отрицание сканирования", text: "Men bank QR-kodini skaner qilmadim." },
    { name: "UZ описание QR-меню", text: "Bu QR-kod menyu sahifasini ochadi." },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("asks_to_scan_qr");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("asks_to_scan_qr");
  });
});

describe("evaluateText — relative_in_distress (R14.5)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — (родственник|сын|...|друг).{0,40}(беда|авари|больниц|задержали|срочно нужны деньги)
    {
      name: "RU сын попал в аварию",
      text: "Ваш сын попал в аварию, срочно нужны деньги на лечение",
    },
    { name: "RU брат в больнице", text: "Твой брат сейчас в больнице, нужна помощь с оплатой" },
    {
      name: "RU родственника задержали",
      text: "Вашего родственника задержали, нужно срочно перевести деньги",
    },
    // UZ — (farzand|...|aka|uka|qiz|do'st).{0,40}(avariya|kasalxona|shoshilinch.{0,10}pul)
    { name: "UZ aka avariyaga tushdi", text: "Akangiz avariyaga tushdi, pul kerak" },
    { name: "UZ do'st kasalxonada", text: "Do'stingiz kasalxonada, tezda pul yuboring" },
    { name: "UZ farzand shoshilinch pul", text: "Farzandingiz uchun shoshilinch pul kerak boldi" },
    {
      name: "UZ singlim mashina muammo zudlik bilan pul",
      text: "Menga singlim qo'ng'iroq qilyapti. U mashinasi bilan muammo bo'lib qolganini aytib, zudlik bilan pul o'tkazishimni so'rayapti.",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU друг играет в футбол", text: "Мой друг любит играть в футбол по выходным" },
    { name: "RU брат купил машину", text: "Мой брат вчера купил новую машину в салоне" },
    { name: "UZ aka mashina sotib oldi", text: "Akam yangi mashina sotib oldi bugun" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("relative_in_distress");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("relative_in_distress");
  });
});

describe("evaluateText — requests_card_digits (R14.6)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — последн(ие|их).{0,10}(4|четыре).{0,10}цифр
    { name: "RU последние 4 цифры карты", text: "Назовите последние 4 цифры вашей карты" },
    {
      name: "RU последних четыре цифры",
      text: "Сообщите последних четыре цифры карты для проверки",
    },
    // RU — подтверд(и|ите).{0,15}цифр.{0,10}карт
    { name: "RU подтвердите цифры карты", text: "Подтвердите цифры карты для верификации" },
    // UZ — karta.{0,20}(raqam|oxirgi).{0,10}(4|to'rt).{0,10}(raqam|son)
    { name: "UZ karta oxirgi 4 raqam", text: "Karta oxirgi 4 raqamini ayting" },
    { name: "UZ karta oxirgi to'rt raqam", text: "Karta oxirgi to'rt raqamini tasdiqlang" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU карта в кошельке", text: "Моя банковская карта лежит в кошельке дома" },
    { name: "RU заказал новую карту", text: "Я заказал новую карту в банке вчера" },
    { name: "UZ kartam hamyonimda", text: "Mening kartam hamyonimda turibdi" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("requests_card_digits");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("requests_card_digits");
  });
});

describe("evaluateText — threatens_account_block (R14.7)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — (карт(а|у)|счёт|счет|аккаунт).{0,30}(заблокир|блокиров)
    { name: "RU карта будет заблокирована", text: "Ваша карта будет заблокирована через 24 часа" },
    { name: "RU счёт заблокируют", text: "Ваш счёт заблокируют, если не подтвердите данные" },
    { name: "RU аккаунт заблокирован", text: "Аккаунт будет заблокирован при бездействии" },
    // UZ — (karta|hisob).{0,30}(bloklan|bloklab)
    { name: "UZ karta bloklanadi", text: "Kartangiz bloklanadi, tasdiqlang" },
    { name: "UZ hisob bloklanadi", text: "Hisobingiz tez orada bloklanadi" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU пополнил карту", text: "Я пополнил карту в банкомате сегодня утром" },
    { name: "RU открыл счёт", text: "Я открыл новый счёт в банке на прошлой неделе" },
    { name: "UZ hisobga pul qoshdim", text: "Men hisobimga pul qoshdim" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("threatens_account_block");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("threatens_account_block");
  });
});

describe("integration — block threat + urgency → suspicious (R14.7)", () => {
  it("RU: срочность + блокировка даёт оба кода и уровень suspicious", () => {
    const text = "Срочно подтвердите данные, иначе карта будет заблокирована";
    const codes = evaluateText(text);
    expect(codes).toContain("threatens_account_block");
    expect(codes).toContain("uses_urgency");

    const { score, level } = scoreFromCodes(codes);
    // threatens_account_block (20) + uses_urgency (15) = 35 ≥ 20 → suspicious
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThan(50);
    expect(level).toBe("suspicious");
  });
});

describe("integration — benign restaurant QR menu stays below high risk", () => {
  it("does not mark a normal restaurant QR menu as high_risk", () => {
    const text =
      "Сервисный сбор 15% от счета. Зарегистрируйтесь в нашем Telegram-боте, отсканировав QR-код ниже. Посетите сайт chenson.uz, чтобы узнать больше о меню, акциях и онлайн-бронировании столов.";
    const codes = evaluateText(text);

    expect(codes).not.toContain("asks_to_scan_qr");
    expect(codes).not.toContain("payment_before_service");
    expect(scoreFromCodes(codes).level).not.toBe("high_risk");
  });
});

describe("evaluateText — fake_delivery_payment (research feed)", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU courier fee link",
      text: "Курьер отправил ссылку: доплатите 12000 сум за доставку, иначе посылку вернут",
    },
    {
      name: "RU postal customs payment",
      text: "Ваша посылка на почте, оплатите небольшой таможенный сбор по ссылке",
    },
    {
      name: "UZ delivery payment link",
      text: "Yetkazib berish uchun 12000 so'm to'lov qiling, aks holda posilka qaytariladi",
    },
    {
      name: "EN parcel payment",
      text: "Pay the delivery fee for your parcel by this link or it will be returned",
    },
    {
      name: "RU voice delivery card-only",
      text: "Слушай, локацию скинул, если там только по карте, доставка у них только по карте",
    },
    {
      name: "RU full voice delivery card-only transcript",
      text: "Слушай, локу скинул, если вдруг там только по карте, то не проблема, я тебе переведу за дорогу сразу же. Вот. Потому что, по-моему, доставка они там только по карте.",
    },
    {
      // Regression: the link word "ссылку" must not flip this delivery note
      // into a gambling promo; it should still read as fake_delivery_payment.
      name: "RU voice delivery card-only with 'ссылку'",
      text: "Ссылку скинул, если вдруг там только по карте, то не проблема, я тебе переведу за дорогу сразу же. Вот, потому что, по-моему, доставка они там только по карте.",
    },
    {
      name: "EN delivery card-only",
      text: "The courier says this delivery is card only and asks to pay by card before pickup",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU normal courier status", text: "Курьер доставит посылку завтра с 10 до 12" },
    {
      name: "RU normal payment on delivery",
      text: "Курьер доставит посылку завтра, оплата наличными или картой при получении",
    },
    { name: "UZ normal delivery", text: "Kuryer ertaga posilkani olib keladi" },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("fake_delivery_payment");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("fake_delivery_payment");
  });
});

describe("evaluateText — gambling_prediction_promo (Telegram betting feed)", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU betting prediction with private invite",
      text: "СЕГОДНЯ СТАВЛЮ НА МАТЧ США - ГЕРМАНИЯ. Посмотреть прогноз бесплатно: https://t.me/+fdOETKx56pozNTBi",
    },
    {
      name: "RU closed channel with guaranteed win",
      text: "Закрытый канал со ставками, гарантирую выигрыш 100.000Р, подпишись прямо сейчас",
    },
    {
      name: "EN betting channel",
      text: "Free betting prediction in our private channel, guaranteed profit: https://t.me/+abcdef12345",
    },
    {
      name: "UZ betting channel",
      text: "Yopiq kanal: stavka prognoz bepul, yutuq 100000 so'm",
    },
    {
      name: "RU casino free-spins deposit promo",
      text: "Стартовый бонус: 100 фриспинов на Twin. Хочешь с крипты пополнить? До 200% на депозит, ссылка ниже",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    {
      name: "RU ordinary match schedule",
      text: "Расписание матча США - Германия сегодня вечером, смотрим футбол с друзьями",
    },
    {
      name: "EN sports news without promo",
      text: "Sports news: the match score was updated after the second half",
    },
    {
      name: "RU restaurant promo with QR",
      text: "Акция ресторана: меню и бонусы по QR-коду, без ставок и прогнозов",
    },
    {
      // Regression: "доставка" contains the substring "ставк" but is delivery,
      // not betting. With "ссылку" matching the action regex this used to
      // falsely fire gambling and over-escalate the verdict to high_risk.
      name: "RU voice delivery card-only (доставка ≠ ставка)",
      text: "Ссылку скинул, если вдруг там только по карте, то не проблема, я тебе переведу за дорогу сразу же. Вот, потому что, по-моему, доставка они там только по карте.",
    },
    {
      // "призыв" contains "приз" but is not a prize; with "матч" as context
      // this used to falsely fire gambling.
      name: "RU call to a match (призыв ≠ приз)",
      text: "Это призыв прийти на матч в субботу, будет весело",
    },
    {
      // "признаю" contains "приз"; "прогноз погоды" is a benign forecast.
      name: "RU admitting a mistake (признаю ≠ приз, прогноз погоды ≠ betting)",
      text: "Я признаю что ошибся, прогноз погоды на завтра плохой",
    },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("gambling_prediction_promo");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("gambling_prediction_promo");
  });
});

describe("evaluateText — giveaway_engagement_bait (NFT / prize engagement bait)", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU NFT giveaway with captcha and reactions",
      text: "Разыгрываем 3 RANDOM NFT из Банка подарков. Из условий: пройти капчу, поставить 3 реакции и проголосовать за @TonZnatok",
    },
    {
      name: "EN giveaway with voting",
      text: "NFT giveaway: subscribe to the channel, vote in the poll and complete captcha to claim the prize",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    {
      name: "ordinary restaurant gift card promo",
      text: "Ресторан дарит подарочный сертификат постоянным гостям по программе лояльности",
    },
    {
      name: "neutral NFT news",
      text: "Новости NFT-рынка: обзор коллекций и статистика продаж за неделю",
    },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("giveaway_engagement_bait");
    expect(["suspicious", "high_risk"]).toContain(scoreFromCodes(evaluateText(text)).level);
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("giveaway_engagement_bait");
  });
});

describe("evaluateText — scam research feed v2: Telegram/Web3 promo patterns", () => {
  it("flags casino/free-spins bonus funnels without making neutral sports news suspicious", () => {
    const twin =
      "Стартовый бонус: 100 фриспинов на Twin. Новым игрокам бонус-пак: от 100% до 150% на первые 3 депа. Хочешь с крипты пополнить? Ссылка на Твин, вход на сайт без VPN.";
    const tonplay =
      "Licensed casino is now launched in Telegram. No KYC, No Limits, No registration. Always here: @TonPlay";
    const neutral = "Sports news: match schedule and score, без ставок и прогнозов.";

    expect(evaluateText(twin)).toEqual(expect.arrayContaining(["crypto_casino_bonus_funnel"]));
    expect(evaluateText(tonplay)).toEqual(expect.arrayContaining(["crypto_casino_bonus_funnel"]));
    expect(evaluateText(neutral)).not.toContain("crypto_casino_bonus_funnel");
  });

  it("flags NFT/Stars giveaways that require captcha, reactions or voting", () => {
    const nft =
      "Разыгрываем 3 RANDOM NFT из Банка подарков через 48 часов. Из условий: пройти капчу, 3 реакции, проголосовать за @TonZnatok.";
    const stars =
      "Напоминаю что ежедневно выдаю NFT и подарки за звёзды. На раздачи выделили 50 000 STARS, раздал более 300 NFT.";
    const neutral = "Новости NFT-рынка: обзор коллекций и статистика продаж за неделю.";

    expect(evaluateText(nft)).toEqual(
      expect.arrayContaining(["giveaway_engagement_bait", "fake_captcha_or_voting"]),
    );
    expect(evaluateText(stars)).toContain("giveaway_engagement_bait");
    expect(evaluateText(neutral)).not.toContain("fake_captcha_or_voting");
  });

  it("does not turn an ordinary SMS verification-code request into a captcha prize gate", () => {
    const text = "The caller asks me to send the verification code that arrived by SMS.";

    expect(evaluateText(text)).toContain("asks_for_sms_code");
    expect(evaluateText(text)).not.toContain("fake_captcha_or_voting");
  });

  it("flags voting domains when voting is tied to contest or prize mechanics", () => {
    const text =
      "Зайдите проголосуйте! https://voting.blockchain-life.com Со сцены пойду забирать статуэтку, какую речь сказать?";
    const neutral = "Supreme Court expected to release ruling on Trump's tariffs on January 14th.";

    expect(evaluateText(text)).toContain("fake_captcha_or_voting");
    expect(evaluateText(neutral)).not.toContain("fake_captcha_or_voting");
  });

  it("flags task/reward campaigns and avoids ordinary Telegram product news", () => {
    const punk =
      "Punk City: Battle Royale. Reward Pool: 30 000 USD. $29,000 in PUNK tokens will be raffled among campaign participants. Keep collecting points to be among the winners.";
    const easyCoin =
      "Беспроигрышная операция. Выполняй лёгкие действия, прокачивай свой уровень и выбирай топовые призы. EasyCoin обмениваешь на топовые призы.";
    const neutral =
      "The recent Telegram update lets people collapse apps and switch between them. Explore TON & Telegram Apps in our catalog.";

    expect(evaluateText(punk)).toContain("task_reward_engagement_bait");
    expect(evaluateText(easyCoin)).toContain("task_reward_engagement_bait");
    expect(evaluateText(neutral)).not.toContain("task_reward_engagement_bait");
  });

  it("flags wallet or DeFi urgency, but not ordinary wallet feature news alone", () => {
    const rhea =
      "After a security incident, Rhea Lending has reopened. Users have a 24-hour grace period to settle open positions before the liquidation bot is reactivated. Manage your positions in HOT Wallet Earn tab.";
    const tonkeeper =
      "Charge Tonkeeper Battery with $PX. Transfer your PX to Tonkeeper; use PX to purchase battery charges instantly. Use this link to open the app and top up your Battery balance.";
    const neutral =
      "Tonkeeper now supports a new token from Not Pixel. Read the product announcement and documentation on tonkeeper.com.";
    const ordinaryBattery =
      "Power bank promo: top up your phone battery at the airport lounge. Open the app link to manage your balance.";

    expect(evaluateText(rhea)).toContain("wallet_action_urgency");
    expect(evaluateText(tonkeeper)).toContain("wallet_action_urgency");
    expect(evaluateText(neutral)).not.toContain("wallet_action_urgency");
    expect(evaluateText(ordinaryBattery)).not.toContain("wallet_action_urgency");
  });

  it("flags TON referral earning schemes", () => {
    const dating =
      "Help friends find a match for Valentine's Day. Earn 1 TON per invited friend. Get referral link on ton.dating and send it to friends.";
    const neutral = "TON ecosystem weekly digest: new apps, games, and catalog updates.";

    expect(evaluateText(dating)).toContain("ton_referral_earning_scheme");
    expect(evaluateText(neutral)).not.toContain("ton_referral_earning_scheme");
  });

  it("flags investment fast-profit funnels without flagging neutral market commentary", () => {
    const goldPitch =
      "Новичок сделал +1.455$ за день на золоте. В понедельник выйдем в прямой эфир, расскажу механику и как начать торговать с нами абсолютно бесплатно.";
    const forexPitch =
      "Beginner profit: $350 in one day on forex. Free start, join the live stream and learn how to trade with us.";
    const neutral =
      "Новости рынка золота: обзор котировок и аналитика без инвестиционных рекомендаций.";

    expect(evaluateText(goldPitch)).toContain("investment_fast_profit_pitch");
    expect(evaluateText(forexPitch)).toContain("investment_fast_profit_pitch");
    expect(scoreFromCodes(evaluateText(goldPitch)).level).toBe("suspicious");
    expect(evaluateText(neutral)).not.toContain("investment_fast_profit_pitch");
  });

  it("escalates a private invite plus casino or fake captcha context to high_risk", () => {
    const casinoCodes = [
      ...evaluateText("100 фриспинов, депозитный бонус и ссылка на Twin"),
      "suspicious_invite_link" as const,
    ];
    const giveawayCodes = [
      ...evaluateText("NFT giveaway: subscribe and join the prize channel"),
      "suspicious_invite_link" as const,
    ];
    const captchaCodes = [
      ...evaluateText("NFT giveaway: пройти капчу и проголосовать за приз"),
      "suspicious_invite_link" as const,
    ];

    expect(scoreFromCodes(casinoCodes).level).toBe("high_risk");
    expect(scoreFromCodes(giveawayCodes).level).toBe("high_risk");
    expect(scoreFromCodes(captchaCodes).level).toBe("high_risk");
  });

  it("flags giveaway bait in private Telegram invite handles", () => {
    const codes = evaluateTelegram("+giftNFT12345");

    expect(codes).toEqual(
      expect.arrayContaining(["suspicious_invite_link", "giveaway_engagement_bait"]),
    );
    expect(scoreFromCodes(codes).level).toBe("high_risk");
  });
});

describe("evaluateText — payment_before_service marketplace patterns", () => {
  const positives: { name: string; text: string }[] = [
    { name: "RU prepayment", text: "Сначала внесите предоплату за бронь товара, потом я отправлю" },
    { name: "RU deposit", text: "Нужен аванс или задаток до встречи, иначе не держу заказ" },
    { name: "UZ upfront payment", text: "Xizmatdan oldin oldindan to'lov qiling, keyin yuboramiz" },
    { name: "EN prepay", text: "First pay the deposit, then I will ship the item" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU neutral payment", text: "Оплата при получении после проверки товара" },
    {
      name: "RU restaurant table booking without upfront payment",
      text: "Узнайте больше о меню, актуальных акциях и онлайн-бронировании столов",
    },
    { name: "UZ pay after service", text: "Tovarni tekshirgandan keyin to'lov qilasiz" },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("payment_before_service");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("payment_before_service");
  });
});

describe("evaluateText — fake_boss_request (research feed)", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU boss asks passport",
      text: "Это ваш руководитель, срочно отправьте паспортные данные для проверки",
    },
    {
      name: "RU HR asks card",
      text: "Отдел кадров просит данные карты и код для анкеты сотрудника",
    },
    {
      name: "UZ boss asks data",
      text: "Rahbar nomidan yozayapman, tez pasport ma'lumot va karta raqamini yuboring",
    },
    { name: "UZ official asks code", text: "Soliq organidanmiz, kod va ma'lumot yuboring" },
  ];

  const negatives: { name: string; text: string }[] = [
    {
      name: "RU ordinary boss message",
      text: "Руководитель просит завтра прийти на планёрку к 10 утра",
    },
    { name: "UZ ordinary HR", text: "Kadr bo'limi ertaga uchrashuv bo'lishini eslatdi" },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("fake_boss_request");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("fake_boss_request");
  });
});

describe("evaluateText — malicious_file_bait (research feed)", () => {
  const positives: { name: string; text: string }[] = [
    { name: "RU gif bait", text: "Откройте этот gif и посмотрите поздравление" },
    { name: "RU archive bait", text: "Скачайте архив с документами и откройте файл" },
    { name: "UZ sticker bait", text: "Stikerni ko'ring va faylni oching" },
    { name: "EN download file", text: "Download this greeting card file and open it" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU normal photo", text: "Посмотрите фото с праздника в семейном чате" },
    { name: "UZ normal message", text: "Bugun oilaviy rasm ko'rdim" },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("malicious_file_bait");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("malicious_file_bait");
  });
});

describe("integration — research-feed codes reach expected risk levels", () => {
  it("known_reported is high_risk on its own", () => {
    expect(scoreFromCodes(["known_reported"]).level).toBe("high_risk");
  });

  it("fake delivery plus a short link becomes high_risk", () => {
    const { level } = scoreFromCodes(["fake_delivery_payment", "suspicious_short_link"]);
    expect(level).toBe("high_risk");
  });
});

describe("evaluateText - telegram_account_takeover_phishing (research feed v1)", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU Telegram deletion cancel button",
      text: "Ваш Telegram аккаунт будет удален. Нажмите кнопку Отмена, чтобы сохранить профиль.",
    },
    {
      name: "RU profile deletion link",
      text: "Заявка на удаление профиля Telegram уже создана, перейдите по ссылке и введите код.",
    },
    {
      name: "UZ Telegram account cancel",
      text: "Telegram akkaunt o'chiriladi. Bekor qilish uchun linkga o'ting va kodni kiriting.",
    },
    {
      name: "UZ Telegram unknown-device freeze link",
      text: "Telegram hisobingizga noma'lum qurilmadan kirish qilinganligi aniqlandi. Hisobingiz majburan muzlatib qo'yildi. 11 soat ichida tasdiqlash uchun havolani bosing.",
    },
    {
      name: "EN Telegram deletion cancel",
      text: "Your Telegram account deletion request is active. Press Cancel and enter the verification code.",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    {
      name: "RU general question",
      text: "В Telegram действительно можно удалить аккаунт через настройки?",
    },
    {
      name: "RU account safety article",
      text: "Как защитить аккаунт Telegram: включите облачный пароль и проверьте устройства.",
    },
    {
      name: "UZ neutral settings",
      text: "Telegram akkaunt sozlamalarida qurilmalarni tekshirish mumkin.",
    },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("telegram_account_takeover_phishing");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("telegram_account_takeover_phishing");
  });

  it("reaches high_risk on its own", () => {
    expect(scoreFromCodes(["telegram_account_takeover_phishing"]).level).toBe("high_risk");
  });
});

describe("evaluateText - dropper_recruitment (research feed v1)", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU sell bank card",
      text: "Оформи банковскую карту на себя и передай нам доступ, заплатим 200 тысяч сум.",
    },
    {
      name: "RU SIM card rent",
      text: "Сдам SIM-карту и аккаунт за вознаграждение, нужен только номер.",
    },
    {
      name: "UZ card for money",
      text: "Karta ochib ber, hisobni topshir, evaziga pul beramiz.",
    },
    {
      name: "EN wallet rent",
      text: "Open a bank card and crypto wallet for us, we pay a reward.",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    {
      name: "RU safety warning",
      text: "Не передавайте банковскую карту, SIM-карту или аккаунт третьим лицам.",
    },
    {
      name: "RU family card use",
      text: "Я дал карту супруге для покупки продуктов.",
    },
    {
      name: "UZ neutral bank card",
      text: "Bank kartamni yangi raqamga bog'lashim kerak.",
    },
    {
      name: "UZ ordinary bank card purchase",
      text: "Men yangi bank kartasini sotib oldim.",
    },
    {
      name: "UZ safe-account transfer is not dropper recruitment",
      text: "Menga notanish odam yozdi. Qo'ng'iroq qilgan odam pulni xavfsiz hisobga o'tkazishni aytdi. Bu firibgarlikka o'xshaydimi?",
    },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("dropper_recruitment");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("dropper_recruitment");
  });

  it("does not let a safety sentence suppress a later recruitment clause", () => {
    const text = "Do not sell your bank card to strangers. Sell your bank card to us for a reward.";

    expect(evaluateText(text)).toContain("dropper_recruitment");
  });

  it("does not let a contrast conjunction extend negation to a dangerous clause", () => {
    const text = "Do not sell your bank card to strangers, but sell your bank card to us.";

    expect(evaluateText(text)).toContain("dropper_recruitment");
  });

  it("does not infer a distressed relative from notanish", () => {
    const text =
      "Menga notanish odam yozdi. Qo'ng'iroq qilgan odam pulni xavfsiz hisobga o'tkazishni aytdi. Bu firibgarlikka o'xshaydimi?";

    expect(evaluateText(text)).not.toContain("relative_in_distress");
  });

  it("is suspicious without changing global thresholds", () => {
    const { score, level } = scoreFromCodes(["dropper_recruitment"]);
    expect(score).toBe(35);
    expect(level).toBe("suspicious");
  });
});

// Soft / polite OTP-extraction bypasses. Real 2026 attackers rarely say "SMS
// code" — they ask the victim to read back digits ("dictate the numbers", "the
// code that will arrive", "code from the message/app"). These must still fire
// `asks_for_sms_code`; neutral asks ("dictate your name") must NOT.
describe("evaluateText — asks_for_sms_code soft bypasses", () => {
  const positives: { name: string; text: string }[] = [
    {
      name: "RU поделитесь кодом из сообщения",
      text: "Поделитесь, пожалуйста, кодом из сообщения для подтверждения входа.",
    },
    {
      name: "RU назовите шесть цифр, которые отправлю",
      text: "Назовите шесть цифр, которые я вам сейчас отправлю.",
    },
    {
      name: "RU продиктуйте код, который придёт",
      text: "Продиктуйте код, который придёт на ваш телефон.",
    },
    {
      name: "RU озвучьте цифры с экрана",
      text: "Откройте приложение и озвучьте цифры с экрана.",
    },
    {
      name: "RU сообщите код из приложения",
      text: "Сообщите код, который пришёл в приложении банка.",
    },
    {
      name: "RU вам придёт код — продиктуйте",
      text: "Вам сейчас придёт код — продиктуйте его, пожалуйста.",
    },
    {
      name: "UZ xabar orqali kelgan kodni ayting",
      text: "Kodni ayting, u sizga xabar orqali keladi.",
    },
    {
      name: "UZ kodni kiriting with digits",
      text: "Salom, bu kodni kiriting please: 1234",
    },
    {
      name: "UZ Cyrillic kodni kiriting with digits",
      text: "Салом, бу кодни киритинг: 1234",
    },
    {
      name: "RU скажите шесть цифр, которые отправлю",
      text: "Скажите шесть цифр, которые я вам сейчас отправлю.",
    },
    {
      name: "RU продиктуйте шесть цифр",
      text: "Продиктуйте шесть цифр.",
    },
    {
      name: "RU прочитайте то, что придёт",
      text: "Прочитайте то, что сейчас придёт в уведомлении.",
    },
    {
      name: "UZ olti raqamni ayting",
      text: "Olti raqamni ayting.",
    },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU назовите полное имя", text: "Назовите своё полное имя для регистрации." },
    { name: "RU продиктуйте номер буквами", text: "Продиктуйте номер заказа по буквам." },
    {
      name: "RU поделитесь впечатлениями",
      text: "Поделитесь, пожалуйста, впечатлениями о фильме.",
    },
    { name: "RU назовите остановку", text: "Назовите остановку для выхода." },
    { name: "RU прочитайте приложение", text: "Прочитайте сообщение из приложения." },
    { name: "RU озвучьте экран презентации", text: "Озвучьте текст с экрана презентации." },
    { name: "RU код города", text: "Назовите код города 71." },
    { name: "RU код товара", text: "Продиктуйте код товара 1234." },
    { name: "UZ нейтральный документ", text: "Hujjatni jo'natishingiz mumkin." },
    { name: "UZ Cyrillic neutral name entry", text: "Салом, исмингизни киритинг." },
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("asks_for_sms_code");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("asks_for_sms_code");
  });

  it("flags plain English SMS-code requests", () => {
    expect(evaluateText("hello, i am from bank security, send sms code")).toContain(
      "asks_for_sms_code",
    );
  });

  it("flags plain English bank security impersonation", () => {
    expect(evaluateText("hello, i am from bank security, send sms code")).toContain(
      "impersonates_bank",
    );
  });
});

describe("evaluateText — Uzbek reported SMS-code requests", () => {
  it("flags a channel admin asking the user to send an SMS code", () => {
    const text =
      "Kanal administratori menga yozmoqda. U mendan SMS kodini yuborishimni so'rayapti.";

    expect(evaluateText(text)).toContain("asks_for_sms_code");
  });

  it("does not flag a neutral channel admin message without a code request", () => {
    const text = "Kanal administratori menga yozmoqda. U ertaga yangi post chiqishini aytdi.";

    expect(evaluateText(text)).not.toContain("asks_for_sms_code");
  });
});

describe("evaluateText — UZ critical scam patterns from audit", () => {
  const positives: { name: string; text: string; code: string }[] = [
    {
      name: "OneID / id.gov.uz code confirmation",
      text: "OneID orqali kirib, id.gov.uz sahifasida kodni tasdiqlang.",
      code: "oneid_government_phishing",
    },
    {
      name: "SIM reissue with SMS code",
      text: "Для перевыпуска SIM-карты назовите SMS-код и паспортные данные.",
      code: "sim_swap_or_number_transfer",
    },
    {
      name: "money mule card transfer for percent",
      text: "Принимайте переводы на карту и отправляйте дальше, оставляйте 10% себе.",
      code: "money_mule_recruitment",
    },
    {
      name: "lottery/prize tax",
      text: "Вы выиграли приз, оплатите налог 50 000 сум для получения.",
      code: "advance_fee_prize_inheritance",
    },
    {
      name: "Korea visa prepayment",
      text: "Для визы в Корею внесите предоплату за оформление документов.",
      code: "advance_fee_prize_inheritance",
    },
    {
      name: "Hajj tour deposit",
      text: "Хадж тур: внесите аванс за бронь места сегодня.",
      code: "advance_fee_prize_inheritance",
    },
    {
      name: "romance to crypto investment pivot",
      text: "Я люблю тебя, давай построим будущее: вложи USDT в мою крипто-стратегию.",
      code: "romance_investment_pivot",
    },
  ];

  const negatives: { name: string; text: string; code: string }[] = [
    {
      name: "OneID public guide without action",
      text: "OneID haqida rasmiy qo'llanma chop etildi.",
      code: "oneid_government_phishing",
    },
    {
      name: "SIM reissue office-only notice",
      text: "Оператор сообщил, что перевыпуск SIM доступен только в офисе с паспортом.",
      code: "sim_swap_or_number_transfer",
    },
    {
      name: "money mule safety warning",
      text: "Не передавайте карту, SIM или аккаунт третьим лицам и не принимайте чужие деньги.",
      code: "money_mule_recruitment",
    },
    {
      name: "tax news without payment request",
      text: "Новости: налог на выигрыш изменился с нового года.",
      code: "advance_fee_prize_inheritance",
    },
    {
      name: "romance without investment pivot",
      text: "Я скучаю, как прошел день?",
      code: "romance_investment_pivot",
    },
  ];

  it.each(positives)("positive: $name", ({ text, code }) => {
    expect(evaluateText(text)).toContain(code);
  });

  it.each(negatives)("negative: $name", ({ text, code }) => {
    expect(evaluateText(text)).not.toContain(code);
  });
});

describe("evaluateText — soft card, PIN, transfer, and personal-data asks", () => {
  const positives: { name: string; text: string; code: string }[] = [
    {
      name: "soft CVV as three digits on card back",
      text: "Назовите три цифры на обороте карты.",
      code: "asks_for_card_cvv",
    },
    {
      name: "card security code",
      text: "Сообщите код безопасности карты.",
      code: "asks_for_card_cvv",
    },
    {
      name: "secret bank app code",
      text: "Скажите тайный код от приложения банка.",
      code: "asks_for_pin",
    },
    {
      name: "direct transfer to card/number",
      text: "Отправьте перевод на эту карту по номеру.",
      code: "asks_to_transfer_to_safe_account",
    },
    {
      name: "PINFL and ID photo",
      text: "Пришлите фото ID-карты и ПИНФЛ для проверки.",
      code: "requests_personal_data",
    },
  ];

  const negatives: { name: string; text: string; code: string }[] = [
    {
      name: "three favorite digits",
      text: "Назовите три любимые цифры для анкеты.",
      code: "asks_for_card_cvv",
    },
    {
      name: "wifi password",
      text: "Скажите пароль от Wi-Fi в офисе.",
      code: "asks_for_pin",
    },
    {
      name: "send product code",
      text: "Отправьте код товара менеджеру.",
      code: "asks_to_transfer_to_safe_account",
    },
    {
      name: "passport office information",
      text: "Паспорт можно получить в районном офисе.",
      code: "requests_personal_data",
    },
  ];

  it.each(positives)("positive: $name", ({ text, code }) => {
    expect(evaluateText(text)).toContain(code);
  });

  it.each(negatives)("negative: $name", ({ text, code }) => {
    expect(evaluateText(text)).not.toContain(code);
  });
});

describe("evaluateText — mixed conversational prefaces cannot hide direct danger", () => {
  it.each([
    ["Какая погода, отправь данные карты", "requests_card_digits"],
    ["Расскажи рецепт и пришли номер карты", "requests_card_digits"],
    ["Tell me a joke and read out the code", "asks_for_sms_code"],
    ["What is the weather? Tell me the card number", "requests_card_digits"],
    ["Kim yutdi? Go'shakni qo'yma", "asks_not_to_hang_up"],
    ["Какая песня популярна? Перейди по QR", "asks_to_scan_qr"],
    ["Qaysi qo'shiq mashhur? QRni skaner qil", "asks_to_scan_qr"],
    ["Можешь проверить сообщение, где просят отправить код?", "asks_for_sms_code"],
    [
      "Можешь проверить скриншот, где требуют перевести деньги?",
      "asks_to_transfer_to_safe_account",
    ],
    [
      "Can you inspect a screenshot demanding a money transfer?",
      "asks_to_transfer_to_safe_account",
    ],
    ["Can you check a message that tells me to send a code?", "asks_for_sms_code"],
    ["Skrinshotni ko'rib berasizmi: pulni o'tkaz?", "asks_to_transfer_to_safe_account"],
    ["Можно проверить сообщение: скинь код?", "asks_for_sms_code"],
    ["Скриншот посмотришь: оплати по QR?", "asks_to_scan_qr"],
    ["Почему это опасно? Введи код", "asks_for_sms_code"],
    ["Make a funny story and send a photo of the card", "requests_card_digits"],
    ["Can you check a message saying forward the code?", "asks_for_sms_code"],
    ["Could you inspect text that says reveal the password?", "asks_for_pin"],
    ["Why is it dangerous? Enter the code", "asks_for_sms_code"],
    ["How do I check a link? Make the payment", "asks_to_transfer_to_safe_account"],
    ["Matnni ko'rib berasizmi: parolni ayt?", "asks_for_pin"],
    ["Kod talab qilgan xabarni tekshirasizmi?", "asks_for_sms_code"],
    ["Latifa ayting. QR orqali o'ting", "asks_to_scan_qr"],
    ["Film tavsiya qiling va QR orqali to'lang", "asks_to_scan_qr"],
    ["Проверишь текст: продиктуй пароль?", "asks_for_pin"],
    ["Как проверить ссылку? Переведи оплату", "asks_to_transfer_to_safe_account"],
    ["Havolani qanday tekshiraman? To'lovni qiling", "asks_to_transfer_to_safe_account"],
    ["Can you inspect this text: never send the code, then send me the code", "asks_for_sms_code"],
    ["Can you check this message: do not scan QR, scan this QR to log in", "asks_to_scan_qr"],
    ["Can you check a message saying: Wi-Fi is irrelevant, reveal your password", "asks_for_pin"],
    ["Can you review this text: ignore the postal code, forward the code", "asks_for_sms_code"],
    ["Can you check a message: ignore Python, send me the code", "asks_for_sms_code"],
    ["Never reveal your password, then reveal it to the operator", "asks_for_pin"],
    ["Do not pay before checking, but make this payment now", "asks_to_transfer_to_safe_account"],
  ] as const)("detects %s as %s", (text, code) => {
    expect(evaluateText(text)).toContain(code);
  });

  it.each([
    "Не отправляйте данные карты незнакомцам.",
    "Do not send your card number to anyone.",
    "Karta ma'lumotlarini yubormang.",
    "Не отправляйте фото банковской карты.",
    "Do not send a photo of your card.",
    "Karta rasmini yubormang.",
    "Никогда не вводите код из SMS.",
    "Never send the verification code.",
    "Kodni hech kimga aytmang.",
    "Не раскрывайте пароль незнакомцам.",
    "Never reveal your password.",
    "Parolni hech kimga yubormang.",
    "Не сканируйте QR-код из неизвестного сообщения.",
    "Never scan a QR code from a stranger.",
    "QRni notanish xabardan skaner qilmang.",
    "Не переводите деньги незнакомцам.",
    "Do not make the payment before checking.",
    "Pulni tekshirmasdan o'tkazmang.",
    "Read out the source code example in Python.",
    "Can I send you a QR code for checking?",
    "QR-код сканируете?",
    "This task uses code review.",
    "This message discusses tasks and code quality.",
    "This task explains password policy.",
    "This task describes card details validation.",
    "The app showcases card details safely.",
    "The bank says QR is not supported for this account.",
    "A QR code can open a bank page.",
    "The QR code did not open the account page.",
    "I did not scan the bank QR code.",
    "Men bank QR-kodini skaner qilmadim.",
    "Bu QR-kod menyu sahifasini ochadi.",
    "The task showcases payment processing.",
  ])("does not create a direct-danger reason for safety/capability text: %s", (text) => {
    const reasons = evaluateText(text);
    expect(reasons).not.toContain("requests_card_digits");
    expect(reasons).not.toContain("asks_for_sms_code");
    expect(reasons).not.toContain("asks_to_scan_qr");
    expect(reasons).not.toContain("asks_for_pin");
    expect(reasons).not.toContain("asks_to_transfer_to_safe_account");
  });
});

describe("evaluateText — natural request framing and punctuation", () => {
  it.each([
    ["They asked me to send the code.", "asks_for_sms_code"],
    ["They asked me for the code.", "asks_for_sms_code"],
    ["The code was requested by the caller.", "asks_for_sms_code"],
    ["The caller asked for my bank password.", "asks_for_pin"],
    ["They requested my password.", "asks_for_pin"],
    ["My bank password was requested.", "asks_for_pin"],
    ["Они попросили меня отправить код.", "asks_for_sms_code"],
    ["Звонивший попросил назвать пароль.", "asks_for_pin"],
    ["Меня попросили прислать фото паспорта.", "requests_personal_data"],
    ["Они попросили перевести деньги.", "asks_to_transfer_to_safe_account"],
    ["Меня попросили сканировать QR для входа.", "asks_to_scan_qr"],
    ["Mendan pasport rasmini yuborishni so'rashdi.", "requests_personal_data"],
    ["A payment was requested before delivery.", "payment_before_service"],
    ["A QR scan was requested for login.", "asks_to_scan_qr"],
    ["They require the code.", "asks_for_sms_code"],
    ["They require my password.", "asks_for_pin"],
    ["They require card details.", "requests_card_digits"],
    ["They require a payment to this account.", "asks_to_transfer_to_safe_account"],
    ["They asked for my passport.", "requests_personal_data"],
    ["My passport was requested.", "requests_personal_data"],
    ["Provide your passport for verification.", "requests_personal_data"],
    ["They asked me to show my ID.", "requests_personal_data"],
    ["Send your national ID.", "requests_personal_data"],
    ["They requested my passport number.", "requests_personal_data"],
    ["Provide your home address.", "requests_personal_data"],
    ["Send your address.", "requests_personal_data"],
    ["Provide the code.", "asks_for_sms_code"],
    ["Submit the code.", "asks_for_sms_code"],
    ["Provide your password.", "asks_for_pin"],
    ["Provide card details.", "requests_card_digits"],
    ["Submit your card number.", "requests_card_digits"],
    ["Предоставьте код.", "asks_for_sms_code"],
    ["Укажите код.", "asks_for_sms_code"],
    ["Предоставьте пароль.", "asks_for_pin"],
    ["Сообщите пароль.", "asks_for_pin"],
    ["Предоставьте данные карты.", "requests_card_digits"],
    ["A code arrived by SMS. The caller asked for it.", "asks_for_sms_code"],
    ["The code came by SMS. Send it to me.", "asks_for_sms_code"],
    ["The code came by SMS. Read it to me.", "asks_for_sms_code"],
    ["The code came by SMS. He told me to send it.", "asks_for_sms_code"],
    ["I received a code in the app. They want it.", "asks_for_sms_code"],
    ["The card number is on the screen. They asked for it.", "requests_card_digits"],
    ["My card number is visible. He told me to share it.", "requests_card_digits"],
    ["My passport is on the form. They requested it.", "requests_personal_data"],
    ["The CVV security code is on the card. Send it to me.", "asks_for_card_cvv"],
    ["The PIN code is shown. Tell it to me.", "asks_for_pin"],
    ["Share your PIN with the operator.", "asks_for_pin"],
    ["Tell me your CVV.", "asks_for_card_cvv"],
    ["Share your screen with me.", "asks_to_share_screen"],
    ["Please share your screen.", "asks_to_share_screen"],
    ["You need to share your phone screen.", "asks_to_share_screen"],
    ["Start screen sharing.", "asks_to_share_screen"],
    ["Give me remote access to your phone.", "asks_to_share_screen"],
    ["Let me see your screen.", "asks_to_share_screen"],
    ["Allow remote control of your device.", "asks_to_share_screen"],
    ["Покажите мне экран.", "asks_to_share_screen"],
    ["Поделитесь экраном.", "asks_to_share_screen"],
    ["Дайте удаленный доступ к телефону.", "asks_to_share_screen"],
    ["Ekraningizni ko'rsating.", "asks_to_share_screen"],
    ["Ekranni ulashing.", "asks_to_share_screen"],
    ["Telefoningizga masofaviy kirish bering.", "asks_to_share_screen"],
    ["Scan QR to log in to your bank account.", "asks_to_scan_qr"],
    ["Scan a QR code to log in to your bank account.", "asks_to_scan_qr"],
    ["Can you review this: scan QR to log in.", "asks_to_scan_qr"],
    ["Send me, please, the code.", "asks_for_sms_code"],
    ["Tell me, please, your password.", "asks_for_pin"],
    ["Send me, please, the card number.", "requests_card_digits"],
    ["Scan, please, the QR code to log in.", "asks_to_scan_qr"],
    ["Пришлите, пожалуйста, код.", "asks_for_sms_code"],
    ["Назовите, пожалуйста, пароль.", "asks_for_pin"],
    ["Сканируйте, пожалуйста, QR для входа.", "asks_to_scan_qr"],
    ["Never send the code: now send me the code.", "asks_for_sms_code"],
    ["Never send the code — now send me the code.", "asks_for_sms_code"],
    ["Never reveal your password — reveal it to the operator.", "asks_for_pin"],
    ["Never scan QR — scan this QR to log in.", "asks_to_scan_qr"],
    ["Do not pay: make this payment now.", "asks_to_transfer_to_safe_account"],
    ["Do not share card details — send me the card number.", "requests_card_digits"],
  ] as const)("detects natural request %s as %s", (text, code) => {
    expect(evaluateText(text)).toContain(code);
  });

  it.each([
    ["The restaurant asks guests to scan a QR code for the menu.", "asks_to_scan_qr"],
    ["The museum says scan the QR code for the audio guide.", "asks_to_scan_qr"],
    ["Scan the QR code to see the menu.", "asks_to_scan_qr"],
    ["Please scan the QR code to connect to Wi-Fi.", "asks_to_scan_qr"],
    ["Tell me the dress code.", "asks_for_sms_code"],
    ["Send me the coupon code.", "asks_for_sms_code"],
    ["Send me the tracking code.", "asks_for_sms_code"],
    ["The task asks for code style consistency.", "asks_for_sms_code"],
    ["The password policy requires users to change a password.", "asks_for_pin"],
    ["The app requires a password to sign in.", "asks_for_pin"],
    ["The bank asks customers not to share card details.", "requests_card_digits"],
    ["Karta ma'lumotlarini bank saytida tekshiring.", "requests_card_digits"],
    ["The task showcases payment processing.", "asks_to_transfer_to_safe_account"],
    ["Do not make payment before verifying.", "asks_to_transfer_to_safe_account"],
    ["How do I make a payment in the app?", "asks_to_transfer_to_safe_account"],
    ["The documentation explains how to make payment.", "asks_to_transfer_to_safe_account"],
    ["Do not send your passport photo.", "requests_personal_data"],
    ["I asked about my address.", "requests_personal_data"],
    ["The form requires an address for delivery.", "requests_personal_data"],
    ["They asked about card details security.", "requests_card_digits"],
    ["Where is the passport renewal office?", "requests_personal_data"],
    ["Do not provide your passport.", "requests_personal_data"],
    ["Never submit your card number.", "requests_card_digits"],
    ["Never provide the code.", "asks_for_sms_code"],
    ["Do not provide your password.", "asks_for_pin"],
    ["Never share your PIN.", "asks_for_pin"],
    ["Do not tell anyone your CVV.", "asks_for_card_cvv"],
    ["Your PIN should remain secret.", "asks_for_pin"],
    ["A CVV is the security code on the back of a card.", "asks_for_card_cvv"],
    ["Никому не сообщайте PIN-код.", "asks_for_pin"],
    ["Никому не сообщайте CVV.", "asks_for_card_cvv"],
    ["PIN-kodni hech kimga aytmang.", "asks_for_pin"],
    ["CVV-ni yubormang.", "asks_for_card_cvv"],
    ["Do not download AnyDesk.", "asks_to_share_screen"],
    ["Can I share a screenshot?", "asks_to_share_screen"],
    ["Can I share my screenshot with you?", "asks_to_share_screen"],
    ["May I share the screenshot for analysis?", "asks_to_share_screen"],
    ["Please share a screenshot of the message.", "asks_to_share_screen"],
    ["This screenshot mentions TeamViewer.", "asks_to_share_screen"],
    ["Can you check a screenshot about AnyDesk?", "asks_to_share_screen"],
    ["The QR code is ready. Send it to me.", "asks_for_sms_code"],
    ["The QR code is in the PDF. Share it with me.", "asks_for_sms_code"],
    ["The CVV security code is on the card. Send it to me.", "asks_for_sms_code"],
    ["The PIN code is shown. Tell it to me.", "asks_for_sms_code"],
    [
      "Banks never ask you to transfer money to a safe account.",
      "asks_to_transfer_to_safe_account",
    ],
    ["Never transfer to a safe account.", "asks_to_transfer_to_safe_account"],
    ["Avoid transferring money to a safe account.", "asks_to_transfer_to_safe_account"],
    ["Never install an APK from a stranger.", "asks_to_install_apk"],
    ["It is unsafe to install an APK.", "asks_to_install_apk"],
    ["Never pay a delivery fee from a link.", "fake_delivery_payment"],
    ["You should not send the code.", "asks_for_sms_code"],
    ["Do not ever send the code.", "asks_for_sms_code"],
    ["It is unsafe to share the code.", "asks_for_sms_code"],
    ["You should not reveal your password.", "asks_for_pin"],
    ["It is unsafe to send card details.", "requests_card_digits"],
    ["You should not provide your passport.", "requests_personal_data"],
    ["Send me the website address.", "requests_personal_data"],
    ["Enter the server address.", "requests_personal_data"],
    ["Tell me the IP address.", "requests_personal_data"],
    ["Show me the HTML element ID.", "requests_personal_data"],
    ["Send the process ID.", "requests_personal_data"],
    ["Enter the user ID.", "requests_personal_data"],
    ["Provide the transaction ID.", "requests_personal_data"],
    ["Can this bot scan QR codes?", "asks_to_scan_qr"],
    ["Xabarda kartaning CVV kodini ayting deyishdi.", "asks_for_sms_code"],
  ] as const)("does not infer %s as %s", (text, code) => {
    expect(evaluateText(text)).not.toContain(code);
  });
});

describe("evaluateText — sensitive-object carry across a safe or neutral clause", () => {
  it.each([
    ["Паспорт, его просят отправить", "requests_personal_data"],
    ["Данные карты, их просят прислать", "requests_card_digits"],
    ["Не отправляйте код, но назовите его мне", "asks_for_sms_code"],
    ["Kod yubormang, lekin uni menga ayting", "asks_for_sms_code"],
    ["QR, его просят открыть для входа", "asks_to_scan_qr"],
    ["В анкете всё заполнено, пришлите CVV банковской карты", "asks_for_card_cvv"],
    [
      "This is a card game, however send the last four digits of your bank card",
      "requests_card_digits",
    ],
  ] as const)("keeps the dangerous tail in %s", (text, code) => {
    expect(evaluateText(text)).toContain(code);
  });

  it.each([
    ["I received the code, tell me the weather", "asks_for_sms_code"],
    ["I received the source code, send it to the reviewer", "asks_for_sms_code"],
    ["Send me the password reset instructions", "asks_for_pin"],
    ["Пришли советы по защите пароля", "asks_for_pin"],
    ["Show me the password field in the UI", "asks_for_pin"],
  ] as const)("does not turn the neutral request %s into %s", (text, code) => {
    expect(evaluateText(text)).not.toContain(code);
  });
});

describe("evaluateText — physical access context stays clause-local", () => {
  it.each([
    "Код домофона 1234, но отправь мне код входа в банк",
    "Код от двери 1234 — отправь мне код входа в банк",
    "Код подъезда 1234; пришли код входа в банк",
    "Отправь мне код входа в банк, код домофона 1234",
    "Код домофона 1234, но они просят отправить код",
    "Eshik kodi 1234, lekin ular kodni yuborishni so'rashyapti",
    "The door code is 1234, but send me the bank login code",
    "The entrance code is 1234; tell me the bank account code",
    "Код домофона 1234 отправь мне код входа в банк",
    "Почтовый код 100000, но они просят отправить код",
    "Tell me the dress code, but send me the bank login code",
    "Исходный код на Python; теперь отправь код входа в банк",
    "Buyurtma kodi 45, lekin SMS kodni yuboring",
  ])("does not let a physical-code clause hide a dangerous request: %s", (text) => {
    expect(evaluateText(text)).toContain("asks_for_sms_code");
  });

  it.each([
    "Код домофона 1234",
    "Мама назвала мне код от подъезда",
    "Пришли мне код от двери",
    "The door code is 1234",
    "Tell me the entrance code",
    "Onam menga eshik kodini aytdi",
    "Eshik kodini menga ayting",
  ])("keeps a genuine physical-access-code message neutral: %s", (text) => {
    expect(evaluateText(text)).not.toContain("asks_for_sms_code");
  });
});
