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
    ru: "🛡 Ishonch Guard\n━━━━━━━━━━━━━━━━━━━━\n\nПроверю номер, ссылку, скриншот или сообщение и подскажу безопасный следующий шаг.\n\nВыберите действие:",
    uz: "🛡 Ishonch Guard\n━━━━━━━━━━━━━━━━━━━━\n\nRaqam, havola, skrinshot yoki xabarni tekshiraman va xavfsiz keyingi qadamni aytaman.\n\nHarakatni tanlang:",
    en: "🛡 Ishonch Guard\n━━━━━━━━━━━━━━━━━━━━\n\nI can check a number, link, screenshot, or message and suggest a safe next step.\n\nChoose an action:",
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
    ru: "📋 Команды бота\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Главное меню\n🧭 /menu — Главное меню\n🔍 /check — Проверить номер или ссылку\n📢 /report — Сообщить о случае\n🆘 /panic — Экстренная помощь\n🚨 /emergency — Срочные шаги\n🛡 /safety — Правила безопасности\n🌐 /lang — Сменить язык\n\n💡 Можно просто прислать сообщение без команды — я проверю его.",
    uz: "📋 Bot buyruqlari\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Asosiy menyu\n🧭 /menu — Asosiy menyu\n🔍 /check — Raqam yoki havolani tekshirish\n📢 /report — Holat haqida xabar berish\n🆘 /panic — Shoshilinch yordam\n🚨 /emergency — Shoshilinch qadamlar\n🛡 /safety — Xavfsizlik qoidalari\n🌐 /lang — Tilni o'zgartirish\n\n💡 Buyruqsiz ham xabar yuboring — men tekshiraman.",
    en: "📋 Bot Commands\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Main menu\n🧭 /menu — Main menu\n🔍 /check — Check a number or link\n📢 /report — Report an incident\n🆘 /panic — Emergency help\n🚨 /emergency — Urgent steps\n🛡 /safety — Safety rules\n🌐 /lang — Change language\n\n💡 You can also just send a message — I'll check it.",
  },

  // ── Meta-intent answers: questions TO the bot, not scam content ───────────
  meta_how_to_use: {
    ru: "Можно просто отправить мне то, что вызывает сомнение: номер телефона, Telegram-username, ссылку, текст сообщения или скриншот. Если это QR-код, лучше пришлите ссылку, которая открывается после сканирования, или опишите, что просят сделать.\n\nЯ отвечу уровнем риска и короткими шагами. Команды: /check, /report, /panic, /safety.",
    uz: "Shubhali narsani shunchaki yuboring: telefon raqami, Telegram-username, havola, xabar matni yoki skrinshot. Agar bu QR-kod bo'lsa, skanerdan keyin ochiladigan havolani yuboring yoki sizdan nima so'ralganini yozing.\n\nMen xavf darajasi va qisqa qadamlar bilan javob beraman. Buyruqlar: /check, /report, /panic, /safety.",
    en: "Just send what feels suspicious: a phone number, Telegram username, link, message text, or screenshot. If it is a QR code, it is better to send the link it opens or describe what you are asked to do.\n\nI will reply with a risk level and short next steps. Commands: /check, /report, /panic, /safety.",
  },
  meta_what_can_you_do: {
    ru: "Я помогаю проверить подозрительные номера, Telegram-аккаунты, ссылки, SMS, скриншоты и описания ситуаций. Могу подсказать срочные шаги, если вы уже отправили код, установили приложение или перевели деньги.\n\nЯ не читаю ваши чаты сам и не называю людей мошенниками без признаков — анализирую только то, что вы прислали.",
    uz: "Men shubhali raqamlar, Telegram akkauntlar, havolalar, SMS, skrinshotlar va vaziyat tavsiflarini tekshirishga yordam beraman. Agar kod yuborgan, ilova o'rnatgan yoki pul o'tkazgan bo'lsangiz, shoshilinch qadamlarni aytaman.\n\nMen chatlaringizni o'zim o'qimayman va asossiz hech kimni firibgar demayman — faqat siz yuborgan narsani tahlil qilaman.",
    en: "I help check suspicious numbers, Telegram accounts, links, SMS messages, screenshots, and situation descriptions. I can also give urgent steps if you already sent a code, installed an app, or transferred money.\n\nI do not read your chats by myself, and I do not call people scammers without signals — I only analyze what you send.",
  },
  meta_how_do_you_check: {
    ru: "Я ищу конкретные признаки риска: просьбу назвать SMS-код, PIN, CVV или пароль; установить APK; перейти по подозрительной ссылке; перевести деньги; давление и срочность; имитацию банка или госоргана.\n\nЕсли таких признаков нет, я пишу «недостаточно данных». Даже официальный номер на экране может быть подменён, поэтому при сомнении лучше перезвонить самому.",
    uz: "Men aniq xavf belgilarini qidiraman: SMS-kod, PIN, CVV yoki parol so'rash; APK o'rnatish; shubhali havolaga o'tish; pul o'tkazish; bosim va shoshiltirish; bank yoki davlat tashkiloti nomidan yozish.\n\nBunday belgilar bo'lmasa, «ma'lumot yetarli emas» deb javob beraman. Ekrandagi rasmiy raqam ham soxtalashtirilishi mumkin, shuning uchun shubhada o'zingiz qayta qo'ng'iroq qiling.",
    en: "I look for concrete risk signs: asking for an SMS code, PIN, CVV, or password; installing an APK; opening a suspicious link; transferring money; pressure and urgency; impersonating a bank or government agency.\n\nIf those signs are missing, I say “not enough data.” Even an official-looking caller ID can be spoofed, so when in doubt, call back yourself.",
  },
  meta_why_failed: {
    ru: "Иногда изображение не удаётся прочитать надёжно: текст размытый, мелкий, закрыт бликами, QR-код слишком маленький или в кадре много лишнего. Я лучше скажу честно, чем буду выдумывать угрозу.\n\nЧто поможет: отправьте текст из SMS/чата вручную, ссылку из QR или коротко напишите, что вас просят сделать.",
    uz: "Ba'zan rasmni ishonchli o'qib bo'lmaydi: matn xira, juda kichik, yorug'lik tushgan, QR-kod kichkina yoki kadrda ortiqcha narsa ko'p. Men xavfni o'ylab topgandan ko'ra, buni ochiq aytganim yaxshiroq.\n\nYordam beradigan narsa: SMS/chat matnini qo'lda yuboring, QR havolasini kiriting yoki sizdan nima so'ralganini qisqa yozing.",
    en: "Sometimes an image cannot be read reliably: the text is blurry, tiny, covered by glare, the QR is too small, or there is too much extra content in the frame. I would rather say that honestly than invent a threat.\n\nWhat helps: paste the SMS/chat text, send the QR link, or briefly write what you are being asked to do.",
  },
  meta_explain_risk: {
    ru: "Уровни риска простые: «безопасно» — опасных признаков не найдено; «недостаточно данных» — мало контекста; «требуется осторожность» — есть подозрительные признаки; «высокий риск» — есть сильные признаки обмана.\n\nЭто подсказка, а не юридический приговор. Если просят код, пароль, APK или деньги — остановитесь и проверьте через официальный канал.",
    uz: "Xavf darajalari oddiy: «xavfsiz» — xavfli belgi topilmadi; «ma'lumot yetarli emas» — kontekst kam; «ehtiyot bo'ling» — shubhali belgilar bor; «yuqori xavf» — aldov belgilari kuchli.\n\nBu maslahat, yuridik hukm emas. Agar kod, parol, APK yoki pul so'rashsa — to'xtang va rasmiy kanal orqali tekshiring.",
    en: "Risk levels are simple: “safe” means no dangerous signs found; “not enough data” means too little context; “be cautious” means suspicious signs exist; “high risk” means strong fraud signs.\n\nThis is guidance, not a legal verdict. If someone asks for a code, password, APK, or money, stop and verify through an official channel.",
  },
  meta_telegram_account_limits: {
    ru: "👤 Проверка Telegram-аккаунта\n\nЯ могу проверить только видимые признаки: username или t.me-ссылку, публичное название/описание, если Telegram отдаёт его боту, и сам контекст: просят ли код, деньги, карту, APK, вход по QR или ссылку.\n\nЯ не вижу скрытую метку SCAM, возраст аккаунта, историю жалоб и кому он писал — Telegram обычно не отдаёт это боту.\n\nЛучше пришлите @username вместе с сообщением или скриншотом, где видно, что человек просит сделать.",
    uz: "👤 Telegram akkauntni tekshirish\n\nMen faqat ko‘rinadigan belgilarni tekshira olaman: username yoki t.me havolasi, agar Telegram botga bersa ommaviy nom/tavsif, hamda kontekst: kod, pul, karta, APK, QR orqali kirish yoki havola so‘ralyaptimi.\n\nMen yashirin SCAM belgisini, akkaunt yoshini, shikoyatlar tarixini yoki u kimlarga yozganini ko‘ra olmayman — Telegram odatda buni botga bermaydi.\n\nYaxshisi @username bilan birga odam sizdan nima so‘rayotgani ko‘ringan xabar yoki skrinshotni yuboring.",
    en: "👤 Telegram account checks\n\nI can check only visible signals: a username or t.me link, public title/description if Telegram exposes it to the bot, and the context: whether they ask for a code, money, card details, APK, QR login, or a link.\n\nI cannot see hidden SCAM labels, account age, report history, or who they messaged — Telegram usually does not expose that to bots.\n\nBest: send the @username together with the message or screenshot showing what the person asks you to do.",
  },
  meta_help: {
    ru: "Я рядом. Отправьте номер, username, ссылку, текст подозрительного сообщения или скриншот — я проверю. Если вы уже сообщили код, установили приложение или перевели деньги, нажмите /panic.\n\nПолезные команды: /check — проверка, /report — сообщить о случае, /safety — правила безопасности, /lang — язык.",
    uz: "Men yordam beraman. Raqam, username, havola, shubhali xabar matni yoki skrinshot yuboring — tekshiraman. Agar kod yuborgan, ilova o'rnatgan yoki pul o'tkazgan bo'lsangiz, /panic ni bosing.\n\nFoydali buyruqlar: /check — tekshirish, /report — holat haqida xabar berish, /safety — xavfsizlik qoidalari, /lang — til.",
    en: "I am here to help. Send a number, username, link, suspicious message text, or screenshot — I will check it. If you already sent a code, installed an app, or transferred money, use /panic.\n\nUseful commands: /check — check, /report — report a case, /safety — safety rules, /lang — language.",
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
    ru: "На кого жалуемся? Пришлите номер телефона, Telegram-username или ссылку. Если их нет, нажмите «Нет номера/ссылки».",
    uz: "Kim haqida shikoyat qilamiz? Telefon raqami, Telegram-username yoki havolani yuboring. Agar ular bo'lmasa, «Raqam/havola yo'q» tugmasini bosing.",
    en: "Who are you reporting? Send a phone number, Telegram username, or link. If you don't have one, tap “No number/link”.",
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
  report_value_invalid: {
    ru: "Здесь нужен номер телефона, Telegram-username или ссылка. Если их нет, нажмите «Нет номера/ссылки» — тогда я приму жалобу по описанию ситуации.",
    uz: "Bu yerda telefon raqami, Telegram-username yoki havola kerak. Agar ular bo'lmasa, «Raqam/havola yo'q» tugmasini bosing — shunda holat tavsifi bo'yicha qabul qilaman.",
    en: "This step needs a phone number, Telegram username, or link. If you don't have one, tap “No number/link” and I will accept the report from the situation description.",
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
    ru: "Я вижу, что это изображение, но не смог надёжно прочитать текст или QR. Пришлите текст из SMS/чата вручную, ссылку под QR или коротко опишите, что просят сделать.\n\nЕсли на картинке QR-код: открывайте его только когда уверены в источнике. Не вводите SMS-код, PIN, CVV, пароль или данные карты после перехода по QR.",
    uz: "Bu rasm ekanini ko‘ryapman, lekin matn yoki QR-kodni ishonchli o‘qiy olmadim. SMS/chat matnini qo‘lda yuboring, QR ostidagi havolani kiriting yoki sizdan nima so‘rashganini qisqacha yozing.\n\nAgar rasmda QR-kod bo‘lsa: manbaga ishonchingiz komil bo‘lgandagina oching. QR orqali o‘tgandan keyin SMS-kod, PIN, CVV, parol yoki karta ma’lumotlarini kiritmang.",
    en: "I can see this is an image, but I couldn’t reliably read the text or QR. Please paste the SMS/chat text, send the link under the QR, or briefly describe what you are asked to do.\n\nIf the image contains a QR code: open it only when you trust the source. Do not enter an SMS code, PIN, CVV, password, or card details after following a QR.",
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
    ru: "Пока не умею анализировать этот тип сообщения. Пришлите номер телефона, Telegram-username, ссылку, текст сообщения или изображение как фото/скриншот. Если проверяете QR — лучше отправьте ссылку, которая под ним открывается. Команды — /help.",
    uz: "Bu turdagi xabarni hozircha tahlil qila olmayman. Telefon raqami, Telegram-username, havola, xabar matni yoki rasm/skrinshot yuboring. QR tekshirayotgan bo‘lsangiz, uning ochadigan havolasini yuborgan yaxshi. Buyruqlar — /help.",
    en: "I can’t analyze this message type yet. Send a phone number, Telegram username, link, message text, or an image as a photo/screenshot. If you are checking a QR, it is better to send the link it opens. Commands — /help.",
  },

  // ── Out-of-scope content: voice/audio/video (R22.3) ───────────────────────
  out_of_scope: {
    ru: "Я пока не смотрю видео и не слушаю голосовые целиком, но могу разобрать главное из них.\n\nПришлите одно из этого:\n• ссылку из описания или комментария;\n• скрин кадра, где видны QR, username, реквизиты или обещание;\n• текст: что обещают и что просят сделать.\n\nЕсли в видео про ставки, крипту, «гарантированный доход», APK или вход по QR — лучше не платить и не вводить данные, пока не проверим.",
    uz: "Hozircha videoni to'liq ko'rmayman va ovozli xabarni eshitmayman, lekin undagi asosiy narsani tekshira olaman.\n\nShulardan birini yuboring:\n• tavsif yoki izohdagi havola;\n• QR, username, rekvizit yoki va'da ko'ringan kadr skrinshoti;\n• matn: nima va'da qilishdi va nima qilishni so'rashdi.\n\nVideoda stavka, kripto, «kafolatlangan daromad», APK yoki QR orqali kirish bo'lsa — tekshirmaguncha pul to'lamang va ma'lumot kiritmang.",
    en: "I cannot watch full videos or listen to voice messages yet, but I can check the useful evidence from them.\n\nSend one of these:\n• the link from the description or comment;\n• a screenshot frame with a QR, username, payment details, or promise;\n• a short text: what they promise and what they ask you to do.\n\nIf the video mentions betting, crypto, “guaranteed income”, APKs, or QR login, do not pay or enter data before we check it.",
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
    ru: "🔁 Проверить ещё",
    uz: "🔁 Yana tekshirish",
    en: "🔁 Check another",
  },
  btn_emergency: {
    ru: "🆘 Что делать срочно",
    uz: "🆘 Shoshilinch qadamlar",
    en: "🆘 Emergency steps",
  },
  btn_skip: {
    ru: "⏭ Пропустить",
    uz: "O‘tkazib yuborish",
    en: "⏭ Skip",
  },
  btn_report_no_value: {
    ru: "Нет номера/ссылки",
    uz: "Raqam/havola yo'q",
    en: "No number/link",
  },
  btn_report_retry: {
    ru: "Повторить отправку",
    uz: "Qayta yuborish",
    en: "Retry submit",
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
    ru: "✅ Есть точное совпадение в официальном справочнике: {org}.",
    uz: "✅ Rasmiy ma'lumotnomada aniq moslik bor: {org}.",
    en: "✅ Exact match in the official directory: {org}.",
  },
  verified_directory_details: {
    ru: "Контакт: {contact}. Назначение: {description}. Проверка: {level}.",
    uz: "Kontakt: {contact}. Vazifasi: {description}. Tekshiruv: {level}.",
    en: "Contact: {contact}. Used for: {description}. Verification: {level}.",
  },
  verified_level_high: {
    ru: "высокая",
    uz: "yuqori",
    en: "high",
  },
  verified_level_medium: {
    ru: "средняя",
    uz: "o'rta",
    en: "medium",
  },
  verified_spoofing_warning: {
    ru: "⚠️ Важно: это не доказывает, что входящий звонок безопасен. Номер на экране могут подменить. Если просят код, карту, приложение или перевод — положите трубку и перезвоните сами.",
    uz: "⚠️ Muhim: bu kiruvchi qo'ng'iroq xavfsizligini isbotlamaydi. Ekrandagi raqam soxtalashtirilishi mumkin. Kod, karta, ilova yoki pul so'rashsa — go'shakni qo'ying va o'zingiz qayta qo'ng'iroq qiling.",
    en: "⚠️ Important: this does not prove an incoming call is safe. Caller ID can be spoofed. If they ask for a code, card, app or transfer — hang up and call back yourself.",
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
    ru: "Сообщить",
    uz: "Xabar berish",
    en: "Report",
  },
  btn_quick_panic: {
    ru: "Экстренная помощь",
    uz: "Shoshilinch yordam",
    en: "Emergency",
  },
  btn_quick_safety: {
    ru: "Правила",
    uz: "Qoidalar",
    en: "Safety",
  },
  btn_quick_lang: {
    ru: "Язык",
    uz: "Til",
    en: "Language",
  },
  btn_quick_how: {
    ru: "Как работает",
    uz: "Qanday ishlaydi",
    en: "How it works",
  },

  // ── Live call copilot (Sprint 3.1) ────────────────────────────────────────
  live_call_header: {
    ru: "📞 Похоже, вы на подозрительном звонке.\n\nСейчас не спорьте и не отвечайте на вопросы. Просто скажите короткую фразу ниже и завершите звонок.",
    uz: "📞 Bu shubhali qo'ng'iroqqa o'xshaydi.\n\nHozir tortishmang va savollarga javob bermang. Quyidagi qisqa jumlani ayting va qo'ng'iroqni tugating.",
    en: "📞 This looks like a suspicious call.\n\nDo not argue or answer questions now. Say the short phrase below and end the call.",
  },
  live_call_hangup: {
    ru: "Скажите: «Я сам перезвоню по официальному номеру.»\n\nПотом положите трубку и нажмите «✅ Я положил трубку».\n\nНе называйте SMS-код, PIN, CVV, пароль или данные карты. Если давят «не кладите трубку» — это сильный признак мошенничества.",
    uz: "Ayting: «Rasmiy raqamga o'zim qo'ng'iroq qilaman.»\n\nKeyin go'shakni qo'ying va «✅ Go'shakni qo'ydim» tugmasini bosing.\n\nSMS-kod, PIN, CVV, parol yoki karta ma'lumotlarini aytmang. «Go'shakni qo'ymang» deb bosim qilishsa — bu firibgarlik belgisi.",
    en: "Say: “I will call back myself using the official number.”\n\nThen hang up and tap “✅ I hung up”.\n\nDo not share SMS codes, PIN, CVV, passwords, or card data. If they pressure you not to hang up, treat it as a strong scam signal.",
  },
  live_call_what_to_say: {
    ru: "💬 Скажите ровно это:\n\n«Я не обсуждаю деньги, коды и карты по входящему звонку. Я сам перезвоню по официальному номеру.»\n\nПосле этой фразы сразу завершите звонок. Не объясняйте причину: мошенники специально удерживают разговор.",
    uz: "💬 Aniq shuni ayting:\n\n«Kiruvchi qo'ng'iroqda pul, kod va kartani muhokama qilmayman. Rasmiy raqamga o'zim qo'ng'iroq qilaman.»\n\nShundan keyin darhol go'shakni qo'ying. Sabab tushuntirmang: firibgarlar suhbatni cho'zishga urinadi.",
    en: "💬 Say exactly this:\n\n“I do not discuss money, codes, or cards on an incoming call. I will call back myself using the official number.”\n\nThen end the call immediately. Do not explain: scammers try to keep you talking.",
  },
  live_call_tell_family: {
    ru: "👪 Позовите близкого как помощника, не как судью.\n\nСкопируйте или прочитайте ему:\n«Мне сейчас звонили от имени банка/службы поддержки и торопили. Я волнуюсь. Побудь со мной 5 минут и помоги набрать официальный номер банка.»\n\nНе пересылайте SMS-код, PIN, CVV, пароль или фото карты. Близкому можно показать переписку без кодов.",
    uz: "👪 Yaqiningizni yordamchi sifatida chaqiring.\n\nUnga shuni o'qing yoki yuboring:\n«Menga bank/qo'llab-quvvatlash nomidan qo'ng'iroq qilishdi va shoshirishdi. Hayajondaman. 5 daqiqa yonimda bo'lib, bankning rasmiy raqamini topishga yordam bering.»\n\nSMS-kod, PIN, CVV, parol yoki karta rasmini yubormang. Yozishmani kodlarsiz ko'rsatish mumkin.",
    en: "👪 Call someone trusted as a helper, not as a judge.\n\nRead or send them this:\n“Someone called claiming to be my bank/support and rushed me. I am worried. Please stay with me for 5 minutes and help me call the bank using an official number.”\n\nDo not forward SMS codes, PINs, CVVs, passwords, or card photos. You can show the chat without codes.",
  },
  btn_live_hangup: {
    ru: "✅ Я положил трубку",
    uz: "✅ Go'shakni qo'ydim",
    en: "✅ I hung up",
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

  // ── "Why" explanation button (Sprint 3.5) ─────────────────────────────────
  btn_why: {
    ru: "❓ Почему так?",
    uz: "❓ Nima uchun?",
    en: "❓ Why?",
  },
  why_explanation: {
    ru: "🧠 *Как я проверяю*\n\nЯ не угадываю и не называю людей мошенниками без оснований. Я ищу опасные признаки:\n\n1\uFE0F\u20E3 Просят SMS-код, PIN, CVV или пароль\n2\uFE0F\u20E3 Просят установить APK или «безопасное приложение»\n3\uFE0F\u20E3 Торопят, пугают или говорят «не кладите трубку»\n4\uFE0F\u20E3 Представляются банком в Telegram или звонят с неизвестного номера\n5\uFE0F\u20E3 Просят перевести деньги на «безопасный счёт» или по ссылке\n\nЕсли таких признаков нет — я пишу «недостаточно данных».\n\nВажно: даже если номер похож на официальный, его могут подменить. Лучше завершить разговор и перезвонить самому.\n\n🔒 Ваши данные не сохраняются в открытом виде.",
    uz: "🧠 *Qanday tekshiraman*\n\nMen taxmin qilmayman va asossiz hech kimni firibgar deb aytmayman. Men xavfli belgilarni qidiraman:\n\n1\uFE0F\u20E3 SMS-kod, PIN, CVV yoki parol so'rashyapti\n2\uFE0F\u20E3 APK yoki «xavfsiz ilova» o'rnatishni aytishyapti\n3\uFE0F\u20E3 Shoshiltiradi, qo'rqitadi yoki «go'shakni qo'ymang» deydi\n4\uFE0F\u20E3 Telegramda bank nomidan yozadi yoki noma'lum raqamdan qo'ng'iroq qiladi\n5\uFE0F\u20E3 «Xavfsiz hisob»ga yoki havola orqali pul o'tkazishni so'raydi\n\nAgar bunday belgilar topilmasa — «ma'lumot yetarli emas» deb yozaman.\n\nMuhim: raqam rasmiy ko'rinsa ham, uni soxtalashtirish mumkin. Suhbatni tugating va o'zingiz qayta qo'ng'iroq qiling.\n\n🔒 Ma'lumotlaringiz ochiq holda saqlanmaydi.",
    en: '🧠 *How I check*\n\nI don\'t guess and I don\'t call people scammers without reason. I look for dangerous signs:\n\n1\uFE0F\u20E3 Asking for an SMS code, PIN, CVV or password\n2\uFE0F\u20E3 Asking you to install an APK or a "secure app"\n3\uFE0F\u20E3 Rushing you, scaring you, or saying "don\'t hang up"\n4\uFE0F\u20E3 Claiming to be a bank via Telegram or calling from an unknown number\n5\uFE0F\u20E3 Asking you to transfer money to a "safe account" or via a link\n\nIf none of these signs are found, I say "not enough data."\n\nImportant: even if a number looks official, it can be spoofed. Better to end the call and ring back yourself.\n\n🔒 Your data is not stored in plain form.',
  },

  // ── Share advice + elder hints (Sprint 3.3 / 3.6) ────────────────────────
  btn_share_advice: {
    ru: "\u{1F4E4} \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0441\u043E\u0432\u0435\u0442 \u0440\u043E\u0434\u0441\u0442\u0432\u0435\u043D\u043D\u0438\u043A\u0443",
    uz: "\u{1F4E4} Yaqinga maslahat yuborish",
    en: "\u{1F4E4} Share advice with family",
  },
  share_advice_text: {
    ru: "\u{1F6E1} \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442 Ishonch Guard:\n\n\u0412\u0430\u043C \u043F\u0440\u0438\u0441\u043B\u0430\u043B\u0438 \u043F\u043E\u0434\u043E\u0437\u0440\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430:\n\n\u274C \u041D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0439\u0442\u0435 SMS-\u043A\u043E\u0434\u044B\n\u274C \u041D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\n\u274C \u041D\u0435 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u0435 \u0434\u0435\u043D\u044C\u0433\u0438\n\n\u2705 \u041F\u043E\u043B\u043E\u0436\u0438\u0442\u0435 \u0442\u0440\u0443\u0431\u043A\u0443 \u0438 \u043F\u0435\u0440\u0435\u0437\u0432\u043E\u043D\u0438\u0442\u0435 \u0432 \u0431\u0430\u043D\u043A \u0441\u0430\u043C\u0438.\n\n\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C: @scamguard_bot",
    uz: "\u{1F6E1} Ishonch Guard xabari:\n\nSizga shubhali xabar keldi. Iltimos:\n\n\u274C SMS-kodlarni yubormang\n\u274C Ilovalar o'rnatmang\n\u274C Pul o'tkazmang\n\n\u2705 Go'shakni qo'ying va bankka o'zingiz qo'ng'iroq qiling.\n\nTekshirish: @scamguard_bot",
    en: "\u{1F6E1} Message from Ishonch Guard:\n\nYou received a suspicious message. Please:\n\n\u274C Don't send SMS codes\n\u274C Don't install apps\n\u274C Don't transfer money\n\n\u2705 Hang up and call the bank yourself.\n\nCheck: @scamguard_bot",
  },

  // ── Deterministic fallback for hosted URLs without reason codes ────────────
  hosted_platform_explanation: {
    ru: "Этот адрес размещён на публичной платформе для веб-приложений. Сам домен не является признаком мошенничества, но владелец конкретной страницы не подтверждён.\n\nНе вводите OTP, PIN, CVV, пароли или данные карты, если не уверены в источнике ссылки.",
    uz: "Bu manzil veb-ilovalar uchun ommaviy platformada joylashgan. Domen o'zi firibgarlik belgisi emas, lekin aniq sahifa egasi tasdiqlanmagan.\n\nAgar havola manbasiga ishonchingiz komil bo'lmasa, OTP, PIN, CVV, parol yoki karta ma'lumotlarini kiritmang.",
    en: "This address is hosted on a public web application platform. The domain itself is not a sign of fraud, but the owner of this specific page is not verified.\n\nDo not enter OTP, PIN, CVV, passwords or card details unless you are sure about the source of the link.",
  },

  // ── Verdict lines (Result Message UX v2) ──────────────────────────────────
  verdict_safe: {
    ru: "⚪ Явных признаков скама не найдено",
    uz: "⚪ Aniq firibgarlik belgilari topilmadi",
    en: "⚪ No obvious scam signs found",
  },
  verdict_unknown: {
    ru: "🟡 Недостаточно данных для точной оценки",
    uz: "🟡 Aniq baho berish uchun ma'lumot yetarli emas",
    en: "🟡 Not enough data for a precise assessment",
  },
  verdict_suspicious: {
    ru: "⚠️ Есть подозрительные признаки",
    uz: "⚠️ Shubhali belgilar mavjud",
    en: "⚠️ Suspicious signs found",
  },
  verdict_high_risk: {
    ru: "🚨 Высокий риск мошенничества",
    uz: "🚨 Firibgarlik xavfi yuqori",
    en: "🚨 High fraud risk",
  },

  // ── Context-specific advice (Result Message UX v2) ────────────────────────
  advice_crypto_topic_only: {
    ru: "Я вижу тему крипто/инвестиций, но без ссылки или номера точный вывод невозможен.",
    uz: "Kripto/investitsiya mavzusini ko'ryapman, lekin havola yoki raqamsiz aniq xulosa chiqarib bo'lmaydi.",
    en: "I see a crypto/investment topic, but without a link or number a precise conclusion isn't possible.",
  },
  advice_send_more_context: {
    ru: "Пришлите ссылку, номер телефона или текст сообщения — тогда смогу дать точную оценку.",
    uz: "Havola, telefon raqami yoki xabar matnini yuboring — shunda aniq baho bera olaman.",
    en: "Send a link, phone number, or message text — then I can give a precise assessment.",
  },
  prompt_more_context: {
    ru: "Для точной оценки нужно больше данных. Пришлите ссылку, номер или полный текст сообщения.",
    uz: "Aniq baho berish uchun ko'proq ma'lumot kerak. Havola, raqam yoki to'liq xabar matnini yuboring.",
    en: "I need more data for a precise assessment. Send a link, number, or the full message text.",
  },
  brief_unknown_crypto: {
    ru: "Вижу тему крипто/инвестиций, но не вижу ссылки, номера, просьбы оплатить или кода. Пока это не похоже на явный скам.",
    uz: "Kripto/investitsiya mavzusini ko'ryapman, lekin havola, raqam, to'lov yoki kod so'rovi ko'rinmayapti. Hozircha bu aniq firibgarlikka o'xshamaydi.",
    en: "I see a crypto/investment topic, but no link, number, payment request, or code request. So far this is not an obvious scam.",
  },
  brief_unknown_qr_menu: {
    ru: "Похоже на меню, акцию или информационный QR. Сам QR не опасен; риск появляется, если после открытия просят оплату, вход, код или карту.",
    uz: "Bu menyu, aksiya yoki ma'lumot beruvchi QRga o'xshaydi. QRning o'zi xavfli emas; xavf to'lov, login, kod yoki karta so'ralganda paydo bo'ladi.",
    en: "This looks like a menu, promo, or informational QR. A QR alone is not dangerous; risk starts if it asks for payment, login, a code, or card data.",
  },
  brief_unknown_delivery: {
    ru: "Похоже на уведомление о доставке или заказе. Без ссылки, оплаты, APK или кода это не выглядит как явный скам.",
    uz: "Bu yetkazib berish yoki buyurtma xabariga o'xshaydi. Havola, to'lov, APK yoki kod so'rovisiz bu aniq firibgarlikka o'xshamaydi.",
    en: "This looks like a delivery or order notice. Without a link, payment, APK, or code request, it does not look like an obvious scam.",
  },
  brief_unknown_phone: {
    ru: "Похоже на обычный узбекский номер. Я не могу назвать владельца без официального источника. Риск зависит от того, что просили во время звонка.",
    uz: "Bu oddiy O'zbekiston raqamiga o'xshaydi. Rasmiy manbasiz egasini ayta olmayman. Xavf qo'ng'iroqda sizdan nima so'ralganiga bog'liq.",
    en: "This looks like a regular Uzbek phone number. I cannot name the owner without an official source. Risk depends on what they asked during the call.",
  },
  prompt_more_context_crypto: {
    ru: "Для точной проверки пришлите ссылку, username продавца или текст обещаний: доходность, предоплата, вывод средств.",
    uz: "Aniq tekshirish uchun havola, sotuvchi username'i yoki va'dalar matnini yuboring: daromad, oldindan to'lov, pul yechish.",
    en: "For a precise check, send the link, seller username, or offer text: returns, prepayment, withdrawals.",
  },
  prompt_more_context_qr_menu: {
    ru: "Если после QR открылась страница с оплатой, логином, SMS-кодом или картой — пришлите адрес или скрин следующего экрана.",
    uz: "QRdan keyin to'lov, login, SMS-kod yoki karta sahifasi ochilsa, manzilni yoki keyingi ekran skrinini yuboring.",
    en: "If the QR opens a payment, login, SMS-code, or card page, send the address or a screenshot of the next screen.",
  },
  prompt_more_context_delivery: {
    ru: "Если в SMS есть ссылка, просьба оплатить или назвать код — пришлите её отдельно.",
    uz: "SMSda havola, to'lov yoki kod so'rovi bo'lsa, uni alohida yuboring.",
    en: "If the SMS has a link, payment request, or code request, send it separately.",
  },
  prompt_more_context_phone: {
    ru: "Напишите, что просили: SMS-код, данные карты, перевод, APK, QR-вход или удалённый доступ.",
    uz: "Nima so'rashganini yozing: SMS-kod, karta ma'lumoti, pul o'tkazma, APK, QR-login yoki masofaviy kirish.",
    en: "Write what they asked for: SMS code, card data, transfer, APK, QR login, or remote access.",
  },

  // ── Section titles (Result Message UX v2) ─────────────────────────────────
  section_brief: {
    ru: "Кратко",
    uz: "Qisqacha",
    en: "Brief",
  },
  section_reasons: {
    ru: "Причины",
    uz: "Sabablar",
    en: "Reasons",
  },
  section_noticed: {
    ru: "Что заметил",
    uz: "Nimani payqadim",
    en: "What I noticed",
  },
  section_action_now: {
    ru: "Что сделать",
    uz: "Nima qilish",
    en: "What to do",
  },
  section_safe_steps: {
    ru: "Что делать",
    uz: "Nima qilish",
    en: "What to do",
  },
  section_why_danger: {
    ru: "Почему опасно",
    uz: "Xavf sababi",
    en: "Why dangerous",
  },
  section_where_report: {
    ru: "Куда обратиться",
    uz: "Kimga murojaat",
    en: "Where to report",
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
