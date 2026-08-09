import { describe, expect, it } from "vitest";
import {
  buildVictimFollowUpContext,
  buildVictimGuidanceFollowUpText,
  buildVictimIntentText,
  classifyVictimGuidanceFollowUp,
  classifyVictimContextualFollowUp,
  classifyVictimContextualPanicIntent,
  classifyVictimIntent,
} from "@/lib/telegram/victim-intent";
import { classifyTextPanicIntent } from "@/lib/telegram/text-panic-intent";

describe("classifyVictimIntent", () => {
  it.each([
    ["помогите", "emotional_help"],
    ["мне нужна помощь", "emotional_help"],
    ["я боюсь", "emotional_help"],
    ["памагите миня абманули", "emotional_help"],
    ["не понимаю что происходит объясни", "emotional_help"],
    // Past-tense "already deceived" → bank-first aftermath guidance.
    ["меня обманули", "report_question"],
    ["обманули", "report_question"],
    ["меня развели на деньги", "report_question"],
    ["кинули на деньги", "report_question"],
    ["у меня украли деньги с карты", "report_question"],
    ["деньги ушли", "report_question"],
    ["мошеники сняли денги с карты", "report_question"],
    ["meni aldashdi", "report_question"],
    ["мени алдашди", "report_question"],
    ["kartamdan pul yechib olishdi", "report_question"],
    ["menya obmanuli chto delat", "report_question"],
    ["kak vernut dengi", "report_question"],
    ["как вернуть деньги", "report_question"],
    ["поможет ли банк вернуть перевод", "report_question"],
    ["нужно ли идти в милицию", "report_question"],
    // "кинули ссылку" must stay a link report, not a deceived report.
    ["мне кинули ссылку", "link_received"],
    ["мама скинула ссылку говорит от налоговой", "link_received"],
    // Standalone scam nouns → gentle concern funnel.
    ["мошенники", "general_scam_concern"],
    ["правда или обман", "general_scam_concern"],
    ["firibgar", "general_scam_concern"],
    // Blackmail / sextortion.
    ["требуют деньги иначе опубликуют мои фото", "blackmail_threat"],
    ["меня шантажируют", "blackmail_threat"],
    ["угрожают разослать фото всем контактам", "blackmail_threat"],
    ["говорят что у них есть компромат с моими фото", "blackmail_threat"],
    ["they say they have compromising photos of me", "blackmail_threat"],
    ["menda kompromat rasmlar bor deb aytyapti", "blackmail_threat"],
    ["rasmlarimni tarqatishadi deb pul so'rashyapti", "blackmail_threat"],
    // Meta and aftermath questions.
    ["ты бот?", "trust_or_greeting"],
    ["как заблокировать карту", "bank_contact_question"],
    ["они опять звонят", "unknown_call"],
    // Vote-for-contest account-theft funnel.
    ["незнакомый номер просит проголосовать за племянницу в конкурсе", "telegram_takeover"],
    // Fake job with a deposit.
    ["предлагают работу на дому надо внести залог", "job_offer"],
    // Withdrawal trap (investment/casino "pay a tax to withdraw").
    ["не могу вывести деньги с платформы", "withdrawal_blocked"],
    ["требуют налог чтобы вывести мой выигрыш", "withdrawal_blocked"],
    ["вложился через наставника а вывод заблокировали", "withdrawal_blocked"],
    ["pulimni qaytarib bo'lmayapti", "withdrawal_blocked"],
    // Loan opened in the victim's name.
    ["на меня оформили кредит", "identity_loan"],
    ["взяли микрозайм на мое имя", "identity_loan"],
    ["kredit rasmiylashtirishibdi ustimga", "identity_loan"],
    // Unauthorized charges and paid subscriptions.
    ["пришло смс о списании которое я не делал", "unauthorized_charge"],
    ["подписали на платные смс списывают деньги", "unauthorized_charge"],
    // Non-Telegram account takeover.
    ["взломали инстаграм", "account_hacked_other"],
    ["взломали почту", "account_hacked_other"],
    // Same scammer returns from a new number.
    ["он пишет мне с нового номера опять", "scammer_recontact"],
    // Privacy questions before sharing evidence.
    ["это анонимно?", "privacy_question"],
    ["ты не сольешь мои данные?", "privacy_question"],
    // Physical threats.
    ["угрожают приехать домой если не заплачу", "violence_threat"],
    // A relative has already paid.
    ["бабушка перевела деньги мошенникам", "relative_already_paid"],
    ["onam firibgarga pul o'tkazib yubordi", "relative_already_paid"],
    // Latin-keyboard transliteration fallback.
    ["menya razveli na dengi", "report_question"],
    ["pomogite", "emotional_help"],
    ["moshenniki", "general_scam_concern"],
    ["eto skam?", "general_scam_concern"],
    // Letter stretching collapses before classification.
    ["памагитеееее", "emotional_help"],
    ["меня обманулиииии", "report_question"],
    ["меня пытаются обмануть", "general_scam_concern"],
    ["звонил мошенник", "general_scam_concern"],
    ["я думаю это мошенники", "general_scam_concern"],
    ["мне пишут в телеграме", "telegram_message"],
    ["мне что то прислали", "telegram_message"],
    ["мне звонит неизвестный номер", "unknown_call"],
    ["мне звонят прямо сейчас", "unknown_call"],
    ["звонят с незнакомого номера", "unknown_call"],
    ["мне звонят с другой страны", "foreign_call"],
    ["просто звонок с другой страны брать трубку?", "foreign_call"],
    ["мне звонят из Нигерии", "foreign_call"],
    ["звонят с номера +98 из Ирана", "foreign_call"],
    [
      "мне звонят с +988 и представляются сотрудником банка, просят данные карты и SMS",
      "foreign_call",
    ],
    [
      "мне звонят с +98 говорят Uzmobile и просят код для защиты номера от блокировки",
      "foreign_call",
    ],
    ["мне звонят по 15 раз с иностранного номера и просят карту и код из SMS", "foreign_call"],
    ["мне звонит Uztelecom с +996 договор истекает и просят SMS код", "foreign_call"],
    ["menga noma'lum raqamdan qo'ng'iroq qilishyapti", "unknown_call"],
    ["мне прислали ссылку", "link_received"],
    ["мне прислали файл", "file_received"],
    ["у меня просят код", "code_request"],
    ["нужно ли давать код", "code_request"],
    ["у меня просят карту", "card_request"],
    ["мне сказали перевести деньги", "transfer_request"],
    ["меня просят установить приложение", "apk_request"],
    ["у меня просят ссылку", "link_request"],
    ["у меня просят паспорт", "personal_data_request"],
    ["у меня просят пинфл", "personal_data_request"],
    ["menga pasport so'rashyapti", "personal_data_request"],
    ["Nega mendan pasport yuborishni so'rashyapti?", "personal_data_request"],
    ["Почему мошенники просят фото паспорта?", "personal_data_request"],
    ["мне звонили из банка", "bank_call"],
    ["мне звонит директор билайна", "operator_call"],
    ["мне звонит оператор Beeline", "operator_call"],
    ["сотрудник Uztelecom говорит договор истекает и просит продиктовать код", "operator_call"],
    ["звонили и говорили что карта заблокирована", "bank_call"],
    ["мне звонит фейковый майор", "authority_impersonation"],
    ["мне звонят из прокуратуры", "authority_impersonation"],
    ["мне пишет следователь", "authority_impersonation"],
    ["мне пишет тот кто говорит что он из кадастра", "authority_impersonation"],
    ["мне звонили из солик", "authority_impersonation"],
    ["Soliqdan qo'ng'iroq qilishdi", "authority_impersonation"],
    ["soliqdan yozishdi", "authority_impersonation"],
    ["Soliqdan SMS kod so'rashyapti", "gov_service_login"],
    ["звонят из водоканала и просят паспорт для умного счетчика", "utility_impersonation"],
    ["пенсионный фонд обещает повысить пенсию и просит данные карты", "pension_benefit"],
    ["инспектор МИБ требует наличные за списание долга", "official_impersonation"],
    ["мне пишет незнакомый человек", "unknown_contact"],
    ["мне пишет администратор канала", "telegram_message"],
    ["мне пишет админ группы", "telegram_message"],
    ["администратор канала написал мне", "telegram_message"],
    ["Kanal administratori menga yozmoqda", "telegram_message"],
    ["Guruh admini menga yozdi", "telegram_message"],
    ["мне пишет одноклассник но я не уверен что это он", "identity_uncertain"],
    ["мне написал друг и просит деньги", "friend_money"],
    ["моей бабушке звонил мошенник он просил срочно прислать деньги на помощь", "friend_money"],
    ["родственник звонит по видеосвязи с ИИ и просит срочно деньги", "friend_money"],
    ["мне пишет кто-то из техподдержки", "support_impersonation"],
    ["мне пишет девушка из интернета", "romance_contact"],
    ["девушка из интернета просит деньги на билет", "romance_money"],
    ["новый знакомый говорит любит и просит деньги на билет", "romance_money"],
    ["мне пишет работодатель", "job_offer"],
    ["работодатель просит оплатить обучение перед работой", "job_offer"],
    ["работа просит внести депозит за форму", "job_offer"],
    ["меня приглашают в канал для заработка", "earning_channel"],
    ["бот обещает 500000 сум в день если нажать кнопку и перейти в канал", "earning_channel"],
    ["мне предлагают бот для заработка 500 тысяч сум в день", "earning_channel"],
    ["мне предлагают инвестировать в крипту через телеграм канал", "investment_offer"],
    ["зовут в крипто канал с платными сигналами", "investment_offer"],
    ["агентство обещает визу в Корею но просит предоплату", "travel_migration_prepayment"],
    ["турфирма просит оплатить хадж заранее", "travel_migration_prepayment"],
    ["menga Koreyaga viza uchun oldindan to'lov so'rashyapti", "travel_migration_prepayment"],
    ["мне пишет тот кто представляется нотариусом", "legal_impersonation"],
    ["мне пишет нотариус и требует оплатить штраф", "legal_impersonation"],
    ["Хотели в Soliq войти", "gov_service_login"],
    ["агентство Хотели в Soliq войти", "gov_service_login"],
    ["просят войти в OneID", "gov_service_login"],
    ["как мне связаться с банком", "bank_contact_question"],
    ["какой номер банка", "bank_contact_question"],
    ["куда пожаловаться на мошенника", "report_question"],
    ["куда звонить если меня обманули", "report_question"],
    ["спасибо", "acknowledgement"],
    ["хорошо сделаю", "acknowledgement"],
    ["Salom", "trust_or_greeting"],
    ["salom sizga ishonsam boladimi", "trust_or_greeting"],
    ["Salom это скам?", "general_scam_concern"],
    ["bu scammi?", "general_scam_concern"],
    ["bu firibgarlikmi?", "general_scam_concern"],
    ["meni aldayapti", "general_scam_concern"],
    ["menga kod so'rashyapti", "code_request"],
    ["покупают голос Open Budget и просят SMS код", "open_budget"],
    ["врач DMED просит SMS код для записи", "medical_code"],
    ["ребенку предлагают бесплатные бонусы в игре и просят код", "child_game_bonus"],
    ["menga nimadir yuborishdi", "telegram_message"],
    ["мне пишут от имени Telegram с галочкой", "telegram_takeover"],
    ["официальный Telegram просит пройти проверку иначе аккаунт удалят", "telegram_takeover"],
    [
      "мне пришло сообщение от Telegram аккаунт удален нажмите Отмена чтобы спасти профиль",
      "telegram_takeover",
    ],
    ["мне пришел подарок Telegram Premium надо активировать по ссылке", "telegram_takeover"],
    ["мне пишет знакомый и просит проголосовать в конкурсе по ссылке", "telegram_takeover"],
    ["просят проголосовать за лучшую мамочку по ссылке", "telegram_takeover"],
    ["одноклассник просит проголосовать по ссылке за лучшую маму", "telegram_takeover"],
    ["Одноклассник просит перейти по ссылке проголосовать за конкурс", "telegram_takeover"],
    ["мне прислали APK я ухожу из этого мира", "file_received"],
    ["прислали APK повестка в суд", "file_received"],
    ["в телеграм пришел файл повестка.pdf.apk", "file_received"],
    ["мне прислали голосовое сообщение как файл и говорят открыть", "file_received"],
    ["прислали GIF открытку с новым годом и файл pptx", "file_received"],
    ["оповещение Apple iOS повреждена на 72 процента просит установить защиту", "apple_security"],
    ["всплывающее окно Apple ID просит пароль для проверки аккаунта", "apple_security"],
    ["незнакомец просит телефон на минуту позвонить", "phone_borrowing"],
    ["На улице просят телефон позвонить на минуту", "phone_borrowing"],
    ["у банкомата незнакомец просит снять деньги с моей карты", "money_mule"],
    ["деньги пришли по ошибке просят вернуть на другой счет", "money_mule"],
    [
      "пишут что нулевой баланс за газ и нужно перейти по ссылке для проверки",
      "utility_impersonation",
    ],
    ["мне звонят из госорганов знают ФИО и ПИНФЛ просят код", "official_impersonation"],
    ["у меня спрашивают три цифры на обороте карты", "card_request"],
    ["поликлиника просит SMS код для записи в DMED", "medical_code"],
    ["знакомый пишет срочно одолжи деньги верну через пару часов", "friend_money"],
    ["ребенку обещают бесплатные бонусы в игре и просят код", "child_game_bonus"],
    ["мне предлагают бот для заработка 500 тысяч сум в день по нажатию кнопки", "earning_channel"],
    ["звонят из почты для получения посылки нужно продиктовать SMS код", "code_request"],
    ["звонят и молчат чтобы записать голос", "silent_call"],
    ["hello are you a scam", "trust_or_greeting"],
    ["what should I do", "advice_question"],
    ["someone asked me for a verification code", "code_request"],
    ["курьер сказал нужна смс для получения посылки", "code_request"],
    ["Мне сказали оплатить по реквизитам из чата", "transfer_request"],
    ["Mendan bir martalik parol bor xabarni boshqa chatga yuborishni so'rashdi", "code_request"],
    ["Menga turli noma'lum raqamlardan qayta-qayta qo'ng'iroq qilishdi", "unknown_call"],
  ])("maps '%s' to %s", (text, kind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(kind);
  });

  it("keeps concrete artifacts on the risk pipeline", () => {
    expect(classifyVictimIntent("https://kapitalbank.uz.evil.example/login")).toBeNull();
    expect(classifyVictimIntent("+998901234567")).toBeNull();
    expect(classifyVictimIntent("@lucky_promo")).toBeNull();
  });

  it("keeps direct scammer payloads on the risk pipeline", () => {
    expect(
      classifyVictimIntent(
        "Служба безопасности Kapitalbank. Ваша карта заблокирована. Назовите код из SMS.",
      ),
    ).toBeNull();
    expect(classifyVictimIntent("Salom, men bank xodimi, kodingizni ayting.")).toBeNull();
  });

  it.each([
    "I scanned a QR code and now cannot access my Telegram account. What should I do?",
    "Я отсканировал QR и потерял доступ к аккаунту. Что делать?",
    "Men QRni tekshirdim, endi akkauntga kira olmayapman. Nima qilay?",
  ])("recognizes post-QR account loss as a Telegram takeover: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "telegram_takeover",
      askedContext: "link_qr",
    });
  });

  it("keeps completed-link concern in the advice flow", () => {
    expect(classifyVictimIntent("Я проверил эту ссылку и теперь боюсь. Что делать?")).toEqual({
      kind: "advice_question",
    });
  });

  it("does not mistake the artifact label 'QR code' for an SMS-code request", () => {
    expect(classifyVictimIntent("I scanned a QR code. What should I do?")).toEqual({
      kind: "advice_question",
    });
  });
});

describe("classifyVictimIntent — confirmed direct-bot live regressions", () => {
  it.each([
    [
      "Сотрудник полиции требует срочно перевести деньги на «безопасный счёт», иначе заведёт дело.",
      { kind: "legal_impersonation", askedContext: "transfer", scenario: "police_impersonation" },
    ],
    [
      "Незнакомец угрожает разослать мои личные фотографии, если я не переведу деньги.",
      { kind: "blackmail_threat", askedContext: "transfer", scenario: "photo_extortion" },
    ],
    [
      "Kredit olishdan oldin sug‘urta va rasmiylashtirish uchun oldindan pul to‘lashimni so‘rashmoqda.",
      { kind: "transfer_request", askedContext: "transfer", scenario: "loan_advance_fee" },
    ],
    [
      "Сбор на лечение просит срочно перевести деньги на личную карту.",
      { kind: "transfer_request", askedContext: "transfer", scenario: "charity_pressure" },
    ],
    [
      "My online boyfriend says he is stranded and urgently needs money for a flight ticket.",
      { kind: "romance_money", askedContext: "transfer", scenario: "romance_money" },
    ],
    [
      "Telegram qo‘llab-quvvatlash xodimi akkauntni tekshirish uchun parolimni yuborishimni so‘radi.",
      { kind: "support_impersonation", scenario: "fake_support" },
    ],
    [
      "I was invited to a Telegram earning channel that promises guaranteed daily income after a deposit.",
      { kind: "earning_channel", askedContext: "link_qr" },
    ],
    [
      "Банк требует перевести все деньги на «безопасный счёт», чтобы защитить их от кражи.",
      { kind: "transfer_request", askedContext: "transfer", scenario: "safe_account_transfer" },
    ],
    [
      "звонили сказали из центрабанка что мои деньги в опасности и надо перевести их на безапасный счет пока не украли",
      { kind: "transfer_request", askedContext: "transfer", scenario: "safe_account_transfer" },
    ],
    [
      "мне пишут в телеграме что надо срочно продиктовать код иначе карту заберут",
      { kind: "code_request", askedContext: "code" },
    ],
  ] as const)("keeps the concrete live topic for %s", (text, expected) => {
    expect(classifyVictimIntent(text)).toEqual(expected);
  });

  it.each([
    [
      "Сотрудник полиции требует срочно перевести деньги на «безопасный счёт», иначе заведёт дело.",
      "ru",
      "Полиция не требует",
    ],
    [
      "Незнакомец угрожает разослать мои личные фотографии, если я не переведу деньги.",
      "ru",
      "личных фотографий",
    ],
    [
      "Kredit olishdan oldin sug‘urta va rasmiylashtirish uchun oldindan pul to‘lashimni so‘rashmoqda.",
      "uz",
      "oldindan to'lov",
    ],
    [
      "Telegram qo‘llab-quvvatlash xodimi akkauntni tekshirish uchun parolimni yuborishimni so‘radi.",
      "uz",
      "parol",
    ],
    [
      "Банк требует перевести все деньги на «безопасный счёт», чтобы защитить их от кражи.",
      "ru",
      "«Безопасный счёт»",
    ],
    [
      "звонили сказали из центрабанка что мои деньги в опасности и надо перевести их на безапасный счет пока не украли",
      "ru",
      "выдуманная схема",
    ],
  ] as const)("builds topic-specific copy for %s", (text, lang, expectedText) => {
    const match = classifyVictimIntent(text);
    expect(match).not.toBeNull();
    expect(buildVictimIntentText(match!, lang)).toContain(expectedText);
  });

  it("keeps short why/next/trusted-person questions on recent code guidance", () => {
    const at = new Date("2026-07-17T12:00:00.000Z");
    const context = buildVictimFollowUpContext({ kind: "code_request", askedContext: "code" }, at);
    const now = new Date(at.getTime() + 60_000);

    const why = classifyVictimGuidanceFollowUp("Почему это опасно?", context, now);
    const next = classifyVictimGuidanceFollowUp("Что делать дальше?", context, now);
    const trusted = classifyVictimGuidanceFollowUp("Можно показать это сыну?", context, now);
    const reply = classifyVictimGuidanceFollowUp("что мне им сказать", context, now);
    const verify = classifyVictimGuidanceFollowUp(
      "а если это правда банк как проверить",
      context,
      now,
    );
    const simple = classifyVictimGuidanceFollowUp("объясни простыми словами", context, now);
    const uzNext = classifyVictimGuidanceFollowUp("нима қилай", context, now);
    const pressure = classifyVictimGuidanceFollowUp(
      "они сказали что срочно надо иначе деньги прападут",
      context,
      now,
    );

    expect(why).toMatchObject({ action: "why", context: { kind: "code_request" } });
    expect(next).toMatchObject({ action: "next_steps", context: { kind: "code_request" } });
    expect(trusted).toMatchObject({ action: "trusted_person", context: { kind: "code_request" } });
    expect(reply).toMatchObject({ action: "reply_script", context: { kind: "code_request" } });
    expect(verify).toMatchObject({ action: "verify_official", context: { kind: "code_request" } });
    expect(simple).toMatchObject({ action: "explain_simple", context: { kind: "code_request" } });
    expect(uzNext).toMatchObject({ action: "next_steps", context: { kind: "code_request" } });
    expect(pressure).toMatchObject({ action: "pressure", context: { kind: "code_request" } });
    expect(buildVictimGuidanceFollowUpText(why!, "ru")).toContain("SMS-код");
    expect(buildVictimGuidanceFollowUpText(next!, "ru")).toContain("Код");
    expect(buildVictimGuidanceFollowUpText(trusted!, "ru")).toContain("близкому человеку");
    expect(buildVictimGuidanceFollowUpText(reply!, "ru")).toContain("сам перезвоню");
    expect(buildVictimGuidanceFollowUpText(verify!, "ru")).toContain("обратной стороны карты");
    expect(buildVictimGuidanceFollowUpText(simple!, "ru")).toContain("Простыми словами");
    expect(buildVictimGuidanceFollowUpText(pressure!, "ru")).toContain("давление");
  });
});

describe("classifyVictimIntent — job-entry fee priority", () => {
  it.each([
    "Меня просят оплатить обучение на работу как новичку",
    "Mendan yangi ish uchun o'qish pulini to'lashni so'rashyapti",
    "They ask me to pay for training as a newcomer to the job",
  ])("routes a reversed-order job/training payment to job guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({ kind: "job_offer" });
  });

  it.each([
    "Почему я должен платить за обучение перед работой?",
    "Nega ish boshlashdan oldin o'qish pulini to'lashim kerak?",
    "Why should I pay a training fee before starting the job?",
  ])("keeps a topic-explicit job-payment follow-up on job guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({ kind: "job_offer" });
  });

  it.each([
    ["Меня просят оплатить обучение в университете", "transfer_request"],
    ["Меня просят оплатить информацию о работе", "transfer_request"],
    ["Меня просят оплатить платформу для работы", "transfer_request"],
    ["Ular komissiyani hozir to'lash kerak deyishyapti.", "transfer_request"],
    ["They ask me to pay the utility bill at work", "utility_impersonation"],
    ["Мне сказали оплатить по реквизитам из чата", "transfer_request"],
    [
      "Агентство предлагает работу за границей и просит оплатить обучение",
      "travel_migration_prepayment",
    ],
  ] as const)("does not steal a neighbouring payment route: %s", (text, expectedKind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(expectedKind);
  });

  it.each([
    ["Мне сказали оплатить проверку: так работает система", "transfer_request"],
    ["They ask me to pay an activation fee so the network will work", "transfer_request"],
    ["Меня просят оплатить обработку заявки", "transfer_request"],
  ] as const)("does not treat a technical use of work/работ as a job: %s", (text, expectedKind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(expectedKind);
  });

  it("does not treat Uzbek bepul as a money request", () => {
    expect(classifyVictimIntent("Mendan bepul kursga yozilishimni so'rashyapti")).toEqual({
      kind: "telegram_message",
    });
    expect(
      classifyVictimIntent("Chet elga bepul ishlash dasturini taklif qilishdi")?.kind,
    ).not.toBe("travel_migration_prepayment");
  });

  it.each([
    "Chet elga ishga kirish uchun oldindan pul so'rashyapti",
    "Xorijga ishlash uchun komissiya so'rashyapti",
    "Oldindan pul to'lashim kerak, keyin xorijga ishga yuborishadi",
    "Komissiyani hozir to'lashim kerak, keyin chet elga ishlashga yuborishadi",
    "They ask for a training fee before I can work abroad",
    "A deposit must be paid before the job overseas",
    "Oldindan to'lov so'rashyapti, keyin Koreyaga viza berishar ekan",
    "They require a deposit before the visa is processed",
  ])(
    "keeps natural and reverse-order travel/work-abroad wording on travel guidance: %s",
    (text) => {
      expect(classifyVictimIntent(text)?.kind).toBe("travel_migration_prepayment");
    },
  );

  it.each([
    "Chet elga ishga kirish uchun o'qish pulini oldindan to'lashim kerak",
    "They ask me to pay a training fee before starting work abroad",
  ])("gives work-abroad prepayment priority over generic job guidance: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("travel_migration_prepayment");
  });

  it("does not infer a job from an ordinary English commission request", () => {
    expect(classifyVictimIntent("They say the commission must be paid now")?.kind).not.toBe(
      "job_offer",
    );
  });

  it.each([
    [
      "ru-forward",
      `Оплату за интернет я внёс вчера.${" x".repeat(60)} Теперь визовое агентство просит внести депозит`,
    ],
    [
      "ru-reverse",
      `Виза для прошлой поездки уже готова.${" x".repeat(60)} Теперь просят предоплату, после этого свяжется визовое агентство`,
    ],
    [
      "uz-forward",
      `Pulim uyda qoldi.${" x".repeat(60)} Chet elga ishga yuborish uchun oldindan to'lov so'rashyapti`,
    ],
    [
      "uz-reverse",
      `Koreya haqida eski xabar bor.${" x".repeat(60)} Oldindan to'lov so'rashyapti, keyin xorijga ishga yuborishadi`,
    ],
    [
      "en-forward",
      `The payment yesterday was normal.${" x".repeat(60)} The travel agency now asks for a deposit`,
    ],
    [
      "en-reverse",
      `My old visa is already closed.${" x".repeat(60)} They now require a deposit before the travel agency will continue`,
    ],
  ] as const)(
    "finds the late close travel/payment pair after an early distant match: %s",
    (_id, text) => {
      expect(classifyVictimIntent(text)?.kind).toBe("travel_migration_prepayment");
    },
  );

  it.each([
    "Мне предлагают работу без взноса, обучение бесплатное",
    "За вакансию ничего платить не нужно",
    "Menga pulsiz ishga kirish kursini taklif qilishdi",
    "Ishga kirish uchun pul kerak emas",
    "Ishga kirish uchun to'lov kerak emas",
    "They offered me a job with no training fee",
    "The job has free training and no deposit",
    "No payment is required to start the job",
  ])("does not turn explicitly free or waived job terms into job risk: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).not.toBe("job_offer");
  });

  it.each([
    "Работа за границей без взноса, обучение бесплатное",
    "Xorijga ishga kirish kursi pulsiz va to'lov kerak emas",
    "They offered free training for a job overseas with no deposit",
  ])("does not turn waived work-abroad terms into a travel prepayment risk: %s", (text) => {
    const kind = classifyVictimIntent(text)?.kind;
    expect(kind).not.toBe("job_offer");
    expect(kind).not.toBe("travel_migration_prepayment");
  });

  it.each([
    "Говорили, что работа без взноса, но теперь просят оплатить обучение перед работой",
    "Просят внести депозит перед работой, хотя обучение бесплатное",
    "Ishga kirish bepul deyishdi, lekin endi o'qish pulini to'lashni so'rashyapti",
    "Ish uchun depozit to'lashni so'rashyapti, lekin o'qish bepul ekan",
    "They said there is no training fee, but now they ask me to pay a deposit before starting the job",
    "They ask me to pay a deposit before the job, although the training is free",
  ])("does not let a waived clause hide a separate real job payment: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("job_offer");
  });

  it.each([
    ["ru", "Не платите заранее", "сильный признак риска", "Срочный перевод"],
    ["uz", "Oldindan", "kuchli xavf belgisi", "xavfsiz hisob"],
    ["en", "Do not pay upfront", "strong risk signal", "safe accounts"],
  ] as const)(
    "uses action-first, bounded and job-specific %s copy",
    (lang, actionLead, limitation, genericTransferCopy) => {
      const text = buildVictimIntentText({ kind: "job_offer" }, lang);
      expect(text.startsWith(actionLead)).toBe(true);
      expect(text).toContain(limitation);
      expect(text).not.toContain(genericTransferCopy);
    },
  );
});

describe("classifyVictimIntent — task scams, BNPL identity theft and coercive secrecy", () => {
  it.each([
    "Ставьте лайки, для вывода пополните баланс",
    "Layk bosing, pulni yechish uchun balansni to'ldiring",
    "Like videos and top up your balance to withdraw your earnings",
  ])("routes task-scam payment gates to deterministic earning guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "task_scam",
      askedContext: "transfer",
    });
  });

  it.each([
    "Sizga Uzum Nasiya dan qarz rasmiylashtirildi",
    "На ваше имя оформили рассрочку в Uzum Nasiya",
    "A buy-now-pay-later loan was opened in your name",
  ])("routes unauthorized credit and BNPL notices to identity-loan rescue: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "identity_loan",
      askedContext: "transfer",
    });
  });

  it.each([
    "Никому не говорите, это операция МВД",
    "Hech kimga aytmang, bu IIB maxsus operatsiyasi",
    "Do not tell anyone, this is a police operation",
  ])("routes official-operation secrecy to official impersonation guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "official_impersonation",
      askedContext: "call",
    });
  });

  it.each([
    "Никому не сообщайте OTP-код — это правило безопасности",
    "OTP kodini hech kimga aytmang — bu xavfsizlik qoidasi",
    "Keep your OTP secret and contact the bank through its official number",
    "Uzum Nasiya orqali o'zim telefonni bo'lib to'lashga oldim",
    "Не пополняйте баланс для вывода после заданий — это мошенничество",
    "Police never ask you to keep an operation secret",
  ])("keeps protective or self-authorized wording out of the new routes: %s", (text) => {
    const kind = classifyVictimIntent(text)?.kind;
    expect(kind).not.toBe("official_impersonation");
    expect(kind).not.toBe("identity_loan");
    expect(kind).not.toBe("task_scam");
  });

  it.each([
    ["ru", "Заработок за лайки", "Не пополняйте баланс"],
    ["uz", "Layk", "Balansni to'ldirmang"],
    ["en", "Earnings for likes", "Do not top up"],
  ] as const)("uses concrete task-scam rescue copy in %s", (lang, topic, action) => {
    const text = buildVictimIntentText({ kind: "task_scam", askedContext: "transfer" }, lang);
    expect(text).toContain(topic);
    expect(text).toContain(action);
  });
});

describe("classifyVictimIntent — concrete schemes survive conversational wrappers", () => {
  it.each([
    "Это безопасно или меня обманывают?\nЧеловек из РУВД пишет, что я подозреваемый по уголовному делу, и требует документы",
    "Men hozir uydaman. IIB xodimi meni jinoyat ishida gumon qilib, hujjatlarni talab qilyapti",
    "Please help me: a police investigator says I am a suspect in a criminal case and demands documents",
  ])("keeps a reported authority accusation on legal-impersonation guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toMatchObject({ kind: "legal_impersonation" });
  });

  it.each([
    "Это безопасно? Оператор просит код для замены SIM-карты",
    "Bu xavfsizmi? Operator SIM kartani almashtirish uchun kod so'rayapti",
    "Please help me: the mobile operator asks for a code to replace my SIM card",
  ])("keeps a SIM replacement secret request on operator guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "operator_call",
      askedContext: "call",
      scenario: "sim_swap",
    });
  });

  it.each([
    "Я сейчас дома. Предлагают вложить деньги в TON wallet с гарантированным доходом. Что делать?",
    "Bu xavfsizmi? TON walletga pul qo'yib, kafolatlangan daromad olishni taklif qilishyapti",
    "I am not in a hurry. They offer a TON wallet investment with guaranteed income",
    "проверь t.me/invest_daromad_bot обещают 20 процентов в день гарантированно",
  ])("keeps a guaranteed-return wallet offer on investment guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "investment_offer",
      askedContext: "transfer",
      scenario: "investment_offer",
    });
  });

  it.each([
    "Это безопасно или меня обманывают? Предлагают работу, но просят оплатить обязательное обучение",
    "Hozir nima qilishim kerak? Ish taklif qilishdi, lekin majburiy o'qish uchun pul so'rashyapti",
    "Please help me: they offer me a job but ask me to pay for mandatory training",
  ])("keeps a job-entry fee on job guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({ kind: "job_offer" });
  });

  it.each([
    "Это безопасно? Сын попал в аварию и просит срочно перевести деньги",
    "Bu xavfsizmi? O'g'lim avariyaga tushdi deb, zudlik bilan pul o'tkazishni so'rashyapti",
    "Please help me: they say my son had an accident and ask me to send money urgently",
  ])("keeps family distress on identity-verification guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "friend_money",
      askedContext: "transfer",
    });
  });

  it.each([
    "Я передал паспорт через официальный визовый центр по своей заявке",
    "Я загрузил паспорт через официальный государственный портал по своей заявке",
    "Men pasportimni rasmiy bank ilovasi orqali yukladim",
    "I submitted my passport through the official visa application center",
  ])("keeps an explicit official document handoff neutral: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "Где находится РУВД и как до него доехать?",
    "Men IIB manzilini qidiryapman",
    "Where is the police department?",
    "The mobile operator replaced my SIM at its official office",
    "I track my own TON wallet investment income",
  ])("does not infer a scheme from a neutral authority, SIM, or wallet reference: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });
});

describe("classifyVictimIntent — bounded everyday incident wording", () => {
  it.each([
    ["I have a suspicious conversation going on.", "general_scam_concern"],
    ["Ular xabardagi olti raqamni aytishimni talab qilyapti.", "code_request"],
    ["Они торопят меня с переводом на другую карту.", "transfer_request"],
    ["Suhbatdosh o'rniga hisobni men to'lashimni so'rayapti.", "transfer_request"],
    ["A Telegram login link appeared in my chat.", "link_received"],
    ["Menga noma'lum kontaktdan arxiv keldi.", "file_received"],
    ["When I answer, nobody says anything.", "silent_call"],
    ["Бабушке звонят и говорят, что внук попал в беду.", "friend_money"],
    ["Money was just taken from my card without permission.", "unauthorized_charge"],
    ["Они получили доступ к моему аккаунту.", "account_hacked_other"],
    ["Men notanish odamga pasport rasmini yubordim.", "personal_data_already_shared"],
    ["Как мне сейчас поступить?", "advice_question"],
  ] as const)("routes %s to protective %s guidance", (text, kind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(kind);
  });

  it.each([
    ["Your order is ready, now tell me the six digits.", "code_request"],
    ["This is an information notice, install the APK for protection.", "file_received"],
  ] as const)("keeps direct danger on protective guidance for %s", (text, kind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(kind);
  });

  it("does not treat a direct passport command as a victim self-report", () => {
    expect(classifyVictimIntent("Send the passport scan to this chat.")).toBeNull();
  });

  it("uses post-incident document aftercare instead of prevention copy", () => {
    const match = classifyVictimIntent("Men notanish odamga pasport rasmini yubordim.");
    expect(match).toEqual({
      kind: "personal_data_already_shared",
      scenario: "passport_already_shared",
    });
    const text = buildVictimIntentText(match!, "uz");
    expect(text).toContain("Hujjatlar allaqachon yuborilgan");
    expect(text).toContain("Bank va hujjatni bergan idoraga");
    expect(text).toContain("102");
    expect(text).not.toContain("yubormang");
  });

  it.each([
    "Я отправил фото своего паспорта.",
    "Я уже загрузила скан удостоверения.",
    "Men pasport rasmini yubordim.",
    "Men shaxsiy hujjatni yukladim.",
    "I sent a photo of my passport.",
    "I already uploaded my identity document.",
  ])("recognizes first-person document sharing without an explicit stranger: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({ kind: "personal_data_already_shared" });
  });

  it.each([
    "Я загрузила паспорт через официальное приложение банка.",
    "Men pasportimni rasmiy bank ilovasi orqali yukladim.",
    "I uploaded my passport through the official government portal.",
  ])("keeps an explicit official document-upload channel neutral: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "Мне звонят из РУВД.",
    "Сотрудник ОВД написал мне.",
    "Мне позвонили из МВД.",
    "Menga IIBdan qo'ng'iroq qilishdi.",
    "The police contacted me.",
  ])("recognizes a named authority contacting the user: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "authority_impersonation",
      askedContext: "call",
    });
  });

  it.each([
    "Я из РУВД, вас подозревают в мошенничестве.",
    "Я из полиции/вас подозревают в мошенничестве.",
    "Я сотрудник полиции, вы проходите по уголовному делу.",
    "Men IIBdanman, siz firibgarlikda gumon qilinyapsiz.",
    "I am from the police; you are suspected of fraud.",
  ])("recognizes a quoted authority accusation as legal impersonation: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({ kind: "legal_impersonation" });
  });

  it.each([
    "Где находится РУВД?",
    "Как позвонить в ОВД?",
    "Что означает МВД?",
    "Men IIB manzilini qidiryapman.",
    "Where is the police department?",
    "I work at the police department.",
    "В новостях сказали, что МВД расследует мошенничество.",
  ])("keeps benign authority location/reference wording neutral: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it("uses natural Uzbek unknown-call wording", () => {
    expect(buildVictimIntentText({ kind: "unknown_call", askedContext: "call" }, "uz")).toContain(
      "suhbatni davom ettirmaslik xavfsizroq",
    );
  });

  it.each([
    ["Я отправил фото паспорта незнакомцу.", "personal_data_already_shared"],
    ["Men notanish odamga pasport rasmini yubordim.", "personal_data_already_shared"],
    ["I sent a passport photo to a stranger.", "personal_data_already_shared"],
    ["Мама успела назвать код из SMS.", "relative_already_paid"],
    ["Дедушка уже снял деньги и отдал их незнакомому курьеру.", "relative_already_paid"],
    ["Onam SMS kodni aytib ulgurdi.", "relative_already_paid"],
    ["Singlim tasdiqlash kodini ularga aytib bo'ldi.", "relative_already_paid"],
    ["My grandmother already sent money to scammers.", "relative_already_paid"],
    [
      "My grandfather already withdrew the money and handed it to a stranger.",
      "relative_already_paid",
    ],
    ["Men begona saytga parolimni kiritib bo'ldim.", "account_hacked_other"],
    ["У меня только что списали деньги без разрешения.", "unauthorized_charge"],
    ["Kartamdan ruxsatsiz pul yechildi.", "unauthorized_charge"],
    ["Qarindoshimizga o'g'lining ovozida yordam so'rab qo'ng'iroq qilishdi.", "friend_money"],
    ["Ularning oilaviy chatida shoshilinch pul yig'ish boshlandi.", "friend_money"],
    ["Qizimga dugonasining ovozida pul so'rab xabar kelibdi.", "friend_money"],
    ["Do'stimga tanish akkauntdan pul o'tkazish iltimosi keldi.", "friend_money"],
  ] as const)("keeps completed and family incidents on their precise route: %s", (text, kind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(kind);
  });

  it.each([
    "My mother already paid the electricity bill.",
    "Мама уже оплатила коммунальные услуги.",
    "Onam elektr to'lovini to'ladi.",
    "I sent my passport scan through the official government portal.",
    "Я отправил скан паспорта через официальный государственный портал.",
    "Men pasport skanini rasmiy davlat portali orqali yubordim.",
    "I already sent money back to my friend.",
    "Я уже вернул деньги другу.",
    "Сестра отправила мне деньги на продукты.",
    "Otam ijara pulini to'ladi.",
    "Opam menga oziq-ovqat uchun pul yubordi.",
    "Друг вернул мне деньги.",
    "Do'stim qarzini qaytardi.",
    "My mother told me the door code.",
    "Мама назвала мне код от подъезда.",
    "Onam menga eshik kodini aytdi.",
    "I sent my passport through my bank official app.",
    "I sent my ID through the official visa application center.",
    "Я отправил паспорт через официальное приложение банка.",
  ])("does not invent scam aftercare for an explicitly benign completed action: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });
});

describe("classifyVictimIntent — elderly QA handoff regressions", () => {
  it.each([
    "просят номер карты и срок действия и три цифры сзади чтобы вернуть ошибочный перевод",
    "Карта рақамини ва орқасидаги уч рақамни сўрашяпти пул қайтарамиз дейишяпти",
  ])("keeps requested card credentials above an incidental transfer story: %s", (text) => {
    const match = classifyVictimIntent(text);

    expect(match).toEqual({ kind: "card_request", askedContext: "card" });
    expect(buildVictimIntentText(match!, "ru")).toMatch(/(?:данные карты|cvv|pin)/iu);
  });

  it("keeps explicit photo blackmail above an unrelated family-contact detail", () => {
    expect(
      classifyVictimIntent(
        "Шантажируют моими фото и требуют заплатить\nМожно ли этому доверять?\nОни торопят меня прямо сейчас и запрещают звонить близким",
      ),
    ).toEqual({
      kind: "blackmail_threat",
      askedContext: "transfer",
      scenario: "photo_extortion",
    });
  });

  it("treats a cash courier demand about a detained relative as an active family scam", () => {
    const match = classifyVictimIntent(
      "мне сказали что мой сын попал в полицию и нужно заплатить штраф пятьсот долларов наличными курьеру который сейчас приедет",
    );

    expect(match).toEqual({ kind: "friend_money", askedContext: "transfer" });
    expect(buildVictimIntentText(match!, "ru")).toMatch(
      /(?:перезвон|сохран[её]нн|кодовое слово)/iu,
    );
    expect(buildVictimIntentText(match!, "ru")).toMatch(/(?:наличн|курьер)/iu);
  });

  it("introduces Ishonch Guard without affirming a scam accusation", () => {
    const match = classifyVictimIntent("а вы не мошенники сами? откуда мне знать");

    expect(match).toEqual({ kind: "trust_or_greeting" });
    expect(buildVictimIntentText(match!, "ru")).toContain("Я — Ishonch Guard");
    expect(buildVictimIntentText(match!, "ru")).not.toMatch(/^Да,/u);
  });

  it("keeps a plain English bank SMS-code request above a generic scam question", () => {
    expect(
      classifyVictimIntent(
        "someone called saying they are from my bank and asked for the sms code is it a scam",
      ),
    ).toEqual({ kind: "code_request", askedContext: "code" });
  });

  it.each([
    "пришло смс что пенсию пересчитают и надо подтвердить карту по ссылке",
    "менга телеграмдан ёзишяпти сиз субсидия ютиб олдингиз картангизни рақамини юборинг дейишяпти",
    "Пенсия учун карта рақамини сўрашяпти ижтимоий ҳимояданмиз дейишяпти",
  ])("preserves the pension/subsidy topic above generic card guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "pension_benefit",
      askedContext: "call",
    });
  });

  it("does not read Uzbek turib as a travel/tour signal in a local job offer", () => {
    expect(
      classifyVictimIntent(
        "ishga taklif qilishyapti kuniga 500 ming so'm uydan turib deyishyapti faqat avval komissiya 200 ming to'lash kerak ekan",
      ),
    ).toEqual({ kind: "job_offer" });
  });

  it("keeps a domain embedded in natural text on the real risk pipeline", () => {
    expect(
      classifyVictimIntent("внук прислал ссылку youtube.com/watch?v=abc123 это безопасно открыть"),
    ).toBeNull();
  });

  it("keeps an SMS-code request above a surrounding card-block story", () => {
    expect(
      classifyVictimIntent(
        "здраствуйте мне пазванили из банка сказали что карта заблакирована и нужно прадиктовать код из смс скажите это правда",
      ),
    ).toEqual({ kind: "code_request", askedContext: "code" });
  });

  it("routes an advance-fee lottery to prize guidance, not completed-payment SOS", () => {
    const match = classifyVictimIntent(
      "мне сказали я выиграла 2 миллиона сум надо оплатить камисию 50 тысяч и пришлют деньги",
    );
    expect(match).toEqual({
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "prize_fee",
    });
    expect(buildVictimIntentText(match!, "ru")).toContain("сначала требуют комиссию");
  });

  it("recognizes a standalone bank-verification question", () => {
    expect(classifyVictimIntent("а если это правда банк как проверить")).toEqual({
      kind: "bank_contact_question",
      askedContext: "call",
    });
  });

  it.each([
    [
      "перевела деньги вчера на этот счет а теперь трубку не берут",
      {
        kind: "transfer_request",
        askedContext: "transfer",
        scenario: "money_already_sent",
      },
    ],
    [
      "муж перевел 5 миллионов сум мошенникам вчера вечером что делать куда звонить",
      {
        kind: "relative_already_paid",
        askedContext: "transfer",
      },
    ],
    [
      "установила приложение которое прислали теперь смс приходят странные",
      {
        kind: "apk_request",
        askedContext: "apk",
        scenario: "apk_already_installed",
      },
    ],
  ] as const)("routes a completed elderly incident to aftercare: %s", (text, expected) => {
    const match = classifyVictimIntent(text);
    expect(match).toEqual(expected);
    expect(buildVictimIntentText(match!, "ru")).toMatch(/(?:заморозить перевод|авиарежим)/iu);
  });

  it.each([
    "Я перевела деньги вчера своему сыну за продукты, всё в порядке",
    "Муж перевёл деньги за коммунальные услуги",
    "Установила приложение банка из официального магазина",
  ])("does not invent aftercare for a benign completed action: %s", (text) => {
    const match = classifyVictimIntent(text);
    expect(match?.scenario).not.toBe("money_already_sent");
    expect(match?.scenario).not.toBe("apk_already_installed");
  });

  it("reuses the gated Uzbek Cyrillic matching variant for a relative emergency", () => {
    expect(
      classifyVictimIntent(
        "Набирам авариага тушди деб пул сўрашяпти телефонда йиғлаяпти овози ўхшайди",
      ),
    ).toEqual({ kind: "friend_money", askedContext: "transfer" });
  });

  it("routes an already-compromised Uzbek Cyrillic Telegram account to recovery copy", () => {
    const match = classifyVictimIntent(
      "Телеграмимга кириб олишди аккаунтим ўғирланди ҳамма контактларимга ёзишяпти",
    );
    expect(match).toEqual({
      kind: "telegram_takeover",
      askedContext: "link_qr",
      scenario: "telegram_account_taken_over",
    });
    const text = buildVictimIntentText(match!, "uz");
    expect(text).toContain("Sozlamalar → Qurilmalar");
    expect(text).toContain("notanish seanslarni tugating");
    expect(text).not.toContain("urinishiga o'xshaydi");
  });

  it("keeps pure Russian text out of the Uzbek transliteration fallback", () => {
    expect(classifyVictimIntent("Я набираю номер из своей телефонной книги")).toBeNull();
  });

  it("turns a short transfer admission into bank-first aftercare only with recent context", () => {
    const at = new Date("2026-07-16T12:00:00.000Z");
    const context = buildVictimFollowUpContext(
      { kind: "investment_offer", askedContext: "transfer", scenario: "investment_offer" },
      at,
    );
    const now = new Date(at.getTime() + 60_000);

    expect(classifyVictimContextualFollowUp("я им уже 500000 отправил", context, now)).toEqual({
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "money_already_sent",
    });
    expect(classifyVictimContextualFollowUp("я ещё не переводила деньги", context, now)).toBeNull();
    expect(
      classifyVictimContextualFollowUp("They already transferred a million", context, now),
    ).toBeNull();
    expect(
      classifyVictimContextualFollowUp(
        "я им уже 500000 отправил, номер +998 90 123 45 67",
        context,
        now,
      ),
    ).toBeNull();
    expect(
      classifyVictimContextualFollowUp(
        "я им уже 500000 отправил",
        context,
        new Date(at.getTime() + 21 * 60_000),
      ),
    ).toBeNull();
  });

  it("keeps confirmation and uninstall replies attached to recent victim guidance", () => {
    const now = new Date("2026-07-16T12:01:00.000Z");
    const investment = buildVictimFollowUpContext(
      { kind: "investment_offer", askedContext: "transfer", scenario: "investment_offer" },
      new Date("2026-07-16T12:00:00.000Z"),
    );
    const code = buildVictimFollowUpContext(
      { kind: "code_request", askedContext: "code" },
      new Date("2026-07-16T12:00:00.000Z"),
    );
    const apk = buildVictimFollowUpContext(
      { kind: "apk_request", askedContext: "apk" },
      new Date("2026-07-16T12:00:00.000Z"),
    );

    expect(classifyVictimContextualFollowUp("точно?", investment, now)).toEqual({
      kind: "investment_offer",
      askedContext: "transfer",
      scenario: "investment_offer",
    });
    expect(classifyVictimContextualFollowUp("rostdan firibgarlarmi", code, now)).toEqual({
      kind: "code_request",
      askedContext: "code",
    });
    expect(classifyVictimContextualFollowUp("я уже установила", apk, now)).toEqual({
      kind: "apk_request",
      askedContext: "apk",
      scenario: "apk_already_installed",
    });
    expect(classifyVictimContextualFollowUp("как удалить", apk, now)).toEqual({
      kind: "apk_request",
      askedContext: "apk",
      scenario: "apk_already_installed",
    });
    expect(classifyVictimContextualFollowUp("They already installed it", apk, now)).toBeNull();
  });
});

describe("classifyVictimIntent — physical access context stays clause-local", () => {
  it.each([
    "Код домофона 1234, но они просят отправить код",
    "Код от двери 1234 — незнакомец просит назвать код входа в банк",
    "Eshik kodi 1234, lekin ular kodni yuborishni so'rashyapti",
    "The door code is 1234, but they asked me to send the bank login code",
  ])("keeps the dangerous follow-up on code protection: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "code_request",
      askedContext: "code",
    });
  });

  it.each([
    "Код домофона 1234",
    "Мама назвала мне код от подъезда",
    "My mother told me the door code",
    "Onam menga eshik kodini aytdi",
  ])("keeps a genuine physical-code message on the neutral path: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });
});

describe("classifyVictimContextualPanicIntent", () => {
  const at = new Date("2026-08-08T08:00:00.000Z");
  const now = new Date(at.getTime() + 60_000);
  const codeContext = buildVictimFollowUpContext(
    { kind: "code_request", askedContext: "code" },
    at,
  );
  const transferContext = buildVictimFollowUpContext(
    { kind: "transfer_request", askedContext: "transfer" },
    at,
  );

  it.each([
    "ну я им всё сказала и что теперь",
    "ularga hammasini aytvordim endi nima qilay",
    "I told them everything, what now?",
  ])("uses recent code context for an otherwise ambiguous admission: %s", (text) => {
    expect(classifyVictimContextualPanicIntent(text, codeContext, now)).toBe(1);
  });

  it("does not invent a code emergency without the matching recent context", () => {
    const text = "ну я им всё сказала и что теперь";

    expect(classifyVictimContextualPanicIntent(text, undefined, now)).toBeNull();
    expect(classifyVictimContextualPanicIntent(text, transferContext, now)).toBeNull();
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it.each(["я им ничего не сказала", "ularga hech narsa aytmadim", "I told them nothing"])(
    "keeps a negated contextual reply outside aftercare: %s",
    (text) => {
      expect(classifyVictimContextualPanicIntent(text, codeContext, now)).toBeNull();
    },
  );
});
