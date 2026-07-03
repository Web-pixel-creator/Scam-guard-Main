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
  ];

  it.each(positives)("positive: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("dropper_recruitment");
  });

  it.each(negatives)("negative: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("dropper_recruitment");
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
