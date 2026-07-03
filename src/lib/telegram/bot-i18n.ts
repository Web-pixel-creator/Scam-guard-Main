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
    ru: "🛡 Ishonch Guard\n━━━━━━━━━━━━━━━━━━━━\n\nЯ рядом: помогу спокойно проверить номер, ссылку, username, скриншот, голосовое или сообщение.\n\nЕсли вам звонят прямо сейчас — нажмите «МНЕ ЗВОНЯТ СЕЙЧАС». Если уже сообщили код, установили APK или переводите деньги — нажмите «Помощь сейчас».\n\nВ любом чате можно набрать @scamguard_bot и вставить номер или ссылку — проверка появится прямо там.",
    uz: "🛡 Ishonch Guard\n━━━━━━━━━━━━━━━━━━━━\n\nMen yoningizdaman: raqam, havola, username, skrinshot, ovozli xabar yoki matnni xotirjam tekshirishga yordam beraman.\n\nAgar hozir qo'ng'iroq qilishayotgan bo'lsa — «HOZIR QO'NG'IROQ»ni bosing. Agar kod yuborgan, APK o'rnatgan yoki pul o'tkazayotgan bo'lsangiz — «Hozir yordam»ni bosing.\n\nIstalgan chatda @scamguard_bot yozib, raqam yoki havolani kiriting — tekshiruv shu yerda chiqadi.",
    en: "🛡 Ishonch Guard\n━━━━━━━━━━━━━━━━━━━━\n\nI am with you: send a number, link, username, screenshot, voice note, or message and I will help you choose a safe next step.\n\nIf someone is calling right now — tap “CALLING ME NOW”. If you already sent a code, installed an APK, or are transferring money — tap “Help now”.\n\nIn any chat, type @scamguard_bot and paste a number or link — the check will appear right there.",
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
    ru: "Что можно прислать на проверку:\n• номер телефона;\n• Telegram-username или ссылку;\n• ссылку на сайт или на APK-файл;\n• текст подозрительного сообщения;\n• скриншот переписки;\n• карточку контакта;\n• описание ситуации словами.\n\nДля нескольких сообщений переписки используйте /conversation.\n\nПросто отправьте это сообщением — я отвечу оценкой риска. Команды: /help.",
    uz: "Tekshirish uchun nima yuborish mumkin:\n• telefon raqami;\n• Telegram-username yoki havola;\n• sayt yoki APK-fayl havolasi;\n• shubhali xabar matni;\n• yozishma skrinshoti;\n• kontakt kartasi;\n• vaziyatni o‘z so‘zlaringiz bilan tavsiflash.\n\nBir nechta yozishma xabari uchun /conversation dan foydalaning.\n\nShunchaki xabar qilib yuboring — men xavf bahosini qaytaraman. Buyruqlar: /help.",
    en: "What you can send for a check:\n• a phone number;\n• a Telegram username or link;\n• a website or APK file link;\n• the text of a suspicious message;\n• a screenshot of a chat;\n• a contact card;\n• a description of the situation in your own words.\n\nFor several chat messages, use /conversation.\n\nJust send it as a message — I’ll reply with a risk assessment. Commands: /help.",
  },

  // ── /check (R4.1) ─────────────────────────────────────────────────────────
  check_prompt: {
    ru: "Пришлите новый объект проверки: номер, username, ссылку, текст сообщения или скриншот.",
    uz: "Yangi tekshiruv uchun yuboring: raqam, username, havola, xabar matni yoki skrinshot.",
    en: "Send a new item to check: a number, username, link, message text, or screenshot.",
  },
  analyzing: {
    ru: "Анализирую…",
    uz: "Tahlil qilinmoqda…",
    en: "Analyzing…",
  },
  check_processing: {
    ru: "Проверяю. Это может занять несколько секунд.",
    uz: "Tekshiryapman. Bu bir necha soniya olishi mumkin.",
    en: "Checking. This may take a few seconds.",
  },
  conversation_prompt: {
    ru: "🧵 Проверка переписки\n\nПришлите 2–{max} сообщений из переписки по одному. Я буду собирать только безопасные признаки, не сам текст.\n\nКогда закончите — нажмите «Анализировать» или напишите «готово».",
    uz: "🧵 Yozishmani tekshirish\n\nYozishmadan 2–{max} ta xabarni bittadan yuboring. Men matnning o'zini emas, faqat xavfsiz belgilarni yig'aman.\n\nTugatgach — «Tahlil qilish»ni bosing yoki «tayyor» deb yozing.",
    en: "🧵 Conversation check\n\nSend 2–{max} chat messages one by one. I will collect only safe signals, not the raw text.\n\nWhen finished, tap “Analyze” or type “done”.",
  },
  conversation_added: {
    ru: "Добавил сообщение {count}/{max}. Пришлите следующее или нажмите «Анализировать».",
    uz: "{count}/{max} xabar qo'shildi. Keyingisini yuboring yoki «Tahlil qilish»ni bosing.",
    en: "Added message {count}/{max}. Send the next one or tap “Analyze”.",
  },
  conversation_empty: {
    ru: "Не вижу текста сообщения. Пришлите текст из переписки или нажмите «Отмена».",
    uz: "Xabar matni ko'rinmayapti. Yozishma matnini yuboring yoki «Bekor qilish»ni bosing.",
    en: "I do not see message text. Send chat text or tap “Cancel”.",
  },
  conversation_too_long: {
    ru: "Это слишком длинно для короткой проверки переписки. Пришлите более короткий фрагмент или самое подозрительное сообщение.",
    uz: "Bu qisqa yozishma tekshiruvi uchun juda uzun. Qisqaroq parcha yoki eng shubhali xabarni yuboring.",
    en: "This is too long for a short conversation check. Send a shorter fragment or the most suspicious message.",
  },
  conversation_too_many: {
    ru: "Лимит {max} сообщений уже достигнут. Нажмите «Анализировать» или «Отмена».",
    uz: "{max} ta xabar limiti tugadi. «Tahlil qilish» yoki «Bekor qilish»ni bosing.",
    en: "The {max}-message limit is reached. Tap “Analyze” or “Cancel”.",
  },
  conversation_not_enough: {
    ru: "Для проверки переписки нужно минимум 2 сообщения. Пришлите ещё одно или нажмите «Отмена».",
    uz: "Yozishmani tekshirish uchun kamida 2 ta xabar kerak. Yana bitta yuboring yoki «Bekor qilish»ni bosing.",
    en: "I need at least 2 messages to check a conversation. Send one more or tap “Cancel”.",
  },
  conversation_expired: {
    ru: "Проверка переписки истекла. Я очистил черновик. Начните заново через /conversation.",
    uz: "Yozishma tekshiruvi muddati tugadi. Qoralama tozalandi. /conversation orqali qayta boshlang.",
    en: "The conversation check expired. I cleared the draft. Start again with /conversation.",
  },
  conversation_cancelled: {
    ru: "Ок, проверку переписки отменил. Можно прислать отдельный номер, ссылку, скриншот или сообщение.",
    uz: "Yaxshi, yozishma tekshiruvi bekor qilindi. Alohida raqam, havola, skrinshot yoki xabar yuborishingiz mumkin.",
    en: "OK, conversation check cancelled. You can send a single number, link, screenshot, or message.",
  },

  // ── /help: command list (R3.1) ───────────────────────────────────────────
  help: {
    ru: "📋 Команды бота\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Главное меню\n🧭 /menu — Главное меню\n📞 /call — Помощь во время звонка\n🔍 /check — Проверить номер или ссылку\n🧵 /conversation — Проверить несколько сообщений переписки\n🎧 /trainer — Тренажёр звонков\n📢 /report — Сообщить о случае\n🧾 /appeal — Исправить ошибочную запись\n🆘 /panic — Экстренная помощь\n👪 /family — Подключить близкого\n📰 /digest — Схемы недели\n🚨 /emergency — Срочные шаги\n🛡 /safety — Правила безопасности\n🌐 /lang — Сменить язык\n\n💡 Можно просто прислать сообщение без команды — я проверю его.",
    uz: "📋 Bot buyruqlari\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Asosiy menyu\n🧭 /menu — Asosiy menyu\n📞 /call — Qo'ng'iroq paytida yordam\n🔍 /check — Raqam yoki havolani tekshirish\n🧵 /conversation — Bir nechta yozishma xabarini tekshirish\n🎧 /trainer — Qo'ng'iroq treneri\n📢 /report — Holat haqida xabar berish\n🧾 /appeal — Xato yozuvni tuzatish\n🆘 /panic — Shoshilinch yordam\n👪 /family — Yaqin insonni ulash\n📰 /digest — Haftalik sxemalar\n🚨 /emergency — Shoshilinch qadamlar\n🛡 /safety — Xavfsizlik qoidalari\n🌐 /lang — Tilni o'zgartirish\n\n💡 Buyruqsiz ham xabar yuboring — men tekshiraman.",
    en: "📋 Bot Commands\n━━━━━━━━━━━━━━━━━━━━\n\n🚀 /start — Main menu\n🧭 /menu — Main menu\n📞 /call — Help during a call\n🔍 /check — Check a number or link\n🧵 /conversation — Check several chat messages\n🎧 /trainer — Call trainer\n📢 /report — Report an incident\n🧾 /appeal — Correct a wrong record\n🆘 /panic — Emergency help\n👪 /family — Link trusted person\n📰 /digest — Weekly scam digest\n🚨 /emergency — Urgent steps\n🛡 /safety — Safety rules\n🌐 /lang — Change language\n\n💡 You can also just send a message — I'll check it.",
  },

  appeal_help: {
    ru: "🧾 Исправить запись\n\nЭто не новая жалоба на мошенника. Используйте эту форму, если ваш номер, Telegram-аккаунт, ссылка или APK уже получили публичную метку Ishonch Guard и вы считаете, что запись ошибочная или устарела.\n\nДля нового случая нажмите «Сообщить о случае». Для исправления откройте форму и коротко объясните, почему запись нужно пересмотреть.\n\nНе отправляйте SMS-коды, PIN, CVV, пароли, seed-фразы или фото документов.",
    uz: "🧾 Yozuvni tuzatish\n\nBu yangi firibgarlik shikoyati emas. Raqamingiz, Telegram akkauntingiz, havolangiz yoki APK havolangiz Ishonch Guard'da ommaviy belgi olgan bo'lsa va yozuv xato yoki eskirgan deb hisoblasangiz, shu formadan foydalaning.\n\nYangi holat uchun «Hodisa haqida xabar berish»ni bosing. Tuzatish uchun formani oching va nega yozuv qayta ko'rilishi kerakligini qisqa yozing.\n\nSMS-kod, PIN, CVV, parol, seed-fraza yoki hujjat fotosini yubormang.",
    en: "🧾 Correct a record\n\nThis is not a new scam report. Use this form only if your number, Telegram account, link, or APK URL already has a public Ishonch Guard label and you believe the record is wrong or outdated.\n\nFor a new incident, tap “Report an incident”. To correct a record, open the form and briefly explain why it should be reviewed.\n\nDo not send SMS codes, PINs, CVVs, passwords, seed phrases, or document photos.",
  },
  btn_open_appeal: {
    ru: "🧾 Открыть форму исправления",
    uz: "🧾 Tuzatish formasini ochish",
    en: "🧾 Open correction form",
  },

  // ── Meta-intent answers: questions TO the bot, not scam content ───────────
  meta_how_to_use: {
    ru: "Можно просто отправить мне то, что вызывает сомнение: номер телефона, Telegram-username, ссылку, текст сообщения или скриншот. Если это QR-код, лучше пришлите ссылку, которая открывается после сканирования, или опишите, что просят сделать.\n\nЯ отвечу уровнем риска и короткими шагами. Команды: /check, /report, /panic, /family, /safety.",
    uz: "Shubhali narsani shunchaki yuboring: telefon raqami, Telegram-username, havola, xabar matni yoki skrinshot. Agar bu QR-kod bo'lsa, skanerdan keyin ochiladigan havolani yuboring yoki sizdan nima so'ralganini yozing.\n\nMen xavf darajasi va qisqa qadamlar bilan javob beraman. Buyruqlar: /check, /report, /panic, /family, /safety.",
    en: "Just send what feels suspicious: a phone number, Telegram username, link, message text, or screenshot. If it is a QR code, it is better to send the link it opens or describe what you are asked to do.\n\nI will reply with a risk level and short next steps. Commands: /check, /report, /panic, /family, /safety.",
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
    ru: "Я рядом. Отправьте номер, username, ссылку, текст подозрительного сообщения или скриншот — я проверю. Если вы уже сообщили код, установили приложение или перевели деньги, нажмите /panic.\n\nПолезные команды: /check — проверка, /report — сообщить о случае, /family — подключить близкого, /safety — правила безопасности, /lang — язык.",
    uz: "Men yordam beraman. Raqam, username, havola, shubhali xabar matni yoki skrinshot yuboring — tekshiraman. Agar kod yuborgan, ilova o'rnatgan yoki pul o'tkazgan bo'lsangiz, /panic ni bosing.\n\nFoydali buyruqlar: /check — tekshirish, /report — holat haqida xabar berish, /family — yaqin insonni ulash, /safety — xavfsizlik qoidalari, /lang — til.",
    en: "I am here to help. Send a number, username, link, suspicious message text, or screenshot — I will check it. If you already sent a code, installed an app, or transferred money, use /panic.\n\nUseful commands: /check — check, /report — report a case, /family — link trusted person, /safety — safety rules, /lang — language.",
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
    ru: "Кого или что нужно передать модератору? Пришлите номер телефона, Telegram-username или ссылку. Если конкретного контакта нет, нажмите «Нет номера/ссылки».",
    uz: "Moderatorga kim yoki nimani yuboramiz? Telefon raqami, Telegram-username yoki havolani yuboring. Aniq kontakt bo'lmasa, «Raqam/havola yo'q» tugmasini bosing.",
    en: "What should I send to moderation? Send a phone number, Telegram username, or link. If there is no concrete contact, tap “No number/link”.",
  },
  report_ask_description: {
    ru: "Опишите в 1-2 фразах: что произошло и что просили сделать — код, пароль, карту, перевод, APK или переход по ссылке. Скриншот можно отправить: я добавлю только безопасное краткое описание.",
    uz: "1-2 jumlada yozing: nima bo'ldi va nima so'rashdi — kod, parol, karta, pul o'tkazish, APK yoki havolaga o'tish. Skrinshot yuborishingiz mumkin: men faqat xavfsiz qisqa tavsif qo'shaman.",
    en: "Describe in 1-2 sentences what happened and what they asked for — a code, password, card, transfer, APK, or link. You may send a screenshot: I will add only a safe short summary.",
  },
  report_ask_scam_type: {
    ru: "Если знаете тип схемы, напишите коротко: фейковый банк, OTP, кредит, доставка, инвестиции. Если не уверены — нажмите «Пропустить».",
    uz: "Sxema turini bilsangiz, qisqacha yozing: soxta bank, OTP, kredit, yetkazib berish, investitsiya. Ishonchingiz komil bo'lmasa — «O'tkazib yuborish» tugmasini bosing.",
    en: "If you know the scheme type, write it briefly: fake bank, OTP, loan, delivery, investments. If unsure, tap “Skip”.",
  },
  report_ask_city: {
    ru: "Город или регион? Это необязательно — можно нажать «Пропустить».",
    uz: "Shahar yoki hudud? Bu majburiy emas — «O'tkazib yuborish» mumkin.",
    en: "City or region? This is optional — you can tap “Skip”.",
  },
  report_ask_amount: {
    ru: "Был ли денежный ущерб? Если да — напишите сумму в UZS. Если денег не потеряли, нажмите «Пропустить» или напишите «нет».",
    uz: "Pul yo'qotildimi? Ha bo'lsa — UZS miqdorini yozing. Pul yo'qotilmagan bo'lsa, «O'tkazib yuborish» tugmasini bosing yoki «yo'q» deb yozing.",
    en: "Was any money lost? If yes, enter the amount in UZS. If no money was lost, tap “Skip” or type “no”.",
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
    ru: "✅ Спасибо, сигнал принят.\n\nВы помогли предупредить других людей. Мы проверим сообщение вручную: публичная метка появится только после модерации. Если похожий сигнал уже был, ваш помогает поднять приоритет проверки.\n\nМодератор получил только безопасную краткую сводку — без кодов, карт, скриншотов и полных контактов.",
    uz: "✅ Rahmat, signal qabul qilindi.\n\nSiz boshqa odamlarni ogohlantirishga yordam berdingiz. Xabar qo'lda tekshiriladi: ommaviy belgi faqat moderatsiyadan keyin chiqadi. Agar shunga o'xshash signal oldin ham bo'lgan bo'lsa, sizniki tekshiruv ustuvorligini oshirishga yordam beradi.\n\nModerator faqat xavfsiz qisqa xulosa oldi — kodlar, kartalar, skrinshotlar va to'liq kontaktlarsiz.",
    en: "✅ Thank you, the signal was received.\n\nYou helped warn other people. We will review it manually: a public label appears only after moderation. If a similar signal already exists, yours helps raise review priority.\n\nThe moderator received only a safe short summary — without codes, cards, screenshots, or full contacts.",
  },
  report_error: {
    ru: "Не удалось отправить жалобу. Попробуйте, пожалуйста, ещё раз чуть позже.",
    uz: "Shikoyatni yuborib bo‘lmadi. Iltimos, birozdan so‘ng qayta urinib ko‘ring.",
    en: "Couldn’t submit the report. Please try again a little later.",
  },
  report_image_added: {
    ru: "Скриншот добавлен к жалобе как краткое описание:\n\n{summary}\n\nСамо изображение я не сохраняю.",
    uz: "Skrinshot shikoyatga qisqa tavsif sifatida qo‘shildi:\n\n{summary}\n\nRasmning o‘zini saqlamayman.",
    en: "Screenshot added to the report as a short summary:\n\n{summary}\n\nI do not store the image itself.",
  },
  report_image_unreadable: {
    ru: "Я получил скриншот, но не смог надёжно извлечь суть для жалобы. Напишите 1-2 фразы: что просили сделать и через что с вами связались.",
    uz: "Skrinshotni oldim, lekin shikoyat uchun mazmunini ishonchli ajrata olmadim. 1-2 jumla yozing: nima qilishni so‘rashdi va siz bilan qayerda bog‘lanishdi.",
    en: "I received the screenshot, but could not reliably extract the incident details. Type 1-2 sentences: what they asked you to do and where they contacted you.",
  },

  // ── Rate limit (R10.2) — {seconds} placeholder filled via bt(..., { seconds }) ─
  rate_limited: {
    ru: "Слишком много запросов. Подождите {seconds} сек. и попробуйте снова.",
    uz: "So‘rovlar juda ko‘p. {seconds} soniya kuting va qayta urinib ko‘ring.",
    en: "Too many requests. Please wait {seconds} sec. and try again.",
  },
  voice_stt_limit_reached: {
    ru: "🎧 Лимит распознавания голосовых на сегодня закончился. Это защита от спама и лишних расходов.\n\nЯ всё равно рядом: напишите коротко, что обещают и что просят сделать, или нажмите «Помощь сейчас», если вы уже отправили код, перевели деньги, установили приложение или вам звонят.",
    uz: "🎧 Bugungi ovozli xabarlarni tanish limiti tugadi. Bu spam va ortiqcha xarajatlardan himoya.\n\nMen baribir yoningizdaman: qisqa yozing, nima va'da qilishdi va nima so'rashyapti, yoki kod yuborgan, pul o'tkazgan, ilova o'rnatgan yoki hozir qo'ng'iroqda bo'lsangiz «Hozir yordam»ni bosing.",
    en: "🎧 Today's voice transcription limit is used up. This protects the bot from spam and extra costs.\n\nI am still here: briefly type what they promise and what they ask you to do, or tap “Help now” if you already sent a code, transferred money, installed an app, or are on a call.",
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
  voice_too_large: {
    ru: "Голосовое или аудио слишком большое. Пришлите короткое сообщение до 60 секунд или напишите 1-2 фразы: что обещают и что просят сделать.",
    uz: "Ovozli xabar yoki audio juda katta. 60 soniyagacha qisqa xabar yuboring yoki 1-2 jumla yozing: nima va'da qilishdi va nima so'rashyapti.",
    en: "The voice note or audio file is too large. Send a short message up to 60 seconds, or type 1-2 sentences: what they promise and what they ask you to do.",
  },
  voice_processing: {
    ru: "🎧 Распознаю голос. Обычно это занимает до 10 секунд. Если текст получится неточным, нажмите «Исправить текст».",
    uz: "🎧 Ovozni matnga aylantiryapman. Odatda bu 10 soniyagacha davom etadi. Matn noto'g'ri chiqsa, «Matnni tuzatish» tugmasini bosing.",
    en: "🎧 Transcribing the voice note. This usually takes up to 10 seconds. If the text is wrong, tap “Correct text”.",
  },
  voice_transcription_failed: {
    ru: "Я пока не смог надёжно разобрать голосовое или аудио.\n\nНапишите коротко: что вам обещают и что просят сделать — код, карту, перевод, APK, QR или ссылку.\n\nЕсли вы уже отправили код, установили приложение или сейчас на звонке — нажмите «Что делать срочно».",
    uz: "Ovozli xabar yoki audioni ishonchli tushuna olmadim.\n\nQisqa yozing: sizga nima va'da qilishdi va nima so'rashyapti — kod, karta, pul o'tkazish, APK, QR yoki havola.\n\nAgar kod yuborgan, ilova o'rnatgan yoki hozir qo'ng'iroqda bo'lsangiz — «Shoshilinch qadamlar» tugmasini bosing.",
    en: "I could not reliably understand the voice note or audio file yet.\n\nBriefly type what they promise and what they ask you to do: code, card, transfer, APK, QR, or link.\n\nIf you already sent a code, installed an app, or are on a call right now, tap “Emergency steps”.",
  },
  voice_transcript_uncertain: {
    ru: "Я распознал голос, но текста мало для честной проверки.\n\nНажмите «Исправить текст» или напишите одним сообщением: что обещают и что просят сделать.\n\nЕсли уже отправили код, установили APK или сейчас на звонке — нажмите «Что делать срочно».",
    uz: "Ovozni o'qidim, lekin halol tekshiruv uchun matn juda kam.\n\n«Matnni tuzatish» tugmasini bosing yoki bitta xabarda yozing: nima va'da qilishdi va nima so'rashyapti.\n\nAgar kod yuborgan, APK o'rnatgan yoki hozir qo'ng'iroqda bo'lsangiz — «Shoshilinch qadamlar» tugmasini bosing.",
    en: "I recognized the voice, but there is too little text for a fair check.\n\nTap “Correct text” or send one message: what they promise and what they ask you to do.\n\nIf you already sent a code, installed an APK, or are on a call right now, tap “Emergency steps”.",
  },
  voice_correct_button: {
    ru: "✏️ Исправить текст",
    uz: "✏️ Matnni tuzatish",
    en: "✏️ Correct text",
  },
  voice_correction_prompt: {
    ru: "Пришлите исправленный текст голосового одним сообщением. Я проверю уже его, без повторного распознавания голоса.",
    uz: "Ovozli xabarning tuzatilgan matnini bitta xabar qilib yuboring. Men uni tekshiraman, ovozni qayta tanimayman.",
    en: "Send the corrected voice transcript as one message. I will check that text without transcribing the voice again.",
  },
  ocr_failed: {
    ru: "Я не смог надёжно прочитать текст или QR на картинке. Я не буду угадывать риск по размытому кадру.\n\nВыберите ниже, на что это похоже, или пришлите: текст из SMS/чата, ссылку из QR, крупный скрин нужного места.",
    uz: "Rasmdagi matn yoki QRni ishonchli o‘qiy olmadim. Xira kadr bo‘yicha xavfni taxmin qilmayman.\n\nQuyida nimaga o‘xshashini tanlang yoki yuboring: SMS/chat matni, QR havolasi, kerakli joyning yaqinroq skrinshoti.",
    en: "I could not reliably read the text or QR in the image. I will not guess risk from a blurry frame.\n\nTap what it looks like below, or send: the SMS/chat text, the QR link, or a closer screenshot of the important part.",
  },
  ocr_failed_repeat: {
    ru: "Ещё одно изображение, но текст или QR всё ещё не читаются.\n\nВыберите тип ниже или пришлите крупный скрин: QR, username, реквизиты, ссылку или обещание выгоды.",
    uz: "Yana bir rasm oldim, lekin matn yoki QR hali ham yetarlicha aniq o‘qilmadi.\n\nQuyida sxema turini tanlang yoki QR, username, rekvizit, havola yoki foyda va’dasi ko‘ringan yaqinroq skrin yuboring.",
    en: "I received another image, but the text or QR is still not readable enough.\n\nTap the scheme type below, or send a closer screenshot showing the QR, username, payment details, link, or promised benefit.",
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
  phone_reputation_reports: {
    ru: "Источник: подтверждённые модераторами жалобы Ishonch Guard. Количество: {count} подтверждённых жалоб. Уверенность: {confidence}.",
    uz: "Manba: Ishonch Guard moderatorlari tasdiqlagan shikoyatlar. Soni: {count} ta tasdiqlangan shikoyat. Ishonchlilik: {confidence}.",
    en: "Source: Ishonch Guard moderator-confirmed reports. Count: {count} confirmed report(s). Confidence: {confidence}.",
  },
  phone_reputation_limit: {
    ru: "Не включает непроверенные жалобы, владельца номера, данные оператора или скрытые внешние метки.",
    uz: "Tekshirilmagan shikoyatlar, raqam egasi, operator ma'lumoti yoki yashirin tashqi belgilar kiritilmaydi.",
    en: "Does not include unverified reports, number owner data, carrier data, or hidden external labels.",
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

  // ── Out-of-scope content: long audio/video (R22.3) ───────────────────────
  out_of_scope: {
    ru: "Я не смотрю весь ролик как человек. Если Telegram даёт кадр-превью, я проверяю его автоматически; если вы видите это сообщение — кадра, текста или ссылки не хватило.\n\nЧто прислать вместо этого:\n• ссылку из описания, комментария или кнопки;\n• скрин кадра, где видны QR, username, реквизиты или обещание;\n• короткий голос или аудиофайл до 60 секунд отдельным сообщением;\n• текст: что обещают и что просят сделать.\n\nЕсли в видео про ставки, крипту, «гарантированный доход», APK или вход по QR — не платите и не вводите данные, пока не проверим.",
    uz: "Men rolikni odamdek boshidan oxirigacha ko'ra olmayman. Agar Telegram kadr-preview bersa, uni avtomatik tekshiraman; agar shu xabar chiqsa — kadr, matn yoki havola yetarli bo'lmadi.\n\nBuning o'rniga yuboring:\n• tavsif, izoh yoki tugmadagi havola;\n• QR, username, rekvizit yoki va'da ko'ringan kadr skrinshoti;\n• 60 soniyagacha qisqa ovoz/audio alohida xabar sifatida;\n• matn: nima va'da qilishdi va nima qilishni so'rashdi.\n\nVideoda stavka, kripto, «kafolatlangan daromad», APK yoki QR orqali kirish bo'lsa — tekshirmaguncha pul to'lamang va ma'lumot kiritmang.",
    en: "I cannot watch a full video like a person. If Telegram provides a preview frame, I check it automatically; if you see this message, the frame, text, or link was not enough.\n\nSend one of these instead:\n• the link from the description, comment, or button;\n• a screenshot frame with a QR, username, payment details, or promise;\n• a short voice/audio message up to 60 seconds as a separate message;\n• a short text: what they promise and what they ask you to do.\n\nIf the video mentions betting, crypto, “guaranteed income”, APKs, or QR login, do not pay or enter data before we check it.",
  },
  media_capture_help: {
    ru: "📸 Как прислать видео на проверку\n\nЯ могу проверить видимый кадр-превью, но не весь ролик. Чтобы вывод был точнее:\n• поставьте видео на паузу и пришлите скрин кадра с QR, username, ссылкой, реквизитами или обещанием дохода;\n• скопируйте ссылку из описания, комментария или кнопки под видео;\n• коротко напишите: что обещают и что просят сделать — оплатить, подписаться, ввести код, карту или установить приложение;\n• если это речь — отправьте короткое голосовое/аудио до 60 секунд отдельным сообщением.\n\nДо проверки не платите за «прогнозы», VIP-доступ, крипто-доход и не вводите коды/данные карты.",
    uz: "📸 Videoni tekshirish uchun qanday yuborish kerak\n\nMen ko'rinadigan preview-kadrni tekshira olaman, lekin butun rolikni emas. Aniqlik uchun:\n• videoni pauza qiling va QR, username, havola, rekvizit yoki daromad va'dasi ko'ringan kadr skrinini yuboring;\n• tavsif, izoh yoki video ostidagi tugmadan havolani ko'chiring;\n• qisqa yozing: nima va'da qilishdi va nima so'rashyapti — to'lov, obuna, kod, karta yoki ilova o'rnatish;\n• agar bu nutq bo'lsa — 60 soniyagacha qisqa ovoz/audio alohida xabar sifatida yuboring.\n\nTekshirmaguncha «prognoz», VIP kirish, kripto daromad uchun pul to'lamang va kod/karta ma'lumotlarini kiritmang.",
    en: "📸 How to send a video for checking\n\nI can check the visible preview frame, but not the whole clip. For a more precise result:\n• pause the video and send a screenshot frame with a QR, username, link, payment details, or income promise;\n• copy the link from the description, comment, or button under the video;\n• briefly write what they promise and what they ask you to do: pay, subscribe, enter a code/card, or install an app;\n• if it is speech, send a short voice/audio message up to 60 seconds separately.\n\nBefore checking, do not pay for predictions, VIP access, crypto income, or enter codes/card data.",
  },
  btn_image_triage_gift: {
    ru: "🎁 NFT/Stars/подарок",
    uz: "🎁 NFT/Stars/sovg'a",
    en: "🎁 NFT/Stars/gift",
  },
  btn_image_triage_casino: {
    ru: "🎰 Казино/фриспины",
    uz: "🎰 Kazino/frispin",
    en: "🎰 Casino/free spins",
  },
  btn_image_triage_wallet: {
    ru: "💼 TON/Wallet",
    uz: "💼 TON/Hamyon",
    en: "💼 TON/Wallet",
  },
  btn_image_triage_bank: {
    ru: "🏦 Банк/код",
    uz: "🏦 Bank/kod",
    en: "🏦 Bank/code",
  },
  btn_image_triage_telegram_profile: {
    ru: "👤 Профиль/чат",
    uz: "👤 Profil/chat",
    en: "👤 Profile/chat",
  },
  btn_image_triage_qr_menu: {
    ru: "🍽 Меню/QR",
    uz: "🍽 Menyu/QR",
    en: "🍽 Menu/QR",
  },
  image_triage_gift: {
    ru: "🎁 Подарок, NFT, Stars или розыгрыш\n\nПриманка: подарок, бонус или шанс выиграть. Риск начинается, если дальше просят капчу, реакции, wallet, комиссию или код.\n\nБезопасный шаг: ничего не вводите и не подключайте. Пришлите ссылку или скрин следующего экрана.",
    uz: "🎁 Sovg'a, NFT, Stars yoki o'yin\n\nTuzoq: sovg'a, bonus yoki yutuq imkoniyati. Keyin captcha, reaksiya, wallet, komissiya yoki kod so'ralsa — xavf boshlanadi.\n\nXavfsiz qadam: hech narsa kiritmang va wallet ulamang. Havola yoki keyingi ekran skrinini yuboring.",
    en: "🎁 Gift, NFT, Stars, or giveaway\n\nHook: a gift, bonus, or chance to win. Risk starts if the next step asks for captcha, reactions, wallet connection, a fee, or a code.\n\nSafe step: enter nothing and connect no wallet. Send the link or the next-screen screenshot.",
  },
  image_triage_casino: {
    ru: "🎰 Казино, ставки, фриспины или VIP-прогноз\n\nПриманка: «бонус», «100 фриспинов», «прогноз бесплатно». Цель часто одна: депозит, платный доступ, карта или код.\n\nБезопасный шаг: не пополняйте баланс и не платите за доступ. Пришлите ссылку/username или условия.",
    uz: "🎰 Kazino, stavka, frispin yoki VIP prognoz\n\nTuzoq: «bonus», «100 frispin», «bepul prognoz». Maqsad ko'pincha depozit, pulli kirish, karta yoki kod.\n\nXavfsiz qadam: balans to'ldirmang va kirish uchun pul to'lamang. Havola/username yoki shartlarni yuboring.",
    en: "🎰 Casino, betting, free spins, or VIP prediction\n\nHook: “bonus”, “100 free spins”, or “free prediction”. The goal is often deposit, paid access, card data, or a code.\n\nSafe step: do not top up or pay for access. Send the link/username or terms.",
  },
  image_triage_wallet: {
    ru: "💼 TON, wallet, DeFi или токены\n\nПриманка: airdrop, battery, fee, срочность или «обновление». Цель может быть wallet connect, подпись транзакции, seed phrase или top up.\n\nБезопасный шаг: не подключайте кошелёк и ничего не подписывайте. Пришлите ссылку кнопки.",
    uz: "💼 TON, wallet, DeFi yoki tokenlar\n\nTuzoq: airdrop, battery, fee, shoshilinchlik yoki «yangilanish». Maqsad wallet connect, tranzaksiya imzosi, seed phrase yoki top up bo'lishi mumkin.\n\nXavfsiz qadam: wallet ulamang va hech narsa imzolamang. Tugma havolasini yuboring.",
    en: "💼 TON, wallet, DeFi, or tokens\n\nHook: airdrop, battery, fee, urgency, or an “update”. The goal may be wallet connect, transaction signature, seed phrase, or top up.\n\nSafe step: do not connect a wallet or sign anything. Send the button link.",
  },
  image_triage_bank: {
    ru: "🏦 Банк, код, карта или APK\n\nОпасно, если просят SMS-код, PIN, CVV, пароль, карту, APK или «защитное приложение». Банк не просит это в Telegram.\n\nБезопасный шаг: ничего не отправляйте. Если уже ввели код/карту или APK — нажмите /panic.",
    uz: "🏦 Bank, kod, karta yoki APK\n\nSMS-kod, PIN, CVV, parol, karta, APK yoki «xavfsizlik ilovasi» so'ralsa — xavfli. Bank Telegram orqali buni so'ramaydi.\n\nXavfsiz qadam: hech narsa yubormang. Kod/karta kiritgan yoki APK o'rnatgan bo'lsangiz — /panic ni bosing.",
    en: "🏦 Bank, code, card, or APK\n\nDanger: SMS code, PIN, CVV, password, card data, APK, or “security app”. Banks do not ask for this through Telegram.\n\nSafe step: send nothing. If you already entered a code/card or installed an APK, use /panic.",
  },
  image_triage_telegram_profile: {
    ru: "👤 Профиль или чат Telegram\n\nПо одному скрину профиля я не могу честно сказать, кто это. Поля вроде «не в контактах», страны телефона или «не официальный аккаунт» — это подсказки, но не доказательство мошенничества.\n\nВажнее просьба: код, деньги, карта, APK, ссылка/QR или срочность. Пришлите сообщение, следующий экран или коротко напишите, что человек просит сделать.",
    uz: "👤 Telegram profili yoki chat\n\nFaqat profil skriniga qarab bu kimligini aniq ayta olmayman. «Kontaktlarda yo'q», telefon mamlakati yoki «rasmiy akkaunt emas» kabi belgilar yordam beradi, lekin firibgarlik isboti emas.\n\nMuhimi — nima so'rashyapti: kod, pul, karta, APK, havola/QR yoki shoshirish. Xabarni, keyingi ekranni yoki odam nima qilishni so'raganini qisqa yuboring.",
    en: "👤 Telegram profile or chat\n\nFrom one profile screenshot, I cannot honestly say who this is. Fields like “not in contacts”, phone country, or “not official account” are clues, not proof of fraud.\n\nWhat matters is the request: code, money, card data, APK, link/QR, or urgency. Send the message, the next screen, or briefly write what they ask you to do.",
  },
  image_triage_qr_menu: {
    ru: "🍽 Меню, ресторанный QR или информационный QR\n\nСам QR обычно не скам: он может открыть меню, акцию или бронирование. Риск появляется после перехода, если просят оплату, Telegram-вход, SMS-код, карту или APK.\n\nБезопасный шаг: проверьте адрес страницы. Если просят данные — пришлите адрес или следующий скрин.",
    uz: "🍽 Menyu, restoran QR yoki ma'lumot QR\n\nQRning o'zi odatda firibgarlik emas: u menyu, aksiya yoki bron sahifasini ochishi mumkin. Xavf keyin to'lov, Telegram login, SMS-kod, karta yoki APK so'ralganda boshlanadi.\n\nXavfsiz qadam: sahifa manzilini tekshiring. Ma'lumot so'ralsa, manzil yoki keyingi skrinni yuboring.",
    en: "🍽 Menu, restaurant QR, or informational QR\n\nA QR alone is usually not a scam: it may open a menu, promo, or booking page. Risk starts after opening if it asks for payment, Telegram login, SMS code, card data, or APK.\n\nSafe step: check the page address. If it asks for data, send the address or next screenshot.",
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
    ru: "🔎 Новая проверка",
    uz: "🔎 Yangi tekshiruv",
    en: "🔎 New check",
  },
  btn_conversation_analyze: {
    ru: "🧵 Анализировать",
    uz: "🧵 Tahlil qilish",
    en: "🧵 Analyze",
  },
  btn_conversation_cancel: {
    ru: "Отмена",
    uz: "Bekor qilish",
    en: "Cancel",
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
  btn_media_tips: {
    ru: "📸 Что прислать?",
    uz: "📸 Nima yuborish?",
    en: "📸 What to send?",
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
    ru: "Проверить новое",
    uz: "Yangi tekshiruv",
    en: "New check",
  },
  btn_quick_conversation: {
    ru: "Вся переписка",
    uz: "Butun yozishma",
    en: "Whole chat",
  },
  btn_quick_report: {
    ru: "Сообщить случай",
    uz: "Holatni yuborish",
    en: "Report case",
  },
  btn_quick_panic: {
    ru: "Помощь сейчас",
    uz: "Hozir yordam",
    en: "Help now",
  },
  btn_live_call_now: {
    ru: "МНЕ ЗВОНЯТ СЕЙЧАС",
    uz: "HOZIR QO'NG'IROQ",
    en: "CALLING ME NOW",
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
    ru: "Как я решаю",
    uz: "Qanday tekshiraman",
    en: "How I decide",
  },
  btn_quick_digest: {
    ru: "Схемы недели",
    uz: "Haftalik sxemalar",
    en: "Weekly scams",
  },
  btn_quick_trainer: {
    ru: "Тренажёр",
    uz: "Trener",
    en: "Trainer",
  },

  // ── Live call copilot (Sprint 3.1) ────────────────────────────────────────
  live_call_header: {
    ru: "📞 Похоже, звонок рискованный.\n\nГлавное сейчас — завершить разговор. Не спорьте и не отвечайте на вопросы.",
    uz: "📞 Qo'ng'iroq xavfli bo'lishi mumkin.\n\nHozir eng muhimi — suhbatni tugatish. Tortishmang va savollarga javob bermang.",
    en: "📞 This call may be risky.\n\nThe safe move is to end it now. Do not argue or answer questions.",
  },
  live_call_hangup: {
    ru: "Скажите одну фразу: «Я сам перезвоню по официальному номеру.»\n\nПоложите трубку и нажмите «✅ Я положил трубку».\n\nКод, PIN, CVV, пароль и данные карты не называйте.",
    uz: "Bitta jumla ayting: «Rasmiy raqamga o'zim qo'ng'iroq qilaman.»\n\nGo'shakni qo'ying va «✅ Go'shakni qo'ydim» tugmasini bosing.\n\nKod, PIN, CVV, parol va karta ma'lumotini aytmang.",
    en: "Say one sentence: “I will call back myself using the official number.”\n\nHang up and tap “✅ I hung up”.\n\nDo not share codes, PIN, CVV, passwords, or card data.",
  },
  live_call_what_to_say: {
    ru: "💬 Прочитайте и завершите звонок:\n\n«Я не обсуждаю деньги, коды и карты по входящему звонку. Я сам перезвоню по официальному номеру.»\n\nНе объясняйте причину — просто положите трубку.",
    uz: "💬 O'qing va qo'ng'iroqni tugating:\n\n«Kiruvchi qo'ng'iroqda pul, kod va kartani muhokama qilmayman. Rasmiy raqamga o'zim qo'ng'iroq qilaman.»\n\nSabab tushuntirmang — go'shakni qo'ying.",
    en: "💬 Read this and end the call:\n\n“I do not discuss money, codes, or cards on an incoming call. I will call back myself using the official number.”\n\nDo not explain — just hang up.",
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
    ru: "\u{1F4F1} \u042F \u0443\u0436\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B SMS-\u043A\u043E\u0434",
    uz: "\u{1F4F1} SMS-kodni yubordim",
    en: "\u{1F4F1} I already sent SMS code",
  },
  btn_live_tell_family: {
    ru: "\u{1F46A} \u041F\u043E\u0437\u0432\u0430\u0442\u044C \u0431\u043B\u0438\u0437\u043A\u043E\u0433\u043E",
    uz: "\u{1F46A} Yaqinni chaqirish",
    en: "\u{1F46A} Call someone trusted",
  },

  // ── "Why" explanation button (Sprint 3.5) ─────────────────────────────────
  btn_why: {
    ru: "❓ Почему так?",
    uz: "❓ Nima uchun?",
    en: "❓ Why?",
  },
  btn_explain_simple: {
    ru: "👵 Простыми словами",
    uz: "👵 Oddiy qilib",
    en: "👵 Simple words",
  },
  why_explanation: {
    ru: "🧠 *Как я проверяю*\n\nЯ не угадываю и не называю людей мошенниками без оснований. Я ищу опасные признаки:\n\n1\uFE0F\u20E3 Просят SMS-код, PIN, CVV или пароль\n2\uFE0F\u20E3 Просят установить APK или «безопасное приложение»\n3\uFE0F\u20E3 Торопят, пугают или говорят «не кладите трубку»\n4\uFE0F\u20E3 Представляются банком в Telegram или звонят с неизвестного номера\n5\uFE0F\u20E3 Просят перевести деньги на «безопасный счёт» или по ссылке\n\nЕсли таких признаков нет — я пишу «недостаточно данных».\n\nВажно: даже если номер похож на официальный, его могут подменить. Лучше завершить разговор и перезвонить самому.\n\n🔒 Ваши данные не сохраняются в открытом виде.",
    uz: "🧠 *Qanday tekshiraman*\n\nMen taxmin qilmayman va asossiz hech kimni firibgar deb aytmayman. Men xavfli belgilarni qidiraman:\n\n1\uFE0F\u20E3 SMS-kod, PIN, CVV yoki parol so'rashyapti\n2\uFE0F\u20E3 APK yoki «xavfsiz ilova» o'rnatishni aytishyapti\n3\uFE0F\u20E3 Shoshiltiradi, qo'rqitadi yoki «go'shakni qo'ymang» deydi\n4\uFE0F\u20E3 Telegramda bank nomidan yozadi yoki noma'lum raqamdan qo'ng'iroq qiladi\n5\uFE0F\u20E3 «Xavfsiz hisob»ga yoki havola orqali pul o'tkazishni so'raydi\n\nAgar bunday belgilar topilmasa — «ma'lumot yetarli emas» deb yozaman.\n\nMuhim: raqam rasmiy ko'rinsa ham, uni soxtalashtirish mumkin. Suhbatni tugating va o'zingiz qayta qo'ng'iroq qiling.\n\n🔒 Ma'lumotlaringiz ochiq holda saqlanmaydi.",
    en: '🧠 *How I check*\n\nI don\'t guess and I don\'t call people scammers without reason. I look for dangerous signs:\n\n1\uFE0F\u20E3 Asking for an SMS code, PIN, CVV or password\n2\uFE0F\u20E3 Asking you to install an APK or a "secure app"\n3\uFE0F\u20E3 Rushing you, scaring you, or saying "don\'t hang up"\n4\uFE0F\u20E3 Claiming to be a bank via Telegram or calling from an unknown number\n5\uFE0F\u20E3 Asking you to transfer money to a "safe account" or via a link\n\nIf none of these signs are found, I say "not enough data."\n\nImportant: even if a number looks official, it can be spoofed. Better to end the call and ring back yourself.\n\n🔒 Your data is not stored in plain form.',
  },

  // ── Share advice + elder hints (Sprint 3.3 / 3.6) ────────────────────────
  btn_share_advice: {
    ru: "\u{1F4E8} \u0422\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u0431\u043B\u0438\u0437\u043A\u043E\u0433\u043E",
    uz: "\u{1F4E8} Yaqin uchun tayyor matn",
    en: "\u{1F4E8} Text for trusted person",
  },
  share_advice_text: {
    ru: "\u{1F6E1} \u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442 Ishonch Guard:\n\n\u0412\u0430\u043C \u043F\u0440\u0438\u0441\u043B\u0430\u043B\u0438 \u043F\u043E\u0434\u043E\u0437\u0440\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430:\n\n\u274C \u041D\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0439\u0442\u0435 SMS-\u043A\u043E\u0434\u044B\n\u274C \u041D\u0435 \u0443\u0441\u0442\u0430\u043D\u0430\u0432\u043B\u0438\u0432\u0430\u0439\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\n\u274C \u041D\u0435 \u043F\u0435\u0440\u0435\u0432\u043E\u0434\u0438\u0442\u0435 \u0434\u0435\u043D\u044C\u0433\u0438\n\n\u2705 \u041F\u043E\u043B\u043E\u0436\u0438\u0442\u0435 \u0442\u0440\u0443\u0431\u043A\u0443 \u0438 \u043F\u0435\u0440\u0435\u0437\u0432\u043E\u043D\u0438\u0442\u0435 \u0432 \u0431\u0430\u043D\u043A \u0441\u0430\u043C\u0438.\n\n\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C: @scamguard_bot",
    uz: "\u{1F6E1} Ishonch Guard xabari:\n\nSizga shubhali xabar keldi. Iltimos:\n\n\u274C SMS-kodlarni yubormang\n\u274C Ilovalar o'rnatmang\n\u274C Pul o'tkazmang\n\n\u2705 Go'shakni qo'ying va bankka o'zingiz qo'ng'iroq qiling.\n\nTekshirish: @scamguard_bot",
    en: "\u{1F6E1} Message from Ishonch Guard:\n\nYou received a suspicious message. Please:\n\n\u274C Don't send SMS codes\n\u274C Don't install apps\n\u274C Don't transfer money\n\n\u2705 Hang up and call the bank yourself.\n\nCheck: @scamguard_bot",
  },

  // ── Family Shield v1 ─────────────────────────────────────────────────────
  btn_quick_family: {
    ru: "Близкий рядом",
    uz: "Yaqin kishi",
    en: "Trusted helper",
  },
  btn_notify_trusted: {
    ru: "👪 Позвать близкого",
    uz: "👪 Yaqinni chaqirish",
    en: "👪 Notify trusted person",
  },
  family_btn_create_invite: {
    ru: "🔗 Создать приглашение",
    uz: "🔗 Taklif yaratish",
    en: "🔗 Create invite",
  },
  family_btn_open_invite: {
    ru: "📤 Отправить в чат близкого",
    uz: "📤 Yaqin kishiga yuborish",
    en: "📤 Send invite to trusted person",
  },
  family_btn_notify: {
    ru: "👪 Позвать близкого",
    uz: "👪 Yaqinni chaqirish",
    en: "👪 Notify trusted person",
  },
  family_btn_codeword: {
    ru: "🎙️ Как проверить голос",
    uz: "🎙️ Ovozni tekshirish",
    en: "🎙️ Verify voice safely",
  },
  family_btn_revoke: {
    ru: "🗑 Отключить",
    uz: "🗑 O'chirish",
    en: "🗑 Disable",
  },
  family_btn_trusted_stop_alerts: {
    ru: "Отключить эти сигналы",
    uz: "Bu signallarni o'chirish",
    en: "Stop these alerts",
  },
  family_menu_text: {
    ru: "👪 *Семейный щит*\n\nЭто кнопка помощи близкому человеку: если вы растерялись, получили высокий риск или вас торопят по телефону, я помогу позвать доверенного человека.\n\nКак подключить:\n1. Нажмите «Создать приглашение».\n2. Отправьте его родственнику или другу.\n3. Он откроет бота и нажмёт Start.\n\nПосле этого появится кнопка «Позвать близкого». Я не передаю ему ваши коды, ссылки, номера или скриншоты.\n\nОтдельно можно нажать «Как проверить голос» и договориться с семьёй, как проверять голосовые и видео-звонки без отправки секрета в бот.",
    uz: "👪 *Oila qalqoni*\n\nBu ishonchli insonni chaqirish tugmasi: agar shoshilib qolsangiz, yuqori xavf chiqsa yoki telefon orqali bosim bo'lsa, men yaqin insoningizni chaqirishga yordam beraman.\n\nQanday ulash:\n1. «Taklif yaratish»ni bosing.\n2. Uni qarindosh yoki do'stingizga yuboring.\n3. U botni ochib Start bosadi.\n\nShundan keyin «Yaqinni chaqirish» tugmasi ishlaydi. Men unga kodlar, havolalar, raqamlar yoki skrinshotlaringizni yubormayman.\n\nAlohida «Ovozni tekshirish» tugmasini bosib, ovozli va video qo'ng'iroqlarni botga sir yubormasdan tekshirish bo'yicha oilaviy qoida kelishib oling.",
    en: "👪 *Family Shield*\n\nThis is a help button for someone you trust: if you feel lost, get a high-risk result, or someone is pressuring you on a call, I can help notify your trusted person.\n\nHow to connect:\n1. Tap “Create invite”.\n2. Send it to a relative or friend.\n3. They open the bot and tap Start.\n\nAfter that, “Notify trusted person” becomes available. I do not send them your codes, links, numbers, or screenshots.\n\nYou can also tap “Verify voice safely” and agree with your family how to verify voice and video calls without sending the secret to the bot.",
  },
  family_codeword_guide: {
    ru: "🔐 *Семейное кодовое слово*\n\nЭто защита от звонков и голосовых, где мошенник звучит как близкий человек.\n\nКак договориться:\n1. Выберите короткую фразу, которую нельзя угадать из соцсетей.\n2. Обсудите её лично или по уже сохранённому номеру.\n3. Не пишите кодовое слово в бот, чат, заметки или SMS.\n4. Если звонят с просьбой о деньгах, коде или срочном переводе — завершите разговор, перезвоните по сохранённому номеру и спросите кодовое слово или личный вопрос.\n\nЕсли человек злится, торопит или запрещает перезванивать — это красный флаг. Деньги и коды не отправляем, пока личность не подтверждена другим каналом.",
    uz: "🔐 *Oilaviy maxfiy so'z*\n\nBu yaqin inson ovoziga o'xshagan qo'ng'iroq yoki audio xabarlardan himoya qiladi.\n\nQanday kelishish kerak:\n1. Ijtimoiy tarmoqlardan topib bo'lmaydigan qisqa iborani tanlang.\n2. Uni yuzma-yuz yoki avvaldan saqlangan raqam orqali kelishib oling.\n3. Maxfiy so'zni botga, chatga, eslatmaga yoki SMSga yozmang.\n4. Pul, kod yoki shoshilinch o'tkazma so'rashsa — suhbatni tugating, saqlangan raqamga qayta qo'ng'iroq qiling va maxfiy so'z yoki shaxsiy savolni so'rang.\n\nAgar odam jahli chiqsa, shoshirsa yoki qayta qo'ng'iroq qilishni taqiqlasa — bu xavf belgisi. Shaxs boshqa kanal orqali tasdiqlanmaguncha pul ham, kod ham yubormang.",
    en: "🔐 *Family code word*\n\nThis protects against calls or voice messages where a scammer sounds like someone close to you.\n\nHow to agree on it:\n1. Choose a short phrase that cannot be guessed from social media.\n2. Discuss it in person or through an already saved phone number.\n3. Do not write the code word in the bot, chat, notes, or SMS.\n4. If someone calls asking for money, a code, or an urgent transfer, end the call, call back using the saved number, and ask the code word or a private question.\n\nIf the person gets angry, rushes you, or forbids calling back, that is a red flag. Do not send money or codes until identity is confirmed through another channel.",
  },
  family_invite_text: {
    ru: "🔗 *Приглашение создано*\n\nЭта ссылка не для вас — её должен открыть другой человек.\n\nЧто сделать сейчас:\n1. Нажмите «📤 Отправить в чат близкого».\n2. В открывшемся окне Telegram выберите родственника или друга и отправьте сообщение.\n3. Когда близкий откроет бота и нажмёт Start, связь включится.\n\nЕсли вы случайно открыли ссылку сами — ничего страшного. Вернитесь сюда и отправьте её другому человеку.\n\nЯ не буду отправлять близкому ваши номера, ссылки, скриншоты, коды или текст проверки — только короткий сигнал: «пожалуйста, помогите сейчас».",
    uz: "🔗 *Taklif yaratildi*\n\nBu havola siz uchun emas — uni boshqa inson ochishi kerak.\n\nHozir nima qilish kerak:\n1. «📤 Yaqin kishiga yuborish»ni bosing.\n2. Telegram oynasida qarindosh yoki do'stingizni tanlab, xabarni yuboring.\n3. Yaqin inson botni ochib Start bosgandan keyin aloqa yoqiladi.\n\nAgar havolani tasodifan o'zingiz ochsangiz — xavotir olmang. Bu xabarga qaytib, uni boshqa insonga yuboring.\n\nMen yaqin insoningizga raqamlar, havolalar, skrinshotlar, kodlar yoki tekshiruv matnini yubormayman — faqat qisqa signal: «iltimos, hozir yordam bering».",
    en: "🔗 *Invite created*\n\nThis link is not for you — another person must open it.\n\nWhat to do now:\n1. Tap “📤 Send invite to trusted person”.\n2. In the Telegram share window, choose a relative or friend and send the message.\n3. After they open the bot and tap Start, the link becomes active.\n\nIf you accidentally open the link yourself, that is okay. Come back here and send it to another person.\n\nI will not send your trusted person your numbers, links, screenshots, codes, or checked text — only a short signal: “please help now.”",
  },
  family_already_linked: {
    ru: "Близкий уже подключён.\n\nЧтобы создать новое приглашение, сначала отключите текущую связь. Если ситуация срочная, можно сразу позвать подключённого близкого.",
    uz: "Yaqin inson allaqachon ulangan.\n\nYangi taklif yaratish uchun avval hozirgi aloqani o'chiring. Agar vaziyat shoshilinch bo'lsa, ulangan yaqin insonni hoziroq chaqirishingiz mumkin.",
    en: "A trusted person is already linked.\n\nTo create a new invite, disable the current link first. If this is urgent, you can notify the linked trusted person now.",
  },
  family_private_chat_only: {
    ru: "Семейный щит настраивается только в личном чате с ботом, чтобы не раскрыть приглашение в группе. Откройте бота в личных сообщениях и нажмите /family.",
    uz: "Oila qalqoni faqat bot bilan shaxsiy chatda sozlanadi, taklif guruhda ko'rinib qolmasligi uchun. Botni shaxsiy xabarlarda oching va /family bosing.",
    en: "Family Shield can be set up only in a private chat with the bot, so the invite is not exposed in a group. Open the bot privately and tap /family.",
  },
  family_accept_ok: {
    ru: "✅ Готово. Вы стали доверенным контактом Ishonch Guard.\n\nЕсли близкий человек попросит срочную помощь, я пришлю короткий сигнал без его личных данных, кодов, ссылок и скриншотов.",
    uz: "✅ Tayyor. Siz Ishonch Guard ishonchli kontakti bo'ldingiz.\n\nYaqin insoningiz shoshilinch yordam so'rasa, men shaxsiy ma'lumotlar, kodlar, havolalar va skrinshotlarsiz qisqa signal yuboraman.",
    en: "✅ Done. You are now an Ishonch Guard trusted contact.\n\nIf your trusted person asks for urgent help, I will send a short alert without personal data, codes, links, or screenshots.",
  },
  family_guardian_linked: {
    ru: "✅ Близкий подключён. Теперь в срочной ситуации вы сможете позвать его одной кнопкой.",
    uz: "✅ Yaqin inson ulandi. Endi shoshilinch holatda uni bitta tugma bilan chaqira olasiz.",
    en: "✅ Trusted person linked. In an emergency, you can now notify them with one tap.",
  },
  family_accept_invalid: {
    ru: "Ссылка приглашения недействительна или уже использована. Попросите создать новое приглашение через /family.",
    uz: "Taklif havolasi yaroqsiz yoki allaqachon ishlatilgan. /family orqali yangi taklif yaratishni so'rang.",
    en: "This invite link is invalid or already used. Ask them to create a new invite with /family.",
  },
  family_accept_expired: {
    ru: "Ссылка приглашения устарела. Попросите создать новое приглашение через /family.",
    uz: "Taklif havolasi eskirgan. /family orqali yangi taklif yaratishni so'rang.",
    en: "This invite link has expired. Ask them to create a new invite with /family.",
  },
  family_accept_self: {
    ru: "Вы открыли свою же ссылку, поэтому связь не включилась. Это приглашение должен открыть другой человек.\n\nВернитесь к сообщению с приглашением, нажмите «📤 Отправить в чат близкого» и выберите родственника или друга в Telegram.",
    uz: "Siz o'zingizning havolangizni ochdingiz, shuning uchun aloqa yoqilmadi. Bu taklifni boshqa inson ochishi kerak.\n\nTaklif xabariga qayting, «📤 Yaqin kishiga yuborish»ni bosing va Telegramda qarindosh yoki do'stingizni tanlang.",
    en: "You opened your own invite link, so the connection was not enabled. Another person must open this invite.\n\nGo back to the invite message, tap “📤 Send invite to trusted person”, and choose a relative or friend in Telegram.",
  },
  family_storage_error: {
    ru: "Семейный щит сейчас недоступен. Срочный совет: позвоните близкому вручную и скажите: «Побудь со мной 5 минут, я сам перезвоню в банк по официальному номеру».",
    uz: "Oila qalqoni hozir ishlamayapti. Shoshilinch maslahat: yaqiningizga o'zingiz qo'ng'iroq qiling va ayting: «5 daqiqa yonimda bo'ling, bankka rasmiy raqam orqali o'zim qo'ng'iroq qilaman».",
    en: "Family Shield is unavailable right now. Urgent fallback: call someone trusted yourself and say: “Stay with me for 5 minutes while I call the bank back using an official number.”",
  },
  family_not_linked: {
    ru: "Близкий ещё не подключён.\n\nСначала создайте приглашение и отправьте его человеку, которому доверяете. После принятия я смогу позвать его одной кнопкой.",
    uz: "Yaqin inson hali ulanmagan.\n\nAvval taklif yarating va ishonchli insonga yuboring. U qabul qilgandan keyin men uni bitta tugma bilan chaqira olaman.",
    en: "No trusted person is linked yet.\n\nCreate an invite and send it to someone you trust. After they accept, I can notify them with one tap.",
  },
  family_notify_ok: {
    ru: "✅ Я отправил близкому короткий сигнал помощи. Теперь не пересылайте ему коды, PIN, CVV, пароли, фото карты или подозрительные файлы.",
    uz: "✅ Yaqiningizga qisqa yordam signali yubordim. Endi unga kodlar, PIN, CVV, parollar, karta rasmi yoki shubhali fayllarni yubormang.",
    en: "✅ I sent your trusted person a short help alert. Do not forward codes, PIN, CVV, passwords, card photos, or suspicious files.",
  },
  family_notify_cooldown: {
    ru: "Сигнал уже отправлен недавно. Чтобы не спамить близкому, подождите пару минут. Если срочно — позвоните ему вручную.",
    uz: "Signal yaqinda yuborilgan. Yaqiningizga spam bo'lmasligi uchun bir necha daqiqa kuting. Juda shoshilinch bo'lsa — o'zingiz qo'ng'iroq qiling.",
    en: "An alert was sent recently. To avoid spamming your trusted person, wait a couple of minutes. If urgent, call them yourself.",
  },
  family_notify_failed: {
    ru: "Не удалось отправить сигнал близкому. Позвоните ему вручную и скажите: «Мне нужна помощь. Побудь со мной 5 минут, пока я перезвоню в банк по официальному номеру».",
    uz: "Yaqiningizga signal yuborib bo'lmadi. Unga o'zingiz qo'ng'iroq qiling va ayting: «Menga yordam kerak. Bankka rasmiy raqam orqali qo'ng'iroq qilgunimcha 5 daqiqa yonimda bo'ling».",
    en: "I could not send the alert. Call them yourself and say: “I need help. Stay with me for 5 minutes while I call the bank back using an official number.”",
  },
  family_revoke_ok: {
    ru: "Готово. Семейный щит отключён для этого контакта.",
    uz: "Tayyor. Bu kontakt uchun Oila qalqoni o'chirildi.",
    en: "Done. Family Shield is disabled for this contact.",
  },
  family_revoke_empty: {
    ru: "Сейчас нет активного или ожидающего доверенного контакта.",
    uz: "Hozir faol yoki kutilayotgan ishonchli kontakt yo'q.",
    en: "There is no active or pending trusted contact right now.",
  },
  family_trusted_opt_out_ok: {
    ru: "Готово. Я отключил эти сигналы для вас. Если человек снова захочет подключить вас как близкого, он отправит новое приглашение.",
    uz: "Tayyor. Siz uchun bu signallarni o'chirdim. Agar u inson sizni yana ishonchli kontakt qilmoqchi bo'lsa, yangi taklif yuboradi.",
    en: "Done. I stopped these alerts for you. If this person wants to link you again, they will send a new invite.",
  },
  family_trusted_opt_out_empty: {
    ru: "Активных сигналов для вас сейчас нет.",
    uz: "Siz uchun hozir faol signal yo'q.",
    en: "There are no active alerts linked to you right now.",
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
  risk_qr_info: {
    ru: "QR-контекст проверен",
    uz: "QR konteksti tekshirildi",
    en: "QR context checked",
  },
  verdict_qr_info: {
    ru: "🟢 Похоже на меню или информационный QR",
    uz: "🟢 Menyu yoki ma'lumot beruvchi QRga o'xshaydi",
    en: "🟢 Looks like a menu or informational QR",
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
    ru: "Вижу тему инвестиций/крипто, но пока нет ссылки, контакта или просьбы оплатить. Оценивайте это как рекламу: риск начинается, если дальше ведут к депозиту, платным сигналам, «комиссии за вывод» или подключению кошелька.",
    uz: "Investitsiya/kripto mavzusini ko'ryapman, lekin hozircha havola, kontakt yoki to'lov so'rovi yo'q. Buni reklama sifatida baholang: xavf keyin depozit, pulli signal, «yechish komissiyasi» yoki hamyon ulash so'ralganda boshlanadi.",
    en: "I see an investment/crypto topic, but no link, contact, or payment request yet. Treat it as advertising: risk starts if it leads to a deposit, paid signals, a “withdrawal fee”, or wallet connection.",
  },
  brief_unknown_qr_menu: {
    ru: "По видимому тексту похоже на меню, акцию или информационный QR. Я не буду утверждать, что прочитал сам QR: важен адрес, который откроется после сканирования. Риск появляется, если дальше просят оплату, вход, SMS-код или карту.",
    uz: "Ko'rinayotgan matnga qaraganda bu menyu, aksiya yoki ma'lumot beruvchi QRga o'xshaydi. QR ichidagi manzilni aniq o'qidim deb aytmayman: skan qilgandan keyin ochiladigan sahifa muhim. Xavf keyin to'lov, login, SMS-kod yoki karta so'ralganda boshlanadi.",
    en: "From the visible text, this looks like a menu, promo, or informational QR. I will not claim I decoded the QR itself: the important part is the page that opens after scanning. Risk starts if the next page asks for payment, login, SMS code, or card data.",
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
  brief_unknown_telegram_profile: {
    ru: "По одному @username нельзя честно сказать «безопасно» или «скам». Telegram не показывает мне скрытую SCAM-метку, возраст аккаунта, жалобы и кому он писал. Я оцениваю только открытые признаки и то, что вы прислали.",
    uz: "Faqat @username bo'yicha «xavfsiz» yoki «firibgarlik» deb halol aytib bo'lmaydi. Telegram menga yashirin SCAM belgisi, akkaunt yoshi, shikoyatlar va kimga yozganini ko'rsatmaydi. Men faqat ochiq belgilar va siz yuborgan ma'lumotni baholayman.",
    en: "A @username alone is not enough to honestly say “safe” or “scam”. Telegram does not show me hidden SCAM labels, account age, complaints, or who they messaged. I assess only public signs and what you send.",
  },
  prompt_more_context_crypto: {
    ru: "Для точной проверки пришлите ссылку, username автора или условия: доходность, депозит, платные сигналы, вывод средств или комиссия.",
    uz: "Aniq tekshirish uchun havola, muallif username'i yoki shartlarni yuboring: daromad, depozit, pulli signal, pul yechish yoki komissiya.",
    en: "For a precise check, send the link, author username, or terms: returns, deposit, paid signals, withdrawals, or fees.",
  },
  prompt_more_context_qr_menu: {
    ru: "Если после QR открылась страница с оплатой, логином, SMS-кодом или картой — пришлите адрес страницы или скрин следующего экрана.",
    uz: "QRdan keyin to'lov, login, SMS-kod yoki karta sahifasi ochilsa, sahifa manzilini yoki keyingi ekran skrinini yuboring.",
    en: "If the QR opens a payment, login, SMS-code, or card page, send the page address or a screenshot of the next screen.",
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
  prompt_more_context_telegram_profile: {
    ru: "Лучше пришлите сообщение или скрин переписки: просят код, деньги, карту, APK, QR-вход, подписку/VIP или перейти по ссылке?",
    uz: "Yaxshisi yozishma xabari yoki skrinini yuboring: kod, pul, karta, APK, QR-login, obuna/VIP yoki havola so'ralyaptimi?",
    en: "Best next step: send the message or chat screenshot: are they asking for a code, money, card data, APK, QR login, VIP/subscription, or a link?",
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

  // ── /chatid — operator setup helper (admin-only, group context) ────────────
  // {chatId} and {chatType} are filled via bt(..., { chatId, chatType }).
  chatid_group: {
    ru: "🛠 Chat ID для настройки\n\nChat ID: {chatId}\nТип чата: {chatType}\n\nСкопируйте это значение в Railway:\nTELEGRAM_MODERATION_CHAT_ID={chatId}\n\nПосле redeploy проверьте:\nrailway run npm run moderation:smoke\n\nНе отправляйте сюда реальные жалобы, пока smoke-тест не прошёл.",
    uz: "🛠 Chat ID sozlash uchun\n\nChat ID: {chatId}\nChat turi: {chatType}\n\nBu qiymatni Railway'ga ko'chiring:\nTELEGRAM_MODERATION_CHAT_ID={chatId}\n\nRedeploydan keyin tekshiring:\nrailway run npm run moderation:smoke\n\nSmoke-test o'tmaguncha shu yerga haqiqiy shikoyatlar yuburmang.",
    en: "🛠 Chat ID for setup\n\nChat ID: {chatId}\nChat type: {chatType}\n\nCopy this value into Railway:\nTELEGRAM_MODERATION_CHAT_ID={chatId}\n\nAfter redeploy, verify with:\nrailway run npm run moderation:smoke\n\nDo not send real reports here until the smoke test passes.",
  },
  chatid_private: {
    ru: "🛠 Chat ID\n\nЭто личный чат. Для moderation-уведомлений нужен ID приватной группы.\n\nСоздайте приватную группу, добавьте туда @scamguard_bot и напишите там:\n/chatid",
    uz: "🛠 Chat ID\n\nBu shaxsiy chat. Moderatsiya xabarlari uchun yopiq guruh ID si kerak.\n\nYopiq guruh yarating, @scamguard_bot ni qo'shing va u yerda yozing:\n/chatid",
    en: "🛠 Chat ID\n\nThis is a private chat. Moderation notifications need a private group ID.\n\nCreate a private group, add @scamguard_bot there and run:\n/chatid",
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
