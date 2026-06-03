// Bot-specific trilingual strings for the Telegram bot (Ishonch Guard).
//
// Form mirrors `t_dict` in `src/lib/i18n.ts`: every entry MUST provide all three
// languages (ru / uz / en) — required by CODING_RULES (i18n). Uzbek is Latin script.
// Tone: calm and plain (audience includes elderly users).
//
// Risk-level labels (risk_*), the privacy promise and other generic app strings
// already live in `src/lib/i18n.ts` (`t()` / `t_dict`) and are NOT duplicated here.
// Reason labels (REASON_LABELS) and advice (ADVICE) live in `src/lib/risk/rules.ts`.
// This module only holds strings that are specific to the bot channel.
//
// Strings are plain text (no MarkdownV2 markup). The response formatter
// (`format.ts`, task 6.2) is responsible for MarkdownV2 escaping.

import type { Lang } from "@/lib/i18n";

type BotDict = Record<string, { ru: string; uz: string; en: string }>;

export const bot_dict: BotDict = {
  // ── /start: greeting + capabilities (R1.1, R1.5) ──────────────────────────
  welcome: {
    ru: "🛡 *Ishonch Guard*\n━━━━━━━━━━━━━━━━━━━━\n\nПомогаю распознать мошенников в Узбекистане.\n\n📌 *Что я умею:*\n• Проверить номер, ссылку или скриншот\n• Оценить подозрительное сообщение\n• Дать срочные шаги при обмане\n\n👇 *Отправьте что-нибудь для проверки* или выберите язык:",
    uz: "🛡 *Ishonch Guard*\n━━━━━━━━━━━━━━━━━━━━\n\nO'zbekistonda firibgarlarni tanib olishga yordam beraman.\n\n📌 *Nima qila olaman:*\n• Raqam, havola yoki skrinshotni tekshirish\n• Shubhali xabarni baholash\n• Aldov holatida shoshilinch qadamlar\n\n👇 *Tekshirish uchun biror narsa yuboring* yoki tilni tanlang:",
    en: "🛡 *Ishonch Guard*\n━━━━━━━━━━━━━━━━━━━━\n\nI help you spot scammers in Uzbekistan.\n\n📌 *What I can do:*\n• Check a number, link or screenshot\n• Assess a suspicious message\n• Give emergency steps if scammed\n\n👇 *Send something to check* or choose a language:",
  },

  // Prompt shown when asking the user to pick/switch a language (R2.1) ────────
  choose_language: {
    ru: "Выберите язык:",
    uz: "Tilni tanlang:",
    en: "Choose a language:",
  },

  // Confirmation after a language was changed (R2.2) ─────────────────────────
  language_changed: {
    ru: "Готово, отвечаю на русском. В любой момент можно сменить язык командой /lang.",
    uz: "Tayyor, o‘zbek tilida javob beraman. Istalgan vaqtda /lang buyrug‘i bilan tilni o‘zgartirishingiz mumkin.",
    en: "Done, I’ll reply in English. You can change the language any time with /lang.",
  },

  // What the user can send (shown after language choice) (R1.3) ──────────────
  input_instruction: {
    ru: "Что можно прислать на проверку:\n• номер телефона;\n• Telegram-username или ссылку;\n• ссылку на сайт или на APK-файл;\n• текст подозрительного сообщения;\n• скриншот переписки;\n• карточку контакта;\n• описание ситуации словами.\n\nПросто отправьте это сообщением — я отвечу оценкой риска. Команды: /help.",
    uz: "Tekshirish uchun nima yuborish mumkin:\n• telefon raqami;\n• Telegram-username yoki havola;\n• sayt yoki APK-fayl havolasi;\n• shubhali xabar matni;\n• yozishma skrinshoti;\n• kontakt kartasi;\n• vaziyatni o‘z so‘zlaringiz bilan tavsiflash.\n\nShunchaki xabar qilib yuboring — men xavf bahosini qaytaraman. Buyruqlar: /help.",
    en: "What you can send for a check:\n• a phone number;\n• a Telegram username or link;\n• a website or APK file link;\n• the text of a suspicious message;\n• a screenshot of a chat;\n• a contact card;\n• a description of the situation in your own words.\n\nJust send it as a message — I’ll reply with a risk assessment. Commands: /help.",
  },

  // ── /check (R4.1) ─────────────────────────────────────────────────────────
  check_prompt: {
    ru: "Пришлите, что нужно проверить: номер, username, ссылку, текст сообщения или скриншот.",
    uz: "Tekshirish kerak bo‘lgan narsani yuboring: raqam, username, havola, xabar matni yoki skrinshot.",
    en: "Send what you’d like to check: a number, username, link, message text or screenshot.",
  },
  analyzing: {
    ru: "Анализирую…",
    uz: "Tahlil qilinmoqda…",
    en: "Analyzing…",
  },

  // ── /help: command list (R3.1) ───────────────────────────────────────────
  help: {
    ru: "📋 *Команды бота*\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Начать работу\n🔍 /check — Проверить номер или ссылку\n📢 /report — Сообщить о мошеннике\n🆘 /panic — Экстренная помощь\n🚨 /emergency — Срочные шаги\n🛡 /safety — Правила безопасности\n🌐 /lang — Сменить язык\n\n💡 Можно просто прислать сообщение без команды — я проверю его.",
    uz: "📋 *Bot buyruqlari*\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Boshlash\n🔍 /check — Raqam yoki havolani tekshirish\n📢 /report — Firibgar haqida xabar berish\n🆘 /panic — Shoshilinch yordam\n🚨 /emergency — Shoshilinch qadamlar\n🛡 /safety — Xavfsizlik qoidalari\n🌐 /lang — Tilni o'zgartirish\n\n💡 Buyruqsiz ham xabar yuboring — men tekshiraman.",
    en: "📋 *Bot Commands*\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Get started\n🔍 /check — Check a number or link\n📢 /report — Report a scammer\n🆘 /panic — Emergency help\n🚨 /emergency — Urgent steps\n🛡 /safety — Safety rules\n🌐 /lang — Change language\n\n💡 You can also just send a message — I'll check it.",
  },

  // ── /safety: basic safety rules + scope reminder (R3.2, R3.3) ─────────────
  safety: {
    ru: "🛡 *Правила безопасности*\n━━━━━━━━━━━━━━━━━━━━\n\n❌ Никому не сообщайте OTP/SMS-код, PIN, CVV или пароль\n❌ Не устанавливайте APK по ссылкам из сообщений\n❌ Не переводите деньги на «безопасный счёт»\n❌ Не сканируйте чужие QR-коды «для входа»\n\n✅ Сомневаетесь — положите трубку\n✅ Перезвоните в банк по номеру с карты\n✅ Проверьте номер/ссылку через этого бота\n\n🔒 Я анализирую только то, что вы сами присылаете. Я не читаю ваши чаты.",
    uz: "🛡 *Xavfsizlik qoidalari*\n━━━━━━━━━━━━━━━━━━━━\n\n❌ Hech kimga OTP/SMS-kod, PIN, CVV yoki parolni aytmang\n❌ Xabardagi havolalar orqali APK o‘rnatmang\n❌ «Xavfsiz hisob»ga pul o‘tkazmang\n❌ Begona QR-kodlarni skanerlamang\n\n✅ Shubha qilsangiz — go‘shakni qo‘ying\n✅ Bankka karta orqasidagi raqam orqali qo‘ng‘iroq qiling\n✅ Raqam/havolani shu bot orqali tekshiring\n\n🔒 Men faqat o‘zingiz yuborgan ma‘lumotni tahlil qilaman. Chatlaringizni o‘qimayman.",
    en: "🛡 *Safety Rules*\n━━━━━━━━━━━━━━━━━━━━\n\n❌ Never share OTP/SMS codes, PIN, CVV or passwords\n❌ Don't install APKs from message links\n❌ Don't transfer money to a 'safe account'\n❌ Don't scan someone else's QR codes\n\n✅ If in doubt — hang up\n✅ Call your bank using the number on your card\n✅ Check the number/link with this bot\n\n🔒 I only analyze what you send me. I don't read your chats.",
  },

  // ── /emergency: numbered checklist (R20.1, R20.2, R20.5) ──────────────────
  emergency: {
    ru: "Срочные шаги. Действуйте спокойно и по порядку:\n\n1. Положите трубку и не продолжайте разговор. Если давят «не кладите трубку» — это признак мошенничества.\n2. Срочно позвоните в банк по официальному номеру (он на обратной стороне карты) и заблокируйте карту и онлайн-банк.\n3. Смените пароль Telegram и завершите активные сессии: Настройки → Устройства → Завершить все остальные сеансы.\n4. Не сканируйте чужие QR-коды.\n5. Сохраните скриншоты переписки и звонков как доказательства.\n6. Подайте заявление в Cyber Police по номеру 102.\n\nЕсли давят прямо во время звонка — завершите его и сами перезвоните в организацию по официальному номеру.",
    uz: "Shoshilinch qadamlar. Xotirjam va tartib bilan harakat qiling:\n\n1. Go‘shakni qo‘ying va suhbatni davom ettirmang. «Go‘shakni qo‘ymang» deb bosim qilishsa — bu firibgarlik belgisi.\n2. Bankka rasmiy raqami orqali (u karta orqasida) zudlik bilan qo‘ng‘iroq qiling va karta hamda onlayn-bankni bloklang.\n3. Telegram parolini o‘zgartiring va faol seanslarni tugating: Sozlamalar → Qurilmalar → Boshqa barcha seanslarni tugatish.\n4. Begona QR-kodlarni skanerlamang.\n5. Yozishma va qo‘ng‘iroqlar skrinshotini dalil sifatida saqlang.\n6. Cyber Police’ga 102 raqami orqali ariza bering.\n\nQo‘ng‘iroq paytida bosim qilishsa — uni tugatib, tashkilotga rasmiy raqami orqali o‘zingiz qo‘ng‘iroq qiling.",
    en: "Urgent steps. Stay calm and go in order:\n\n1. Hang up and don’t continue the conversation. If they pressure you to “stay on the line”, that’s a scam sign.\n2. Call your bank right away on the official number (it’s on the back of your card) and block the card and online banking.\n3. Change your Telegram password and end active sessions: Settings → Devices → Terminate all other sessions.\n4. Don’t scan anyone else’s QR codes.\n5. Save screenshots of chats and calls as evidence.\n6. File a report with Cyber Police at 102.\n\nIf you’re being pressured during the call — end it and call the organization yourself on the official number.",
  },

  // ── /report scenario step prompts (R6.1–R6.7) ────────────────────────────
  report_ask_value: {
    ru: "На кого жалуемся? Пришлите значение: номер телефона, Telegram-username или ссылку.",
    uz: "Kim haqida shikoyat qilamiz? Qiymatni yuboring: telefon raqami, Telegram-username yoki havola.",
    en: "Who are you reporting? Send the value: a phone number, Telegram username or link.",
  },
  report_ask_description: {
    ru: "Коротко опишите ситуацию: что произошло и что просили сделать.",
    uz: "Vaziyatni qisqacha tasvirlang: nima bo‘ldi va nima qilishni so‘rashdi.",
    en: "Briefly describe what happened and what you were asked to do.",
  },
  report_ask_scam_type: {
    ru: "Какой это вид мошенничества? Напишите коротко (например: фейковый банк, кредит, OTP). Можно пропустить — отправьте «-».",
    uz: "Bu qanday firibgarlik turi? Qisqacha yozing (masalan: soxta bank, kredit, OTP). O‘tkazib yuborish mumkin — «-» yuboring.",
    en: "What type of scam was it? Write briefly (e.g. fake bank, loan, OTP). You can skip — send “-”.",
  },
  report_ask_city: {
    ru: "В каком городе это произошло? Можно пропустить — отправьте «-».",
    uz: "Bu qaysi shaharda bo‘ldi? O‘tkazib yuborish mumkin — «-» yuboring.",
    en: "In which city did this happen? You can skip — send “-”.",
  },
  report_ask_amount: {
    ru: "Какая сумма ущерба в сумах (UZS)? Укажите число или пропустите — отправьте «-».",
    uz: "Zarar miqdori qancha (so‘mda, UZS)? Raqam yozing yoki o‘tkazib yuboring — «-» yuboring.",
    en: "What was the loss amount in soum (UZS)? Enter a number or skip — send “-”.",
  },
  report_skip_hint: {
    ru: "Это поле необязательное. Чтобы пропустить, отправьте «-» или нажмите «Пропустить».",
    uz: "Bu maydon ixtiyoriy. O‘tkazib yuborish uchun «-» yuboring yoki «O‘tkazib yuborish» tugmasini bosing.",
    en: "This field is optional. To skip, send “-” or tap “Skip”.",
  },

  // ── /report validation messages (R6.5, R6.6) ──────────────────────────────
  report_value_too_long: {
    ru: "Значение слишком длинное (максимум 500 символов). Пришлите номер, username или ссылку покороче.",
    uz: "Qiymat juda uzun (maksimum 500 belgi). Qisqaroq raqam, username yoki havola yuboring.",
    en: "The value is too long (max 500 characters). Send a shorter number, username or link.",
  },
  report_description_too_short: {
    ru: "Описание слишком короткое (нужно минимум 5 символов). Опишите ситуацию чуть подробнее.",
    uz: "Tavsif juda qisqa (kamida 5 belgi kerak). Vaziyatni biroz batafsilroq yozing.",
    en: "The description is too short (at least 5 characters needed). Please describe the situation a bit more.",
  },
  report_description_too_long: {
    ru: "Описание слишком длинное (максимум 5000 символов). Сократите его, пожалуйста.",
    uz: "Tavsif juda uzun (maksimum 5000 belgi). Iltimos, qisqartiring.",
    en: "The description is too long (max 5000 characters). Please shorten it.",
  },

  // ── /report result messages (R6.7, R6.8) ──────────────────────────────────
  report_confirm: {
    ru: "Спасибо, жалоба принята. Запись станет публичной только после проверки модератором. Так мы защищаемся от ложных обвинений.",
    uz: "Rahmat, shikoyat qabul qilindi. Yozuv faqat moderator tekshiruvidan keyin ommaviy bo‘ladi. Shu tariqa biz yolg‘on ayblovlardan himoyalanamiz.",
    en: "Thank you, your report has been received. It will become public only after a moderator reviews it. This protects against false accusations.",
  },
  report_error: {
    ru: "Не удалось отправить жалобу. Попробуйте, пожалуйста, ещё раз чуть позже.",
    uz: "Shikoyatni yuborib bo‘lmadi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.",
    en: "Couldn’t submit the report. Please try again a little later.",
  },

  // ── Rate limit (R10.2) — {seconds} placeholder filled via bt(..., { seconds }) ─
  rate_limited: {
    ru: "Слишком много запросов. Подождите {seconds} сек. и попробуйте снова.",
    uz: "So‘rovlar juda ko‘p. {seconds} soniya kuting va qayta urinib ko‘ring.",
    en: "Too many requests. Please wait {seconds} sec. and try again.",
  },

  // ── Input length (R4.10) ──────────────────────────────────────────────────
  text_too_long: {
    ru: "Сообщение слишком длинное (максимум 2000 символов). Пришлите текст покороче или только подозрительную часть.",
    uz: "Xabar juda uzun (maksimum 2000 belgi). Qisqaroq matn yoki faqat shubhali qismni yuboring.",
    en: "The message is too long (max 2000 characters). Send a shorter text or just the suspicious part.",
  },

  // ── Image / OCR (R5.5, R5.6, R16.3) ───────────────────────────────────────
  image_too_large: {
    ru: "Изображение слишком большое (максимум 6 МБ). Пришлите файл поменьше или вставьте текст вручную.",
    uz: "Rasm juda katta (maksimum 6 MB). Kichikroq fayl yuboring yoki matnni qo‘lda joylashtiring.",
    en: "The image is too large (max 6 MB). Send a smaller file or paste the text manually.",
  },
  ocr_failed: {
    ru: "Не удалось распознать текст на изображении. Пришлите содержимое текстом, пожалуйста.",
    uz: "Rasmdagi matnni aniqlab bo‘lmadi. Iltimos, ma’lumotni matn ko‘rinishida yuboring.",
    en: "Couldn’t read the text in the image. Please send the content as text instead.",
  },
  multiple_images: {
    ru: "За один раз я обрабатываю одно изображение. Проверяю первое из присланных.",
    uz: "Men bir vaqtning o‘zida bitta rasmni qayta ishlayman. Yuborilganlardan birinchisini tekshiraman.",
    en: "I process one image at a time. Checking the first of the ones you sent.",
  },

  // ── Confirmed reports line in a check result (R4.11) ──────────────────────
  // {count} placeholder filled via bt("known_reports", lang, { count }).
  known_reports: {
    ru: "В базе есть {count} подтверждённых жалоб на этот контакт.",
    uz: "Bazada bu kontakt bo‘yicha {count} ta tasdiqlangan shikoyat bor.",
    en: "There are {count} confirmed reports about this contact in our database.",
  },

  // ── Contact card (R21.4) ──────────────────────────────────────────────────
  contact_no_number: {
    ru: "В карточке контакта не нашёлся номер телефона. Пришлите номер текстом, пожалуйста.",
    uz: "Kontakt kartasida telefon raqami topilmadi. Iltimos, raqamni matn ko‘rinishida yuboring.",
    en: "I couldn’t find a phone number in the contact card. Please send the number as text.",
  },

  // ── Empty / unsupported input (R16.1) ─────────────────────────────────────
  unsupported_input: {
    ru: "Я не смог обработать это сообщение. Пришлите номер телефона, Telegram-username, ссылку, текст сообщения или скриншот. Команды — /help.",
    uz: "Bu xabarni qayta ishlay olmadim. Telefon raqami, Telegram-username, havola, xabar matni yoki skrinshot yuboring. Buyruqlar — /help.",
    en: "I couldn’t handle this message. Send a phone number, Telegram username, link, message text or screenshot. Commands — /help.",
  },

  // ── Out-of-scope content: voice/audio/video (R22.3) ───────────────────────
  out_of_scope: {
    ru: "Извините, голосовые, аудио и видео я пока не анализирую. Пришлите, пожалуйста, текст сообщения или скриншот.",
    uz: "Kechirasiz, ovozli, audio va video xabarlarni hozircha tahlil qilmayman. Iltimos, xabar matnini yoki skrinshotni yuboring.",
    en: "Sorry, I don’t analyze voice, audio or video yet. Please send the message text or a screenshot instead.",
  },

  // ── Document/APK safety response ──────────────────────────────────────────
  document_safety: {
    ru: "⚠️ Файлы (APK, документы) не скачиваются и не анализируются ботом.\n\nДля вашей безопасности Ishonch Guard не открывает и не сохраняет такие файлы. Если вам прислали APK от имени банка, оператора или «безопасности» — это сильный признак мошенничества.\n\nЧто делать:\n• Не устанавливайте файл\n• Удалите его\n• Не давайте приложению доступ к SMS, уведомлениям или контактам\n• Если уже установили — отправьте /panic и выберите «Установил APK»",
    uz: "⚠️ Fayllar (APK, hujjatlar) bot tomonidan yuklanmaydi va tahlil qilinmaydi.\n\nXavfsizligingiz uchun Ishonch Guard bunday fayllarni ochmaydi va saqlamaydi. Agar sizga bank, operator yoki «xavfsizlik xizmati» nomidan APK yuborishgan bo'lsa — bu firibgarlik belgisi.\n\nNima qilish kerak:\n• Faylni o'rnatmang\n• Uni o'chirib tashlang\n• Ilovaga SMS, bildirishnomalar yoki kontaktlarga ruxsat bermang\n• Agar allaqachon o'rnatgan bo'lsangiz — /panic yuboring va «APK o'rnatdim» ni tanlang",
    en: '⚠️ Files (APK, documents) are not downloaded or analyzed by the bot.\n\nFor your safety, Ishonch Guard does not open or save such files. If someone sent you an APK on behalf of a bank, operator or "security service" — this is a strong sign of fraud.\n\nWhat to do:\n• Do not install the file\n• Delete it\n• Do not grant the app access to SMS, notifications or contacts\n• If you already installed it — send /panic and choose "Installed APK"',
  },

  // ── Unknown command (R16.2) ───────────────────────────────────────────────
  unknown_command: {
    ru: "Не знаю такой команды. Список команд — /help.",
    uz: "Bunday buyruqni bilmayman. Buyruqlar ro‘yxati — /help.",
    en: "I don’t know that command. See the list of commands — /help.",
  },

  // ── Generic error (R11.3) ─────────────────────────────────────────────────
  generic_error: {
    ru: "Что-то пошло не так. Попробуйте, пожалуйста, ещё раз.",
    uz: "Nimadir xato ketdi. Iltimos, qayta urinib ko‘ring.",
    en: "Something went wrong. Please try again.",
  },

  // ── Inline button labels (R1.1, R4.6, R20.3, R6.3) ────────────────────────
  btn_report: {
    ru: "📢 Сообщить",
    uz: "📢 Xabar berish",
    en: "📢 Report",
  },
  btn_check_another: {
    ru: "🔄 Проверить ещё",
    uz: "🔄 Yana tekshirish",
    en: "🔄 Check another",
  },
  btn_emergency: {
    ru: "🆘 Я уже отправил код/деньги",
    uz: "Men kod/pul yuborib qo‘ydim",
    en: "🆘 I already sent a code/money",
  },
  btn_skip: {
    ru: "⏭ Пропустить",
    uz: "O‘tkazib yuborish",
    en: "⏭ Skip",
  },
  // Language buttons keep the language’s own name in every locale (like LANGS in i18n.ts).
  btn_lang_ru: {
    ru: "Русский",
    uz: "Русский",
    en: "Русский",
  },
  btn_lang_uz: {
    ru: "O‘zbekcha",
    uz: "O‘zbekcha",
    en: "O‘zbekcha",
  },
  btn_lang_en: {
    ru: "English",
    uz: "English",
    en: "English",
  },

  // ── Verified contacts (D-011) ─────────────────────────────────────────────
  verified_match: {
    ru: "✅ Номер совпадает с официальным контактом: {org}.",
    uz: "✅ Raqam rasmiy kontakt bilan mos keladi: {org}.",
    en: "✅ Number matches an official contact: {org}.",
  },
  verified_spoofing_warning: {
    ru: "⚠️ Важно: номер на экране может быть подменён (Caller ID spoofing). Если вам звонят с этого номера и просят SMS-код, PIN, CVV, пароль, установить приложение или перевести деньги — это опасно.\n\nБезопаснее завершить разговор и самостоятельно перезвонить по официальному номеру.",
    uz: "⚠️ Muhim: ekrandagi raqam soxta bo'lishi mumkin (Caller ID spoofing). Agar sizga ushbu raqamdan qo'ng'iroq qilib, SMS-kod, PIN, CVV, parol so'rashsa yoki ilova o'rnatishni/pul o'tkazishni aytishsa — bu xavfli.\n\nXavfsizroq: suhbatni tugating va rasmiy raqamga o'zingiz qo'ng'iroq qiling.",
    en: "⚠️ Important: Caller ID can be spoofed. If someone calls from this number and asks for your SMS code, PIN, CVV, password, to install an app or transfer money — it's still dangerous.\n\nSafer: hang up and call back using the official number yourself.",
  },
  verified_with_danger: {
    ru: "🚨 Номер похож на официальный контакт ({org}), но сообщение содержит опасные признаки. Даже официальный номер на экране может быть подменён. Не выполняйте инструкции и свяжитесь с организацией самостоятельно.",
    uz: "🚨 Raqam rasmiy kontaktga ({org}) o'xshaydi, lekin xabarda xavfli belgilar bor. Hatto rasmiy raqam ham soxta bo'lishi mumkin. Ko'rsatmalarni bajarmang va tashkilotga o'zingiz murojaat qiling.",
    en: "🚨 Number resembles an official contact ({org}), but the message contains dangerous signals. Even an official number on screen can be spoofed. Do not follow the instructions — contact the organization yourself.",
  },

  // ── Quick action buttons (welcome screen) ─────────────────────────────────
  btn_quick_check: {
    ru: "Проверить",
    uz: "Tekshirish",
    en: "Check",
  },
  btn_quick_report: {
    ru: "Пожаловаться",
    uz: "Shikoyat",
    en: "Report",
  },
  btn_quick_panic: {
    ru: "Экстренная помощь",
    uz: "Shoshilinch yordam",
    en: "Emergency",
  },

  // ── Live call copilot (Sprint 3.1) ────────────────────────────────────────
  live_call_header: {
    ru: "\u{1F6A8} \u0412\u042B \u0421\u0415\u0419\u0427\u0410\u0421 \u041D\u0410 \u0417\u0412\u041E\u041D\u041A\u0415",
    uz: "\u{1F6A8} HOZIR QO'NG'IROQDASIZ",
    en: "\u{1F6A8} YOU'RE ON A CALL RIGHT NOW",
  },
  live_call_hangup: {
    ru: "\u{1F6D1} \u041F\u041E\u041B\u041E\u0416\u0418\u0422\u0415 \u0422\u0420\u0423\u0411\u041A\u0423. \u042D\u0442\u043E \u0441\u0430\u043C\u043E\u0435 \u0432\u0430\u0436\u043D\u043E\u0435.\n\n\u0411\u0430\u043D\u043A \u041D\u0418\u041A\u041E\u0413\u0414\u0410 \u043D\u0435 \u043F\u0440\u043E\u0441\u0438\u0442 \u043A\u043E\u0434 \u043F\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0443.\n\u0415\u0441\u043B\u0438 \u0433\u043E\u0432\u043E\u0440\u044F\u0442 \u00AB\u043D\u0435 \u043A\u043B\u0430\u0434\u0438\u0442\u0435 \u0442\u0440\u0443\u0431\u043A\u0443\u00BB \u2014 \u044D\u0442\u043E 100% \u043C\u043E\u0448\u0435\u043D\u043D\u0438\u043A.",
    uz: "\u{1F6D1} GO'SHAKNI QO'YING. Bu eng muhim harakat.\n\nBank HECH QACHON telefon orqali kod so'ramaydi.\nAgar \u00ABgo'shakni qo'ymang\u00BB deyishsa \u2014 bu 100% firibgar.",
    en: "\u{1F6D1} HANG UP. This is the most important action.\n\nA bank NEVER asks for a code over the phone.\nIf they say \u201Cdon't hang up\u201D \u2014 it's 100% a scammer.",
  },
  live_call_what_to_say: {
    ru: "\u{1F4AC} \u0427\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0442\u044C:\n\n\u00AB\u042F \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435 \u043C\u043E\u0433\u0443 \u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C. \u042F \u043F\u0435\u0440\u0435\u0437\u0432\u043E\u043D\u044E \u0432 \u0431\u0430\u043D\u043A \u0441\u0430\u043C.\u00BB\n\n\u0418 \u043F\u043E\u043B\u043E\u0436\u0438\u0442\u044C \u0442\u0440\u0443\u0431\u043A\u0443. \u041D\u0435 \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0439\u0442\u0435, \u043D\u0435 \u0441\u043F\u043E\u0440\u044C\u0442\u0435.",
    uz: "\u{1F4AC} Nima deyish kerak:\n\n\u00ABHozir gaplasha olmayman. Bankka o'zim qo'ng'iroq qilaman.\u00BB\n\nVa go'shakni qo'ying. Tushuntirmang, tortishmang.",
    en: "\u{1F4AC} What to say:\n\n\u201CI can't talk right now. I'll call the bank myself.\u201D\n\nAnd hang up. Don't explain, don't argue.",
  },
  btn_live_hangup: {
    ru: "\u{1F6D1} \u041F\u043E\u043B\u043E\u0436\u0438\u0442\u044C \u0442\u0440\u0443\u0431\u043A\u0443",
    uz: "\u{1F6D1} Go'shakni qo'yish",
    en: "\u{1F6D1} Hang up now",
  },
  btn_live_what_to_say: {
    ru: "\u{1F4AC} \u0427\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u0442\u044C?",
    uz: "\u{1F4AC} Nima deyish?",
    en: "\u{1F4AC} What to say?",
  },
  btn_live_call_bank: {
    ru: "\u{1F4DE} \u041F\u043E\u0437\u0432\u043E\u043D\u0438\u0442\u044C \u0432 \u0431\u0430\u043D\u043A",
    uz: "\u{1F4DE} Bankka qo'ng'iroq",
    en: "\u{1F4DE} Call the bank",
  },
  btn_live_sent_code: {
    ru: "\u{1F198} \u042F \u0443\u0436\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B \u043A\u043E\u0434",
    uz: "\u{1F198} Kodni allaqachon yubordim",
    en: "\u{1F198} I already sent the code",
  },
  btn_live_tell_family: {
    ru: "\u{1F46A} \u0421\u043E\u043E\u0431\u0449\u0438\u0442\u044C \u0431\u043B\u0438\u0437\u043A\u043E\u043C\u0443",
    uz: "\u{1F46A} Yaqinlarga xabar berish",
    en: "\u{1F46A} Tell a family member",
  },
};

export type BotStringKey = keyof typeof bot_dict;

/**
 * Accessor for bot-specific strings, analogous to `t()` in `src/lib/i18n.ts`.
 * Default language is `ru` (R1.4). Optionally interpolates `{name}` placeholders,
 * e.g. `bt("rate_limited", lang, { seconds: 30 })`.
 */
export function bt(
  key: BotStringKey,
  lang: Lang = "ru",
  vars?: Record<string, string | number>,
): string {
  const entry = bot_dict[key];
  let str = entry?.[lang] ?? entry?.ru ?? String(key);
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      str = str.split(`{${name}}`).join(String(value));
    }
  }
  return str;
}
