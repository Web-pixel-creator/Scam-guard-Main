// Emergency checklist builder — dynamically pulls official numbers from
// the verified-contacts module instead of hardcoding them in i18n strings.
//
// Product decision (D-011): show verified official contacts as a callback
// directory. The user should hang up and call back themselves.
//
// Scenarios covered:
//   1. Sent SMS-code / OTP
//   2. Installed an APK
//   3. Transferred money
//   4. Entered card details
//   5. Lost access to Telegram
//   6. Currently on a suspicious call
//
// Each scenario: immediate action → do NOT do → call official contact →
// save evidence → report.

import type { Lang } from "@/lib/i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import { VERIFIED_CONTACTS, type VerifiedContact } from "@/lib/risk/verified-contacts";
import { bt } from "@/lib/telegram/bot-i18n";

// ── Contact helpers ─────────────────────────────────────────────────────────

/** Get key contacts for emergency display (banks, police, payment systems). */
function getEmergencyContacts(): {
  police: VerifiedContact;
  banks: VerifiedContact[];
  payments: VerifiedContact[];
  telecom: VerifiedContact[];
  cyber: VerifiedContact | undefined;
} {
  const police = VERIFIED_CONTACTS.find((c) => c.normalized === "102")!;
  const banks = VERIFIED_CONTACTS.filter(
    (c) => c.orgType === "bank" && c.contactType === "short_code",
  );
  const payments = VERIFIED_CONTACTS.filter(
    (c) => c.orgType === "payment_system" && c.contactType === "short_code",
  );
  const telecom = VERIFIED_CONTACTS.filter(
    (c) => c.orgType === "telecom" && c.contactType === "short_code",
  );
  const cyber = VERIFIED_CONTACTS.find((c) => c.orgType === "cybersecurity");
  return { police, banks, payments, telecom, cyber };
}

/** Format a contact for display: "Org — number" */
function fmtContact(c: VerifiedContact, lang: Lang): string {
  return `${c.org[lang]} — ${c.display}`;
}

/** Format a list of contacts as bullet points */
function contactList(contacts: VerifiedContact[], lang: Lang): string {
  return contacts.map((c) => `  • ${fmtContact(c, lang)}`).join("\n");
}

// ── Text builders per language ──────────────────────────────────────────────

const TITLES: Record<Lang, string> = {
  ru: "🚨 ЭКСТРЕННЫЕ ШАГИ",
  uz: "🚨 SHOSHILINCH QADAMLAR",
  en: "🚨 EMERGENCY STEPS",
};

const DISCLAIMER: Record<Lang, string> = {
  ru: "⚠️ Ishonch Guard помогает сориентироваться, но не заменяет банк или правоохранительные органы.",
  uz: "⚠️ Ishonch Guard yo'l-yo'riq beradi, lekin bank yoki huquq-tartibot organlarini almashtirmaydi.",
  en: "⚠️ Ishonch Guard helps you orient, but does not replace banks or law enforcement.",
};

interface Scenario {
  title: Record<Lang, string>;
  steps: Record<Lang, string[]>;
}

function buildScenarios(contacts: ReturnType<typeof getEmergencyContacts>): Scenario[] {
  const bankList = (lang: Lang) => contactList(contacts.banks, lang);
  const paymentList = (lang: Lang) => contactList(contacts.payments, lang);
  const telecomList = (lang: Lang) => contactList(contacts.telecom, lang);
  const policeLine = (lang: Lang) => fmtContact(contacts.police, lang);
  const cyberLine = (lang: Lang) => (contacts.cyber ? fmtContact(contacts.cyber, lang) : "");

  return [
    // ─── Scenario 1: SMS-code / OTP ───────────────────────────────────────
    {
      title: {
        ru: "1️⃣ Я отправил SMS-код / OTP",
        uz: "1️⃣ Men SMS-kod / OTP yubordim",
        en: "1️⃣ I sent an SMS code / OTP",
      },
      steps: {
        ru: [
          "⚡ ПОЗВОНИТЕ В БАНК И ЗАБЛОКИРУЙТЕ КАРТУ",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Заблокируйте карту и онлайн-банк.",
          "  2. Смените пароль онлайн-банка и Telegram.",
          "  3. Не переходите по ссылкам из новых сообщений.",
          `  4. Сохраните скриншоты и подайте заявление: ${policeLine("ru")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Контакты:",
          "",
          bankList("ru"),
          paymentList("ru"),
        ],
        uz: [
          "⚡ BANKKA QO'NG'IROQ QILIB, KARTANI BLOKLANG",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Karta va onlayn-bankni bloklang.",
          "  2. Onlayn-bank va Telegram parolini o'zgartiring.",
          "  3. Yangi xabarlardagi havolalarga o'tmang.",
          `  4. Skrinshotlarni saqlang va ariza bering: ${policeLine("uz")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Kontaktlar:",
          "",
          bankList("uz"),
          paymentList("uz"),
        ],
        en: [
          "⚡ CALL YOUR BANK AND BLOCK THE CARD",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Block your card and online banking.",
          "  2. Change your online banking and Telegram passwords.",
          "  3. Do not click links in new messages.",
          `  4. Save screenshots and file a report: ${policeLine("en")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Contacts:",
          "",
          bankList("en"),
          paymentList("en"),
        ],
      },
    },
    // ─── Scenario 2: Installed APK ────────────────────────────────────────
    {
      title: {
        ru: "2️⃣ Я установил APK / приложение",
        uz: "2️⃣ Men APK / ilova o'rnatdim",
        en: "2️⃣ I installed an APK / app",
      },
      steps: {
        ru: [
          "⚡ ВКЛЮЧИТЕ АВИАРЕЖИМ ПРЯМО СЕЙЧАС",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Удалите подозрительное приложение.",
          "  2. Заблокируйте карты через банк.",
          "  3. Смените все пароли с другого устройства.",
          `  4. Подайте заявление: ${policeLine("ru")}`,
          cyberLine("ru") ? `  5. Сообщите: ${cyberLine("ru")}` : "",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Контакты:",
          "",
          bankList("ru"),
        ].filter(Boolean),
        uz: [
          "⚡ HOZIROQ AVIAREZHIMNI YOQING",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Shubhali ilovani o'chiring.",
          "  2. Kartalarni bank orqali bloklang.",
          "  3. Barcha parollarni boshqa qurilmadan o'zgartiring.",
          `  4. Ariza bering: ${policeLine("uz")}`,
          cyberLine("uz") ? `  5. Xabar bering: ${cyberLine("uz")}` : "",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Kontaktlar:",
          "",
          bankList("uz"),
        ].filter(Boolean),
        en: [
          "⚡ TURN ON AIRPLANE MODE RIGHT NOW",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Delete the suspicious app.",
          "  2. Block your cards through your bank.",
          "  3. Change all passwords from another device.",
          `  4. File a report: ${policeLine("en")}`,
          cyberLine("en") ? `  5. Report: ${cyberLine("en")}` : "",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Contacts:",
          "",
          bankList("en"),
        ].filter(Boolean),
      },
    },
    // ─── Scenario 3: Transferred money ────────────────────────────────────
    {
      title: {
        ru: "3️⃣ Я перевёл деньги",
        uz: "3️⃣ Men pul o'tkazdim",
        en: "3️⃣ I transferred money",
      },
      steps: {
        ru: [
          "⚡ ЗВОНИТЕ В БАНК — ПРОСИТЕ ЗАМОРОЗИТЬ ПЕРЕВОД",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Позвоните в банк немедленно.",
          `  2. Подайте заявление: ${policeLine("ru")}`,
          "  3. Сохраните чек, переписку, номер получателя.",
          "  4. «Переведите повторно для отмены» — это вторая схема.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Контакты:",
          "",
          bankList("ru"),
          paymentList("ru"),
        ],
        uz: [
          "⚡ BANKKA QO'NG'IROQ QILING — O'TKAZMANI MUZLATISHNI SO'RANG",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Bankka darhol qo'ng'iroq qiling.",
          `  2. Ariza bering: ${policeLine("uz")}`,
          "  3. Chekni, yozishmani, qabul qiluvchi raqamini saqlang.",
          "  4. «Bekor qilish uchun qayta o'tkazing» — bu ikkinchi firibgarlik.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Kontaktlar:",
          "",
          bankList("uz"),
          paymentList("uz"),
        ],
        en: [
          "⚡ CALL YOUR BANK — ASK TO FREEZE THE TRANSFER",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Call your bank immediately.",
          `  2. File a police report: ${policeLine("en")}`,
          "  3. Save the receipt, chat history, recipient's number.",
          '  4. "Transfer again to cancel" — that\'s a second scam.',
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Contacts:",
          "",
          bankList("en"),
          paymentList("en"),
        ],
      },
    },
    // ─── Scenario 4: Entered card details ─────────────────────────────────
    {
      title: {
        ru: "4️⃣ Я ввёл данные карты",
        uz: "4️⃣ Men karta ma'lumotlarini kiritdim",
        en: "4️⃣ I entered card details",
      },
      steps: {
        ru: [
          "⚡ ЗАБЛОКИРУЙТЕ КАРТУ НЕМЕДЛЕННО",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Позвоните в банк и заблокируйте карту.",
          "  2. Смените PIN и пароль онлайн-банка.",
          "  3. Проверьте операции — оспорьте неизвестные.",
          `  4. Подайте заявление: ${policeLine("ru")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Контакты:",
          "",
          bankList("ru"),
          paymentList("ru"),
        ],
        uz: [
          "⚡ KARTANI DARHOL BLOKLANG",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Bankka qo'ng'iroq qilib, kartani bloklang.",
          "  2. PIN va onlayn-bank parolini o'zgartiring.",
          "  3. Operatsiyalarni tekshiring — noma'lumlarini bahslang.",
          `  4. Ariza bering: ${policeLine("uz")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Kontaktlar:",
          "",
          bankList("uz"),
          paymentList("uz"),
        ],
        en: [
          "⚡ BLOCK YOUR CARD IMMEDIATELY",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Call your bank and block the card.",
          "  2. Change your PIN and online banking password.",
          "  3. Check transactions — dispute unknown ones.",
          `  4. File a report: ${policeLine("en")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Contacts:",
          "",
          bankList("en"),
          paymentList("en"),
        ],
      },
    },
    // ─── Scenario 5: Lost Telegram access ─────────────────────────────────
    {
      title: {
        ru: "5️⃣ Я потерял доступ к Telegram",
        uz: "5️⃣ Men Telegram'ga kirishni yo'qotdim",
        en: "5️⃣ I lost access to Telegram",
      },
      steps: {
        ru: [
          "⚡ ВОССТАНОВИТЕ ЧЕРЕЗ SMS НА ВАШ НОМЕР",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Не получается — блокируйте SIM через оператора.",
          "  2. Telegram: @recover или Settings → Ask a Question.",
          "  3. Предупредите контакты другим способом.",
          `  4. Подайте заявление: ${policeLine("ru")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Контакты:",
          "",
          telecomList("ru"),
        ],
        uz: [
          "⚡ SMS-KOD ORQALI TIKLANG",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Iloji bo'lmasa — SIM-kartani operator orqali bloklang.",
          "  2. Telegram: @recover yoki Settings → Ask a Question.",
          "  3. Kontaktlaringizni boshqa yo'l bilan ogohlantiring.",
          `  4. Ariza bering: ${policeLine("uz")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Kontaktlar:",
          "",
          telecomList("uz"),
        ],
        en: [
          "⚡ RECOVER VIA SMS CODE TO YOUR NUMBER",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. If you can't — block SIM through your operator.",
          "  2. Telegram: @recover or Settings → Ask a Question.",
          "  3. Warn your contacts via other means.",
          `  4. File a report: ${policeLine("en")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Contacts:",
          "",
          telecomList("en"),
        ],
      },
    },
    // ─── Scenario 6: Suspicious call ──────────────────────────────────────
    {
      title: {
        ru: "6️⃣ Подозрительный звонок",
        uz: "6️⃣ Shubhali qo'ng'iroq",
        en: "6️⃣ Suspicious call",
      },
      steps: {
        ru: [
          "⚡ ЗАВЕРШИТЕ ЗВОНОК. СКАЖИТЕ: «Я САМ ПЕРЕЗВОНЮ.»",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Не называйте SMS-код, PIN, CVV, пароль.",
          "  2. «Не кладите трубку» = мошенничество.",
          "  3. Перезвоните сами по официальному номеру.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Контакты:",
          "",
          bankList("ru"),
          telecomList("ru"),
        ],
        uz: [
          "⚡ QO'NG'IROQNI TUGATING. «O'ZIM QO'NG'IROQ QILAMAN» DENG.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. SMS-kod, PIN, CVV, parolni aytmang.",
          "  2. «Go'shakni qo'ymang» = firibgarlik.",
          "  3. Rasmiy raqamga o'zingiz qo'ng'iroq qiling.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Kontaktlar:",
          "",
          bankList("uz"),
          telecomList("uz"),
        ],
        en: [
          '⚡ HANG UP. SAY: "I\'LL CALL BACK MYSELF."',
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Never give SMS code, PIN, CVV, or password.",
          '  2. "Stay on the line" = scam.',
          "  3. Call the organization yourself at the official number.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📞 Contacts:",
          "",
          bankList("en"),
          telecomList("en"),
        ],
      },
    },
    // ─── Scenario 7: Sextortion (photo/video blackmail) ───────────────────
    {
      title: {
        ru: "7️⃣ Меня шантажируют фото/видео",
        uz: "7️⃣ Meni foto/video bilan shantaj",
        en: "7️⃣ Photo/video blackmail",
      },
      steps: {
        ru: [
          "⚡ НЕ ПЛАТИТЕ — ОПЛАТА ПРИВОДИТ К НОВЫМ ТРЕБОВАНИЯМ",
          "",
          "❤️ Вы НЕ виноваты.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Заблокируйте шантажиста.",
          "  2. Не отправляйте новые фото/видео.",
          "  3. Сохраните скриншоты переписки.",
          `  4. Обратитесь в полицию: ${policeLine("ru")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "💡 Многие шантажисты используют страх, чтобы заставить вас платить. Оплата часто приводит к новым требованиям.",
          "",
          "Если вам меньше 18 лет — обратитесь к взрослому, которому доверяете.",
        ],
        uz: [
          "⚡ TO'LAMANG — TO'LOV YANGI TALABLARGA OLIB KELADI",
          "",
          "❤️ Siz AYBDOR EMASSIZ.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Shantajchini bloklang.",
          "  2. Yangi foto/video yubormang.",
          "  3. Yozishma skrinshotlarini saqlang.",
          `  4. Politsiyaga murojaat qiling: ${policeLine("uz")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "💡 Ko'plab shantajchilar qo'rquvdan foydalanadi. To'lov ko'pincha yangi talablarga olib keladi.",
          "",
          "Agar 18 yoshdan kichik bo'lsangiz — ishonchli kattaga ayting.",
        ],
        en: [
          "⚡ DO NOT PAY — PAYMENT LEADS TO MORE DEMANDS",
          "",
          "❤️ You are NOT to blame.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Block the blackmailer.",
          "  2. Do not send new photos/videos.",
          "  3. Save screenshots of the conversation.",
          `  4. Contact police: ${policeLine("en")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "💡 Many blackmailers use fear to make you pay. Payment often leads to more demands.",
          "",
          "If you are under 18 — tell an adult you trust.",
        ],
      },
    },
    // ─── Scenario 8: Romance scam ────────────────────────────────────────
    {
      title: {
        ru: "8️⃣ Просят деньги в отношениях",
        uz: "8️⃣ Munosabatda pul so'rash",
        en: "8️⃣ Money in relationships",
      },
      steps: {
        ru: [
          "⚡ ПРЕКРАТИТЕ ПЕРЕВОДЫ ПРЯМО СЕЙЧАС",
          "",
          "❤️ Вы НЕ виноваты — это манипуляция.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Прекратите все переводы.",
          "  2. Проверьте фото через Google Images.",
          "  3. Признаки: быстрая «любовь», просит деньги/крипто, избегает видео.",
          `  4. Жалоба: ${policeLine("ru")} или /report`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "Если вам меньше 18 лет — обратитесь к взрослому, которому доверяете.",
        ],
        uz: [
          "⚡ O'TKAZMALARNI HOZIROQ TO'XTATING",
          "",
          "❤️ Siz AYBDOR EMASSIZ — bu manipulyatsiya.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Barcha o'tkazmalarni to'xtating.",
          "  2. Fotoni Google orqali tekshiring.",
          "  3. Belgilari: tez «sevgi», pul/kripto so'raydi, videodan qochadi.",
          `  4. Shikoyat: ${policeLine("uz")} yoki /report`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "Agar 18 yoshdan kichik bo'lsangiz — ishonchli kattaga ayting.",
        ],
        en: [
          "⚡ STOP ALL TRANSFERS NOW",
          "",
          "❤️ You are NOT to blame — it's manipulation.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Stop all money transfers.",
          "  2. Reverse-search their photo via Google Images.",
          '  3. Signs: quick "love", asks for money/crypto, avoids video calls.',
          `  4. Report: ${policeLine("en")} or /report`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "If you are under 18 — tell an adult you trust.",
        ],
      },
    },
    // ─── Scenario 9: Threats to publish ───────────────────────────────────
    {
      title: {
        ru: "9️⃣ Угрожают публикацией",
        uz: "9️⃣ Nashr bilan tahdid",
        en: "9️⃣ Threats to publish",
      },
      steps: {
        ru: [
          "⚡ НЕ ПЛАТИТЕ — ВЫ ЖЕРТВА, НЕ ПРЕСТУПНИК",
          "",
          "❤️ Вы НЕ виноваты.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Заблокируйте угрожающего.",
          "  2. Сохраните доказательства (скриншоты).",
          `  3. Обратитесь в полицию: ${policeLine("ru")}`,
          "  4. Если опубликовано — напишите в поддержку платформы.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "💡 Многие шантажисты используют страх, чтобы заставить вас платить. Оплата часто приводит к новым требованиям.",
          "",
          "Если вам меньше 18 лет — обратитесь к взрослому, которому доверяете.",
        ],
        uz: [
          "⚡ TO'LAMANG — SIZ JABRLANUVCHISIZ, JINOYATCHI EMAS",
          "",
          "❤️ Siz AYBDOR EMASSIZ.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Tahdid qiluvchini bloklang.",
          "  2. Dalillarni saqlang (skrinshotlar).",
          `  3. Politsiyaga murojaat qiling: ${policeLine("uz")}`,
          "  4. Nashr etilgan bo'lsa — platforma qo'llab-quvvatlashiga yozing.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "💡 Ko'plab shantajchilar qo'rquvdan foydalanadi. To'lov ko'pincha yangi talablarga olib keladi.",
          "",
          "Agar 18 yoshdan kichik bo'lsangiz — ishonchli kattaga ayting.",
        ],
        en: [
          "⚡ DO NOT PAY — YOU ARE THE VICTIM, NOT THE CRIMINAL",
          "",
          "❤️ You are NOT to blame.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Block the person threatening you.",
          "  2. Save evidence (screenshots).",
          `  3. Contact police: ${policeLine("en")}`,
          "  4. If published — write to the platform's support.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "💡 Many blackmailers use fear to make you pay. Payment often leads to more demands.",
          "",
          "If you are under 18 — tell an adult you trust.",
        ],
      },
    },
    // ─── Scenario 10: Under 18 ───────────────────────────────────────────
    {
      title: { ru: "🔟 Мне меньше 18 лет", uz: "🔟 Menga 18 yoshdan kam", en: "🔟 I'm under 18" },
      steps: {
        ru: [
          "⚡ РАССКАЖИ ВЗРОСЛОМУ, КОТОРОМУ ДОВЕРЯЕШЬ",
          "",
          "❤️ Ты НЕ виноват(а).",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Покажи это сообщение взрослому.",
          "  2. Заблокируй этого человека.",
          "  3. Не отправляй фото/видео и не плати.",
          `  4. Позвони: ${policeLine("ru")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "Тебе помогут. Ты не сделал(а) ничего плохого.",
        ],
        uz: [
          "⚡ ISHONCHLI KATTAGA AYTIB BER",
          "",
          "❤️ Sen AYBDOR EMASSING.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Bu xabarni kattaga ko'rsat.",
          "  2. Bu odamni blokla.",
          "  3. Foto/video yuborma va to'lama.",
          `  4. Qo'ng'iroq qil: ${policeLine("uz")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "Senga yordam berishadi.",
        ],
        en: [
          "⚡ TELL AN ADULT YOU TRUST",
          "",
          "❤️ You are NOT to blame.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Show this message to an adult.",
          "  2. Block this person.",
          "  3. Do not send photos/videos and do not pay.",
          `  4. Call: ${policeLine("en")}`,
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "You will be helped. You did nothing wrong.",
        ],
      },
    },
  ];
}

/**
 * Build the full emergency checklist text for a given language.
 * Pulls official numbers dynamically from the verified-contacts module.
 */
export function buildEmergencyText(lang: Lang): string {
  const contacts = getEmergencyContacts();
  const scenarios = buildScenarios(contacts);

  const parts: string[] = [TITLES[lang], ""];

  for (const scenario of scenarios) {
    parts.push(scenario.title[lang]);
    for (const step of scenario.steps[lang]) {
      parts.push(step);
    }
    parts.push("");
  }

  parts.push(DISCLAIMER[lang]);

  return parts.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// PANIC MODE — individual scenario access for interactive Telegram flow
// ═══════════════════════════════════════════════════════════════════════════

/** Scenario IDs (1-indexed, matching the numbered list above). */
export type PanicScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Short titles for the scenario selection menu (inline buttons). */
export const PANIC_MENU_TITLES: Record<PanicScenarioId, Record<Lang, string>> = {
  1: {
    ru: "📱 Я уже отправил SMS-код",
    uz: "📱 SMS-kodni yubordim",
    en: "📱 I already sent SMS code",
  },
  2: { ru: "📦 Установил APK", uz: "📦 APK o'rnatdim", en: "📦 Installed APK" },
  3: { ru: "💸 Перевёл деньги", uz: "💸 Pul o'tkazdim", en: "💸 Transferred money" },
  4: { ru: "💳 Ввёл данные карты", uz: "💳 Karta ma'lumotlari", en: "💳 Entered card data" },
  5: { ru: "🔒 Потерял Telegram", uz: "🔒 Telegram'ni yo'qotdim", en: "🔒 Lost Telegram" },
  6: { ru: "📞 Звонят сейчас", uz: "📞 Hozir qo'ng'iroq", en: "📞 On a call now" },
  7: {
    ru: "🔞 Шантаж фото/видео",
    uz: "🔞 Foto/video bilan shantaj",
    en: "🔞 Photo/video blackmail",
  },
  8: {
    ru: "💔 Просят деньги в отношениях",
    uz: "💔 Munosabatda pul so'rashmoqda",
    en: "💔 Money requests in relationships",
  },
  9: {
    ru: "👤 Угрожают публикацией",
    uz: "👤 Chop etish bilan tahdid",
    en: "👤 Threatens to publish",
  },
  10: { ru: "🧒 Мне меньше 18 лет", uz: "🧒 Menga 18 yoshdan kam", en: "🧒 I'm under 18" },
};

/** callback_data prefix for panic scenario buttons. Full: "panic:1" through "panic:10". */
export const PANIC_CB_PREFIX = "panic:";

/** Build the panic menu prompt text. */
export function buildPanicMenuText(lang: Lang): string {
  const prompts: Record<Lang, string> = {
    ru: "Что произошло? Выберите ситуацию — я дам конкретные шаги:",
    uz: "Nima bo'ldi? Vaziyatni tanlang — aniq qadamlarni aytaman:",
    en: "What happened? Choose a situation — I'll give you specific steps:",
  };
  return prompts[lang];
}

const SCENARIO_HUMAN_CUES: Partial<Record<PanicScenarioId, Record<Lang, string>>> = {
  1: {
    ru: "Я рядом. Главное сейчас — закрыть доступ к деньгам, а детали разберём после звонка в банк.",
    uz: "Men yoningizdaman. Hozir eng muhimi — pulga kirishni yopish, tafsilotlarni bankka qo'ng'iroqdan keyin ko'ramiz.",
    en: "I am with you. First we close access to the money; details can wait until after the bank call.",
  },
  2: {
    ru: "Я рядом. Сначала изолируем телефон: так приложение не сможет дальше получать SMS и уведомления.",
    uz: "Men yoningizdaman. Avval telefonni ajratamiz: ilova SMS va bildirishnomalarni ololmaydi.",
    en: "I am with you. First isolate the phone so the app cannot keep reading SMS or notifications.",
  },
  3: {
    ru: "Я рядом. Сейчас цель — остановить движение денег и сохранить доказательства, не отправляя ничего повторно.",
    uz: "Men yoningizdaman. Maqsad — pul harakatini to'xtatish va dalillarni saqlash; qayta pul yubormang.",
    en: "I am with you. The goal now is to stop money movement and save evidence; do not send anything again.",
  },
  4: {
    ru: "Я рядом. Сначала закрываем карту: даже если списаний нет, данные уже могли попасть к посторонним.",
    uz: "Men yoningizdaman. Avval kartani yopamiz: yechib olish bo'lmasa ham, ma'lumotlar begonalarga o'tgan bo'lishi mumkin.",
    en: "I am with you. First block the card: even if nothing was charged, the details may already be exposed.",
  },
  5: {
    ru: "Я рядом. Не спорьте с тем, кто пишет от вашего имени: сначала возвращаем доступ и предупреждаем близких.",
    uz: "Men yoningizdaman. Sizning nomingizdan yozayotgan odam bilan tortishmang: avval kirishni tiklab, yaqinlarni ogohlantiramiz.",
    en: "I am with you. Do not argue with whoever is using your account; first recover access and warn people.",
  },
  6: {
    ru: "Я рядом. Не доказывайте ничего по телефону: настоящий банк спокойно дождётся вашего обратного звонка.",
    uz: "Men yoningizdaman. Telefonda hech narsani isbotlamang: haqiqiy bank sizning qayta qo'ng'irog'ingizni kutadi.",
    en: "I am with you. You do not need to prove anything on the call; a real bank will wait for your callback.",
  },
};

const COMPACT_PANIC_CARDS: Record<PanicScenarioId, Record<Lang, string[]>> = {
  1: {
    ru: [
      "⚡ ПОЗВОНИТЕ В БАНК И ЗАБЛОКИРУЙТЕ КАРТУ",
      "",
      SCENARIO_HUMAN_CUES[1]!.ru,
      "",
      "Сделайте сейчас:",
      "1. Заблокируйте карту и онлайн-банк.",
      "2. Смените пароль банка и Telegram с другого устройства.",
      "3. Сохраните переписку и больше ничего не отправляйте.",
      "",
      "Нужны номера или полный план — нажмите кнопки ниже.",
    ],
    uz: [
      "⚡ BANKKA QO'NG'IROQ QILIB, KARTANI BLOKLANG",
      "",
      SCENARIO_HUMAN_CUES[1]!.uz,
      "",
      "Hozir qiling:",
      "1. Karta va onlayn-bankni bloklang.",
      "2. Bank va Telegram parollarini boshqa qurilmadan almashtiring.",
      "3. Yozishmani saqlang va boshqa hech narsa yubormang.",
      "",
      "Raqamlar yoki to'liq reja kerak bo'lsa, pastdagi tugmalarni bosing.",
    ],
    en: [
      "⚡ CALL YOUR BANK AND BLOCK THE CARD",
      "",
      SCENARIO_HUMAN_CUES[1]!.en,
      "",
      "Do this now:",
      "1. Block the card and online banking.",
      "2. Change bank and Telegram passwords from another device.",
      "3. Save the chat and send nothing else.",
      "",
      "For numbers or the full plan, use the buttons below.",
    ],
  },
  2: {
    ru: [
      "⚡ ВКЛЮЧИТЕ АВИАРЕЖИМ ПРЯМО СЕЙЧАС",
      "",
      SCENARIO_HUMAN_CUES[2]!.ru,
      "",
      "Сделайте сейчас:",
      "1. Удалите подозрительное приложение.",
      "2. Заблокируйте карты через банк.",
      "3. Смените пароли с другого устройства.",
      "",
      "Если приложение просило доступ к SMS/уведомлениям — считайте риск высоким.",
    ],
    uz: [
      "⚡ HOZIROQ AVIAREJIMNI YOQING",
      "",
      SCENARIO_HUMAN_CUES[2]!.uz,
      "",
      "Hozir qiling:",
      "1. Shubhali ilovani o'chiring.",
      "2. Kartalarni bank orqali bloklang.",
      "3. Parollarni boshqa qurilmadan almashtiring.",
      "",
      "Ilova SMS/bildirishnoma ruxsatini so'ragan bo'lsa — xavf yuqori.",
    ],
    en: [
      "⚡ TURN ON AIRPLANE MODE RIGHT NOW",
      "",
      SCENARIO_HUMAN_CUES[2]!.en,
      "",
      "Do this now:",
      "1. Delete the suspicious app.",
      "2. Block cards through your bank.",
      "3. Change passwords from another device.",
      "",
      "If the app requested SMS/notification access, treat this as high risk.",
    ],
  },
  3: {
    ru: [
      "⚡ ПОЗВОНИТЕ В БАНК — ПОПРОСИТЕ ЗАМОРОЗИТЬ ПЕРЕВОД",
      "",
      SCENARIO_HUMAN_CUES[3]!.ru,
      "",
      "Сделайте сейчас:",
      "1. Позвоните в банк по официальному номеру.",
      "2. Сохраните чек, чат, номер получателя и время операции.",
      "3. Не делайте «возвратный перевод» — это частая вторая схема.",
      "",
      "Полный план и контакты — в кнопках ниже.",
    ],
    uz: [
      "⚡ BANKKA QO'NG'IROQ QILING — O'TKAZMANI MUZLATISHNI SO'RANG",
      "",
      SCENARIO_HUMAN_CUES[3]!.uz,
      "",
      "Hozir qiling:",
      "1. Bankka rasmiy raqam orqali qo'ng'iroq qiling.",
      "2. Chek, chat, qabul qiluvchi raqami va vaqtni saqlang.",
      "3. «Qaytarish uchun yana o'tkazing» demang — bu ikkinchi sxema.",
      "",
      "To'liq reja va kontaktlar — pastdagi tugmalarda.",
    ],
    en: [
      "⚡ CALL YOUR BANK — ASK TO FREEZE THE TRANSFER",
      "",
      SCENARIO_HUMAN_CUES[3]!.en,
      "",
      "Do this now:",
      "1. Call the bank using an official number.",
      "2. Save the receipt, chat, recipient number, and time.",
      "3. Do not make a “return transfer” — that is a common second scam.",
      "",
      "Full plan and contacts are in the buttons below.",
    ],
  },
  4: {
    ru: [
      "⚡ ЗАБЛОКИРУЙТЕ КАРТУ НЕМЕДЛЕННО",
      "",
      SCENARIO_HUMAN_CUES[4]!.ru,
      "",
      "Сделайте сейчас:",
      "1. Заблокируйте карту в приложении или по официальному номеру банка.",
      "2. Проверьте операции и оспорьте неизвестные.",
      "3. Если вводили пароль банка — смените его с другого устройства.",
      "",
      "Нужны номера банков — нажмите «Позвонить безопасно».",
    ],
    uz: [
      "⚡ KARTANI DARHOL BLOKLANG",
      "",
      SCENARIO_HUMAN_CUES[4]!.uz,
      "",
      "Hozir qiling:",
      "1. Kartani ilova orqali yoki bankning rasmiy raqami orqali bloklang.",
      "2. Operatsiyalarni tekshiring va noma'lumlarini bahslashing.",
      "3. Bank parolini kiritgan bo'lsangiz, boshqa qurilmadan almashtiring.",
      "",
      "Bank raqamlari kerak bo'lsa, «Xavfsiz qo'ng'iroq» tugmasini bosing.",
    ],
    en: [
      "⚡ BLOCK THE CARD IMMEDIATELY",
      "",
      SCENARIO_HUMAN_CUES[4]!.en,
      "",
      "Do this now:",
      "1. Block the card in the app or via the bank’s official number.",
      "2. Check transactions and dispute unknown ones.",
      "3. If you entered a banking password, change it from another device.",
      "",
      "For bank numbers, tap “Safe callback”.",
    ],
  },
  5: {
    ru: [
      "⚡ ВЕРНИТЕ ДОСТУП И ПРЕДУПРЕДИТЕ БЛИЗКИХ",
      "",
      SCENARIO_HUMAN_CUES[5]!.ru,
      "",
      "Сделайте сейчас:",
      "1. С другого устройства завершите неизвестные сеансы Telegram.",
      "2. Включите двухэтапный пароль.",
      "3. Предупредите близких: от вашего имени могут просить деньги или код.",
      "",
      "Если нужна готовая фраза — нажмите кнопку ниже.",
    ],
    uz: [
      "⚡ KIRISHNI TIKLANG VA YAQINLARNI OGOHLANTIRING",
      "",
      SCENARIO_HUMAN_CUES[5]!.uz,
      "",
      "Hozir qiling:",
      "1. Boshqa qurilmadan noma'lum Telegram seanslarini tugating.",
      "2. Ikki bosqichli parolni yoqing.",
      "3. Yaqinlarni ogohlantiring: sizning nomingizdan pul yoki kod so'rashlari mumkin.",
      "",
      "Tayyor matn kerak bo'lsa, pastdagi tugmani bosing.",
    ],
    en: [
      "⚡ RECOVER ACCESS AND WARN CLOSE CONTACTS",
      "",
      SCENARIO_HUMAN_CUES[5]!.en,
      "",
      "Do this now:",
      "1. From another device, terminate unknown Telegram sessions.",
      "2. Enable a two-step password.",
      "3. Warn close contacts: someone may ask for money or codes from your account.",
      "",
      "For a ready phrase, use the button below.",
    ],
  },
  6: {
    ru: [
      "⚡ ЗАВЕРШИТЕ ЗВОНОК",
      "",
      SCENARIO_HUMAN_CUES[6]!.ru,
      "",
      "Скажите одну фразу:",
      "«Я сам перезвоню по официальному номеру».",
      "",
      "Потом нажмите «Я положил трубку». Не называйте SMS-код, PIN, CVV, пароль или данные карты.",
    ],
    uz: [
      "⚡ QO'NG'IROQNI TUGATING",
      "",
      SCENARIO_HUMAN_CUES[6]!.uz,
      "",
      "Bitta jumla ayting:",
      "«Rasmiy raqamga o'zim qayta qo'ng'iroq qilaman».",
      "",
      "Keyin «Go'shakni qo'ydim» tugmasini bosing. SMS-kod, PIN, CVV, parol yoki karta ma'lumotini aytmang.",
    ],
    en: [
      "⚡ HANG UP",
      "",
      SCENARIO_HUMAN_CUES[6]!.en,
      "",
      "Say one sentence:",
      "“I will call back myself using the official number.”",
      "",
      "Then tap “I hung up”. Do not share SMS codes, PINs, CVVs, passwords, or card data.",
    ],
  },
  7: {
    ru: [
      "⚡ НЕ ПЛАТИТЕ И НЕ ОТПРАВЛЯЙТЕ НОВЫЕ ФАЙЛЫ",
      "",
      "Я рядом. Шантажисты часто требуют всё больше после первой оплаты.",
      "",
      "Сделайте сейчас:",
      "1. Сохраните угрозы скриншотами.",
      "2. Заблокируйте человека.",
      "3. Позовите доверенного взрослого или обратитесь в полицию.",
    ],
    uz: [
      "⚡ TO'LAMANG VA YANGI FAYL YUBORMANG",
      "",
      "Men yoningizdaman. Shantajchilar birinchi to'lovdan keyin ko'proq talab qiladi.",
      "",
      "Hozir qiling:",
      "1. Tahdidlarni skrinshot qilib saqlang.",
      "2. Odamni bloklang.",
      "3. Ishonchli kattaga yoki politsiyaga murojaat qiling.",
    ],
    en: [
      "⚡ DO NOT PAY OR SEND NEW FILES",
      "",
      "I am with you. Blackmailers often demand more after the first payment.",
      "",
      "Do this now:",
      "1. Save threats as screenshots.",
      "2. Block the person.",
      "3. Call a trusted adult or the police.",
    ],
  },
  8: {
    ru: [
      "⚡ ОСТАНОВИТЕ ПЕРЕВОДЫ",
      "",
      "Я рядом. Если отношения строятся на срочных платежах и давлении, сначала нужна пауза.",
      "",
      "Сделайте сейчас:",
      "1. Не берите кредит и не отправляйте деньги.",
      "2. Попросите близкого посмотреть переписку со стороны.",
      "3. Проверьте фото/историю через обратный поиск.",
    ],
    uz: [
      "⚡ PUL O'TKAZMALARINI TO'XTATING",
      "",
      "Men yoningizdaman. Munosabat shoshilinch to'lov va bosimga qurilgan bo'lsa, avval pauza kerak.",
      "",
      "Hozir qiling:",
      "1. Kredit olmang va pul yubormang.",
      "2. Yaqiningizdan yozishmani tashqaridan ko'rib berishni so'rang.",
      "3. Foto/tarixni teskari qidiruv orqali tekshiring.",
    ],
    en: [
      "⚡ STOP TRANSFERS",
      "",
      "I am with you. If the relationship depends on urgent payments and pressure, pause first.",
      "",
      "Do this now:",
      "1. Do not take a loan or send money.",
      "2. Ask someone trusted to review the chat from the outside.",
      "3. Reverse-search photos and the story.",
    ],
  },
  9: {
    ru: [
      "⚡ НЕ ПЛАТИТЕ ЗА УДАЛЕНИЕ ПУБЛИКАЦИИ",
      "",
      "Я рядом. Оплата часто приводит к новым угрозам, а не к удалению.",
      "",
      "Сделайте сейчас:",
      "1. Сохраните доказательства.",
      "2. Заблокируйте угрожающего.",
      "3. Если контент опубликован — пишите в поддержку платформы и полицию.",
    ],
    uz: [
      "⚡ E'LONNI O'CHIRISH UCHUN TO'LAMANG",
      "",
      "Men yoningizdaman. To'lov ko'pincha o'chirishga emas, yangi tahdidlarga olib keladi.",
      "",
      "Hozir qiling:",
      "1. Dalillarni saqlang.",
      "2. Tahdid qiluvchini bloklang.",
      "3. Kontent e'lon qilingan bo'lsa, platforma qo'llab-quvvatlashiga va politsiyaga yozing.",
    ],
    en: [
      "⚡ DO NOT PAY TO REMOVE A POST",
      "",
      "I am with you. Payment often leads to more threats, not deletion.",
      "",
      "Do this now:",
      "1. Save evidence.",
      "2. Block the person threatening you.",
      "3. If content is posted, contact platform support and police.",
    ],
  },
  10: {
    ru: [
      "⚡ ПОЗОВИТЕ ВЗРОСЛОГО, КОТОРОМУ ДОВЕРЯЕТЕ",
      "",
      "Ты не обязан разбираться один. Взрослый может помочь остановить давление.",
      "",
      "Сделайте сейчас:",
      "1. Ничего не отправляйте и не платите.",
      "2. Покажите переписку доверенному взрослому.",
      "3. Если есть угрозы — сохраните скриншоты и звоните 102.",
    ],
    uz: [
      "⚡ ISHONCHLI KATTANI CHAQIRING",
      "",
      "Buni yolg'iz hal qilishingiz shart emas. Katta odam bosimni to'xtatishga yordam beradi.",
      "",
      "Hozir qiling:",
      "1. Hech narsa yubormang va to'lamang.",
      "2. Yozishmani ishonchli kattaga ko'rsating.",
      "3. Tahdid bo'lsa, skrinshotlarni saqlang va 102 ga qo'ng'iroq qiling.",
    ],
    en: [
      "⚡ CALL AN ADULT YOU TRUST",
      "",
      "You do not have to handle this alone. An adult can help stop the pressure.",
      "",
      "Do this now:",
      "1. Do not send anything or pay.",
      "2. Show the chat to a trusted adult.",
      "3. If there are threats, save screenshots and call 102.",
    ],
  },
};

/**
 * Build the detailed text for a single panic scenario (by ID).
 * Returns the scenario title + full steps + disclaimer, pulling numbers from
 * the verified-contacts module. Used when the user explicitly asks for all steps.
 */
export function buildDetailedPanicScenarioText(id: PanicScenarioId, lang: Lang): string {
  const contacts = getEmergencyContacts();
  const scenarios = buildScenarios(contacts);
  const scenario = scenarios[id - 1]; // 1-indexed → 0-indexed

  const parts: string[] = [scenario.title[lang], ""];
  for (const step of withScenarioHumanCue(scenario.steps[lang], id, lang)) {
    parts.push(step);
  }
  parts.push("");
  parts.push(DISCLAIMER[lang]);

  return parts.join("\n");
}

/**
 * Build the compact first card for a panic scenario.
 *
 * The full checklist stays available through `panicctx:full`; the first screen is
 * intentionally short for stressed users.
 */
export function buildPanicScenarioText(id: PanicScenarioId, lang: Lang): string {
  const compact = COMPACT_PANIC_CARDS[id]?.[lang];
  if (!compact) return buildDetailedPanicScenarioText(id, lang);
  return [PANIC_MENU_TITLES[id][lang], "", ...compact].join("\n");
}

function withScenarioHumanCue(steps: string[], id: PanicScenarioId, lang: Lang): string[] {
  const cue = SCENARIO_HUMAN_CUES[id]?.[lang];
  if (!cue || steps.length === 0) return steps;

  const [firstAction, ...rest] = steps;
  return [firstAction, "", cue, ...rest];
}

/** Parse a panic callback_data ("panic:1" → 1, "panic:more"/"panic:back" → null for ID, handle separately). */
export function parsePanicCallback(data: string): PanicScenarioId | null {
  if (!data.startsWith(PANIC_CB_PREFIX)) return null;
  const suffix = data.slice(PANIC_CB_PREFIX.length);
  if (suffix === "more" || suffix === "back") return null;
  const n = Number(suffix);
  if (n >= 1 && n <= 10) return n as PanicScenarioId;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PANIC KEYBOARD PAGINATION — split 10 scenarios into 2 pages (6+4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build panic keyboard page 1: scenarios 1–6 (2 per row) + "Другие ситуации" button.
 * This is the default page shown on `/panic`.
 */
export function buildPanicKeyboardPage1(lang: Lang): InlineKeyboard {
  const rows: InlineKeyboard = [];
  // Scenarios 1–6, 2 per row
  for (let i = 1; i <= 6; i += 2) {
    rows.push([
      {
        text: PANIC_MENU_TITLES[i as PanicScenarioId][lang],
        callback_data: `${PANIC_CB_PREFIX}${i}`,
      },
      {
        text: PANIC_MENU_TITLES[(i + 1) as PanicScenarioId][lang],
        callback_data: `${PANIC_CB_PREFIX}${i + 1}`,
      },
    ]);
  }
  // "More" button
  const moreLabel: Record<Lang, string> = {
    ru: "Другие ситуации ➡️",
    uz: "Boshqa vaziyatlar ➡️",
    en: "Other situations ➡️",
  };
  rows.push([{ text: moreLabel[lang], callback_data: `${PANIC_CB_PREFIX}more` }]);
  return rows;
}

/**
 * Build panic keyboard page 2: scenarios 7–10 (2 per row) + "← Назад" button.
 * Shown when user taps "Другие ситуации".
 */
export function buildPanicKeyboardPage2(lang: Lang): InlineKeyboard {
  const rows: InlineKeyboard = [];
  // Scenarios 7–10, 2 per row
  for (let i = 7; i <= 10; i += 2) {
    rows.push([
      {
        text: PANIC_MENU_TITLES[i as PanicScenarioId][lang],
        callback_data: `${PANIC_CB_PREFIX}${i}`,
      },
      {
        text: PANIC_MENU_TITLES[(i + 1) as PanicScenarioId][lang],
        callback_data: `${PANIC_CB_PREFIX}${i + 1}`,
      },
    ]);
  }
  // "Back" button
  const backLabel: Record<Lang, string> = {
    ru: "← Назад",
    uz: "← Orqaga",
    en: "← Back",
  };
  rows.push([{ text: backLabel[lang], callback_data: `${PANIC_CB_PREFIX}back` }]);
  return rows;
}

/** callback_data prefix for live-call copilot buttons. */
export const LIVE_CALL_CB_PREFIX = "livecall:";

/** Live call copilot button actions. */
export type LiveCallAction = "hangup" | "what_to_say" | "call_bank" | "sent_code" | "tell_family";

/** Parse a live-call callback. */
export function parseLiveCallCallback(data: string): LiveCallAction | null {
  if (!data.startsWith(LIVE_CALL_CB_PREFIX)) return null;
  const action = data.slice(LIVE_CALL_CB_PREFIX.length);
  const valid: LiveCallAction[] = [
    "hangup",
    "what_to_say",
    "call_bank",
    "sent_code",
    "tell_family",
  ];
  return valid.includes(action as LiveCallAction) ? (action as LiveCallAction) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMERGENCY COPILOT V2 — contextual follow-up after panic scenarios
// ═══════════════════════════════════════════════════════════════════════════

export const PANIC_CONTEXT_CB_PREFIX = "panicctx:";

export type EmergencyFollowUpAction = "more" | "contacts" | "script" | "trusted_person" | "full";

export interface EmergencyContextData {
  lastPanicId?: unknown;
  lastPanicAt?: unknown;
}

export interface EmergencyFollowUpMatch {
  action: EmergencyFollowUpAction;
  panicId: PanicScenarioId;
}

const PANIC_CONTEXT_TTL_MS = 2 * 60 * 60 * 1000;

const FOLLOWUP_URL_RE =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:uz|com|net|org|ru|io|app|site|info|me|online|xyz|top|shop|click|bank)\b)/i;
const FOLLOWUP_PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const FOLLOWUP_TELEGRAM_RE = /(?:t\.me\/|telegram\.me\/|@[a-zA-Z0-9_]{3,})/i;
const FOLLOWUP_APK_LINK_RE = /(?:https?:\/\/\S+\.apk\b|\b\S+\.apk\b)/i;
const FOLLOWUP_SECRET_RE =
  /(?:\b(?:otp|sms|смс|код|pin|пин|cvv|cvc|пароль|password)\b[^\d\n]{0,20}\d{3,8}\b|\b\d{3,8}\b[^\n]{0,20}\b(?:otp|sms|смс|код|pin|пин|cvv|cvc)\b)/i;
const FOLLOWUP_LONG_TEXT_LIMIT = 220;

const FOLLOWUP_CONTACTS_RE =
  /(?:номер|телефон|позвон|контакт|горяч[а-я]*\s+лини[а-я]*|куда\s+звонить|кому\s+звонить)[\s\S]{0,45}(?:банк|карта|служба|оператор)|(?:банк|банка|банку|карты?|служба)[\s\S]{0,45}(?:номер|телефон|контакт|позвон|горяч[а-я]*\s+лини[а-я]*|куда\s+звонить|кому\s+звонить)|(?:bank|card|hotline|support)[\s\S]{0,45}(?:number|phone|contact|call|hotline)|(?:call|phone|contact)[\s\S]{0,45}(?:bank|card|support)|(?:bank|karta)[\s\S]{0,45}(?:raqam|telefon|qo'ng'iroq|qongiroq)/i;
const FOLLOWUP_SCRIPT_RE =
  /(?:что|как)\s+(?:сказать|ответить|говорить|объяснить)|(?:текст|фраза|фразу|скрипт|слова)\b|what\s+to\s+say|what\s+should\s+i\s+say|script|nima\s+(?:deyish|aytish)|qanday\s+(?:aytaman|gaplashaman)/i;
const FOLLOWUP_TRUSTED_RE =
  /(?:близк|родствен|семь|семья|мам|пап|сын|дочь|пожил|пенсион|доверя|нервнича|волнуюсь|страшно|паник|один|одна|позвать|позови|со\s+мной|рядом)|(?:family|relative|trusted|elder|parent|mother|father|son|daughter|nervous|scared|panic|alone)|(?:yaqin|qarindosh|ishonchli|ota|ona|farzand|keks|qo'rq|xavotir|yolg'iz)/i;
const FOLLOWUP_MORE_RE =
  /(?:что|что-то)\s+(?:еще|ещё|дальше)|(?:что\s+мне\s+делать|что\s+делать\s+дальше|как\s+быть|дальше|следующий\s+шаг|посовет|подскажи|помоги\s+дальше)|what\s+next|next\s+steps|more\s+advice|what\s+else|what\s+should\s+i\s+do|yana\s+nima|keyin\s+nima|nima\s+qil/i;

const FOLLOWUP_BUTTONS: Record<EmergencyFollowUpAction, Record<Lang, string>> = {
  more: { ru: "🧭 Что дальше", uz: "🧭 Keyingi qadam", en: "🧭 Next step" },
  contacts: { ru: "📞 Позвонить безопасно", uz: "📞 Xavfsiz qo'ng'iroq", en: "📞 Safe callback" },
  script: { ru: "💬 Готовая фраза", uz: "💬 Tayyor jumla", en: "💬 Ready phrase" },
  trusted_person: {
    ru: "👪 Позвать близкого",
    uz: "👪 Yaqinni chaqirish",
    en: "👪 Call someone trusted",
  },
  full: {
    ru: "📋 Все срочные шаги",
    uz: "📋 Barcha shoshilinch qadamlar",
    en: "📋 All urgent steps",
  },
};

function normalizeFollowUpText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[’‘`]/g, "'")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru");
}

function hasRiskPayloadForFollowUp(text: string): boolean {
  const normalized = normalizeFollowUpText(text);
  return (
    normalized.length > FOLLOWUP_LONG_TEXT_LIMIT ||
    FOLLOWUP_URL_RE.test(normalized) ||
    FOLLOWUP_PHONE_RE.test(normalized) ||
    FOLLOWUP_TELEGRAM_RE.test(normalized) ||
    FOLLOWUP_APK_LINK_RE.test(normalized) ||
    FOLLOWUP_SECRET_RE.test(normalized)
  );
}

export function asPanicScenarioId(value: unknown): PanicScenarioId | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 10 ? (n as PanicScenarioId) : null;
}

function isRecentPanicContext(context: EmergencyContextData, now: Date): boolean {
  const id = asPanicScenarioId(context.lastPanicId);
  if (id === null || typeof context.lastPanicAt !== "string") return false;
  const timestamp = Date.parse(context.lastPanicAt);
  if (!Number.isFinite(timestamp)) return false;
  const age = now.getTime() - timestamp;
  return age >= 0 && age <= PANIC_CONTEXT_TTL_MS;
}

export function withPanicContextData<T extends object>(
  existing: T | undefined,
  panicId: PanicScenarioId,
  now: Date = new Date(),
): T & { lastPanicId: PanicScenarioId; lastPanicAt: string } {
  return {
    ...(existing ?? ({} as T)),
    lastPanicId: panicId,
    lastPanicAt: now.toISOString(),
  };
}

export function parsePanicContextCallback(data: string): EmergencyFollowUpAction | null {
  if (!data.startsWith(PANIC_CONTEXT_CB_PREFIX)) return null;
  const action = data.slice(PANIC_CONTEXT_CB_PREFIX.length);
  const valid: EmergencyFollowUpAction[] = ["more", "contacts", "script", "trusted_person", "full"];
  return valid.includes(action as EmergencyFollowUpAction)
    ? (action as EmergencyFollowUpAction)
    : null;
}

export function classifyEmergencyFollowUp(
  text: string,
  context: EmergencyContextData,
  now: Date = new Date(),
): EmergencyFollowUpMatch | null {
  if (!isRecentPanicContext(context, now)) return null;
  if (hasRiskPayloadForFollowUp(text)) return null;

  const panicId = asPanicScenarioId(context.lastPanicId);
  if (panicId === null) return null;
  const normalized = normalizeFollowUpText(text);
  if (!normalized) return null;

  if (FOLLOWUP_CONTACTS_RE.test(normalized)) return { action: "contacts", panicId };
  if (FOLLOWUP_TRUSTED_RE.test(normalized)) return { action: "trusted_person", panicId };
  if (FOLLOWUP_SCRIPT_RE.test(normalized)) return { action: "script", panicId };
  if (FOLLOWUP_MORE_RE.test(normalized)) return { action: "more", panicId };
  return null;
}

export function buildEmergencyFollowUpKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: FOLLOWUP_BUTTONS.more[lang], callback_data: `${PANIC_CONTEXT_CB_PREFIX}more` },
      {
        text: FOLLOWUP_BUTTONS.contacts[lang],
        callback_data: `${PANIC_CONTEXT_CB_PREFIX}contacts`,
      },
    ],
    [
      { text: FOLLOWUP_BUTTONS.script[lang], callback_data: `${PANIC_CONTEXT_CB_PREFIX}script` },
      {
        text: FOLLOWUP_BUTTONS.trusted_person[lang],
        callback_data: "family:notify",
      },
    ],
    [{ text: FOLLOWUP_BUTTONS.full[lang], callback_data: `${PANIC_CONTEXT_CB_PREFIX}full` }],
  ];
}

function followUpTitle(panicId: PanicScenarioId, lang: Lang): string {
  return PANIC_MENU_TITLES[panicId][lang];
}

function verifiedCallbackDirectory(lang: Lang): string {
  const contacts = getEmergencyContacts();
  const banks = contacts.banks.slice(0, 6);
  const payments = contacts.payments.slice(0, 3);
  const lines: Record<Lang, string[]> = {
    ru: [
      "📞 Официальный обратный звонок",
      "",
      "1. Сначала смотрите номер на карте, в банковском приложении или на официальном сайте.",
      "2. Не звоните по номеру, который продиктовал собеседник или прислал в SMS.",
      "3. Если вы волнуетесь, попросите близкого набрать номер вместе с вами.",
      "",
      "Проверенные короткие номера:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
    uz: [
      "📞 Rasmiy qayta qo'ng'iroq",
      "",
      "1. Avval raqamni karta orqasidan, bank ilovasidan yoki rasmiy saytdan oling.",
      "2. Suhbatdosh aytgan yoki SMSda kelgan raqamga qo'ng'iroq qilmang.",
      "3. Hayajonlansangiz, ishonchli yaqiningiz bilan birga qo'ng'iroq qiling.",
      "",
      "Tekshirilgan qisqa raqamlar:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
    en: [
      "📞 Official callback",
      "",
      "1. First use the number on your card, in the bank app, or on the official site.",
      "2. Do not call the number the caller dictated or sent by SMS.",
      "3. If you feel stressed, ask someone trusted to dial with you.",
      "",
      "Verified short numbers:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
  };
  return lines[lang].filter(Boolean).join("\n");
}

function trustedPersonText(panicId: PanicScenarioId, lang: Lang): string {
  const title = followUpTitle(panicId, lang);
  const lines: Record<Lang, string[]> = {
    ru: [
      "👪 Позовите человека, которому доверяете",
      "",
      "Если вы пожилой человек, сильно волнуетесь или вас торопят — не разбирайтесь в одиночку. Позвоните близкому и попросите быть рядом, пока вы связываетесь с банком.",
      "",
      `Скажите прямо: «Мне нужна помощь. Ситуация: ${title}. Пожалуйста, побудь со мной и помоги позвонить в банк по официальному номеру».`,
      "",
      "Не пересылайте SMS-код, PIN, CVV, пароль или фото карты. Можно показать переписку без кодов и попросить проверить шаги вместе.",
    ],
    uz: [
      "👪 Ishonchli yaqiningizni chaqiring",
      "",
      "Agar yoshi katta bo'lsangiz, hayajonlansangiz yoki sizni shoshirishsa — yolg'iz qaror qilmang. Yaqiningizga qo'ng'iroq qiling va bank bilan bog'lanayotganda yoningizda bo'lishini so'rang.",
      "",
      `Shunday deng: «Menga yordam kerak. Vaziyat: ${title}. Iltimos, yonimda bo'ling va bankka rasmiy raqam orqali qo'ng'iroq qilishga yordam bering».`,
      "",
      "SMS-kod, PIN, CVV, parol yoki karta rasmini yubormang. Kodlarsiz yozishmani ko'rsatib, qadamlarni birga tekshirish mumkin.",
    ],
    en: [
      "👪 Call someone you trust",
      "",
      "If you are elderly, stressed, or being rushed, do not handle it alone. Call a trusted person and ask them to stay with you while you contact the bank.",
      "",
      `Say: "I need help. Situation: ${title}. Please stay with me and help me call the bank using an official number."`,
      "",
      "Do not forward SMS codes, PINs, CVVs, passwords, or card photos. You can show the chat without codes and check the steps together.",
    ],
  };
  return lines[lang].join("\n");
}

function scriptText(panicId: PanicScenarioId, lang: Lang): string {
  const title = followUpTitle(panicId, lang);
  const lines: Record<Lang, string[]> = {
    ru: [
      "💬 Готовая фраза",
      "",
      "Если вам звонят прямо сейчас, скажите:",
      "",
      "«Я не обсуждаю деньги и коды по входящему звонку. Я сам перезвоню в организацию по официальному номеру».",
      "",
      "Потом завершите звонок. Не спорьте и не объясняйте. Если нужно сказать близкому:",
      `«У меня ситуация: ${title}. Помоги мне спокойно проверить и позвонить в банк».`,
    ],
    uz: [
      "💬 Tayyor jumla",
      "",
      "Agar hozir qo'ng'iroq qilishayotgan bo'lsa, ayting:",
      "",
      "«Men kiruvchi qo'ng'iroqda pul va kodlarni muhokama qilmayman. Tashkilotga rasmiy raqam orqali o'zim qo'ng'iroq qilaman».",
      "",
      "Keyin go'shakni qo'ying. Tortishmang va tushuntirmang. Yaqiningizga:",
      `«Vaziyatim: ${title}. Iltimos, xotirjam tekshirishga va bankka qo'ng'iroq qilishga yordam ber».`,
    ],
    en: [
      "💬 Ready phrase",
      "",
      "If someone is calling right now, say:",
      "",
      '"I do not discuss money or codes on an incoming call. I will call the organization myself using an official number."',
      "",
      "Then hang up. Do not argue or explain. To a trusted person:",
      `"My situation is: ${title}. Please help me check calmly and call the bank."`,
    ],
  };
  return lines[lang].join("\n");
}

function moreAdviceText(panicId: PanicScenarioId, lang: Lang): string {
  const byScenario: Record<PanicScenarioId, Record<Lang, string[]>> = {
    1: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Позвоните в банк по официальному номеру и скажите: «Я сообщил SMS-код, заблокируйте карту и онлайн-банк».",
        "2. Смените пароль банка и Telegram с другого устройства.",
        "3. Сохраните переписку и номера, но больше ничего не отправляйте.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Bankka rasmiy raqam orqali qo'ng'iroq qiling: «SMS-kod berdim, karta va onlayn-bankni bloklang».",
        "2. Bank va Telegram parollarini boshqa qurilmadan o'zgartiring.",
        "3. Yozishma va raqamlarni saqlang, boshqa hech narsa yubormang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Call your bank on an official number: “I gave an SMS code; block my card and online banking.”",
        "2. Change banking and Telegram passwords from another device.",
        "3. Save chats and numbers, but send nothing else.",
      ],
    },
    2: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Оставьте авиарежим включенным, пока не удалите приложение.",
        "2. С другого телефона позвоните в банк и попросите временно заблокировать карты.",
        "3. С чистого устройства смените пароли банка, Telegram и почты.",
        "4. Если приложение просило доступ к SMS/уведомлениям — считайте это высоким риском.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Ilovani o'chirmaguningizcha aviarejimni yoqilgan holda qoldiring.",
        "2. Boshqa telefondan bankka qo'ng'iroq qilib, kartalarni vaqtincha bloklashni so'rang.",
        "3. Toza qurilmadan bank, Telegram va email parollarini almashtiring.",
        "4. Ilova SMS/bildirishnoma ruxsatini so'ragan bo'lsa — bu yuqori xavf.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Keep airplane mode on until the app is removed.",
        "2. From another phone, call the bank and ask to temporarily block cards.",
        "3. From a clean device, change bank, Telegram, and email passwords.",
        "4. If the app asked for SMS/notification access, treat it as high risk.",
      ],
    },
    3: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Позвоните в банк и попросите заморозить/оспорить перевод.",
        "2. Не делайте «возвратный перевод» — это частая вторая схема.",
        "3. Сохраните чек, чат, номер получателя и время операции.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Bankka qo'ng'iroq qilib, o'tkazmani muzlatish/bahslashishni so'rang.",
        "2. «Qaytarish uchun yana o'tkazing» demang — bu ko'p uchraydigan ikkinchi sxema.",
        "3. Chek, chat, qabul qiluvchi raqami va vaqtni saqlang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Call your bank and ask to freeze/dispute the transfer.",
        "2. Do not make a “return transfer” — that is a common second scam.",
        "3. Save the receipt, chat, recipient number, and transaction time.",
      ],
    },
    4: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Заблокируйте карту в приложении или по официальному номеру банка.",
        "2. Проверьте последние операции и попросите оспорить неизвестные.",
        "3. Если вводили пароль онлайн-банка — смените его с другого устройства.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Kartani ilova orqali yoki bankning rasmiy raqami orqali bloklang.",
        "2. Oxirgi operatsiyalarni tekshiring va noma'lumlarini bahslashishni so'rang.",
        "3. Onlayn-bank parolini kiritgan bo'lsangiz, uni boshqa qurilmadan almashtiring.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Block the card in the app or via the bank’s official number.",
        "2. Check recent transactions and ask to dispute unknown ones.",
        "3. If you entered an online banking password, change it from another device.",
      ],
    },
    5: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Зайдите в Telegram с другого устройства и завершите неизвестные сеансы.",
        "2. Включите двухэтапный пароль.",
        "3. Предупредите близких: от вашего имени могут просить деньги или код.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Telegramga boshqa qurilmadan kiring va noma'lum seanslarni tugating.",
        "2. Ikki bosqichli parolni yoqing.",
        "3. Yaqinlarni ogohlantiring: sizning nomingizdan pul yoki kod so'rashlari mumkin.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Log into Telegram from another device and terminate unknown sessions.",
        "2. Enable two-step password.",
        "3. Warn close contacts: someone may ask for money or codes from your account.",
      ],
    },
    6: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Положите трубку и не продолжайте разговор.",
        "2. Перезвоните сами по официальному номеру банка или организации.",
        "3. Если вы уже сказали код или данные карты — переходите к сценарию «SMS-код» или «данные карты».",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Go'shakni qo'ying va suhbatni davom ettirmang.",
        "2. Bank yoki tashkilotga rasmiy raqam orqali o'zingiz qo'ng'iroq qiling.",
        "3. Kod yoki karta ma'lumotini aytgan bo'lsangiz — «SMS-kod» yoki «karta ma'lumotlari» ssenariysiga o'ting.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Hang up and do not continue the call.",
        "2. Call the bank or organization yourself using an official number.",
        "3. If you already gave a code or card data, use the “SMS code” or “card data” scenario.",
      ],
    },
    7: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Не платите и не отправляйте новые фото/видео.",
        "2. Сохраните угрозы скриншотами.",
        "3. Заблокируйте человека и обратитесь к доверенному взрослому или в полицию.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. To'lamang va yangi foto/video yubormang.",
        "2. Tahdidlarni skrinshot qilib saqlang.",
        "3. Odamni bloklang va ishonchli kattaga yoki politsiyaga murojaat qiling.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Do not pay and do not send more photos/videos.",
        "2. Save threats as screenshots.",
        "3. Block the person and contact a trusted adult or the police.",
      ],
    },
    8: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Остановите переводы и не берите кредиты.",
        "2. Проверьте фото через обратный поиск.",
        "3. Попросите близкого посмотреть переписку со стороны.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. O'tkazmalarni to'xtating va kredit olmang.",
        "2. Suratni teskari qidiruv orqali tekshiring.",
        "3. Yaqiningizdan yozishmani tashqaridan ko'rib berishni so'rang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Stop transfers and do not take loans.",
        "2. Reverse-search the photo.",
        "3. Ask someone trusted to review the chat from the outside.",
      ],
    },
    9: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Не платите: оплата часто приводит к новым требованиям.",
        "2. Сохраните доказательства и заблокируйте угрожающего.",
        "3. Если контент опубликован, пишите в поддержку платформы и полицию.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. To'lamang: to'lov ko'pincha yangi talablarni keltiradi.",
        "2. Dalillarni saqlang va tahdid qiluvchini bloklang.",
        "3. Kontent e'lon qilingan bo'lsa, platforma qo'llab-quvvatlashiga va politsiyaga yozing.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Do not pay: payment often leads to more demands.",
        "2. Save evidence and block the person threatening you.",
        "3. If content is published, contact platform support and police.",
      ],
    },
    10: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Покажите это сообщение взрослому, которому доверяете.",
        "2. Ничего не отправляйте и не платите.",
        "3. Если есть угрозы, сохраните скриншоты и звоните 102.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Bu xabarni ishonchli kattaga ko'rsating.",
        "2. Hech narsa yubormang va to'lamang.",
        "3. Tahdid bo'lsa, skrinshotlarni saqlang va 102 ga qo'ng'iroq qiling.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Show this message to an adult you trust.",
        "2. Do not send anything and do not pay.",
        "3. If there are threats, save screenshots and call 102.",
      ],
    },
  };
  return byScenario[panicId][lang].join("\n");
}

function guidedCallbackDirectory(lang: Lang): string {
  const contacts = getEmergencyContacts();
  const banks = contacts.banks.slice(0, 6);
  const payments = contacts.payments.slice(0, 3);
  const lines: Record<Lang, string[]> = {
    ru: [
      "📞 Официальный обратный звонок: как сделать безопасно",
      "",
      "1. Если звонок ещё идёт — сначала положите трубку.",
      "2. Откройте приложение банка, карту или номер на официальном сайте. Не звоните по номеру из SMS или входящего звонка.",
      "3. Наберите номер сами. Если волнуетесь, попросите близкого быть рядом.",
      "",
      "Что сказать оператору:",
      "«Мне звонили и просили код, деньги или приложение. Проверьте мой счёт и заблокируйте рискованные операции.»",
      "",
      "Проверенные короткие номера:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
    uz: [
      "📞 Rasmiy qayta qo'ng'iroq: xavfsiz tartib",
      "",
      "1. Qo'ng'iroq davom etayotgan bo'lsa — avval go'shakni qo'ying.",
      "2. Bank ilovasi, karta yoki rasmiy saytdagi raqamni oling. SMS yoki kiruvchi qo'ng'iroqdagi raqamdan foydalanmang.",
      "3. Raqamni o'zingiz tering. Hayajonlansangiz, yaqiningiz yoningizda bo'lsin.",
      "",
      "Operatorga shunday deng:",
      "«Menga qo'ng'iroq qilib kod, pul yoki ilova so'rashdi. Hisobimni tekshirib, xavfli operatsiyalarni bloklang.»",
      "",
      "Tekshirilgan qisqa raqamlar:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
    en: [
      "📞 Official callback: safe steps",
      "",
      "1. If the call is still active, hang up first.",
      "2. Use the bank app, your card, or the official website. Do not use a number from an SMS or incoming call.",
      "3. Dial the number yourself. If you are stressed, ask someone trusted to stay with you.",
      "",
      "What to say to the operator:",
      "“Someone called and asked for a code, money, or an app. Please check my account and block risky operations.”",
      "",
      "Verified short numbers:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
  };
  return lines[lang].join("\n");
}

function guidedTrustedPersonText(panicId: PanicScenarioId, lang: Lang): string {
  const title = followUpTitle(panicId, lang);
  const lines: Record<Lang, string[]> = {
    ru: [
      "👪 Позовите человека, которому доверяете",
      "",
      "Это не слабость. В мошеннических звонках специально торопят, чтобы человек остался один и ошибся.",
      "",
      "Сделайте так:",
      "1. Позвоните близкому или отправьте готовый текст ниже.",
      "2. Попросите: «Пожалуйста, побудь со мной 5 минут, пока я звоню в банк по официальному номеру».",
      "3. Не пересылайте SMS-код, PIN, CVV, пароль или фото карты.",
      "",
      `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Я волнуюсь, побудь со мной и помоги спокойно проверить это по официальному номеру».`,
    ],
    uz: [
      "👪 Ishonchli yaqiningizni chaqiring",
      "",
      "Bu zaiflik emas. Firibgarlar odam yolg'iz qolib xato qilishi uchun ataylab shoshiradi.",
      "",
      "Shunday qiling:",
      "1. Yaqiningizga qo'ng'iroq qiling yoki pastdagi tayyor matnni yuboring.",
      "2. So'rang: «Bankka rasmiy raqam orqali qo'ng'iroq qilgunimcha 5 daqiqa yonimda bo'ling».",
      "3. SMS-kod, PIN, CVV, parol yoki karta rasmini yubormang.",
      "",
      `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Hayajondaman. Yonimda bo'lib, buni rasmiy raqam orqali xotirjam tekshirishga yordam bering».`,
    ],
    en: [
      "👪 Call someone you trust",
      "",
      "This is not weakness. Scam calls deliberately rush people so they stay alone and make a mistake.",
      "",
      "Do this:",
      "1. Call a trusted person or send the ready text below.",
      "2. Ask: “Stay with me for 5 minutes while I call the bank using an official number.”",
      "3. Do not send SMS codes, PINs, CVVs, passwords, or card photos.",
      "",
      `Ready text: “I need help. Situation: ${title}. I am worried. Please stay with me and help me check this calmly using an official number.”`,
    ],
  };
  return lines[lang].join("\n");
}

function guidedScriptText(panicId: PanicScenarioId, lang: Lang): string {
  const title = followUpTitle(panicId, lang);
  const lines: Record<Lang, string[]> = {
    ru: [
      "💬 Готовая фраза",
      "",
      "Если человек на линии — не спорьте. Прочитайте одну фразу и завершите разговор:",
      "",
      "«Я не обсуждаю деньги, коды, карты и приложения по входящему звонку. Я сам перезвоню по официальному номеру.»",
      "",
      "Если рядом близкий, скажите ему:",
      `«Ситуация: ${title}. Помоги мне не торопиться и позвонить в банк по официальному номеру».`,
    ],
    uz: [
      "💬 Tayyor jumla",
      "",
      "Agar odam hali liniyada bo'lsa — tortishmang. Bitta jumlani o'qing va suhbatni tugating:",
      "",
      "«Kiruvchi qo'ng'iroqda pul, kod, karta va ilovalarni muhokama qilmayman. Rasmiy raqamga o'zim qo'ng'iroq qilaman.»",
      "",
      "Yaqiningiz yoningizda bo'lsa, shunday deng:",
      `«Vaziyat: ${title}. Shoshilmasdan bankka rasmiy raqam orqali qo'ng'iroq qilishga yordam bering».`,
    ],
    en: [
      "💬 Ready phrase",
      "",
      "If the person is still on the line, do not argue. Read one sentence and end the call:",
      "",
      "“I do not discuss money, codes, cards, or apps on an incoming call. I will call back myself using the official number.”",
      "",
      "If someone trusted is nearby, tell them:",
      `“Situation: ${title}. Help me slow down and call the bank using an official number.”`,
    ],
  };
  return lines[lang].join("\n");
}

function guidedMoreAdviceText(panicId: PanicScenarioId, lang: Lang): string {
  if (panicId === 6) {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🧭 После звонка: один шаг за раз",
        "",
        "1. Убедитесь, что звонок завершён. Не перезванивайте на входящий номер.",
        "2. Если код, карту и пароль не называли — просто перезвоните в банк по официальному номеру и спросите, был ли запрос.",
        "3. Если уже назвали код или данные карты — срочно блокируйте карту/онлайн-банк и выберите в /panic сценарий «SMS-код» или «Данные карты».",
        "4. Сохраните номер, время звонка и скрин переписки, если она была.",
      ],
      uz: [
        "🧭 Qo'ng'iroqdan keyin: bitta qadamdan",
        "",
        "1. Qo'ng'iroq tugaganiga ishonch hosil qiling. Kiruvchi raqamga qayta qo'ng'iroq qilmang.",
        "2. Kod, karta va parol aytmagan bo'lsangiz — bankka rasmiy raqam orqali qo'ng'iroq qilib, so'rov bo'lgan-bo'lmaganini so'rang.",
        "3. Kod yoki karta ma'lumotini aytgan bo'lsangiz — karta/onlayn-bankni zudlik bilan bloklang va /panic ichida «SMS-kod» yoki «karta ma'lumotlari» ssenariysini tanlang.",
        "4. Raqam, qo'ng'iroq vaqti va yozishma skrinini saqlang.",
      ],
      en: [
        "🧭 After the call: one step at a time",
        "",
        "1. Make sure the call is over. Do not call back the incoming number.",
        "2. If you did not share a code, card, or password, call the bank using an official number and ask whether there was a real request.",
        "3. If you already shared a code or card data, urgently block the card/online bank and choose the “SMS code” or “card data” scenario in /panic.",
        "4. Save the number, call time, and chat screenshot if there was one.",
      ],
    };
    return lines[lang].join("\n");
  }

  const prefix: Record<Lang, string> = {
    ru: "Я рядом. Давайте без паники: только один безопасный шаг за раз.",
    uz: "Men yoningizdaman. Vahimasiz: bir vaqtning o'zida faqat bitta xavfsiz qadam.",
    en: "I am with you. No panic: one safe step at a time.",
  };
  return `${prefix[lang]}\n\n${moreAdviceText(panicId, lang)}`;
}

export function buildEmergencyFollowUpText(
  action: EmergencyFollowUpAction,
  panicId: PanicScenarioId,
  lang: Lang,
): string {
  switch (action) {
    case "contacts":
      return guidedCallbackDirectory(lang);
    case "script":
      return guidedScriptText(panicId, lang);
    case "trusted_person":
      return guidedTrustedPersonText(panicId, lang);
    case "full":
      return buildDetailedPanicScenarioText(panicId, lang);
    case "more":
      return guidedMoreAdviceText(panicId, lang);
  }
}
