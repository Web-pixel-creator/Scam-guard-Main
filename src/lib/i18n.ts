export type Lang = "ru" | "uz" | "en";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "ru", label: "Русский" },
  { code: "uz", label: "O‘zbekcha" },
  { code: "en", label: "English" },
];

type Dict = Record<string, { ru: string; uz: string; en: string }>;

export const t_dict: Dict = {
  brand: { ru: "Ishonch Guard", uz: "Ishonch Guard", en: "Ishonch Guard" },
  nav_check: { ru: "Проверка", uz: "Tekshirish", en: "Check" },
  nav_report: { ru: "Сообщить", uz: "Xabar berish", en: "Report" },
  nav_emergency: { ru: "Помощь", uz: "Yordam", en: "Emergency" },
  nav_privacy: { ru: "Приватность", uz: "Maxfiylik", en: "Privacy" },

  hero_title: {
    ru: "Проверьте номер, Telegram или ссылку до того, как вас обманут",
    uz: "Aldanishdan oldin raqam, Telegram yoki havolani tekshiring",
    en: "Check a number, Telegram or link before you get scammed",
  },
  hero_sub: {
    ru: "Ishonch Guard помогает распознать телефонных, SMS и Telegram-мошенников в Узбекистане. Вставьте подозрительный номер, ссылку, username или текст сообщения — получите оценку риска и понятные шаги, что делать дальше.",
    uz: "Ishonch Guard O‘zbekistondagi telefon, SMS va Telegram firibgarlarini tanib olishga yordam beradi. Shubhali raqam, havola, username yoki xabar matnini joylashtiring — xavf bahosini va keyingi aniq qadamlarni oling.",
    en: "Ishonch Guard helps you spot phone, SMS and Telegram scammers in Uzbekistan. Paste a suspicious number, link, username or message text — get a risk assessment and clear next steps.",
  },

  input_placeholder: {
    ru: "Вставьте номер, Telegram username, ссылку или текст сообщения…",
    uz: "Raqam, Telegram username, havola yoki xabar matnini joylashtiring…",
    en: "Paste a number, Telegram username, link or message text…",
  },
  check_now: { ru: "Проверить риск", uz: "Xavfni tekshirish", en: "Check risk" },
  check_hint: {
    ru: "Проверка занимает несколько секунд. Мы не сохраняем полные номера и коды.",
    uz: "Tekshirish bir necha soniya oladi. To‘liq raqam va kodlarni saqlamaymiz.",
    en: "Takes a few seconds. We don’t store full numbers or codes.",
  },
  checking: { ru: "Анализирую…", uz: "Tahlil qilinmoqda…", en: "Analyzing…" },
  report_btn: { ru: "Сообщить о мошеннике", uz: "Firibgarni xabar qilish", en: "Report a scammer" },

  risk_safe: { ru: "Безопасно", uz: "Xavfsiz", en: "Safe" },
  risk_unknown: { ru: "Недостаточно данных", uz: "Ma’lumot yetarli emas", en: "Not enough data" },
  risk_suspicious: { ru: "Требуется осторожность", uz: "Ehtiyot bo‘ling", en: "Be cautious" },
  risk_high: { ru: "Высокий риск", uz: "Yuqori xavf", en: "High risk" },

  why_title: { ru: "Почему мы так считаем", uz: "Nima uchun shunday hisoblayapmiz", en: "Why we think so" },
  what_to_do: { ru: "Что делать", uz: "Nima qilish kerak", en: "What to do" },
  ai_explanation: { ru: "Объяснение", uz: "Tushuntirish", en: "Explanation" },

  privacy_promise: {
    ru: "Мы никогда не просим OTP, PIN, CVV, пароли или полные данные карты. Номера и Telegram ID обрабатываются в защищённом виде.",
    uz: "Biz hech qachon OTP, PIN, CVV, parol yoki to‘liq karta ma’lumotlarini so‘ramaymiz. Raqamlar va Telegram ID himoyalangan tarzda qayta ishlanadi.",
    en: "We never ask for OTP, PIN, CVV, passwords or full card details. Numbers and Telegram IDs are processed in a protected way.",
  },
  disclaimer: {
    ru: "Ishonch Guard помогает оценить риск, но не заменяет банк, правоохранительные органы или юридическую консультацию.",
    uz: "Ishonch Guard xavfni baholashga yordam beradi, lekin bank, huquq idoralari yoki yuridik maslahat o‘rnini bosmaydi.",
    en: "Ishonch Guard helps assess risk but does not replace your bank, law enforcement or legal advice.",
  },

  schemes_title: { ru: "Популярные схемы", uz: "Mashhur sxemalar", en: "Common schemes" },
  how_it_works: { ru: "Как это работает", uz: "Bu qanday ishlaydi", en: "How it works" },
  step_1: { ru: "Вставьте подозрительное", uz: "Shubhalini joylashtiring", en: "Paste the suspicious thing" },
  step_1_d: { ru: "Номер, Telegram, ссылка или текст сообщения.", uz: "Raqam, Telegram, havola yoki xabar matni.", en: "Number, Telegram, link or message text." },
  step_2: { ru: "Анализ за секунды", uz: "Bir necha soniyada tahlil", en: "Analysis in seconds" },
  step_2_d: {
    ru: "Правила, база жалоб и AI помогают оценить риск и объяснить признаки мошенничества.",
    uz: "Qoidalar, shikoyatlar bazasi va AI xavfni baholab, firibgarlik belgilarini tushuntiradi.",
    en: "Rules, a reports database and AI help assess risk and explain scam signals.",
  },
  step_3: { ru: "Понятная оценка риска", uz: "Tushunarli xavf bahosi", en: "Clear risk assessment" },
  step_3_d: { ru: "С конкретными шагами, что делать дальше.", uz: "Keyingi qadamlar bo‘yicha aniq tavsiyalar bilan.", en: "With concrete next steps to take." },

  emergency_title: { ru: "Уже отправили код или деньги?", uz: "Kod yoki pulni allaqachon yubordingizmi?", en: "Already sent a code or money?" },
  emergency_cta: { ru: "Срочные шаги", uz: "Shoshilinch qadamlar", en: "Emergency steps" },

  example_title: { ru: "Так выглядит проверка", uz: "Tekshiruv qanday ko‘rinadi", en: "What a check looks like" },
  example_sub: {
    ru: "Вы вставляете подозрительное сообщение — мы показываем оценку риска, причины и шаги.",
    uz: "Siz shubhali xabarni joylashtirasiz — biz xavf bahosi, sabablar va qadamlarni ko‘rsatamiz.",
    en: "You paste the suspicious message — we show the risk level, reasons and steps.",
  },

  footer_made: { ru: "Анти-скам ассистент для Узбекистана", uz: "O‘zbekiston uchun anti-skam yordamchi", en: "Anti-scam assistant for Uzbekistan" },

  attach_screenshot: { ru: "Прикрепить скриншот", uz: "Skrinshot biriktirish", en: "Attach screenshot" },
  remove_screenshot: { ru: "Удалить", uz: "O‘chirish", en: "Remove" },
  screenshot_warning: {
    ru: "Перед анализом мы автоматически маскируем OTP-коды, номера карт и телефоны. Картинка не сохраняется в базе — мы храним только обезличенный текст.",
    uz: "Tahlildan oldin OTP kodlar, karta va telefon raqamlari avtomatik niqoblanadi. Rasm bazada saqlanmaydi — faqat shaxsiy ma’lumotlarsiz matn saqlanadi.",
    en: "Before analysis we automatically mask OTP codes, card numbers and phones. The image is not stored — we keep only the redacted text.",
  },
  screenshot_too_large: {
    ru: "Файл слишком большой. Максимум 4 МБ.",
    uz: "Fayl juda katta. Maksimum 4 MB.",
    en: "File is too large. Max 4 MB.",
  },
  rate_limited: {
    ru: "Слишком много проверок. Подождите немного и попробуйте снова.",
    uz: "Juda ko‘p tekshiruv. Biroz kuting va qayta urinib ko‘ring.",
    en: "Too many checks. Please wait a moment and try again.",
  },

  ocr_preview_title: {
    ru: "Извлечённый текст из скриншота",
    uz: "Skrinshotdan olingan matn",
    en: "Extracted text from screenshot",
  },
  ocr_preview_hint: {
    ru: "Проверьте и при необходимости отредактируйте текст перед отправкой на анализ. Чувствительные данные (OTP, карты, телефоны) уже замаскированы.",
    uz: "Tahlilga yuborishdan oldin matnni tekshiring va kerak bo‘lsa tahrirlang. Sezuvchan ma’lumotlar (OTP, kartalar, telefonlar) allaqachon niqoblangan.",
    en: "Review and edit the text before sending it for analysis. Sensitive data (OTP, cards, phones) is already masked.",
  },
  ocr_check_this: { ru: "Проверить этот текст", uz: "Bu matnni tekshirish", en: "Check this text" },
  ocr_cancel: { ru: "Отменить", uz: "Bekor qilish", en: "Cancel" },
  ocr_recognizing: { ru: "Распознаю текст…", uz: "Matnni aniqlanmoqda…", en: "Recognizing text…" },
  ocr_failed: {
    ru: "Не удалось распознать текст. Попробуйте другой скриншот или вставьте текст вручную.",
    uz: "Matnni aniqlab bo‘lmadi. Boshqa skrinshotni sinab ko‘ring yoki matnni qo‘lda joylashtiring.",
    en: "Could not recognize text. Try another screenshot or paste the text manually.",
  },
};


export function t(key: keyof typeof t_dict, lang: Lang) {
  return t_dict[key]?.[lang] ?? key;
}
