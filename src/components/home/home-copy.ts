import type { Lang } from "@/lib/i18n";

type UrgentCardCopy = {
  tag: string;
  text: string;
  when: readonly string[];
};

/**
 * Homepage copy for all three languages. Questions use the polite plural
 * ("вы") so they read naturally for every visitor; the same Russian FAQ feeds
 * the route's FAQPage JSON-LD, keeping structured data equal to visible text.
 * Urgent cards are keyed by the verified directory dial string; a contact the
 * map does not know falls back to its own verified note. `**text**` marks a
 * short phrase that the page renders bold so the key point reads at a glance.
 */
export const HOME_COPY = {
  ru: {
    hero: {
      eyebrow: "Проверка на мошенников · Узбекистан",
      title: ["Не доверяйте на слово.", "Проверьте за секунды."],
      lead: "Вставьте **номер, ссылку или текст сообщения**. Покажем **уровень риска**, причины простыми словами и **один безопасный шаг**.",
      chips: ["Бесплатно", "Без регистрации", "Текст не публикуется", "RU · UZ · EN"],
      checks: "проверок",
      urgentTitle: "Уже отправили код или деньги?",
      urgentText: "Откройте срочные шаги — каждая минута важна",
      bot: "Открыть Telegram-бот",
      botNote: "Перешлите подозрительное сообщение боту прямо из чата.",
      checkerLabel: "Быстрая проверка",
      checkerTitle: "Что хотите проверить?",
      getLabel: "Что вы получите",
      get: [
        ["Уровень риска", "от 0 до 100"],
        ["Причины", "простыми словами"],
        ["Один шаг", "что сделать сейчас"],
      ],
      privacy: "Мы никогда не просим коды из SMS, PIN и пароли.",
      details: "Подробный разбор",
      hideDetails: "Скрыть разбор",
    },
    kinds: {
      label: "Что можно проверить",
      note: "Тип определим сами — просто вставьте в форму",
      example: "Пример",
      items: [
        {
          name: "Телефон",
          title: "Номер, который звонит или пишет",
          text: "Сверим со справочником официальных номеров и подтверждёнными жалобами.",
          sample: "+998 •• ••• •• ••",
        },
        {
          name: "Ссылка",
          title: "Сайт или ссылка из SMS и Telegram",
          text: "Странный домен, короткая ссылка, опечатка в названии банка, файл APK.",
          sample: "uzpost-pay.top",
        },
        {
          name: "Сообщение",
          title: "Текст SMS, письма или @username",
          text: "Просьба назвать код, «безопасный счёт», давление и срочность.",
          sample: "«Назовите код из SMS»",
        },
        {
          name: "Скриншот",
          title: "Фото или скриншот переписки",
          text: "Распознаем текст на картинке — только после вашего согласия.",
          sample: "PNG · JPG · WEBP",
        },
      ],
    },
    how: {
      label: "Как это работает",
      statement: [
        "Мошенники торопят. Мы — нет: ",
        "за несколько секунд покажем, насколько это опасно и что делать.",
      ],
      steps: [
        {
          title: "Пришлите подозрительное",
          text: "Номер, ссылку, @username, текст сообщения или скриншот. **Регистрация не нужна.**",
        },
        {
          title: "Получите понятный ответ",
          text: "**Уровень риска и причины** простыми словами — без технических терминов.",
        },
        {
          title: "Сделайте один шаг",
          text: "Например: **положите трубку и перезвоните** по номеру с карты. Или просто не открывайте ссылку.",
        },
      ],
    },
    bot: {
      label: "Telegram-бот",
      badge: "Работает в Telegram",
      title: "Тот же помощник — в Telegram.",
      lead: "Перешлите боту подозрительное сообщение прямо из чата — ответ придёт через несколько секунд, на русском, узбекском или английском.",
      fastTitle: "Перешлите — ответ через несколько секунд.",
      fastText: "Без регистрации, без установки приложений",
      langTitle: "На вашем языке",
      replyKicker: "Пример ответа",
      replyTitle: "Один шаг",
      replyText: "Бот объясняет, почему это опасно, и говорит, что сделать прямо сейчас.",
      chatSubtitle: "бот",
      chatForwarded: "Переслано",
      chatScam: "Служба безопасности банка. Назовите код из SMS.",
      chatVerdict: "Высокий риск · 75/100",
      chatReason: "Просят код из SMS и выдают себя за банк.",
      chatNext: "Положите трубку и перезвоните по номеру с карты.",
      chatButtons: ["Что делать дальше", "Проверить ещё"],
      rows: [
        [
          "Пересланные сообщения и ссылки",
          "Перешлите из любого чата — бот разберёт и ответит",
          "сразу",
        ],
        ["Скриншоты и голосовые", "Перед распознаванием бот спросит разрешение", "с согласия"],
        ["Языки", "Ответ на русском, узбекском или английском", "RU · UZ · EN"],
      ],
      rowsCta: "Перейти в @scamguard_bot",
      rowsTitle: "Пересылайте прямо из Telegram",
      rowsText: "Ничего не нужно устанавливать — бот ответит в Telegram через несколько секунд.",
    },
    urgent: {
      label: "Срочная помощь",
      badge: "Каждая минута важна",
      title: "Уже отправили код или деньги?",
      lead: "Не ждите результата проверки. Позвоните по одному из номеров ниже и сделайте три шага по порядку.",
      guide: "Пошаговая инструкция",
      call: "Позвонить",
      when: "Когда звонить",
      cards: {
        "102": {
          tag: "Экстренно",
          text: "Преступления и мошенничество. Звоните, если деньги уже ушли.",
          when: [
            "Перевели деньги мошенникам",
            "Назвали код или данные карты",
            "Вам угрожают или давят",
          ],
        },
        "+998712000044": {
          tag: "Горячая линия",
          text: "Вклады и банковское мошенничество. Если банк не помогает.",
          when: ["Банковское мошенничество", "Вопросы по вкладам", "Банк не отвечает на обращение"],
        },
        "1257": {
          tag: "Колл-центр",
          text: "Операции по картам. Блокировка карты UZCARD.",
          when: [
            "Подозрительная операция по карте",
            "Нужно срочно заблокировать карту",
            "Назвали данные карты UZCARD",
          ],
        },
      } as Record<string, UrgentCardCopy>,
      stepsTitle: "Три шага — по порядку.",
      stepsLead: "Начните с карты: заблокированная карта останавливает новые списания.",
      steps: [
        ["Заблокируйте карту", "В приложении банка или по номеру на обратной стороне карты."],
        ["Позвоните в банк", "Попросите остановить перевод и зарегистрировать обращение."],
        ["Смените пароль", "Затем подайте заявление в полицию."],
      ],
      note: "Даже настоящий банк не просит код из SMS, PIN, CVV или пароль.",
    },
    directory: {
      label: "Справочник",
      badge: "Проверенные номера",
      title: "Перезвоните сами — по номеру из справочника.",
      lead: "Контакты банков, платёжных систем, операторов и государственных служб Узбекистана.",
      cta: "Открыть справочник",
      stats: [
        ["Проверенные контакты", "Номера и короткие коды — только из официальных источников."],
        ["Организации", "Банки, платёжные системы, операторы и госслужбы."],
        ["Банковские линии", "Перезванивайте сами — по номеру отсюда или с карты."],
      ],
      note: "Даже настоящий банк не просит код из SMS, PIN, CVV, пароль или установку приложения.",
    },
    faq: {
      label: "Частые вопросы",
      title: "А если уже случилось?",
      lead: "Шесть ситуаций, с которыми приходят чаще всего. Для каждой — что сделать прямо сейчас.",
      items: [
        {
          q: "Звонят из «службы безопасности банка» — это правда?",
          a: "Настоящий банк не просит код из SMS, пароль или установку приложения по ссылке. Положите трубку и перезвоните по номеру с карты.",
        },
        {
          q: "Уже назвали код из SMS — что делать?",
          a: "Сразу заблокируйте карту через приложение или официальный номер банка, смените пароль и сообщите банку, что код мог попасть к мошенникам.",
        },
        {
          q: "Установили подозрительное приложение (APK) — телефон в опасности?",
          a: "Включите авиарежим, не открывайте банковские приложения, удалите APK и свяжитесь с банком с другого устройства.",
        },
        {
          q: "Перевели деньги «на безопасный счёт» — можно вернуть?",
          a: "Не ждите: позвоните в банк, попросите остановить перевод и зафиксировать обращение. Затем подайте заявление в полицию.",
        },
        {
          q: "В Telegram пишет «менеджер банка» — отвечать?",
          a: "Не отвечайте и не переходите по ссылкам. Банк решает вопросы в официальном приложении или по номеру с карты.",
        },
        {
          q: "Хочу проверить ссылку, но боюсь её открывать",
          a: "Не открывайте её. Скопируйте адрес как текст и вставьте в проверку — мы разберём признаки риска без перехода на сайт.",
        },
      ],
    },
    more: {
      label: "Ещё полезное",
      cards: [
        {
          title: "Схемы мошенников",
          text: "Какие уловки встречаются **чаще всего** и как их узнать.",
        },
        {
          title: "Сообщить о схеме",
          text: "Опишите случай **без личных данных** — после проверки он поможет предупредить других.",
        },
        {
          title: "Приватность",
          text: "**Без регистрации.** Номера маскируются, коды и пароли не сохраняются.",
        },
      ],
    },
  },
  uz: {
    hero: {
      eyebrow: "Firibgarlikka tekshiruv · O‘zbekiston",
      title: ["So‘zga darrov ishonmang.", "Soniyalarda tekshiring."],
      lead: "**Raqam, havola yoki xabar matnini** joylashtiring. **Xavf darajasi**, oddiy so‘zlar bilan sabablar va **bitta xavfsiz qadamni** ko‘rsatamiz.",
      chips: ["Bepul", "Ro‘yxatdan o‘tmasdan", "Matn e’lon qilinmaydi", "RU · UZ · EN"],
      checks: "ta tekshiruv",
      urgentTitle: "Kod yoki pulni yuborib qo‘ydingizmi?",
      urgentText: "Shoshilinch qadamlarni oching — har bir daqiqa muhim",
      bot: "Telegram-botni ochish",
      botNote: "Shubhali xabarni chatdan to‘g‘ridan-to‘g‘ri botga yuboring.",
      checkerLabel: "Tezkor tekshiruv",
      checkerTitle: "Nimani tekshirmoqchisiz?",
      getLabel: "Nima olasiz",
      get: [
        ["Xavf darajasi", "0 dan 100 gacha"],
        ["Sabablar", "oddiy so‘zlar bilan"],
        ["Bitta qadam", "hozir nima qilish kerak"],
      ],
      privacy: "Biz hech qachon SMS-kod, PIN va parollarni so‘ramaymiz.",
      details: "Batafsil tahlil",
      hideDetails: "Tahlilni yashirish",
    },
    kinds: {
      label: "Nimani tekshirish mumkin",
      note: "Turini o‘zimiz aniqlaymiz — shunchaki shaklga joylashtiring",
      example: "Namuna",
      items: [
        {
          name: "Telefon",
          title: "Qo‘ng‘iroq qilgan yoki yozgan raqam",
          text: "Rasmiy raqamlar ma’lumotnomasi va tasdiqlangan shikoyatlar bilan solishtiramiz.",
          sample: "+998 •• ••• •• ••",
        },
        {
          name: "Havola",
          title: "SMS va Telegram’dagi sayt yoki havola",
          text: "G‘alati domen, qisqa havola, bank nomidagi xato, APK fayl.",
          sample: "uzpost-pay.top",
        },
        {
          name: "Xabar",
          title: "SMS, xat matni yoki @username",
          text: "Kodni so‘rash, «xavfsiz hisob», bosim va shoshirish.",
          sample: "«SMS-kodni ayting»",
        },
        {
          name: "Skrinshot",
          title: "Yozishma surati yoki skrinshoti",
          text: "Rasmdagi matnni faqat roziligingizdan so‘ng aniqlaymiz.",
          sample: "PNG · JPG · WEBP",
        },
      ],
    },
    how: {
      label: "Qanday ishlaydi",
      statement: [
        "Firibgarlar shoshiradi. Biz — yo‘q: ",
        "bir necha soniyada xavf qanchalik jiddiyligini va nima qilish kerakligini ko‘rsatamiz.",
      ],
      steps: [
        {
          title: "Shubhali narsani yuboring",
          text: "Raqam, havola, @username, xabar matni yoki skrinshot. **Ro‘yxatdan o‘tish shart emas.**",
        },
        {
          title: "Tushunarli javob oling",
          text: "**Xavf darajasi va sabablari** oddiy so‘zlar bilan — texnik atamalarsiz.",
        },
        {
          title: "Bitta qadam qiling",
          text: "Masalan: **qo‘ng‘iroqni tugatib, karta orqasidagi raqamga o‘zingiz qo‘ng‘iroq qiling.** Yoki havolani shunchaki ochmang.",
        },
      ],
    },
    bot: {
      label: "Telegram-bot",
      badge: "Telegram’da ishlaydi",
      title: "Xuddi shu yordamchi — Telegram’da.",
      lead: "Shubhali xabarni chatdan to‘g‘ridan-to‘g‘ri botga yuboring — javob bir necha soniyada rus, o‘zbek yoki ingliz tilida keladi.",
      fastTitle: "Yuboring — javob bir necha soniyada.",
      fastText: "Ro‘yxatdan o‘tmasdan, ilova o‘rnatmasdan",
      langTitle: "O‘z tilingizda",
      replyKicker: "Javob namunasi",
      replyTitle: "Bitta qadam",
      replyText: "Bot nima uchun xavfli ekanini tushuntiradi va hozir nima qilishni aytadi.",
      chatSubtitle: "bot",
      chatForwarded: "Uzatilgan",
      chatScam: "Bank xavfsizlik xizmati. SMS-kodni ayting.",
      chatVerdict: "Yuqori xavf · 75/100",
      chatReason: "SMS-kod so‘rashmoqda va o‘zini bank deb ko‘rsatmoqda.",
      chatNext: "Qo‘ng‘iroqni tugating va karta orqasidagi raqamga qo‘ng‘iroq qiling.",
      chatButtons: ["Keyin nima qilish kerak", "Yana tekshirish"],
      rows: [
        [
          "Yuborilgan xabarlar va havolalar",
          "Istalgan chatdan yuboring — bot tahlil qilib javob beradi",
          "darhol",
        ],
        ["Skrinshot va ovozli xabarlar", "Aniqlashdan oldin bot ruxsat so‘raydi", "rozilik bilan"],
        ["Tillar", "Javob rus, o‘zbek yoki ingliz tilida", "RU · UZ · EN"],
      ],
      rowsCta: "@scamguard_bot’ga o‘tish",
      rowsTitle: "To‘g‘ridan-to‘g‘ri Telegram’dan yuboring",
      rowsText:
        "Hech narsa o‘rnatish shart emas — bot Telegram’da bir necha soniyada javob beradi.",
    },
    urgent: {
      label: "Shoshilinch yordam",
      badge: "Har bir daqiqa muhim",
      title: "Kod yoki pulni yuborib qo‘ydingizmi?",
      lead: "Tekshiruv natijasini kutmang. Quyidagi raqamlardan biriga qo‘ng‘iroq qiling va uch qadamni tartib bilan bajaring.",
      guide: "Bosqichma-bosqich ko‘rsatma",
      call: "Qo‘ng‘iroq qilish",
      when: "Qachon qo‘ng‘iroq qilish kerak",
      cards: {
        "102": {
          tag: "Shoshilinch",
          text: "Jinoyat va firibgarlik. Pul allaqachon ketgan bo‘lsa, qo‘ng‘iroq qiling.",
          when: [
            "Firibgarlarga pul o‘tkazdingiz",
            "Kod yoki karta ma’lumotlarini aytdingiz",
            "Sizga tahdid yoki bosim o‘tkazishyapti",
          ],
        },
        "+998712000044": {
          tag: "Ishonch telefoni",
          text: "Omonatlar va bank firibgarligi. Agar bank yordam bermasa.",
          when: [
            "Bank firibgarligi",
            "Omonatlar bo‘yicha savollar",
            "Bank murojaatga javob bermayapti",
          ],
        },
        "1257": {
          tag: "Call-markaz",
          text: "Karta operatsiyalari. UZCARD kartasini bloklash.",
          when: [
            "Kartada shubhali operatsiya",
            "Kartani zudlik bilan bloklash kerak",
            "UZCARD karta ma’lumotlarini aytdingiz",
          ],
        },
      } as Record<string, UrgentCardCopy>,
      stepsTitle: "Uch qadam — tartib bilan.",
      stepsLead: "Kartadan boshlang: bloklangan karta yangi yechib olishlarni to‘xtatadi.",
      steps: [
        ["Kartani bloklang", "Bank ilovasida yoki karta orqasidagi raqam orqali."],
        ["Bankka qo‘ng‘iroq qiling", "O‘tkazmani to‘xtatish va murojaatni qayd etishni so‘rang."],
        ["Parolni almashtiring", "Keyin politsiyaga ariza bering."],
      ],
      note: "Haqiqiy bank ham SMS-kod, PIN, CVV yoki parolni so‘ramaydi.",
    },
    directory: {
      label: "Ma’lumotnoma",
      badge: "Tasdiqlangan raqamlar",
      title: "O‘zingiz qo‘ng‘iroq qiling — ma’lumotnomadagi raqamga.",
      lead: "O‘zbekiston banklari, to‘lov tizimlari, operatorlari va davlat xizmatlarining kontaktlari.",
      cta: "Ma’lumotnomani ochish",
      stats: [
        ["Tasdiqlangan kontaktlar", "Raqamlar va qisqa kodlar — faqat rasmiy manbalardan."],
        ["Tashkilotlar", "Banklar, to‘lov tizimlari, operatorlar va davlat xizmatlari."],
        [
          "Bank liniyalari",
          "O‘zingiz qo‘ng‘iroq qiling — shu yerdagi yoki karta orqasidagi raqamga.",
        ],
      ],
      note: "Haqiqiy bank ham SMS-kod, PIN, CVV, parol yoki ilova o‘rnatishni so‘ramaydi.",
    },
    faq: {
      label: "Ko‘p beriladigan savollar",
      title: "Agar allaqachon yuz bergan bo‘lsa-chi?",
      lead: "Eng ko‘p uchraydigan oltita holat. Har biri uchun — hozir nima qilish kerak.",
      items: [
        {
          q: "«Bank xavfsizlik xizmati»dan qo‘ng‘iroq qilishyapti — bu rostmi?",
          a: "Haqiqiy bank SMS-kod, parol yoki havola orqali ilova o‘rnatishni so‘ramaydi. Qo‘ng‘iroqni tugating va karta orqasidagi raqamga o‘zingiz qo‘ng‘iroq qiling.",
        },
        {
          q: "SMS-kodni aytib qo‘ydim — nima qilish kerak?",
          a: "Darhol kartani bank ilovasi yoki bankning rasmiy raqami orqali bloklang, parolni almashtiring va kod firibgarlarga tushgan bo‘lishi mumkinligini bankka ayting.",
        },
        {
          q: "Shubhali ilova (APK) o‘rnatdim — telefonim xavf ostidami?",
          a: "Aviarejimni yoqing, bank ilovalarini ochmang, APK’ni o‘chiring va boshqa qurilmadan bank bilan bog‘laning.",
        },
        {
          q: "Pulni «xavfsiz hisob»ga o‘tkazdim — qaytarib olsa bo‘ladimi?",
          a: "Kutmang: bankka qo‘ng‘iroq qilib, o‘tkazmani to‘xtatish va murojaatni qayd etishni so‘rang. Keyin politsiyaga ariza bering.",
        },
        {
          q: "Telegram’da «bank menejeri» yozyapti — javob beraymi?",
          a: "Javob bermang va havolalarni ochmang. Bank masalalarni rasmiy ilovada yoki karta orqasidagi raqam orqali hal qiladi.",
        },
        {
          q: "Havolani tekshirmoqchiman, lekin ochishdan qo‘rqaman",
          a: "Uni ochmang. Manzilni matn sifatida nusxalab, tekshiruvga joylashtiring — sahifani ochmasdan xavf belgilarini ko‘rib chiqamiz.",
        },
      ],
    },
    more: {
      label: "Yana foydali",
      cards: [
        {
          title: "Firibgarlik sxemalari",
          text: "Qaysi hiylalar **ko‘p uchraydi** va ularni qanday tanish mumkin.",
        },
        {
          title: "Sxema haqida xabar bering",
          text: "Holatni **shaxsiy ma’lumotlarsiz** tasvirlang — tekshiruvdan so‘ng u boshqalarni ogohlantirishga yordam beradi.",
        },
        {
          title: "Maxfiylik",
          text: "**Ro‘yxatdan o‘tmasdan.** Raqamlar niqoblanadi, kodlar va parollar saqlanmaydi.",
        },
      ],
    },
  },
  en: {
    hero: {
      eyebrow: "Scam check for Uzbekistan",
      title: ["Don’t take it on trust.", "Check it in seconds."],
      lead: "Paste **a number, link or message**. We show **the risk level**, the reasons in plain words and **one safe next step**.",
      chips: ["Free", "No signup", "Text never published", "RU · UZ · EN"],
      checks: "checks",
      urgentTitle: "Already sent a code or money?",
      urgentText: "Open the urgent steps — every minute counts",
      bot: "Open the Telegram bot",
      botNote: "Forward a suspicious message to the bot right from the chat.",
      checkerLabel: "Quick check",
      checkerTitle: "What do you want to check?",
      getLabel: "What you get",
      get: [
        ["Risk level", "from 0 to 100"],
        ["Reasons", "in plain words"],
        ["One step", "what to do now"],
      ],
      privacy: "We never ask for SMS codes, PINs or passwords.",
      details: "Detailed breakdown",
      hideDetails: "Hide breakdown",
    },
    kinds: {
      label: "What you can check",
      note: "We detect the type — just paste it into the form",
      example: "Example",
      items: [
        {
          name: "Phone",
          title: "The number that calls or writes to you",
          text: "We compare it with the official directory and confirmed reports.",
          sample: "+998 •• ••• •• ••",
        },
        {
          name: "Link",
          title: "A website or link from SMS and Telegram",
          text: "Odd domains, short links, misspelled bank names, APK files.",
          sample: "uzpost-pay.top",
        },
        {
          name: "Message",
          title: "SMS or email text, or an @username",
          text: "Requests for a code, a “safe account”, pressure and urgency.",
          sample: "“Tell us the SMS code”",
        },
        {
          name: "Screenshot",
          title: "A photo or screenshot of the chat",
          text: "We read the text in the image — only after you agree.",
          sample: "PNG · JPG · WEBP",
        },
      ],
    },
    how: {
      label: "How it works",
      statement: [
        "Scammers rush you. We don’t: ",
        "in seconds we show how dangerous it is and what to do.",
      ],
      steps: [
        {
          title: "Send what looks suspicious",
          text: "A number, link, @username, message text or screenshot. **No signup needed.**",
        },
        {
          title: "Get a clear answer",
          text: "**The risk level and the reasons** in plain words — no technical jargon.",
        },
        {
          title: "Take one safe step",
          text: "For example: **hang up and call the number on your card.** Or simply don’t open the link.",
        },
      ],
    },
    bot: {
      label: "Telegram bot",
      badge: "Works in Telegram",
      title: "The same helper — in Telegram.",
      lead: "Forward a suspicious message to the bot straight from the chat — the answer arrives in seconds, in Russian, Uzbek or English.",
      fastTitle: "Forward it — the answer comes in seconds.",
      fastText: "No signup, no app to install",
      langTitle: "In your language",
      replyKicker: "Example reply",
      replyTitle: "One step",
      replyText: "The bot explains why it’s dangerous and what to do right now.",
      chatSubtitle: "bot",
      chatForwarded: "Forwarded",
      chatScam: "Bank security service. Tell us the SMS code.",
      chatVerdict: "High risk · 75/100",
      chatReason: "Asks for an SMS code and pretends to be the bank.",
      chatNext: "Hang up and call the number on the back of your card.",
      chatButtons: ["What to do next", "Check another"],
      rows: [
        [
          "Forwarded messages and links",
          "Forward from any chat — the bot reviews it and replies",
          "instantly",
        ],
        [
          "Screenshots and voice notes",
          "The bot asks for permission before reading them",
          "with consent",
        ],
        ["Languages", "Replies in Russian, Uzbek or English", "RU · UZ · EN"],
      ],
      rowsCta: "Go to @scamguard_bot",
      rowsTitle: "Forward straight from Telegram",
      rowsText: "Nothing to install — the bot replies in Telegram within seconds.",
    },
    urgent: {
      label: "Urgent help",
      badge: "Every minute counts",
      title: "Already sent a code or money?",
      lead: "Don’t wait for a check result. Call one of the numbers below and take the three steps in order.",
      guide: "Step-by-step guide",
      call: "Call",
      when: "When to call",
      cards: {
        "102": {
          tag: "Emergency",
          text: "Crime and fraud. Call if money has already left.",
          when: [
            "You sent money to scammers",
            "You shared a code or card details",
            "You are being threatened or pressured",
          ],
        },
        "+998712000044": {
          tag: "Hotline",
          text: "Deposits and banking fraud. If your bank does not help.",
          when: ["Banking fraud", "Questions about deposits", "The bank ignores your complaint"],
        },
        "1257": {
          tag: "Call centre",
          text: "Card transactions. Blocking a UZCARD card.",
          when: [
            "A suspicious card transaction",
            "You need to block the card now",
            "You shared UZCARD card details",
          ],
        },
      } as Record<string, UrgentCardCopy>,
      stepsTitle: "Three steps — in order.",
      stepsLead: "Start with the card: a blocked card stops new charges.",
      steps: [
        ["Block your card", "In your bank’s app or via the number on the back of the card."],
        ["Call your bank", "Ask them to stop the transfer and register your report."],
        ["Change your password", "Then file a report with the police."],
      ],
      note: "Even your real bank never asks for an SMS code, PIN, CVV or password.",
    },
    directory: {
      label: "Directory",
      badge: "Verified numbers",
      title: "Call back yourself — using a number from the directory.",
      lead: "Contacts for Uzbekistan’s banks, payment systems, mobile operators and public services.",
      cta: "Open the directory",
      stats: [
        ["Verified contacts", "Numbers and short codes from official sources only."],
        ["Organisations", "Banks, payment systems, mobile operators and public services."],
        ["Bank lines", "Call back yourself — using a number from here or on your card."],
      ],
      note: "Even your real bank never asks for an SMS code, PIN, CVV, password or to install an app.",
    },
    faq: {
      label: "FAQ",
      title: "What if it already happened?",
      lead: "The six situations people come with most often — and what to do right now.",
      items: [
        {
          q: "A “bank security service” is calling me — is it real?",
          a: "A real bank never asks for an SMS code, a password or to install an app from a link. Hang up and call the number on your card.",
        },
        {
          q: "I already gave away an SMS code — what now?",
          a: "Block your card right away in the app or via your bank’s official number, change your password and tell the bank the code may have reached scammers.",
        },
        {
          q: "I installed a suspicious app (APK) — is my phone at risk?",
          a: "Turn on airplane mode, don’t open banking apps, delete the APK and contact your bank from another device.",
        },
        {
          q: "I moved money to a “safe account” — can I get it back?",
          a: "Don’t wait: call your bank, ask them to stop the transfer and register your report. Then file a report with the police.",
        },
        {
          q: "A “bank manager” is messaging me on Telegram — should I reply?",
          a: "Don’t reply or open any links. Banks handle issues in their official app or via the number on your card.",
        },
        {
          q: "I want to check a link but I’m afraid to open it",
          a: "Don’t open it. Copy the address as text and paste it into the check — we look for risk signs without visiting the site.",
        },
      ],
    },
    more: {
      label: "More",
      cards: [
        {
          title: "Scam patterns",
          text: "**The most common tricks** and how to spot them.",
        },
        {
          title: "Report a scheme",
          text: "Describe what happened **without personal data** — after review it helps warn others.",
        },
        {
          title: "Privacy",
          text: "**No signup.** Numbers are masked; codes and passwords are never stored.",
        },
      ],
    },
  },
} satisfies Record<Lang, unknown>;

export type HomeCopy = (typeof HOME_COPY)["ru"];
