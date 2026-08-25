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
    expect(buildVictimGuidanceFollowUpText(reply!, "ru")).toContain(
      "Я ничего не сообщаю и сам перезвоню",
    );
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

describe("classifyVictimIntent — utility word boundaries", () => {
  it.each([
    "Купил хлеб в магазине и получил обычный бумажный чек",
    "Я выбрал телефон в магазине электроники",
    "Нам прислали электронный чек за покупку",
  ])("does not find a utility inside an ordinary word: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).not.toBe("utility_impersonation");
  });

  it.each([
    "Газ отключат, если не оплатить долг по ссылке",
    "За электричество просят оплатить по ссылке из SMS",
    "Водоканал просит паспорт для проверки счётчика",
  ])("keeps an explicit utility request: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("utility_impersonation");
  });
});

describe("classifyVictimIntent — ordinary family help", () => {
  it.each([
    "Мама попросила помочь приготовить ужин",
    "Onam uyda choy damlashga yordam berishimni so'radi",
    "My mother asked me to help make dinner",
  ])("does not turn ordinary help into a family emergency: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "Мама попала в больницу и срочно просит перевести деньги",
    "Onam kasalxonada, zudlik bilan pul o'tkazishni so'rayapti",
    "My mother is in hospital and urgently asks me to transfer money",
  ])("keeps explicit family distress on the emergency route: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("friend_money");
  });
});

describe("classifyVictimIntent — bounded advance-payment and identity anomalies", () => {
  it.each([
    [
      "На OLX просят внести депозит на карту, чтобы забронировать просмотр квартиры",
      "rental_deposit",
    ],
    [
      "O'yindagi akkauntimni sotib olmoqchi, vositachiga oldindan komissiya yuboring deyapti",
      "game_escrow_fee",
    ],
    [
      "My boss looked strange on a video call and ordered an urgent transfer to a partner account",
      "fake_boss_request",
    ],
    [
      "Я уже потерял деньги у мошенников. Теперь юрист обещает вернуть их и просит комиссию заранее",
      "recovery_fee",
    ],
    [
      "Oldin firibgarga pul yo'qotdim, endi yurist pulni qaytarish uchun oldindan haq so'rayapti",
      "recovery_fee",
    ],
    [
      "I already lost money to a scam. A recovery agent promises to get it back but asks for an upfront fee",
      "recovery_fee",
    ],
    ["Donations for flood victims must be sent urgently to a personal card", "charity_pressure"],
  ] as const)("keeps the concrete scenario for: %s", (text, scenario) => {
    expect(classifyVictimIntent(text)).toMatchObject({ scenario });
  });

  it.each([
    "В договоре банка указан обычный депозит",
    "На OLX указано: залог только после просмотра и подписания договора",
    "O'yin platformasi komissiyani savdo tugagandan keyin o'zi ushlab qoladi",
    "O'yin akkaunti uchun vositachiga komissiya yubormang",
    "My boss joined the scheduled video call to discuss an already approved invoice",
    "A security trainer said never transfer money after a suspicious deepfake call",
    "Я уже потерял деньги, как мне попытаться вернуть их через банк?",
    "Юрист поможет подготовить заявление, условия оплаты указаны в письменном договоре",
    "A lawyer explained the official complaint process and did not ask for an upfront fee",
    "I already lost money to a scam. My lawyer warned me never to pay an upfront fee to anyone promising recovery",
    "Я уже потерял деньги, а юрист предупредил никогда не платить комиссию заранее за возврат",
    "Oldin pul yo'qotdim, yurist qaytarishni va'da qilganlarga oldindan haq to'lamang dedi",
  ])("does not create a scam scenario from a safe neighbour: %s", (text) => {
    expect(classifyVictimIntent(text)?.scenario).toBeUndefined();
  });

  it("keeps an actual mistaken incoming transfer on the money-mule route", () => {
    expect(
      classifyVictimIntent(
        "Мне по ошибке пришёл перевод, и отправитель просит вернуть деньги на другой счёт",
      ),
    ).toEqual({ kind: "money_mule", askedContext: "transfer" });
  });

  it.each([
    ["ru", "Предложение вернуть", /по\s+ошибке|другой\s+сч[её]т|штраф|текст\s+угрозы/iu],
    ["uz", "takroriy firibgarlik", /pul\s+[«"]?xato|boshqa\s+hisob|jarima|tahdid\s+matni/iu],
    [
      "en",
      "second scam attempt",
      /arrived\s+[“"]?by\s+mistake|another\s+account|fine|threat\s+text/iu,
    ],
  ] as const)("uses evidence-faithful recovery-fee copy in %s", (lang, required, forbidden) => {
    const text = buildVictimIntentText(
      { kind: "transfer_request", askedContext: "transfer", scenario: "recovery_fee" },
      lang,
    );
    expect(text).toContain(required);
    expect(text).not.toMatch(forbidden);
  });

  it("does not invent a registered charity for a generic donation organizer", () => {
    const match = classifyVictimIntent(
      "Donations for flood victims must be sent urgently to a personal card",
    );
    expect(match).toEqual({
      kind: "transfer_request",
      askedContext: "transfer",
      scenario: "charity_pressure",
    });
    const text = buildVictimIntentText(match!, "en");
    expect(text).toMatch(/donation|organizer|fundraiser/iu);
    expect(text).not.toMatch(/unknown\s+charity|legitimate\s+charity|safe\s+account/iu);
  });
});

describe("classifyVictimIntent — task scams, BNPL identity theft and coercive secrecy", () => {
  it.each([
    "Ставьте лайки, для вывода пополните баланс",
    "За лайки начислили зарплату, но для получения требуют оплатить налог",
    "За лайки обещают зарплату, но просят сначала внести налог",
    "Layk bosing, pulni yechish uchun balansni to'ldiring",
    "Vazifalarni bajardim, ish haqini olish uchun komissiya to'lashni so'rashyapti",
    "Like videos and top up your balance to withdraw your earnings",
    "I posted reviews, but they demand a verification fee before cashing out",
  ])("routes task-scam payment gates to deterministic earning guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "task_scam",
      askedContext: "transfer",
    });
  });

  it.each([
    "Sizga Uzum Nasiya dan qarz rasmiylashtirildi",
    "Mening nomimga muddatli to'lov ochilibdi, men uni ochmaganman",
    "На ваше имя оформили рассрочку в Uzum Nasiya",
    "Пришёл кредит, которого я не брал",
    "A buy-now-pay-later loan was opened in your name",
    "An installment appeared that I did not open",
    "Klarna says an account was opened using my identity",
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
    "Мне сказали скрыть этот перевод от банка и ничего не говорить семье",
    "Не говорите банку об этом переводе, держите его в тайне",
    "O'tkazmani bankdan va oiladan yashirishni aytishdi",
    "В банке скажите, что перевод семье, правду не говорите",
    "В банке скажите, что перевод родственнику",
    "Bank so'rasa, to'lov oila uchun deb ayting, rostini aytmang",
    "Bankka to'lov oila uchun deb ayting",
    "They told me not to tell the bank about this transfer and to keep it secret",
    "They told me to hide this transfer from the bank",
    "Tell the bank the payment is for family and don't tell them the truth",
    "Tell the bank the payment is for family",
  ])("routes transaction secrecy to coercion-specific guidance: %s", (text) => {
    expect(classifyVictimIntent(text)).toEqual({
      kind: "coercive_secrecy",
      askedContext: "transfer",
    });
  });

  it.each([
    "Никому не сообщайте OTP-код — это правило безопасности",
    "OTP kodini hech kimga aytmang — bu xavfsizlik qoidasi",
    "Keep your OTP secret and contact the bank through its official number",
    "Uzum Nasiya orqali o'zim telefonni bo'lib to'lashga oldim",
    "Не пополняйте баланс для вывода после заданий — это мошенничество",
    "Police never ask you to keep an operation secret",
    "Не скрывайте перевод от банка — это важное правило безопасности",
    "O'tkazmani bankdan yashirmang, rasmiy raqamga qo'ng'iroq qiling",
    "Never hide a transfer from the bank; call its official number",
    "Лайки в нашей команде добровольные, зарплату и налог считает бухгалтерия",
    "За лайки обещают зарплату, налог рассчитывает бухгалтерия",
    "Vazifa ishning bir qismi, ish haqi va soliqni buxgalteriya hisoblaydi",
    "Reviews are part of my salaried job; no verification fee is required",
    "Я сам взял этот кредит и плачу его по графику",
    "Muddatli to'lovni o'zim ochdim va jadval bo'yicha to'layapman",
    "I opened this Klarna installment myself",
    "Скажите банку правду: перевод не семье",
    "Bankka rostini ayting: bu to'lov oila uchun emas",
    "Tell the bank the truth: this payment is not for family",
  ])("keeps protective or self-authorized wording out of the new routes: %s", (text) => {
    const kind = classifyVictimIntent(text)?.kind;
    expect(kind).not.toBe("official_impersonation");
    expect(kind).not.toBe("coercive_secrecy");
    expect(kind).not.toBe("identity_loan");
    expect(kind).not.toBe("task_scam");
  });

  it.each([
    "I opened this Klarna installment myself, but this loan I did not open",
    "Я сам открыл эту рассрочку, но этот кредит я не брал",
    "Muddatli to'lovni o'zim ochdim, lekin bu kreditni men olmaganman",
  ])(
    "keeps an explicit unauthorized-credit clause above an earlier self-authorized clause: %s",
    (text) => {
      expect(classifyVictimIntent(text)?.kind).toBe("identity_loan");
    },
  );

  it.each([
    "I opened this Klarna installment myself, and this second loan I did not open.",
    "Я сам открыл эту рассрочку, а этот второй кредит я не брал.",
    "Bu muddatli to'lovni o'zim ochdim, va bu ikkinchi kreditni men olmaganman.",
  ])("keeps a coordinated unauthorized-credit clause risky: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("identity_loan");
  });

  it.each([
    "Tell the bank the truth, but the caller told me to say the payment is for family",
    "Скажите банку правду, но звонивший велел сказать, что перевод родственнику",
  ])("keeps a caller's cover story above an earlier honest-bank clause: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("coercive_secrecy");
  });

  it.each([
    "Never hide a transfer from the bank, and now the caller told me to hide this transfer from the bank.",
    "Никогда не скрывайте перевод от банка, а теперь звонивший велел скрыть этот перевод от банка.",
    "Bu o'tkazmani bankdan yashirmang, va endi firibgar o'tkazmani bankdan yashirishni aytdi.",
  ])("keeps a coordinated caller secrecy instruction risky: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("coercive_secrecy");
  });

  it.each([
    "I opened a Klarna installment using my identity",
    "Klarna verifies customers using my identity document",
    "I personally opened a Klarna installment. It appeared in my name as expected.",
    "I opened a loan using my identity. It is in my name.",
    "Я сама оформила рассрочку. Она появилась на мое имя как и ожидалось.",
    "Muddatli to'lovni o'zim ochdim. U mening nomimga kutilganidek ochildi.",
  ])("does not infer identity theft from ordinary first-party identity wording: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).not.toBe("identity_loan");
  });

  it.each([
    "An installment appeared on my credit report. I did not open it.",
    "Klarna says a loan was opened. I did not apply for it.",
    "Пришёл кредит. Я его не брал.",
    "Mening kredit hisobotimda muddatli to'lov paydo bo'ldi. Men uni ochmaganman.",
  ])("carries the credit product into an adjacent first-person denial: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("identity_loan");
  });

  it.each([
    "The bank called about a transfer. They told me to say it was for family.",
    "Банк спросит о переводе. Скажите, что это помощь семье.",
    "Bank to'lov haqida so'raydi. Oila uchun deb ayting.",
  ])("carries bank/transfer context into an adjacent cover story: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("coercive_secrecy");
  });

  it.each([
    "The article says: I did not open this Klarna loan.",
    "The article says that I did not open this Klarna loan.",
    "The guide explains, “I did not open this Klarna loan.”",
    "Support documentation gives this example: Tell the bank the payment is for family.",
    "Example: a Klarna installment appeared. I did not open it.",
    "Hypothetical example: Tell the bank the payment is for family.",
    "The guide says: this is only an example. Tell the bank the payment is for family.",
    'The guide says: "Here is an example. A caller may claim it is a bank transfer. Tell the bank the payment is for family."',
    'The guide warns: "I did not open this Klarna loan."',
    "Руководство предупреждает: «Я не брал этот кредит. Скажите банку, что перевод родственнику.»",
    "Qo'llanma ogohlantiradi: “Men bu kreditni olmaganman. Bankka to'lov oila uchun deb ayting.”",
    "Never tell a customer to tell the bank the payment is for family.",
  ])("does not treat educational examples as the user's incident: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).not.toBe("identity_loan");
    expect(classifyVictimIntent(text)?.kind).not.toBe("coercive_secrecy");
  });

  it.each([
    ["Klarna policy says: a loan was opened in my name without consent.", "identity_loan"],
    [
      "The caller sent a guide saying: tell the bank the payment is for family.",
      "coercive_secrecy",
    ],
    ["Bank policy says: hide this transfer from the bank.", "coercive_secrecy"],
    [
      "The scammer wrote documentation: tell the bank the payment is for family.",
      "coercive_secrecy",
    ],
    ["Звонивший прислал инструкцию: скажите банку, что перевод родственнику.", "coercive_secrecy"],
    ["Firibgar qo'llanma yubordi: bankka to'lov oila uchun deb ayting.", "coercive_secrecy"],
    [
      "The guide says: never hide a transfer from the bank. The caller told me to hide this transfer from the bank.",
      "coercive_secrecy",
    ],
    ["The guide says: this is only an example. I did not open this Klarna loan.", "identity_loan"],
    [
      "The caller told me not to tell anyone because this is a police operation.",
      "official_impersonation",
    ],
    ["The caller said: don't tell anyone. This is a police operation.", "official_impersonation"],
    [
      "Never hide a transfer from the bank, then the caller told me to hide this transfer from the bank.",
      "coercive_secrecy",
    ],
    [
      'The guide says: "Never hide a transfer from the bank." The caller sent a guide saying: tell the bank the payment is for family.',
      "coercive_secrecy",
    ],
    ['The guide warns: "I did not open this Klarna loan.', "identity_loan"],
  ] as const)("does not let a document keyword hide an attributed incident: %s", (text, kind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(kind);
  });

  it("does not let an earlier safety sentence hide a later coercive instruction", () => {
    expect(
      classifyVictimIntent(
        "Never hide a transfer from the bank. The caller now told me to hide this transfer from the bank.",
      )?.kind,
    ).toBe("coercive_secrecy");
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

  it.each([
    ["ru", "скрыть перевод", "Не переводите деньги"],
    ["uz", "yashirish talabi", "Pul o'tkazmang"],
    ["en", "hide a transfer", "Do not transfer money"],
  ] as const)("uses coercion-specific transaction copy in %s", (lang, topic, action) => {
    const text = buildVictimIntentText(
      { kind: "coercive_secrecy", askedContext: "transfer" },
      lang,
    );
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

describe("new real-world scam wave routing", () => {
  it.each([
    [
      "налоговая пишет, что заведёт дело, если я не подожгу заправку и никому не скажу",
      "authority_physical_coercion",
    ],
    [
      "soliqdanmiz deyapti, bajarmasang ish ochamiz, uskunani buzib ket deb majburlashyapti",
      "authority_physical_coercion",
    ],
    [
      "Police say I will be arrested unless I secretly leave a package at the building",
      "authority_physical_coercion",
    ],
    [
      "полиция требует отнести пакет к школе, иначе заведут уголовное дело",
      "authority_physical_coercion",
    ],
    [
      "IIB paketni gavjum binoda qoldirishni buyurdi, aks holda jinoiy ish ochamiz dedi",
      "authority_physical_coercion",
    ],
    ["сосед неожиданно прислал «это ты на видео?» и просит открыть файл", "neighbor_video_malware"],
    ["qo'shnim videodagi senmi deb faylni ochishni so'radi", "neighbor_video_malware"],
    [
      "A friend sent 'is this you in the video?' and asks me to install a player",
      "neighbor_video_malware",
    ],
    [
      "Сосед написал «это ты на видео?» и прислал camera_video.zip, просит открыть.",
      "neighbor_video_malware",
    ],
    [
      "Qo'shnim «bu senmi?» deb camera_video.zip yubordi, ochishni so'rayapti.",
      "neighbor_video_malware",
    ],
    ["Қўшним «бу сенми?» деб camera_video.zip юборди, очишни сўраяпти.", "neighbor_video_malware"],
    [
      "A resident asks “is this you?” and sent camera_video.zip for me to open.",
      "neighbor_video_malware",
    ],
    ["Сосед прислал video_from_camera.rar и просит распаковать архив.", "neighbor_video_malware"],
    [
      "Знакомый прислал запись с камеры в footage.7z, просит распакуй её.",
      "neighbor_video_malware",
    ],
    [
      "друг спрашивает «это ты на видео?» и просит открыть отдельный файл",
      "neighbor_video_malware",
    ],
    ["tanishim videodagi senmi deb alohida faylni ochishni so'radi", "neighbor_video_malware"],
    [
      "прислали приложение для оплаты штрафа со 100% кешбэком, сказали установить",
      "fake_fine_cashback_app",
    ],
    ["jarimani keshbek bilan to'lash uchun ilova o'rnat deyapti", "fake_fine_cashback_app"],
    [
      "They sent an app to pay a traffic fine with cashback and told me to install it",
      "fake_fine_cashback_app",
    ],
    ["пришёл ROAD24.apk из сообщения со скидкой на штраф", "fake_fine_cashback_app"],
    ["jarima uchun xabarda ROAD24 APK yuborib, keshbek va'da qilishdi", "fake_fine_cashback_app"],
    [
      "ROAD24 ilovasini chatdan o'rnatsam, jarima pulining hammasini qaytarishar ekan.",
      "fake_fine_cashback_app",
    ],
    [
      "ROAD24 иловасини чатдан ўрнатсам, жарима пулининг ҳаммасини қайтаришар экан.",
      "fake_fine_cashback_app",
    ],
    [
      "В чате прислали ROAD24.apk и обещают вернуть весь штраф, если установлю.",
      "fake_fine_cashback_app",
    ],
    [
      "They sent ROAD24.apk in a chat and promise to refund the full fine if I install it.",
      "fake_fine_cashback_app",
    ],
    [
      "предлагают за деньги обнулить штрафные баллы через знакомого в ГАИ",
      "penalty_points_cancellation",
    ],
    [
      "jarima ballarini pulga o'chirib beraman, YHXBda odamim bor deyapti",
      "penalty_points_cancellation",
    ],
    [
      "Telegramdagi vositachi 800 ming so'mga jarima ballarimni nol qilib, shaxsiy kartasiga pul o'tkazishni so'radi",
      "penalty_points_cancellation",
    ],
    [
      "Tanishim jarima ballarini olib tashlab beradi, buning uchun pul so'radi.",
      "penalty_points_cancellation",
    ],
    [
      "Танишим жарима балларини олиб ташлаб беради, бунинг учун пул сўради.",
      "penalty_points_cancellation",
    ],
    [
      "A fixer says he can wipe my driving penalty points for a cash fee.",
      "penalty_points_cancellation",
    ],
    [
      "A traffic officer contact will take my violation points off for cash.",
      "penalty_points_cancellation",
    ],
    ["Знакомый в ГАИ якобы спишет штрафные баллы за комиссию.", "penalty_points_cancellation"],
    [
      "An insider says they can wipe my traffic penalty points for a fee",
      "penalty_points_cancellation",
    ],
    [
      "знакомый прислал ссылку: я уже получил подарок банка, забирай тоже",
      "known_contact_prize_link",
    ],
    [
      "tanishim men bank sovg'asini oldim, havoladan sen ham ol deb yozdi",
      "known_contact_prize_link",
    ],
    [
      "A friend sent a link saying I got the bank prize, claim yours too",
      "known_contact_prize_link",
    ],
    [
      "Брат прислал ссылку на подарок банка и пишет, что уже получил 70000 сум.",
      "known_contact_prize_link",
    ],
    ["Акам банк совғасига ҳавола юборди ва 70000 сўмни олганини ёзди.", "known_contact_prize_link"],
    [
      "My brother sent a bank gift link and says he already received 70,000 soum.",
      "known_contact_prize_link",
    ],
  ])("preserves the concrete scenario for %s", (text, scenario) => {
    expect(classifyVictimIntent(text)?.scenario).toBe(scenario);
  });

  it.each([
    "налоговая угрожает делом и заставляет поджечь заправку",
    "15-летнему сыну написали от налоговой: если он не подожжет заправку, заведут уголовное дело",
    "полиция заставляет дочь поджечь склад, иначе её арестуют",
    "следователь пишет парню: подожги школу, иначе уголовное дело",
    "15 yoshli o'g'limga soliqdan yozishdi: zapravkani yoqmasa jinoiy ish ochamiz",
    "qizimga politsiyadan yozib, binoni yoqmasa qamash bilan qo'rqitishyapti",
    "Police told my daughter to set fire to a building or they will arrest her",
    "A detective ordered me to set fire to a car or I would be arrested.",
    "Прокурорман деган одам камера симини узишимни талаб қиляпти.",
    "Пишет оперативник: подожги склад, иначе посадим.",
    "Profilaktika inspektoriman, kamerani buzmasang seni qamayman.",
    "Профилактика инспекториман, камерани бузмасанг сени қамайман.",
    "A federal agent told me to leave a backpack at the station or face arrest.",
    "A law-enforcement detective says I must destroy a camera or go to jail.",
    "Prokuraturadanmiz deganlar qutini maktab yoniga qoldirishga majburladi; men hali bormadim.",
    "Прокуратураданмиз деганлар қутини мактаб ёнига қолдиришга мажбурлади; мен ҳали бормадим.",
    "Полиция пишет. Не поджигайте старый склад. Подожгите школу, иначе уголовное дело.",
  ])(
    "routes authority coercion of the user, child, or third person to physical safety: %s",
    (text) => {
      expect(classifyVictimIntent(text)).toMatchObject({
        kind: "authority_physical_coercion",
        scenario: "authority_physical_coercion",
      });
    },
  );

  it.each([
    "тебя убью если не заплатишь",
    "мы приедем к тебе домой и сломаем ноги",
    "seni topamiz va uramiz, pul yubor",
    "uyingga boramiz, manzilingni bilamiz",
    "We will come to your house and beat you if you do not pay",
    "They said they'll kill me and know my address",
    "помогите, они угрожают приехать домой и убить меня",
    "yordam, uyingga boramiz, manzilingni bilamiz",
    "help me, they will come to my house and beat me",
    "Pul bermasang, seni urib tashlaymiz.",
    "Пул бермасанг, сени уриб ташлаймиз.",
    "Я тебя застрелю.",
    "Я сломаю тебе шею.",
    "Мы тебя закопаем.",
    "Seni otib tashlayman.",
    "Seni yo'q qilaman.",
    "Сени отиб ташлайман.",
    "Сени йўқ қиламан.",
    "I'll shoot you.",
    "I'll break your neck.",
    "We will make you disappear.",
  ])("recognizes a direct physical-violence threat in natural RU/UZ/EN: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).toBe("violence_threat");
  });

  it.each([
    "I will come, but I won't hurt or kill you.",
    "Я приеду. Но не убью тебя.",
    "Men seni urmayman va o'ldirmayman.",
    "I won't shoot you.",
    "Я не застрелю тебя.",
    "Seni otib tashlamayman.",
  ])("does not turn an explicitly negated physical threat into violence: %s", (text) => {
    expect(classifyVictimIntent(text)?.kind).not.toBe("violence_threat");
  });

  it.each(["I will hurt you, but I won't kill you.", "Я тебя изобью, но не убью."])(
    "keeps an affirmative threat when only a second action is negated: %s",
    (text) => {
      expect(classifyVictimIntent(text)?.kind).toBe("violence_threat");
    },
  );

  it.each([
    "Jarimani bankning rasmiy ilovasida o'zim to'ladim, chatdan APK kelmagan.",
    "Жаримани банкнинг расмий иловасида ўзим тўладим, чатдан APK келмаган.",
    "Ertaga tasdiqlangan yetkazib beruvchiga bankning rasmiy ilovasida shartnoma bo'yicha to'lov qilaman.",
    "Эртага тасдиқланган етказиб берувчига банкнинг расмий иловасида шартнома бўйича тўлов қиламан.",
    "Yetkazib beruvchiga to'lov rejalashtirilgan edi, oluvchi va summa tasdiqlangan.",
  ])("keeps an ordinary official Uzbek payment out of victim routing: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "Подарок уже получил. Брат лично вручил мне телефон на день рождения, ссылок не было.",
    "Sovg'ani oldim. Akam tug'ilgan kunimga telefonni shaxsan berdi, havola yo'q.",
    "Совғани олдим. Акам туғилган кунимга телефонни шахсан берди, ҳавола йўқ.",
    "I received the gift. My brother handed me a phone for my birthday; there was no link.",
    "Я лично подарила брату новый телефон на день рождения; он уже получил подарок, никаких ссылок или файлов не было.",
    "I personally gave my brother a new phone for his birthday; he already received the gift, and there were no links or files.",
  ])("keeps a completed in-person personal gift out of prize-link routing: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "Я сам нашёл ROAD24 в Google Play и установил официальное приложение, из чата APK не присылали.",
    "ROAD24 ilovasini Google Play'dan o'zim topib o'rnatdim, chatdan APK kelmagan.",
    "ROAD24 иловасини Google Play'дан ўзим топиб ўрнатдим, чатдан APK келмаган.",
    "I found the official ROAD24 app myself in Google Play; no APK came from a chat.",
  ])("keeps a self-found official ROAD24 store app out of APK routing: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "The police emergency number is 102.",
    "Полиция рақами 102.",
    "Police said a suspect set fire to a warehouse and was arrested.",
  ])("keeps neutral police facts and third-person news out of live victim routing: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it.each([
    "Sayohat rasmlarimni oilaviy guruhga tarqatishadi deb aytishdi.",
    "Fotosessiya uchun pul so'rashyapti, rasmlarimni keyin yuborishadi.",
  ])(
    "does not infer photo extortion without a tied publication threat and money demand: %s",
    (text) => {
      expect(classifyVictimIntent(text)?.kind).not.toBe("blackmail_threat");
    },
  );

  it.each([
    "я перевела деньги не тому человеку, можно отменить перевод?",
    "men pulni adashib boshqa odamga yubordim, o'tkazmani bekor qilsa bo'ladimi",
    "I sent money to the wrong recipient by mistake, can I recall the transfer?",
    "I accidentally transferred money to the wrong person. Can my bank recall it?",
    "По ошибке оплатила чужой номер телефона вместо своего. Можно отменить?",
    "Adashib pulni boshqa odamga o'tkazib yubordim. Bank qaytarib bera oladimi?",
    "Адашиб пулни бошқа одамга ўтказиб юбордим. Банк қайтариб бера оладими?",
    "Adashib o'zimnikining o'rniga boshqa odamning telefon raqamiga to'lov qildim. Bekor qilsa bo'ladimi?",
    "Адашиб ўзимникининг ўрнига бошқа одамнинг телефон рақамига тўлов қилдим. Бекор қилса бўладими?",
    "Оплатила чужой телефон по ошибке — что теперь нажать, чтобы отменить?",
    "Boshqa telefon raqamiga xato to'ladim — bekor qilish mumkinmi?",
    "Бошқа телефон рақамига хато тўладим — бекор қилиш мумкинми?",
    "I topped up someone else's phone by mistake—how can I cancel it?",
    "Adashib boshqa odamga pul yubordim.",
    "Адашиб бошқа одамга пул юбордим.",
  ])("keeps an ordinary wrong-recipient transfer out of scam panic: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBeNull();
    expect(classifyVictimIntent(text)).toEqual({
      kind: "accidental_transfer_outgoing",
      askedContext: "transfer",
    });
  });

  it("keeps incoming return-to-another-account wording on the money-mule route", () => {
    expect(
      classifyVictimIntent("мне пришли деньги по ошибке и просят вернуть их на другую карту"),
    ).toMatchObject({ kind: "money_mule" });
  });

  it.each([
    "сосед прислал обычное mp4 из галереи, мы заранее договаривались",
    "Qo'shnim oddiy videoni Telegram ichida yubordi, hech qanday fayl yoki ilova o'rnatish kerak emas",
    "Друг прислал видео с дня рождения, посмотреть?",
    "Do'stim tug'ilgan kundan oddiy videoni yubordi, ko'rsam bo'ladimi?",
    "My friend sent a birthday video in Telegram, should I watch it?",
    "Я оплатил штраф в официальном приложении банка, APK и ссылок не было",
    "Мне нужно оплатить штраф в официальном приложении, это можно?",
    "Jarimani rasmiy ilovada to'lasam bo'ladimi?",
    "Can I pay a fine in the official app?",
    "Jarima ballarini pulga o'chirish mumkin emas, vositachiga pul bermang",
    "официально бесплатно проверяю штрафные баллы на госпортале",
    "новость предупреждает: не выполняйте опасные задания от имени полиции",
    "ИИБ требует принести пакет документов в отделение, иначе будет штраф",
    "IIB hujjatlar paketini bo'limga olib borishni talab qildi, aks holda jarima",
    "Police require me to bring a document package to the station or pay a late fee",
    "Друг прислал ссылку на официальный сайт банка с итогами розыгрыша",
    "Do'stim bankning rasmiy saytidagi yutuq natijalari havolasini yubordi",
    "My friend shared the official bank site with the giveaway results",
  ])("does not turn a protective or ordinary statement into a new live incident: %s", (text) => {
    expect(classifyVictimIntent(text)?.scenario).not.toBe("authority_physical_coercion");
    expect(classifyVictimIntent(text)?.scenario).not.toBe("neighbor_video_malware");
    expect(classifyVictimIntent(text)?.scenario).not.toBe("penalty_points_cancellation");
    expect(classifyVictimIntent(text)?.scenario).not.toBe("fake_fine_cashback_app");
    expect(classifyVictimIntent(text)?.scenario).not.toBe("known_contact_prize_link");
  });

  it.each([
    "что такое безопасный счёт?",
    "кто такая служба безопасности?",
    "what does safe account mean?",
    "xavfsiz hisob nima degani?",
  ])("keeps a safe-account definition out of a live victim incident: %s", (text) => {
    expect(classifyVictimIntent(text)).toBeNull();
  });

  it("understands bare why and gives a scenario-specific reply script", () => {
    const at = new Date("2026-08-23T10:00:00.000Z");
    const context = buildVictimFollowUpContext(
      {
        kind: "authority_physical_coercion",
        askedContext: "call",
        scenario: "authority_physical_coercion",
      },
      at,
    );
    const why = classifyVictimGuidanceFollowUp("а почему?", context, new Date(at.getTime() + 1000));
    const reply = classifyVictimGuidanceFollowUp(
      "что мне им сказать?",
      context,
      new Date(at.getTime() + 1000),
    );

    expect(why?.action).toBe("why");
    expect(reply?.action).toBe("reply_script");
    expect(buildVictimGuidanceFollowUpText(reply!, "ru")).toContain("102");
    expect(buildVictimGuidanceFollowUpText(reply!, "ru")).not.toContain(
      "перезвоню по официальному номеру",
    );
  });

  it.each([
    ["пачему?", "why"],
    ["nima uchun?", "why"],
    ["что теперь?", "next_steps"],
    ["ok and now?", "next_steps"],
    ["endi-chi?", "next_steps"],
    ["what should I say to them?", "reply_script"],
    ["ularga nima yozay?", "reply_script"],
    ["Ularga nima deb javob beray?", "reply_script"],
    ["Уларга нима деб жавоб берай?", "reply_script"],
    ["pachemu?", "why"],
    ["chto delat dalshe?", "next_steps"],
    ["chto im skazat?", "reply_script"],
    ["nu i chto teper?", "next_steps"],
  ] as const)("keeps a natural or bounded-translit follow-up contextual: %s", (text, action) => {
    const at = new Date("2026-08-23T10:00:00.000Z");
    const context = buildVictimFollowUpContext(
      {
        kind: "authority_physical_coercion",
        askedContext: "call",
        scenario: "authority_physical_coercion",
      },
      at,
    );

    expect(
      classifyVictimGuidanceFollowUp(text, context, new Date(at.getTime() + 1000))?.action,
    ).toBe(action);
  });

  it("answers why and next-step follow-ups without repeating the original scenario card", () => {
    const at = new Date("2026-08-23T10:00:00.000Z");
    const match = {
      kind: "apk_request",
      askedContext: "apk",
      scenario: "fake_fine_cashback_app",
    } as const;
    const context = buildVictimFollowUpContext(match, at);
    const why = classifyVictimGuidanceFollowUp("почему?", context, new Date(at.getTime() + 1000));
    const next = classifyVictimGuidanceFollowUp(
      "что теперь?",
      context,
      new Date(at.getTime() + 1000),
    );
    const original = buildVictimIntentText(match, "ru");

    expect(buildVictimGuidanceFollowUpText(why!, "ru")).not.toBe(original);
    expect(buildVictimGuidanceFollowUpText(why!, "ru")).toMatch(/APK|официальн/iu);
    expect(buildVictimGuidanceFollowUpText(next!, "ru")).not.toBe(original);
    expect(buildVictimGuidanceFollowUpText(next!, "ru")).toMatch(/Wi|мобильн|доверенн/iu);
  });

  it("keeps high-stakes scenario copy factual, localized, and actionable", () => {
    const fine = buildVictimIntentText(
      { kind: "apk_request", askedContext: "apk", scenario: "fake_fine_cashback_app" },
      "ru",
    );
    const prize = buildVictimIntentText(
      { kind: "identity_uncertain", scenario: "known_contact_prize_link" },
      "en",
    );
    const accidental = buildVictimIntentText(
      { kind: "accidental_transfer_outgoing", askedContext: "transfer" },
      "ru",
    );
    const game = buildVictimIntentText(
      { kind: "transfer_request", scenario: "game_escrow_fee" },
      "en",
    );
    const privacy = buildVictimIntentText({ kind: "privacy_question" }, "en");
    const uzAdvice = buildVictimIntentText({ kind: "advice_question" }, "uz");

    expect(fine).toMatch(/авиарежим|Wi|мобильн|другого доверенного/iu);
    expect(prize).toMatch(/Telegram login code|unknown sessions|banking OTP|card data/iu);
    expect(accidental).toMatch(/официальн.*канал|доступен ли отзыв|не гарантирован/iu);
    expect(accidental).not.toMatch(/оспорить/iu);
    expect(game).toMatch(/whether the platform permits|built-in/iu);
    expect(privacy).toMatch(/masked number|hostname|AI\/vision provider|not stored locally/iu);
    expect(uzAdvice).toContain("🆘 Shoshilinch qadamlar");
  });
});
