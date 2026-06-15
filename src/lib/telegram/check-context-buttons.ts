import type { Lang } from "@/lib/i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";

export type AskedContextKind = "code" | "card" | "transfer" | "apk" | "link_qr" | "call";

const PREFIX = "asked:";

export function askedContextCallback(kind: AskedContextKind): string {
  return `${PREFIX}${kind}`;
}

export function parseAskedContextCallback(data: string): AskedContextKind | null {
  if (!data.startsWith(PREFIX)) return null;
  const value = data.slice(PREFIX.length);
  if (
    value === "code" ||
    value === "card" ||
    value === "transfer" ||
    value === "apk" ||
    value === "link_qr" ||
    value === "call"
  ) {
    return value;
  }
  return null;
}

export function buildAskedContextKeyboardRows(lang: Lang): InlineKeyboard {
  const labels: Record<Lang, Record<AskedContextKind, string>> = {
    ru: {
      code: "🔐 Просят код",
      card: "💳 Просят карту",
      transfer: "💸 Просят перевод",
      apk: "📦 APK/приложение",
      link_qr: "🔗 Ссылка/QR",
      call: "📞 Звонят сейчас",
    },
    uz: {
      code: "🔐 Kod so'rashdi",
      card: "💳 Karta so'rashdi",
      transfer: "💸 Pul o'tkazish",
      apk: "📦 APK/ilova",
      link_qr: "🔗 Havola/QR",
      call: "📞 Hozir qo'ng'iroq",
    },
    en: {
      code: "🔐 Asked for code",
      card: "💳 Asked for card",
      transfer: "💸 Asked transfer",
      apk: "📦 APK/app",
      link_qr: "🔗 Link/QR",
      call: "📞 Calling now",
    },
  };

  const l = labels[lang];
  return [
    [
      { text: l.code, callback_data: askedContextCallback("code") },
      { text: l.card, callback_data: askedContextCallback("card") },
    ],
    [
      { text: l.transfer, callback_data: askedContextCallback("transfer") },
      { text: l.apk, callback_data: askedContextCallback("apk") },
    ],
    [
      { text: l.link_qr, callback_data: askedContextCallback("link_qr") },
      { text: l.call, callback_data: askedContextCallback("call") },
    ],
  ];
}

export function buildAskedContextFollowUpKeyboard(lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("btn_emergency", lang), callback_data: "emergency" }],
    [{ text: bt("btn_check_another", lang), callback_data: "check_another" }],
  ];
}

export function buildAskedContextText(kind: AskedContextKind, lang: Lang): string {
  const text: Record<AskedContextKind, Record<Lang, string>> = {
    code: {
      ru: [
        "🔐 Просят SMS-код, OTP или Telegram-код",
        "",
        "Это сильный красный флаг. Код нужен, чтобы войти в ваш банк, Telegram или подтвердить операцию.",
        "",
        "Сделайте сейчас:",
        "1. Не отправляйте код.",
        "2. Завершите разговор.",
        "3. Перезвоните в банк или сервис сами по официальному номеру.",
      ].join("\n"),
      uz: [
        "🔐 SMS-kod, OTP yoki Telegram-kod so'rashyapti",
        "",
        "Bu kuchli xavf belgisi. Kod bank, Telegram yoki operatsiyani tasdiqlash uchun kerak bo'lishi mumkin.",
        "",
        "Hozir qiling:",
        "1. Kodni yubormang.",
        "2. Suhbatni tugating.",
        "3. Bank yoki servisga rasmiy raqam orqali o'zingiz qo'ng'iroq qiling.",
      ].join("\n"),
      en: [
        "🔐 They asked for an SMS, OTP, or Telegram code",
        "",
        "This is a strong red flag. A code can open your bank, Telegram, or confirm a payment.",
        "",
        "Do now:",
        "1. Do not send the code.",
        "2. End the conversation.",
        "3. Call the bank/service yourself using the official number.",
      ].join("\n"),
    },
    card: {
      ru: [
        "💳 Просят карту, CVV, PIN или фото карты",
        "",
        "Это риск доступа к деньгам. Настоящий банк не просит CVV, PIN и коды в чате.",
        "",
        "Сделайте сейчас:",
        "1. Ничего не отправляйте.",
        "2. Если уже отправили — заблокируйте карту.",
        "3. Пришлите скрин переписки, я подскажу следующий шаг.",
      ].join("\n"),
      uz: [
        "💳 Karta, CVV, PIN yoki karta rasmini so'rashyapti",
        "",
        "Bu pulingizga kirish xavfi. Haqiqiy bank chatda CVV, PIN yoki kod so'ramaydi.",
        "",
        "Hozir qiling:",
        "1. Hech narsa yubormang.",
        "2. Yuborgan bo'lsangiz — kartani bloklang.",
        "3. Suhbat skrinini yuboring, keyingi qadamni aytaman.",
      ].join("\n"),
      en: [
        "💳 They asked for card data, CVV, PIN, or a card photo",
        "",
        "This risks access to your money. A real bank will not ask for CVV, PIN, or codes in chat.",
        "",
        "Do now:",
        "1. Send nothing.",
        "2. If you already sent it, block the card.",
        "3. Send a chat screenshot and I will guide the next step.",
      ].join("\n"),
    },
    transfer: {
      ru: [
        "💸 Просят перевести деньги",
        "",
        "Оплата доступа, «безопасный счёт», комиссия за приз или возврат — частые схемы.",
        "",
        "Сделайте сейчас:",
        "1. Не переводите повторно.",
        "2. Сохраните чек, чат и номер получателя.",
        "3. Если уже перевели — звоните в банк и просите заморозить операцию.",
      ].join("\n"),
      uz: [
        "💸 Pul o'tkazishni so'rashyapti",
        "",
        "Kirish to'lovi, «xavfsiz hisob», sovrin komissiyasi yoki qaytarish — keng tarqalgan sxemalar.",
        "",
        "Hozir qiling:",
        "1. Qayta pul yubormang.",
        "2. Chek, chat va qabul qiluvchi raqamini saqlang.",
        "3. Yuborgan bo'lsangiz — bankka qo'ng'iroq qilib, operatsiyani muzlatishni so'rang.",
      ].join("\n"),
      en: [
        "💸 They asked you to transfer money",
        "",
        "Access fees, a “safe account”, prize commission, or refund fee are common scam paths.",
        "",
        "Do now:",
        "1. Do not send more money.",
        "2. Save the receipt, chat, and recipient number.",
        "3. If paid already, call the bank and ask to freeze the transaction.",
      ].join("\n"),
    },
    apk: {
      ru: [
        "📦 Просят установить APK или приложение",
        "",
        "Это высокий риск: приложение может читать SMS, уведомления и управлять телефоном.",
        "",
        "Сделайте сейчас:",
        "1. Не устанавливайте файл.",
        "2. Если установили — включите авиарежим.",
        "3. Удалите приложение и смените пароли с другого устройства.",
      ].join("\n"),
      uz: [
        "📦 APK yoki ilova o'rnatishni so'rashyapti",
        "",
        "Bu yuqori xavf: ilova SMS, bildirishnomalar va telefonni boshqarishi mumkin.",
        "",
        "Hozir qiling:",
        "1. Faylni o'rnatmang.",
        "2. O'rnatgan bo'lsangiz — aviarejimni yoqing.",
        "3. Ilovani o'chiring va parollarni boshqa qurilmadan almashtiring.",
      ].join("\n"),
      en: [
        "📦 They asked you to install an APK or app",
        "",
        "High risk: the app may read SMS, notifications, and control the phone.",
        "",
        "Do now:",
        "1. Do not install it.",
        "2. If installed, turn on airplane mode.",
        "3. Remove the app and change passwords from another device.",
      ].join("\n"),
    },
    link_qr: {
      ru: [
        "🔗 Просят открыть ссылку или QR",
        "",
        "Ссылка/QR опасны, если после перехода просят вход в Telegram, код, карту, оплату или подключение кошелька.",
        "",
        "Сделайте сейчас:",
        "1. Не вводите данные после перехода.",
        "2. Проверьте адрес сайта.",
        "3. Пришлите ссылку или следующий экран после QR.",
      ].join("\n"),
      uz: [
        "🔗 Havola yoki QR ochishni so'rashyapti",
        "",
        "Havola/QR xavfli bo'ladi, agar keyin Telegram login, kod, karta, to'lov yoki hamyon ulash so'ralsa.",
        "",
        "Hozir qiling:",
        "1. O'tgandan keyin ma'lumot kiritmang.",
        "2. Sayt manzilini tekshiring.",
        "3. Havolani yoki QRdan keyingi ekranni yuboring.",
      ].join("\n"),
      en: [
        "🔗 They asked you to open a link or QR",
        "",
        "A link/QR becomes risky if it asks for Telegram login, a code, card data, payment, or wallet connect.",
        "",
        "Do now:",
        "1. Enter no data after opening it.",
        "2. Check the website address.",
        "3. Send the link or the next screen after the QR.",
      ].join("\n"),
    },
    call: {
      ru: [
        "📞 Звонят прямо сейчас",
        "",
        "Не спорьте и не отвечайте на вопросы. Ваша задача — спокойно завершить звонок.",
        "",
        "Скажите одну фразу:",
        "«Я сам перезвоню по официальному номеру».",
        "",
        "Потом положите трубку и нажмите «Экстренная помощь».",
      ].join("\n"),
      uz: [
        "📞 Hozir qo'ng'iroq qilishyapti",
        "",
        "Bahslashmang va savollarga javob bermang. Vazifa — suhbatni tinch tugatish.",
        "",
        "Bitta jumla ayting:",
        "«Men rasmiy raqamga o'zim qayta qo'ng'iroq qilaman».",
        "",
        "Keyin qo'ng'iroqni tugating va «Emergency» tugmasini bosing.",
      ].join("\n"),
      en: [
        "📞 They are calling right now",
        "",
        "Do not argue or answer questions. Your job is to end the call calmly.",
        "",
        "Say one phrase:",
        "“I will call back myself using the official number.”",
        "",
        "Then hang up and press “Emergency help”.",
      ].join("\n"),
    },
  };

  return text[kind][lang];
}
