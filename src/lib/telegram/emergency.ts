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
    // ─── Scenario 11: AI voice clone ─────────────────────────────────────
    {
      title: {
        ru: "1️⃣1️⃣ AI-голос: якобы близкий просит деньги",
        uz: "1️⃣1️⃣ AI-ovoz: yaqin odam pul so'rayapti",
        en: "1️⃣1️⃣ AI voice: close person asks for money",
      },
      steps: {
        ru: [
          "⚡ НЕ ПЕРЕВОДИТЕ ДЕНЬГИ ПО ГОЛОСОВОМУ СООБЩЕНИЮ ИЛИ ЗВОНКУ",
          "",
          "❤️ Даже знакомый голос можно подделать. Сначала проверьте человека другим способом.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Завершите звонок или голосовой чат.",
          "  2. Перезвоните близкому сами по сохранённому номеру.",
          "  3. Задайте вопрос, ответ на который знаете только вы двое.",
          "  4. Не переводите деньги и не называйте коды, пока не подтвердите личность.",
          "  5. Если уже перевели деньги — звоните в банк и сохраните доказательства.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Если есть угрозы или деньги уже ушли — обратитесь: ${policeLine("ru")}`,
        ],
        uz: [
          "⚡ OVOZLI XABAR YOKI QO'NG'IROQ BO'YICHA PUL O'TKAZMANG",
          "",
          "❤️ Tanish ovoz ham soxtalashtirilishi mumkin. Avval odamni boshqa yo'l bilan tekshiring.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Qo'ng'iroq yoki ovozli chatni tugating.",
          "  2. Yaqiningizga saqlangan raqam orqali o'zingiz qayta qo'ng'iroq qiling.",
          "  3. Faqat ikkovingiz biladigan savol bering.",
          "  4. Shaxsini tasdiqlamaguncha pul yubormang va kod aytmang.",
          "  5. Pul yuborgan bo'lsangiz — bankka qo'ng'iroq qiling va dalillarni saqlang.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Tahdid bo'lsa yoki pul ketgan bo'lsa — murojaat qiling: ${policeLine("uz")}`,
        ],
        en: [
          "⚡ DO NOT SEND MONEY BASED ON A VOICE MESSAGE OR CALL",
          "",
          "❤️ A familiar voice can be faked. Verify the person through another channel first.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. End the call or voice chat.",
          "  2. Call the person yourself using a saved number.",
          "  3. Ask a private question only the two of you know.",
          "  4. Do not send money or share codes until identity is confirmed.",
          "  5. If money was already sent, call the bank and save evidence.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `If there are threats or money was sent, contact: ${policeLine("en")}`,
        ],
      },
    },
    // ─── Scenario 12: Fake job / easy money ──────────────────────────────
    {
      title: {
        ru: "1️⃣2️⃣ Работа / лёгкий доход",
        uz: "1️⃣2️⃣ Ish / oson daromad",
        en: "1️⃣2️⃣ Job / easy money",
      },
      steps: {
        ru: [
          "⚡ НЕ ПЛАТИТЕ ЗА ТРУДОУСТРОЙСТВО, ДОСТУП ИЛИ «АКТИВАЦИЮ»",
          "",
          "❤️ Настоящий работодатель не просит оплатить оформление, депозит, страховку или «комиссию за вывод».",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Не отправляйте паспорт, карту, PIN, SMS-коды или фото документов.",
          "  2. Не устанавливайте APK и не проходите KYC по ссылке из чата.",
          "  3. Попросите юридическое название компании, сайт и договор.",
          "  4. Проверьте вакансию через официальный сайт компании, а не через Telegram.",
          "  5. Если уже платили — звоните в банк и сохраните чек/переписку.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Если есть давление, угрозы или деньги ушли — обратитесь: ${policeLine("ru")}`,
        ],
        uz: [
          "⚡ ISHGA KIRISH, KIRISH HUQUQI YOKI «FAOLLASHTIRISH» UCHUN TO'LAMANG",
          "",
          "❤️ Haqiqiy ish beruvchi rasmiylashtirish, depozit, sug'urta yoki «yechib olish komissiyasi» uchun pul so'ramaydi.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Pasport, karta, PIN, SMS-kod yoki hujjat rasmini yubormang.",
          "  2. APK o'rnatmang va chatdagi havola orqali KYC o'tmang.",
          "  3. Kompaniyaning yuridik nomi, sayti va shartnomasini so'rang.",
          "  4. Vakansiyani Telegram orqali emas, kompaniyaning rasmiy saytida tekshiring.",
          "  5. Pul to'lagan bo'lsangiz — bankka qo'ng'iroq qiling va chek/yozishmani saqlang.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Bosim, tahdid yoki pul ketgan bo'lsa — murojaat qiling: ${policeLine("uz")}`,
        ],
        en: [
          "⚡ DO NOT PAY FOR A JOB, ACCESS, OR “ACTIVATION”",
          "",
          "❤️ A real employer does not ask you to pay for hiring, deposits, insurance, or a “withdrawal fee”.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Do not send passports, cards, PINs, SMS codes, or document photos.",
          "  2. Do not install APKs or pass KYC through a chat link.",
          "  3. Ask for the legal company name, website, and contract.",
          "  4. Verify the vacancy on the company's official website, not in Telegram.",
          "  5. If you already paid, call your bank and save the receipt/chat.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `If there is pressure, threats, or money was sent, contact: ${policeLine("en")}`,
        ],
      },
    },
    // ─── Scenario 13: Fake delivery / top-up ─────────────────────────────
    {
      title: {
        ru: "1️⃣3️⃣ Доставка / пополнение / «маленькая комиссия»",
        uz: "1️⃣3️⃣ Yetkazish / to'lov / «kichik komissiya»",
        en: "1️⃣3️⃣ Delivery / top-up / small fee",
      },
      steps: {
        ru: [
          "⚡ НЕ ОПЛАЧИВАЙТЕ ПО ССЫЛКЕ ИЗ ЧАТА И НЕ ВВОДИТЕ КОД",
          "",
          "❤️ Схема часто начинается с маленькой суммы: доставка, таможня, пополнение, возврат или подтверждение карты.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Откройте доставку/магазин только через официальное приложение или сайт.",
          "  2. Не вводите SMS-код, PIN, CVV и полный номер карты.",
          "  3. Не устанавливайте APK «для получения посылки» или «подтверждения».",
          "  4. Если ввели карту/код — заблокируйте карту и онлайн-банк.",
          "  5. Сохраните ссылку, чек, чат и номер отправителя.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Если ввели карту/код или деньги ушли — обратитесь: ${policeLine("ru")}`,
        ],
        uz: [
          "⚡ CHATDAGI HAVOLA ORQALI TO'LAMANG VA KOD KIRITMANG",
          "",
          "❤️ Sxema ko'pincha kichik summa bilan boshlanadi: yetkazish, bojxona, to'lov, qaytarish yoki kartani tasdiqlash.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Yetkazish/do'konni faqat rasmiy ilova yoki sayt orqali oching.",
          "  2. SMS-kod, PIN, CVV va to'liq karta raqamini kiritmang.",
          "  3. «Posilkani olish» yoki «tasdiqlash» uchun APK o'rnatmang.",
          "  4. Karta/kod kiritgan bo'lsangiz — karta va onlayn-bankni bloklang.",
          "  5. Havola, chek, chat va yuboruvchi raqamini saqlang.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Karta/kod kiritgan yoki pul ketgan bo'lsa — murojaat qiling: ${policeLine("uz")}`,
        ],
        en: [
          "⚡ DO NOT PAY THROUGH A CHAT LINK OR ENTER A CODE",
          "",
          "❤️ This scam often starts with a small fee: delivery, customs, top-up, refund, or card confirmation.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Open delivery/shop only through the official app or website.",
          "  2. Do not enter SMS codes, PINs, CVVs, or a full card number.",
          "  3. Do not install APKs “to receive a parcel” or “confirm”.",
          "  4. If you entered a card/code, block the card and online banking.",
          "  5. Save the link, receipt, chat, and sender number.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `If you entered a card/code or money was sent, contact: ${policeLine("en")}`,
        ],
      },
    },
    // ─── Scenario 14: Crypto / TON / Wallet ──────────────────────────────
    {
      title: {
        ru: "1️⃣4️⃣ Крипто / TON / Wallet",
        uz: "1️⃣4️⃣ Kripto / TON / Wallet",
        en: "1️⃣4️⃣ Crypto / TON / Wallet",
      },
      steps: {
        ru: [
          "⚡ НЕ ПОДКЛЮЧАЙТЕ WALLET И НЕ ВВОДИТЕ SEED-ФРАЗУ",
          "",
          "❤️ Подарки, Stars, NFT, airdrop и «комиссия за вывод» часто ведут к краже кошелька или депозита.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Не вводите seed-фразу, приватный ключ, код Telegram или SMS-код.",
          "  2. Не подключайте кошелёк к ссылке из чата/канала.",
          "  3. Не платите комиссию за «разблокировку», «вывод» или «проверку».",
          "  4. Если seed-фраза уже введена — перенесите активы в новый кошелёк с чистого устройства.",
          "  5. Сохраните ссылку, адрес кошелька, чек/хэш операции и переписку.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Если были угрозы или деньги ушли — обратитесь: ${policeLine("ru")}`,
        ],
        uz: [
          "⚡ WALLET ULAMANG VA SEED-FRAZANI KIRITMANG",
          "",
          "❤️ Sovg'alar, Stars, NFT, airdrop va «yechib olish komissiyasi» ko'pincha hamyon yoki depozit o'g'irlashga olib boradi.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Seed-fraza, maxfiy kalit, Telegram-kod yoki SMS-kodni kiritmang.",
          "  2. Hamyonni chat/kanaldagi havolaga ulamang.",
          "  3. «Ochish», «yechish» yoki «tekshirish» komissiyasini to'lamang.",
          "  4. Seed-fraza kiritilgan bo'lsa — aktivlarni toza qurilmadan yangi hamyonga o'tkazing.",
          "  5. Havola, hamyon manzili, chek/operatsiya xeshi va yozishmani saqlang.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Tahdid bo'lsa yoki pul ketgan bo'lsa — murojaat qiling: ${policeLine("uz")}`,
        ],
        en: [
          "⚡ DO NOT CONNECT WALLET OR ENTER A SEED PHRASE",
          "",
          "❤️ Gifts, Stars, NFTs, airdrops, and “withdrawal fees” often lead to wallet or deposit theft.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Do not enter a seed phrase, private key, Telegram code, or SMS code.",
          "  2. Do not connect a wallet to a chat/channel link.",
          "  3. Do not pay a fee for “unlocking”, “withdrawal”, or “verification”.",
          "  4. If a seed phrase was entered, move assets to a new wallet from a clean device.",
          "  5. Save the link, wallet address, receipt/transaction hash, and chat.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `If there are threats or money was sent, contact: ${policeLine("en")}`,
        ],
      },
    },
    // ─── Scenario 15: Government grant / benefit ─────────────────────────
    {
      title: {
        ru: "1️⃣5️⃣ Госвыплата / грант / компенсация",
        uz: "1️⃣5️⃣ Davlat to'lovi / grant / kompensatsiya",
        en: "1️⃣5️⃣ Government grant / benefit",
      },
      steps: {
        ru: [
          "⚡ НЕ ПЛАТИТЕ «КОМИССИЮ ЗА ВЫПЛАТУ» И НЕ ВВОДИТЕ КОД",
          "",
          "❤️ Настоящие госуслуги не требуют SMS-код, CVV, PIN или предоплату через Telegram-ссылку.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Что сделать сейчас:",
          "",
          "  1. Откройте услугу только через официальный сайт/приложение, набрав адрес сами.",
          "  2. Не вводите SMS-код, Telegram-код, CVV, PIN или данные карты.",
          "  3. Не отправляйте фото паспорта/ID в чат без проверки источника.",
          "  4. Если ввели карту или код — заблокируйте карту/онлайн-банк.",
          "  5. Сохраните ссылку, чат и имя канала/аккаунта.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Если деньги ушли или есть угрозы — обратитесь: ${policeLine("ru")}`,
        ],
        uz: [
          "⚡ «TO'LOV KOMISSIYASI»NI TO'LAMANG VA KOD KIRITMANG",
          "",
          "❤️ Haqiqiy davlat xizmatlari Telegram havolasi orqali SMS-kod, CVV, PIN yoki oldindan to'lov so'ramaydi.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 Hozir nima qilish kerak:",
          "",
          "  1. Xizmatni faqat rasmiy sayt/ilova orqali, manzilni o'zingiz terib oching.",
          "  2. SMS-kod, Telegram-kod, CVV, PIN yoki karta ma'lumotini kiritmang.",
          "  3. Manbani tekshirmasdan pasport/ID rasmini chatga yubormang.",
          "  4. Karta yoki kod kiritgan bo'lsangiz — karta/onlayn-bankni bloklang.",
          "  5. Havola, chat va kanal/akkaunt nomini saqlang.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `Pul ketgan yoki tahdid bo'lsa — murojaat qiling: ${policeLine("uz")}`,
        ],
        en: [
          "⚡ DO NOT PAY A “BENEFIT FEE” OR ENTER A CODE",
          "",
          "❤️ Real government services do not ask for SMS codes, CVVs, PINs, or prepayment through a Telegram link.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          "📋 What to do now:",
          "",
          "  1. Open the service only through the official site/app by typing the address yourself.",
          "  2. Do not enter SMS codes, Telegram codes, CVVs, PINs, or card data.",
          "  3. Do not send passport/ID photos in chat before verifying the source.",
          "  4. If you entered a card or code, block the card/online banking.",
          "  5. Save the link, chat, and channel/account name.",
          "",
          "━━━━━━━━━━━━━━━━━━━━━━",
          `If money was sent or there are threats, contact: ${policeLine("en")}`,
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
export type PanicScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

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
  11: {
    ru: "🎙️ Голос близкого / AI",
    uz: "🎙️ Yaqin ovozi / AI",
    en: "🎙️ Loved one's voice / AI",
  },
  12: {
    ru: "💼 Работа / лёгкий доход",
    uz: "💼 Ish / oson daromad",
    en: "💼 Job / easy money",
  },
  13: {
    ru: "🚚 Доставка / пополнение",
    uz: "🚚 Yetkazish / to'lov",
    en: "🚚 Delivery / top-up",
  },
  14: {
    ru: "🪙 Крипто / TON / Wallet",
    uz: "🪙 Kripto / TON / Wallet",
    en: "🪙 Crypto / TON / Wallet",
  },
  15: {
    ru: "🏛️ Госвыплата / грант",
    uz: "🏛️ Davlat to'lovi / grant",
    en: "🏛️ Government grant",
  },
};

/** callback_data prefix for panic scenario buttons. Full: "panic:1" through "panic:15". */
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
  11: {
    ru: [
      "⚡ НЕ ПЕРЕВОДИТЕ ДЕНЬГИ ПО ГОЛОСУ",
      "",
      "Я рядом. Сейчас важно проверить не голос, а человека: голос могли подделать или переслать.",
      "",
      "Сделайте сейчас:",
      "1. Завершите звонок или голосовой чат.",
      "2. Перезвоните близкому сами по сохранённому номеру.",
      "3. Задайте кодовое слово или личный вопрос.",
      "",
      "Пока личность не подтверждена — не переводите деньги и не называйте коды.",
    ],
    uz: [
      "⚡ OVOZ BO'YICHA PUL YUBORMANG",
      "",
      "Men yoningizdaman. Hozir ovozni emas, odamni tekshirish kerak: ovoz soxtalashtirilgan yoki yuborilgan bo'lishi mumkin.",
      "",
      "Hozir qiling:",
      "1. Qo'ng'iroq yoki ovozli chatni tugating.",
      "2. Yaqiningizga saqlangan raqam orqali o'zingiz qo'ng'iroq qiling.",
      "3. Maxfiy so'z yoki shaxsiy savol bering.",
      "",
      "Shaxs tasdiqlanmaguncha pul yubormang va kod aytmang.",
    ],
    en: [
      "⚡ DO NOT SEND MONEY BASED ON VOICE",
      "",
      "I am with you. The goal is not to trust the voice, but to verify the person: voice can be cloned or forwarded.",
      "",
      "Do this now:",
      "1. End the call or voice chat.",
      "2. Call the person yourself using a saved number.",
      "3. Ask a family code word or private question.",
      "",
      "Until identity is confirmed, do not send money or share codes.",
    ],
  },
  12: {
    ru: [
      "⚡ НЕ ПЛАТИТЕ ЗА РАБОТУ ИЛИ «ВЫВОД»",
      "",
      "Я рядом. Лёгкий доход часто используют как крючок: сначала обещают прибыль, потом просят депозит, комиссию или документы.",
      "",
      "Сделайте сейчас:",
      "1. Не отправляйте паспорт, карту, коды или фото документов.",
      "2. Не устанавливайте APK и не проходите KYC по ссылке из чата.",
      "3. Попросите юридическое название компании и договор.",
      "",
      "Пока нет договора и официального сайта — не платите.",
    ],
    uz: [
      "⚡ ISH YOKI «YECHISH» UCHUN TO'LAMANG",
      "",
      "Men yoningizdaman. Oson daromad ko'pincha tuzoq: avval foyda va'da qilinadi, keyin depozit, komissiya yoki hujjat so'raladi.",
      "",
      "Hozir qiling:",
      "1. Pasport, karta, kod yoki hujjat rasmini yubormang.",
      "2. APK o'rnatmang va chatdagi havola orqali KYC o'tmang.",
      "3. Kompaniyaning yuridik nomi va shartnomasini so'rang.",
      "",
      "Shartnoma va rasmiy sayt bo'lmaguncha to'lamang.",
    ],
    en: [
      "⚡ DO NOT PAY FOR WORK OR “WITHDRAWAL”",
      "",
      "I am with you. Easy income is often the hook: first profit is promised, then a deposit, fee, or documents are requested.",
      "",
      "Do this now:",
      "1. Do not send passports, cards, codes, or document photos.",
      "2. Do not install APKs or pass KYC through a chat link.",
      "3. Ask for the legal company name and contract.",
      "",
      "Until there is a contract and official website, do not pay.",
    ],
  },
  13: {
    ru: [
      "⚡ НЕ ОПЛАЧИВАЙТЕ ПО ССЫЛКЕ ИЗ ЧАТА",
      "",
      "Я рядом. Доставка, пополнение, возврат или «маленькая комиссия» часто ведут к краже карты.",
      "",
      "Сделайте сейчас:",
      "1. Откройте сервис только через официальное приложение или сайт.",
      "2. Не вводите SMS-код, PIN, CVV или полный номер карты.",
      "3. Если уже ввели данные — заблокируйте карту.",
      "",
      "Ссылку/скрин следующего экрана можно прислать на проверку.",
    ],
    uz: [
      "⚡ CHATDAGI HAVOLA ORQALI TO'LAMANG",
      "",
      "Men yoningizdaman. Yetkazish, to'lov, qaytarish yoki «kichik komissiya» ko'pincha kartani o'g'irlashga olib boradi.",
      "",
      "Hozir qiling:",
      "1. Servisni faqat rasmiy ilova yoki sayt orqali oching.",
      "2. SMS-kod, PIN, CVV yoki to'liq karta raqamini kiritmang.",
      "3. Ma'lumot kiritgan bo'lsangiz — kartani bloklang.",
      "",
      "Havola/keyingi ekran skrinini tekshiruvga yuborishingiz mumkin.",
    ],
    en: [
      "⚡ DO NOT PAY THROUGH A CHAT LINK",
      "",
      "I am with you. Delivery, top-up, refund, or a “small fee” often leads to card theft.",
      "",
      "Do this now:",
      "1. Open the service only through the official app or website.",
      "2. Do not enter SMS codes, PINs, CVVs, or a full card number.",
      "3. If you already entered details, block the card.",
      "",
      "You can send the link/next screen screenshot for checking.",
    ],
  },
  14: {
    ru: [
      "⚡ НЕ ПОДКЛЮЧАЙТЕ WALLET И НЕ ВВОДИТЕ SEED-ФРАЗУ",
      "",
      "Я рядом. NFT, Stars, TON-бонусы и airdrop часто ведут к wallet connect, seed-фразе или «комиссии за вывод».",
      "",
      "Сделайте сейчас:",
      "1. Не вводите seed-фразу, приватный ключ или Telegram-код.",
      "2. Не подключайте кошелёк к ссылке из чата.",
      "3. Если seed уже ввели — перенесите активы в новый кошелёк с чистого устройства.",
      "",
      "Сохраните ссылку и адрес кошелька, если деньги уже ушли.",
    ],
    uz: [
      "⚡ WALLET ULAMANG VA SEED-FRAZA KIRITMANG",
      "",
      "Men yoningizdaman. NFT, Stars, TON bonuslari va airdrop ko'pincha wallet connect, seed-fraza yoki «yechish komissiyasi»ga olib boradi.",
      "",
      "Hozir qiling:",
      "1. Seed-fraza, maxfiy kalit yoki Telegram-kodni kiritmang.",
      "2. Hamyonni chatdagi havolaga ulamang.",
      "3. Seed kiritilgan bo'lsa — aktivlarni toza qurilmadan yangi hamyonga o'tkazing.",
      "",
      "Pul ketgan bo'lsa, havola va hamyon manzilini saqlang.",
    ],
    en: [
      "⚡ DO NOT CONNECT WALLET OR ENTER A SEED PHRASE",
      "",
      "I am with you. NFTs, Stars, TON bonuses, and airdrops often lead to wallet connect, seed phrases, or a “withdrawal fee”.",
      "",
      "Do this now:",
      "1. Do not enter a seed phrase, private key, or Telegram code.",
      "2. Do not connect a wallet to a chat link.",
      "3. If a seed was entered, move assets to a new wallet from a clean device.",
      "",
      "Save the link and wallet address if money was already sent.",
    ],
  },
  15: {
    ru: [
      "⚡ НЕ ПЛАТИТЕ «КОМИССИЮ ЗА ВЫПЛАТУ»",
      "",
      "Я рядом. Госвыплаты и гранты часто подделывают: обещают компенсацию, а потом просят карту, код или предоплату.",
      "",
      "Сделайте сейчас:",
      "1. Открывайте услугу только через официальный сайт или приложение.",
      "2. Не вводите SMS-код, CVV, PIN или Telegram-код.",
      "3. Не отправляйте паспорт/ID в чат без проверки источника.",
      "",
      "Если ввели карту или код — заблокируйте карту/онлайн-банк.",
    ],
    uz: [
      "⚡ «TO'LOV KOMISSIYASI»NI TO'LAMANG",
      "",
      "Men yoningizdaman. Davlat to'lovlari va grantlar ko'pincha soxtalashtiriladi: kompensatsiya va'da qilinadi, keyin karta, kod yoki oldindan to'lov so'raladi.",
      "",
      "Hozir qiling:",
      "1. Xizmatni faqat rasmiy sayt yoki ilova orqali oching.",
      "2. SMS-kod, CVV, PIN yoki Telegram-kodni kiritmang.",
      "3. Manbani tekshirmasdan pasport/IDni chatga yubormang.",
      "",
      "Karta yoki kod kiritgan bo'lsangiz — karta/onlayn-bankni bloklang.",
    ],
    en: [
      "⚡ DO NOT PAY A “BENEFIT FEE”",
      "",
      "I am with you. Government benefits and grants are often faked: compensation is promised, then card data, a code, or prepayment is requested.",
      "",
      "Do this now:",
      "1. Open the service only through the official site or app.",
      "2. Do not enter SMS codes, CVVs, PINs, or Telegram codes.",
      "3. Do not send passport/ID photos in chat before verifying the source.",
      "",
      "If you entered a card or code, block the card/online banking.",
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
  if (suffix === "more" || suffix === "more2" || suffix === "back" || suffix === "back2")
    return null;
  const n = Number(suffix);
  if (n >= 1 && n <= 15) return n as PanicScenarioId;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PANIC KEYBOARD PAGINATION — split scenarios into short pages.
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
 * Build panic keyboard page 2: scenarios 7–11 (2 per row) + next/back buttons.
 * Shown when user taps "Другие ситуации".
 */
export function buildPanicKeyboardPage2(lang: Lang): InlineKeyboard {
  const rows: InlineKeyboard = [];
  // Scenarios 7–11, 2 per row.
  for (let i = 7; i <= 11; i += 2) {
    const row: InlineKeyboard[number] = [
      {
        text: PANIC_MENU_TITLES[i as PanicScenarioId][lang],
        callback_data: `${PANIC_CB_PREFIX}${i}`,
      },
    ];
    if (i + 1 <= 11) {
      row.push({
        text: PANIC_MENU_TITLES[(i + 1) as PanicScenarioId][lang],
        callback_data: `${PANIC_CB_PREFIX}${i + 1}`,
      });
    }
    rows.push(row);
  }
  const nextLabel: Record<Lang, string> = {
    ru: "Ещё ситуации ➡️",
    uz: "Yana vaziyatlar ➡️",
    en: "More situations ➡️",
  };
  rows.push([{ text: nextLabel[lang], callback_data: `${PANIC_CB_PREFIX}more2` }]);

  // "Back" button
  const backLabel: Record<Lang, string> = {
    ru: "← Назад",
    uz: "← Orqaga",
    en: "← Back",
  };
  rows.push([{ text: backLabel[lang], callback_data: `${PANIC_CB_PREFIX}back` }]);
  return rows;
}

/**
 * Build panic keyboard page 3: scenarios 12–15 + "← Назад" button.
 * This page keeps newer promo/payment scam cases out of the first emergency screen.
 */
export function buildPanicKeyboardPage3(lang: Lang): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (let i = 12; i <= 15; i += 2) {
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

  const backLabel: Record<Lang, string> = {
    ru: "← Назад",
    uz: "← Orqaga",
    en: "← Back",
  };
  rows.push([{ text: backLabel[lang], callback_data: `${PANIC_CB_PREFIX}back2` }]);
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

export function buildLiveCallActiveKeyboard(lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("btn_live_hangup", lang), callback_data: `${LIVE_CALL_CB_PREFIX}hangup` }],
    [
      {
        text: bt("btn_live_what_to_say", lang),
        callback_data: `${LIVE_CALL_CB_PREFIX}what_to_say`,
      },
      {
        text: bt("btn_live_sent_code", lang),
        callback_data: `${LIVE_CALL_CB_PREFIX}sent_code`,
      },
    ],
    [
      {
        text: bt("btn_live_tell_family", lang),
        callback_data: `${LIVE_CALL_CB_PREFIX}tell_family`,
      },
    ],
  ];
}

export function buildLiveCallPhraseKeyboard(lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("btn_live_hangup", lang), callback_data: `${LIVE_CALL_CB_PREFIX}hangup` }],
    [
      {
        text: bt("btn_live_tell_family", lang),
        callback_data: `${LIVE_CALL_CB_PREFIX}tell_family`,
      },
    ],
  ];
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
  /(?:номер|телефон|позвон|контакт|горяч[а-я]*\s+лини[а-я]*|куда\s+звонить|кому\s+звонить)[\s\S]{0,45}(?:банк|карта|служба|оператор)|(?:банк|банка|банку|карты?|служба)[\s\S]{0,45}(?:номер|телефон|контакт|позвон|горяч[а-я]*\s+лини[а-я]*|куда\s+звонить|кому\s+звонить)|(?:куда\s+обратиться|в\s+полици[юи]|полици[яю]|мвд|102|uzcert|поддержк[ау])|(?:bank|card|hotline|support|police|platform)[\s\S]{0,45}(?:number|phone|contact|call|hotline|help)|(?:call|phone|contact|report)[\s\S]{0,45}(?:bank|card|support|police|platform)|(?:bank|karta|politsiya|i i v|iiv)[\s\S]{0,45}(?:raqam|telefon|qo'ng'iroq|qongiroq|murojaat)/i;
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
  return Number.isInteger(n) && n >= 1 && n <= 15 ? (n as PanicScenarioId) : null;
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

type PanicFollowUpProfile =
  | "financial"
  | "malware"
  | "telegram_recovery"
  | "live_call"
  | "blackmail"
  | "romance"
  | "minor"
  | "voice_clone"
  | "fake_job"
  | "delivery"
  | "crypto"
  | "government_grant";

function followUpProfile(panicId: PanicScenarioId): PanicFollowUpProfile {
  switch (panicId) {
    case 1:
    case 3:
    case 4:
      return "financial";
    case 2:
      return "malware";
    case 5:
      return "telegram_recovery";
    case 6:
      return "live_call";
    case 7:
    case 9:
      return "blackmail";
    case 8:
      return "romance";
    case 10:
      return "minor";
    case 11:
      return "voice_clone";
    case 12:
      return "fake_job";
    case 13:
      return "delivery";
    case 14:
      return "crypto";
    case 15:
      return "government_grant";
  }
}

function shouldUseHelpDirectory(panicId: PanicScenarioId): boolean {
  const profile = followUpProfile(panicId);
  return (
    profile === "telegram_recovery" ||
    profile === "blackmail" ||
    profile === "romance" ||
    profile === "minor" ||
    profile === "voice_clone" ||
    profile === "fake_job" ||
    profile === "delivery" ||
    profile === "crypto" ||
    profile === "government_grant"
  );
}

function contactsButtonText(lang: Lang, panicId?: PanicScenarioId): string {
  if (panicId == null || !shouldUseHelpDirectory(panicId)) return FOLLOWUP_BUTTONS.contacts[lang];

  const labels: Record<Lang, string> = {
    ru: "🆘 Куда обратиться",
    uz: "🆘 Qayerga murojaat",
    en: "🆘 Where to get help",
  };
  return labels[lang];
}

export function buildLiveCallPostHangupKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      {
        text: contactsButtonText(lang, 6),
        callback_data: `${PANIC_CONTEXT_CB_PREFIX}contacts`,
      },
      {
        text: FOLLOWUP_BUTTONS.trusted_person[lang],
        callback_data: "family:notify",
      },
    ],
    [
      { text: FOLLOWUP_BUTTONS.script[lang], callback_data: `${PANIC_CONTEXT_CB_PREFIX}script` },
      { text: FOLLOWUP_BUTTONS.full[lang], callback_data: `${PANIC_CONTEXT_CB_PREFIX}full` },
    ],
  ];
}

export function buildEmergencyFollowUpKeyboard(
  lang: Lang,
  panicId?: PanicScenarioId,
): InlineKeyboard {
  if (panicId === 6) return buildLiveCallPostHangupKeyboard(lang);

  return [
    [
      { text: FOLLOWUP_BUTTONS.more[lang], callback_data: `${PANIC_CONTEXT_CB_PREFIX}more` },
      {
        text: contactsButtonText(lang, panicId),
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
    11: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Перезвоните близкому сами по сохранённому номеру или через другой мессенджер.",
        "2. Спросите кодовое слово или личный вопрос, который нельзя узнать из соцсетей.",
        "3. До подтверждения личности не переводите деньги, не берите кредит и не называйте коды.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Yaqiningizga saqlangan raqam orqali yoki boshqa messenjerda o'zingiz qo'ng'iroq qiling.",
        "2. Ijtimoiy tarmoqlardan bilib bo'lmaydigan maxfiy so'z yoki shaxsiy savol bering.",
        "3. Shaxs tasdiqlanmaguncha pul yubormang, kredit olmang va kod aytmang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Call the person yourself using a saved number or another messenger.",
        "2. Ask a code word or private question that cannot be learned from social media.",
        "3. Until identity is confirmed, do not send money, take loans, or share codes.",
      ],
    },
    12: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Поставьте паузу: не платите депозит, налог, страховку или комиссию за вывод.",
        "2. Попросите юридическое название компании, сайт, договор и имя ответственного лица.",
        "3. Проверьте вакансию через официальный сайт компании или независимый источник.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Pauza qiling: depozit, soliq, sug'urta yoki yechib olish komissiyasini to'lamang.",
        "2. Kompaniyaning yuridik nomi, sayti, shartnomasi va mas'ul shaxs ismini so'rang.",
        "3. Vakansiyani kompaniyaning rasmiy sayti yoki mustaqil manba orqali tekshiring.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Pause: do not pay a deposit, tax, insurance, or withdrawal fee.",
        "2. Ask for the legal company name, website, contract, and responsible person's name.",
        "3. Verify the vacancy through the company's official site or an independent source.",
      ],
    },
    13: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Закройте ссылку и откройте сервис вручную через официальное приложение или сайт.",
        "2. Если вводили карту, CVV или SMS-код — заблокируйте карту и онлайн-банк.",
        "3. Сохраните ссылку, чек и чат; не устанавливайте APK для доставки/возврата.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Havolani yoping va servisni rasmiy ilova yoki sayt orqali qo'lda oching.",
        "2. Karta, CVV yoki SMS-kod kiritgan bo'lsangiz — karta va onlayn-bankni bloklang.",
        "3. Havola, chek va chatni saqlang; yetkazish/qaytarish uchun APK o'rnatmang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Close the link and open the service manually through the official app or site.",
        "2. If you entered card data, CVV, or an SMS code, block the card and online banking.",
        "3. Save the link, receipt, and chat; do not install delivery/refund APKs.",
      ],
    },
    14: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Не подключайте кошелёк и не вводите seed-фразу/приватный ключ.",
        "2. Если seed уже ввели — с чистого устройства создайте новый кошелёк и перенесите активы.",
        "3. Сохраните ссылку, адрес кошелька, хэш операции и переписку.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. Hamyonni ulamang va seed-fraza/maxfiy kalitni kiritmang.",
        "2. Seed kiritilgan bo'lsa — toza qurilmadan yangi hamyon yarating va aktivlarni o'tkazing.",
        "3. Havola, hamyon manzili, operatsiya xeshi va yozishmani saqlang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Do not connect the wallet or enter a seed phrase/private key.",
        "2. If a seed was entered, create a new wallet from a clean device and move assets.",
        "3. Save the link, wallet address, transaction hash, and chat.",
      ],
    },
    15: {
      ru: [
        "🧭 Следующий безопасный шаг",
        "",
        "1. Не платите комиссию и не вводите коды для «получения выплаты».",
        "2. Откройте госуслугу только через официальный сайт/приложение, набрав адрес сами.",
        "3. Если ввели карту или SMS-код — заблокируйте карту/онлайн-банк.",
      ],
      uz: [
        "🧭 Keyingi xavfsiz qadam",
        "",
        "1. «To'lovni olish» uchun komissiya to'lamang va kod kiritmang.",
        "2. Davlat xizmatini faqat rasmiy sayt/ilova orqali, manzilni o'zingiz terib oching.",
        "3. Karta yoki SMS-kod kiritgan bo'lsangiz — karta/onlayn-bankni bloklang.",
      ],
      en: [
        "🧭 Next safe step",
        "",
        "1. Do not pay a fee or enter codes to “receive a benefit”.",
        "2. Open the government service only through the official site/app by typing it yourself.",
        "3. If you entered a card or SMS code, block the card/online banking.",
      ],
    },
  };
  return byScenario[panicId][lang].join("\n");
}

function guidedCallbackDirectory(panicId: PanicScenarioId, lang: Lang): string {
  const contacts = getEmergencyContacts();
  const banks = contacts.banks.slice(0, 6);
  const payments = contacts.payments.slice(0, 3);
  const protectionContacts = [contacts.police, contacts.cyber].filter(
    (contact): contact is VerifiedContact => contact != null,
  );
  const profile = followUpProfile(panicId);

  if (profile === "telegram_recovery") {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🔐 Восстановление Telegram",
        "",
        "1. Не отвечайте тому, кто пишет от вашего имени.",
        "2. Восстанавливайте доступ только через Telegram на своём устройстве.",
        "3. Предупредите близких: от вашего аккаунта могут просить деньги или коды.",
        "",
        "Если были переводы, угрозы или взлом других сервисов — сохраните скриншоты и обратитесь:",
        contactList(protectionContacts, lang),
      ],
      uz: [
        "🔐 Telegram'ni tiklash",
        "",
        "1. Sizning nomingizdan yozayotgan odamga javob bermang.",
        "2. Kirishni faqat o'z qurilmangizdagi Telegram orqali tiklang.",
        "3. Yaqinlaringizni ogohlantiring: akkauntingizdan pul yoki kod so'rashlari mumkin.",
        "",
        "Pul o'tkazilgan, tahdid bo'lgan yoki boshqa servislar buzilgan bo'lsa, skrinshotlarni saqlang va murojaat qiling:",
        contactList(protectionContacts, lang),
      ],
      en: [
        "🔐 Telegram recovery",
        "",
        "1. Do not reply to whoever is using your account.",
        "2. Recover access only through Telegram on your own device.",
        "3. Warn close contacts: your account may ask for money or codes.",
        "",
        "If money was sent, threats appeared, or other services were compromised, save screenshots and contact:",
        contactList(protectionContacts, lang),
      ],
    };
    return lines[lang].join("\n");
  }

  if (profile === "blackmail" || profile === "minor") {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🆘 Куда обратиться",
        "",
        "1. Позовите взрослого или человека, которому доверяете. Сейчас важно не оставаться одному.",
        "2. Не платите, не отправляйте новые фото/видео и не спорьте с угрожающим.",
        "3. Сохраните скриншоты, ссылку на профиль и время сообщений.",
        "",
        "Обратиться можно сюда:",
        contactList(protectionContacts, lang),
        "",
        "Если вам меньше 18 лет — сначала покажите переписку взрослому рядом. Это не стыдно и не ваша вина.",
      ],
      uz: [
        "🆘 Qayerga murojaat qilish",
        "",
        "1. Ishonchli katta odamni yoki yaqiningizni chaqiring. Hozir yolg'iz qolmaslik muhim.",
        "2. To'lamang, yangi foto/video yubormang va tahdid qilayotgan odam bilan tortishmang.",
        "3. Skrinshotlar, profil havolasi va xabar vaqtlarini saqlang.",
        "",
        "Bu yerlarga murojaat qilish mumkin:",
        contactList(protectionContacts, lang),
        "",
        "18 yoshdan kichik bo'lsangiz — avval yozishmani yoningizdagi kattaga ko'rsating. Bu uyat emas va siz aybdor emassiz.",
      ],
      en: [
        "🆘 Where to get help",
        "",
        "1. Call a trusted adult or trusted person. The important thing is not to stay alone.",
        "2. Do not pay, do not send more photos/videos, and do not argue with the person threatening you.",
        "3. Save screenshots, the profile link, and message times.",
        "",
        "You can contact:",
        contactList(protectionContacts, lang),
        "",
        "If you are under 18, show the chat to an adult near you first. This is not shameful and it is not your fault.",
      ],
    };
    return lines[lang].join("\n");
  }

  if (profile === "romance") {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🆘 Куда обратиться",
        "",
        "1. Попросите близкого посмотреть переписку со стороны. В романтических схемах специально изолируют человека.",
        "2. Если уже переводили деньги — позвоните в банк по официальному номеру и попросите проверить операции.",
        "3. Сохраните переписку, чеки, username и реквизиты получателя.",
        "",
        "Проверенные номера банков и платёжных систем:",
        contactList(banks, lang),
        contactList(payments, lang),
      ],
      uz: [
        "🆘 Qayerga murojaat qilish",
        "",
        "1. Yaqiningizdan yozishmani tashqaridan ko'rib berishni so'rang. Romantik sxemalarda odamni ataylab yolg'iz qoldirishadi.",
        "2. Pul o'tkazgan bo'lsangiz — bankka rasmiy raqam orqali qo'ng'iroq qilib, operatsiyalarni tekshirtiring.",
        "3. Yozishma, chek, username va oluvchi rekvizitlarini saqlang.",
        "",
        "Tekshirilgan bank va to'lov tizimi raqamlari:",
        contactList(banks, lang),
        contactList(payments, lang),
      ],
      en: [
        "🆘 Where to get help",
        "",
        "1. Ask someone trusted to review the chat from the outside. Romance scams deliberately isolate people.",
        "2. If you already sent money, call the bank using an official number and ask them to review operations.",
        "3. Save the chat, receipts, username, and recipient details.",
        "",
        "Verified bank and payment-system numbers:",
        contactList(banks, lang),
        contactList(payments, lang),
      ],
    };
    return lines[lang].join("\n");
  }

  if (profile === "voice_clone") {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🎙️ Как проверить голос безопасно",
        "",
        "1. Не используйте номер, ссылку или аккаунт, откуда пришла просьба.",
        "2. Перезвоните человеку по сохранённому номеру или напишите в другой канал.",
        "3. Спросите кодовое слово или личный вопрос: то, чего нет в соцсетях.",
        "4. Если деньги уже перевели — звоните в банк по официальному номеру и сохраните чек.",
        "",
        "Куда обратиться, если был перевод, угрозы или вымогательство:",
        contactList(protectionContacts, lang),
        contactList(banks, lang),
        contactList(payments, lang),
      ],
      uz: [
        "🎙️ Ovozni xavfsiz tekshirish",
        "",
        "1. Iltimos kelgan raqam, havola yoki akkauntdan foydalanmang.",
        "2. Odamga saqlangan raqam orqali qo'ng'iroq qiling yoki boshqa kanalga yozing.",
        "3. Maxfiy so'z yoki shaxsiy savol bering: ijtimoiy tarmoqlarda yo'q narsa.",
        "4. Pul yuborilgan bo'lsa — bankka rasmiy raqam orqali qo'ng'iroq qiling va chekni saqlang.",
        "",
        "Pul o'tkazilgan, tahdid yoki tovlamachilik bo'lgan bo'lsa, murojaat qiling:",
        contactList(protectionContacts, lang),
        contactList(banks, lang),
        contactList(payments, lang),
      ],
      en: [
        "🎙️ How to verify voice safely",
        "",
        "1. Do not use the number, link, or account that made the request.",
        "2. Call the person using a saved number or message them through another channel.",
        "3. Ask a code word or private question: something not visible on social media.",
        "4. If money was already sent, call your bank using an official number and save the receipt.",
        "",
        "Where to get help if money was sent, threats appeared, or there is extortion:",
        contactList(protectionContacts, lang),
        contactList(banks, lang),
        contactList(payments, lang),
      ],
    };
    return lines[lang].join("\n");
  }

  if (profile === "fake_job") {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🆘 Куда обратиться",
        "",
        "1. Если уже оплатили «депозит/комиссию/налог» — звоните в банк по официальному номеру.",
        "2. Если отправили документы — сохраните переписку и не отправляйте новые фото/коды.",
        "3. Сохраните ссылку, username, реквизиты, чек и обещания дохода.",
        "",
        "Куда можно обратиться:",
        contactList(protectionContacts, lang),
        contactList(banks, lang),
        contactList(payments, lang),
      ],
      uz: [
        "🆘 Qayerga murojaat qilish",
        "",
        "1. «Depozit/komissiya/soliq» to'lagan bo'lsangiz — bankka rasmiy raqam orqali qo'ng'iroq qiling.",
        "2. Hujjat yuborgan bo'lsangiz — yozishmani saqlang va yangi foto/kod yubormang.",
        "3. Havola, username, rekvizit, chek va daromad va'dalarini saqlang.",
        "",
        "Murojaat qilish mumkin:",
        contactList(protectionContacts, lang),
        contactList(banks, lang),
        contactList(payments, lang),
      ],
      en: [
        "🆘 Where to get help",
        "",
        "1. If you already paid a “deposit/fee/tax”, call your bank using an official number.",
        "2. If you sent documents, save the chat and do not send new photos/codes.",
        "3. Save the link, username, payment details, receipt, and income promises.",
        "",
        "You can contact:",
        contactList(protectionContacts, lang),
        contactList(banks, lang),
        contactList(payments, lang),
      ],
    };
    return lines[lang].join("\n");
  }

  if (profile === "delivery" || profile === "government_grant") {
    const lines: Record<Lang, string[]> = {
      ru: [
        profile === "delivery" ? "🚚 Доставка/пополнение: помощь" : "🏛️ Госвыплата/грант: помощь",
        "",
        "1. Если вводили карту, CVV или SMS-код — срочно заблокируйте карту и онлайн-банк.",
        "2. Откройте сервис только вручную через официальный сайт/приложение.",
        "3. Сохраните ссылку, чат, чек и имя канала/аккаунта.",
        "",
        "Проверенные номера:",
        contactList(banks, lang),
        contactList(payments, lang),
        "",
        "Если есть угрозы, вымогательство или поддельные документы:",
        contactList(protectionContacts, lang),
      ],
      uz: [
        profile === "delivery" ? "🚚 Yetkazish/to'lov: yordam" : "🏛️ Davlat to'lovi/grant: yordam",
        "",
        "1. Karta, CVV yoki SMS-kod kiritgan bo'lsangiz — karta va onlayn-bankni zudlik bilan bloklang.",
        "2. Servisni faqat rasmiy sayt/ilova orqali qo'lda oching.",
        "3. Havola, chat, chek va kanal/akkaunt nomini saqlang.",
        "",
        "Tekshirilgan raqamlar:",
        contactList(banks, lang),
        contactList(payments, lang),
        "",
        "Tahdid, tovlamachilik yoki soxta hujjatlar bo'lsa:",
        contactList(protectionContacts, lang),
      ],
      en: [
        profile === "delivery" ? "🚚 Delivery/top-up help" : "🏛️ Government grant help",
        "",
        "1. If you entered card data, CVV, or an SMS code, urgently block the card and online banking.",
        "2. Open the service only manually through the official site/app.",
        "3. Save the link, chat, receipt, and channel/account name.",
        "",
        "Verified numbers:",
        contactList(banks, lang),
        contactList(payments, lang),
        "",
        "If there are threats, extortion, or forged documents:",
        contactList(protectionContacts, lang),
      ],
    };
    return lines[lang].join("\n");
  }

  if (profile === "crypto") {
    const lines: Record<Lang, string[]> = {
      ru: [
        "🆘 Крипто/TON: что делать",
        "",
        "1. Если seed-фразу или приватный ключ уже ввели — создайте новый кошелёк с чистого устройства и перенесите активы.",
        "2. Не платите «комиссию за вывод», «разморозку» или «верификацию».",
        "3. Сохраните ссылку, адрес кошелька, хэш операции и переписку.",
        "",
        "Если была карта/перевод через банк — звоните в банк. Если есть угрозы — обращайтесь:",
        contactList(banks, lang),
        contactList(protectionContacts, lang),
      ],
      uz: [
        "🆘 Kripto/TON: nima qilish kerak",
        "",
        "1. Seed-fraza yoki maxfiy kalit kiritilgan bo'lsa — toza qurilmadan yangi hamyon yarating va aktivlarni o'tkazing.",
        "2. «Yechib olish», «muzdan tushirish» yoki «verifikatsiya» komissiyasini to'lamang.",
        "3. Havola, hamyon manzili, operatsiya xeshi va yozishmani saqlang.",
        "",
        "Karta/bank o'tkazmasi bo'lgan bo'lsa — bankka qo'ng'iroq qiling. Tahdid bo'lsa — murojaat qiling:",
        contactList(banks, lang),
        contactList(protectionContacts, lang),
      ],
      en: [
        "🆘 Crypto/TON: what to do",
        "",
        "1. If a seed phrase or private key was entered, create a new wallet from a clean device and move assets.",
        "2. Do not pay “withdrawal”, “unfreeze”, or “verification” fees.",
        "3. Save the link, wallet address, transaction hash, and chat.",
        "",
        "If a card/bank transfer was involved, call your bank. If there are threats, contact:",
        contactList(banks, lang),
        contactList(protectionContacts, lang),
      ],
    };
    return lines[lang].join("\n");
  }

  const lines: Record<Lang, string[]> = {
    ru: [
      "📞 Безопасный обратный звонок",
      "",
      "1. Не звоните на входящий номер и на номер из SMS.",
      "2. Откройте приложение банка, карту или номер на официальном сайте.",
      "3. Наберите номер сами. Если волнуетесь, попросите близкого быть рядом.",
      "",
      "Что сказать оператору:",
      "«Мне звонили и просили код, деньги или приложение. Проверьте мой счёт и заблокируйте рискованные операции».",
      "",
      "Проверенные номера:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
    uz: [
      "📞 Xavfsiz qayta qo'ng'iroq",
      "",
      "1. Kiruvchi raqamga yoki SMSdagi raqamga qo'ng'iroq qilmang.",
      "2. Bank ilovasi, karta yoki rasmiy saytni oching.",
      "3. Raqamni o'zingiz tering. Hayajonlansangiz, yaqiningiz yoningizda bo'lsin.",
      "",
      "Operatorga shunday deng:",
      "«Menga qo'ng'iroq qilib kod, pul yoki ilova so'rashdi. Hisobimni tekshirib, xavfli operatsiyalarni bloklang».",
      "",
      "Tekshirilgan raqamlar:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
    en: [
      "📞 Safe callback",
      "",
      "1. Do not call the incoming number or a number from SMS.",
      "2. Open the bank app, your card, or the official website.",
      "3. Dial the number yourself. If you are stressed, ask someone trusted to stay with you.",
      "",
      "What to say to the operator:",
      "“Someone called and asked for a code, money, or an app. Please check my account and block risky operations.”",
      "",
      "Verified numbers:",
      contactList(banks, lang),
      contactList(payments, lang),
    ],
  };
  return lines[lang].join("\n");
}

function guidedTrustedPersonText(panicId: PanicScenarioId, lang: Lang): string {
  const title = followUpTitle(panicId, lang);
  const profile = followUpProfile(panicId);
  const lines: Record<Lang, string[]> =
    profile === "blackmail" || profile === "minor"
      ? {
          ru: [
            "👪 Позовите человека, которому доверяете",
            "",
            "Это не слабость. При угрозах и шантаже мошенники специально изолируют человека, чтобы он боялся просить помощи.",
            "",
            "Сделайте так:",
            "1. Позовите взрослого или близкого прямо сейчас.",
            "2. Попросите быть рядом, пока вы сохраняете скриншоты и блокируете контакт.",
            "3. Не платите и не отправляйте новые фото, видео, документы или коды.",
            "",
            `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Мне угрожают/давят. Побудь со мной, помоги сохранить доказательства и обратиться за помощью».`,
          ],
          uz: [
            "👪 Ishonchli yaqiningizni chaqiring",
            "",
            "Bu zaiflik emas. Tahdid va shantajda firibgarlar odam yordam so'rashdan qo'rqishi uchun uni ataylab yolg'iz qoldiradi.",
            "",
            "Shunday qiling:",
            "1. Hozir ishonchli katta odamni yoki yaqiningizni chaqiring.",
            "2. Skrinshotlarni saqlash va kontaktni bloklash paytida yoningizda bo'lishini so'rang.",
            "3. To'lamang, yangi foto, video, hujjat yoki kod yubormang.",
            "",
            `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Menga tahdid qilishyapti/bosim o'tkazishyapti. Yonimda bo'lib, dalillarni saqlashga va yordam so'rashga yordam bering».`,
          ],
          en: [
            "👪 Call someone you trust",
            "",
            "This is not weakness. In blackmail and threats, scammers deliberately isolate people so they are afraid to ask for help.",
            "",
            "Do this:",
            "1. Call a trusted adult or trusted person right now.",
            "2. Ask them to stay with you while you save screenshots and block the contact.",
            "3. Do not pay or send more photos, videos, documents, or codes.",
            "",
            `Ready text: “I need help. Situation: ${title}. I am being threatened or pressured. Please stay with me, help me save evidence, and get help.”`,
          ],
        }
      : profile === "romance"
        ? {
            ru: [
              "👪 Позовите человека, которому доверяете",
              "",
              "Это не слабость. В романтических схемах часто торопят, давят жалостью и просят держать всё в секрете.",
              "",
              "Сделайте так:",
              "1. Попросите близкого посмотреть переписку со стороны.",
              "2. Поставьте паузу на переводы, кредиты, подарочные карты и крипто.",
              "3. Не отправляйте документы, фото карты, коды или интимные материалы.",
              "",
              `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Меня просят деньги/помощь, и я волнуюсь. Посмотри переписку со стороны, пожалуйста».`,
            ],
            uz: [
              "👪 Ishonchli yaqiningizni chaqiring",
              "",
              "Bu zaiflik emas. Romantik sxemalarda ko'pincha shoshirishadi, rahm-shafqatga bosishadi va hammasini sir saqlashni so'rashadi.",
              "",
              "Shunday qiling:",
              "1. Yaqiningizdan yozishmani tashqaridan ko'rib berishni so'rang.",
              "2. Pul o'tkazish, kredit, sovg'a kartalari va kriptoga pauza qiling.",
              "3. Hujjat, karta rasmi, kod yoki shaxsiy material yubormang.",
              "",
              `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Mendan pul/yordam so'rashyapti, xavotirdaman. Iltimos, yozishmani tashqaridan ko'rib bering».`,
            ],
            en: [
              "👪 Call someone you trust",
              "",
              "This is not weakness. Romance scams often rush people, use pity, and ask them to keep everything secret.",
              "",
              "Do this:",
              "1. Ask someone trusted to review the chat from the outside.",
              "2. Pause transfers, loans, gift cards, and crypto.",
              "3. Do not send documents, card photos, codes, or intimate material.",
              "",
              `Ready text: “I need help. Situation: ${title}. Someone is asking me for money/help and I am worried. Please review the chat from the outside.”`,
            ],
          }
        : profile === "telegram_recovery"
          ? {
              ru: [
                "👪 Позовите человека, которому доверяете",
                "",
                "Это не слабость. Когда аккаунт захватили, важно быстро предупредить людей и не спорить с тем, кто пишет от вашего имени.",
                "",
                "Сделайте так:",
                "1. Попросите близкого помочь предупредить ваши контакты.",
                "2. Восстанавливайте доступ только через Telegram на своём устройстве.",
                "3. Не пересылайте Telegram-код, пароль, SMS-коды или фото документов.",
                "",
                `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Помоги предупредить людей, что от моего имени могут просить деньги или коды».`,
              ],
              uz: [
                "👪 Ishonchli yaqiningizni chaqiring",
                "",
                "Bu zaiflik emas. Akkaunt egallanganda odamlarni tez ogohlantirish va sizning nomingizdan yozayotgan odam bilan tortishmaslik muhim.",
                "",
                "Shunday qiling:",
                "1. Yaqiningizdan kontaktlaringizni ogohlantirishga yordam berishini so'rang.",
                "2. Kirishni faqat o'z qurilmangizdagi Telegram orqali tiklang.",
                "3. Telegram-kod, parol, SMS-kod yoki hujjat rasmini yubormang.",
                "",
                `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Mening nomimdan pul yoki kod so'rashlari mumkinligini odamlarga aytishga yordam bering».`,
              ],
              en: [
                "👪 Call someone you trust",
                "",
                "This is not weakness. When an account is taken over, it is important to warn people quickly and not argue with whoever is using it.",
                "",
                "Do this:",
                "1. Ask someone trusted to help warn your contacts.",
                "2. Recover access only through Telegram on your own device.",
                "3. Do not send Telegram codes, passwords, SMS codes, or document photos.",
                "",
                `Ready text: “I need help. Situation: ${title}. Please help me warn people that my account may ask for money or codes.”`,
              ],
            }
          : profile === "malware"
            ? {
                ru: [
                  "👪 Позовите человека, которому доверяете",
                  "",
                  "Это не слабость. После установки подозрительного APK лучше действовать с другого устройства и не торопиться.",
                  "",
                  "Сделайте так:",
                  "1. Позвоните близкому с другого телефона.",
                  "2. Попросите быть рядом, пока вы держите авиарежим, удаляете приложение и звоните в банк.",
                  "3. Не пересылайте SMS-код, PIN, CVV, пароль или фото карты.",
                  "",
                  `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Я установил подозрительное приложение. Побудь со мной, пока я изолирую телефон и проверяю банк».`,
                ],
                uz: [
                  "👪 Ishonchli yaqiningizni chaqiring",
                  "",
                  "Bu zaiflik emas. Shubhali APK o'rnatilgandan keyin boshqa qurilmadan, shoshilmasdan harakat qilish yaxshiroq.",
                  "",
                  "Shunday qiling:",
                  "1. Yaqiningizga boshqa telefondan qo'ng'iroq qiling.",
                  "2. Aviaparvozni yoqib turish, ilovani o'chirish va bankka qo'ng'iroq qilishda yoningizda bo'lishini so'rang.",
                  "3. SMS-kod, PIN, CVV, parol yoki karta rasmini yubormang.",
                  "",
                  `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Shubhali ilova o'rnatdim. Telefonni ajratib, bankni tekshirgunimcha yonimda bo'ling».`,
                ],
                en: [
                  "👪 Call someone you trust",
                  "",
                  "This is not weakness. After installing a suspicious APK, it is better to act from another device and slow down.",
                  "",
                  "Do this:",
                  "1. Call someone trusted from another phone.",
                  "2. Ask them to stay with you while you keep airplane mode on, remove the app, and call the bank.",
                  "3. Do not send SMS codes, PINs, CVVs, passwords, or card photos.",
                  "",
                  `Ready text: “I need help. Situation: ${title}. I installed a suspicious app. Please stay with me while I isolate the phone and check the bank.”`,
                ],
              }
            : profile === "voice_clone"
              ? {
                  ru: [
                    "👪 Позовите человека, которому доверяете",
                    "",
                    "Это не слабость. При подделке голоса специально давят на страх за близкого.",
                    "",
                    "Сделайте так:",
                    "1. Позвоните другому родственнику или другу семьи.",
                    "2. Попросите вместе перезвонить человеку по сохранённому номеру.",
                    "3. Не пересылайте SMS-код, PIN, CVV, пароль или фото карты.",
                    "",
                    `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Голос похож на близкого, но просят деньги срочно. Побудь со мной и помоги проверить его по сохранённому номеру».`,
                  ],
                  uz: [
                    "👪 Ishonchli yaqiningizni chaqiring",
                    "",
                    "Bu zaiflik emas. Ovoz soxtalashtirilganda yaqin odam uchun qo'rquvga bosim qilishadi.",
                    "",
                    "Shunday qiling:",
                    "1. Boshqa qarindosh yoki oilaviy do'stga qo'ng'iroq qiling.",
                    "2. Odamga saqlangan raqam orqali birga qayta qo'ng'iroq qilishni so'rang.",
                    "3. SMS-kod, PIN, CVV, parol yoki karta rasmini yubormang.",
                    "",
                    `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Ovoz yaqin odamnikiga o'xshaydi, lekin zudlik bilan pul so'rashyapti. Yonimda bo'lib, uni saqlangan raqam orqali tekshirishga yordam bering».`,
                  ],
                  en: [
                    "👪 Call someone you trust",
                    "",
                    "This is not weakness. Voice-clone scams deliberately pressure people with fear for someone close.",
                    "",
                    "Do this:",
                    "1. Call another relative or family friend.",
                    "2. Ask them to help call the person back using a saved number.",
                    "3. Do not send SMS codes, PINs, CVVs, passwords, or card photos.",
                    "",
                    `Ready text: “I need help. Situation: ${title}. The voice sounds like someone close, but they are asking for money urgently. Please stay with me and help me verify them using a saved number.”`,
                  ],
                }
              : profile === "fake_job" ||
                  profile === "delivery" ||
                  profile === "crypto" ||
                  profile === "government_grant"
                ? {
                    ru: [
                      "👪 Позовите человека, которому доверяете",
                      "",
                      "Это не слабость. В схемах с работой, доставкой, крипто и выплатами специально торопят, чтобы человек не проверил источник.",
                      "",
                      "Сделайте так:",
                      "1. Попросите близкого посмотреть ссылку/переписку со стороны.",
                      "2. Поставьте паузу на оплату, коды, документы, wallet connect и установку приложений.",
                      "3. Если уже ввели карту/код или перевели деньги — вместе позвоните в банк по официальному номеру.",
                      "",
                      `Готовый текст: «Мне нужна помощь. Ситуация: ${title}. Меня торопят перейти по ссылке/оплатить/ввести данные. Побудь со мной и помоги проверить источник».`,
                    ],
                    uz: [
                      "👪 Ishonchli yaqiningizni chaqiring",
                      "",
                      "Bu zaiflik emas. Ish, yetkazish, kripto va to'lov sxemalarida manbani tekshirmaslik uchun odamni ataylab shoshirishadi.",
                      "",
                      "Shunday qiling:",
                      "1. Yaqiningizdan havola/yozishmani tashqaridan ko'rib berishni so'rang.",
                      "2. To'lov, kodlar, hujjatlar, wallet connect va ilova o'rnatishga pauza qiling.",
                      "3. Karta/kod kiritgan yoki pul yuborgan bo'lsangiz — bankka rasmiy raqam orqali birga qo'ng'iroq qiling.",
                      "",
                      `Tayyor matn: «Menga yordam kerak. Vaziyat: ${title}. Meni havolaga o'tish/to'lash/ma'lumot kiritishga shoshirishyapti. Yonimda bo'lib, manbani tekshirishga yordam bering».`,
                    ],
                    en: [
                      "👪 Call someone you trust",
                      "",
                      "This is not weakness. Job, delivery, crypto, and benefit scams deliberately rush people before they verify the source.",
                      "",
                      "Do this:",
                      "1. Ask someone trusted to review the link/chat from the outside.",
                      "2. Pause payments, codes, documents, wallet connect, and app installs.",
                      "3. If you entered card/code data or sent money, call the bank together using an official number.",
                      "",
                      `Ready text: “I need help. Situation: ${title}. I am being rushed to open a link/pay/enter data. Please stay with me and help verify the source.”`,
                    ],
                  }
                : {
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

function financialGuidedScriptLines(
  panicId: PanicScenarioId,
  title: string,
  lang: Lang,
): string[] | null {
  if (panicId === 1) {
    const lines: Record<Lang, string[]> = {
      ru: [
        "💬 Готовая фраза",
        "",
        "Код уже отправлен. Сейчас цель — закрыть доступ к деньгам.",
        "",
        "Если человек ещё на линии — не спорьте. Скажите и кладите трубку:",
        "",
        "«Стоп. Я больше ничего не подтверждаю.»",
        "",
        "Близкому человеку скажите:",
        `«Ситуация: ${title}. Мне срочно нужна помощь — позвонить в банк и заблокировать карту и онлайн-банк».`,
      ],
      uz: [
        "💬 Tayyor jumla",
        "",
        "Kod allaqachon yuborilgan. Hozir maqsad — pulga kirishni yopish.",
        "",
        "Agar odam hali liniyada bo'lsa — tortishmang. Ayting va qo'ng'iroqni tugating:",
        "",
        "«To'xtang. Endi hech narsani tasdiqlamayman.»",
        "",
        "Yaqiningizga shunday deng:",
        `«Vaziyat: ${title}. Zudlik bilan yordam kerak — bankka qo'ng'iroq qilib karta va onlayn-bankni bloklash».`,
      ],
      en: [
        "💬 Ready phrase",
        "",
        "The code has already been sent. The goal now is to close access to your money.",
        "",
        "If the person is still on the line, do not argue. Say this and hang up:",
        "",
        "“Stop. I will not confirm anything else.”",
        "",
        "Tell someone trusted:",
        `“Situation: ${title}. I urgently need help calling the bank and blocking my card and online banking.”`,
      ],
    };
    return lines[lang];
  }

  if (panicId === 3) {
    const lines: Record<Lang, string[]> = {
      ru: [
        "💬 Готовая фраза",
        "",
        "Перевод уже сделан. Сейчас нужна попытка остановить или оспорить операцию.",
        "",
        "Банку по телефону скажите:",
        "",
        "«Я только что перевёл деньги под давлением. Пожалуйста, заморозьте или оспорьте операцию немедленно.»",
        "",
        "Близкому человеку скажите:",
        `«Ситуация: ${title}. Помоги мне срочно позвонить в банк и сохранить чек».`,
      ],
      uz: [
        "💬 Tayyor jumla",
        "",
        "Pul allaqachon o'tkazilgan. Hozir operatsiyani to'xtatish yoki e'tiroz bildirishga urinish kerak.",
        "",
        "Bankka telefonda shunday deng:",
        "",
        "«Men hozirgina bosim ostida pul o'tkazdim. Iltimos, operatsiyani darhol muzlating yoki e'tiroz bildiring.»",
        "",
        "Yaqiningizga shunday deng:",
        `«Vaziyat: ${title}. Bankka zudlik bilan qo'ng'iroq qilishga va chekni saqlashga yordam bering».`,
      ],
      en: [
        "💬 Ready phrase",
        "",
        "The transfer has already been made. Now you need to try to stop or dispute it.",
        "",
        "Tell the bank by phone:",
        "",
        "“I have just sent money under pressure. Please freeze or dispute the transaction immediately.”",
        "",
        "Tell someone trusted:",
        `“Situation: ${title}. Help me urgently call the bank and save the receipt.”`,
      ],
    };
    return lines[lang];
  }

  if (panicId === 4) {
    const lines: Record<Lang, string[]> = {
      ru: [
        "💬 Готовая фраза",
        "",
        "Данные карты уже могли попасть к посторонним. Сейчас главное — заблокировать карту.",
        "",
        "Банку скажите:",
        "",
        "«Я ввёл данные карты на подозрительном сайте/по просьбе. Заблокируйте карту, пожалуйста, возможны списания.»",
        "",
        "Близкому человеку скажите:",
        `«Ситуация: ${title}. Помоги мне заблокировать карту через приложение или официальный номер банка».`,
      ],
      uz: [
        "💬 Tayyor jumla",
        "",
        "Karta ma'lumotlari begonalarga o'tgan bo'lishi mumkin. Hozir eng muhimi — kartani bloklash.",
        "",
        "Bankka shunday deng:",
        "",
        "«Men karta ma'lumotlarini shubhali saytda/so'rov bo'yicha kiritdim. Kartani bloklang, iltimos, yechib olishlar bo'lishi mumkin.»",
        "",
        "Yaqiningizga shunday deng:",
        `«Vaziyat: ${title}. Kartani bank ilovasi yoki rasmiy raqam orqali bloklashga yordam bering».`,
      ],
      en: [
        "💬 Ready phrase",
        "",
        "Your card details may already be exposed. The main step now is to block the card.",
        "",
        "Tell the bank:",
        "",
        "“I entered my card details on a suspicious site/by request. Please block the card; charges may be attempted.”",
        "",
        "Tell someone trusted:",
        `“Situation: ${title}. Help me block the card through the bank app or official number.”`,
      ],
    };
    return lines[lang];
  }

  return null;
}

function guidedScriptText(panicId: PanicScenarioId, lang: Lang): string {
  const title = followUpTitle(panicId, lang);
  const profile = followUpProfile(panicId);
  const financialLines =
    profile === "financial" ? financialGuidedScriptLines(panicId, title, lang) : null;
  if (financialLines) return financialLines.join("\n");

  const lines: Record<Lang, string[]> =
    profile === "blackmail" || profile === "minor"
      ? {
          ru: [
            "💬 Готовая фраза",
            "",
            "Если вам угрожают или требуют деньги/фото — не спорьте и не оправдывайтесь. Отправьте одну фразу:",
            "",
            "«Я прекращаю переписку. Я ничего не плачу и не отправляю. Дальше я сохраняю доказательства и обращаюсь за помощью.»",
            "",
            "Близкому человеку скажите:",
            `«Ситуация: ${title}. Мне страшно, побудь со мной и помоги сохранить скриншоты».`,
          ],
          uz: [
            "💬 Tayyor jumla",
            "",
            "Agar sizga tahdid qilishsa yoki pul/foto talab qilishsa — tortishmang va o'zingizni oqlamang. Bitta jumlani yuboring:",
            "",
            "«Yozishmani to'xtataman. Hech narsa to'lamayman va yubormayman. Endi dalillarni saqlab, yordam so'rayman.»",
            "",
            "Yaqiningizga shunday deng:",
            `«Vaziyat: ${title}. Qo'rqyapman, yonimda bo'ling va skrinshotlarni saqlashga yordam bering».`,
          ],
          en: [
            "💬 Ready phrase",
            "",
            "If someone threatens you or demands money/photos, do not argue or justify yourself. Send one sentence:",
            "",
            "“I am ending this chat. I will not pay or send anything. I am saving evidence and getting help.”",
            "",
            "Tell someone trusted:",
            `“Situation: ${title}. I am scared. Please stay with me and help me save screenshots.”`,
          ],
        }
      : profile === "romance"
        ? {
            ru: [
              "💬 Готовая фраза",
              "",
              "Если человек просит деньги, кредит, подарок или крипто — не спорьте. Поставьте паузу:",
              "",
              "«Я не перевожу деньги и не беру кредиты в переписке. Сначала я спокойно проверю ситуацию с близким человеком.»",
              "",
              "Близкому человеку скажите:",
              `«Ситуация: ${title}. Посмотри переписку со стороны: меня просят деньги или помощь».`,
            ],
            uz: [
              "💬 Tayyor jumla",
              "",
              "Agar odam pul, kredit, sovg'a yoki kripto so'rasa — tortishmang. Pauza qiling:",
              "",
              "«Yozishmada pul o'tkazmayman va kredit olmayman. Avval vaziyatni yaqin odam bilan xotirjam tekshiraman.»",
              "",
              "Yaqiningizga shunday deng:",
              `«Vaziyat: ${title}. Yozishmani tashqaridan ko'rib bering: mendan pul yoki yordam so'rashyapti».`,
            ],
            en: [
              "💬 Ready phrase",
              "",
              "If the person asks for money, a loan, a gift, or crypto, do not argue. Pause:",
              "",
              "“I do not send money or take loans in a chat. First I will calmly check this with someone I trust.”",
              "",
              "Tell someone trusted:",
              `“Situation: ${title}. Please review the chat from the outside: someone is asking me for money or help.”`,
            ],
          }
        : profile === "telegram_recovery"
          ? {
              ru: [
                "💬 Готовая фраза",
                "",
                "Если вам пишут от вашего имени или просят код — не спорьте. Отправьте близким коротко:",
                "",
                "«Мой Telegram могли взломать. Не переводите деньги и не отправляйте коды сообщениям от моего имени. Я восстанавливаю доступ.»",
                "",
                "Себе правило: Telegram-код и пароль никому не пересылаю.",
              ],
              uz: [
                "💬 Tayyor jumla",
                "",
                "Agar sizning nomingizdan yozishsa yoki kod so'rashsa — tortishmang. Yaqinlarga qisqa yuboring:",
                "",
                "«Telegramim buzilgan bo'lishi mumkin. Mening nomimdan kelgan xabarlarga pul yoki kod yubormang. Kirishni tiklayapman.»",
                "",
                "Qoidam: Telegram-kod va parolni hech kimga yubormayman.",
              ],
              en: [
                "💬 Ready phrase",
                "",
                "If someone writes from your account or asks for a code, do not argue. Send this to close contacts:",
                "",
                "“My Telegram may be compromised. Do not send money or codes to messages from my account. I am recovering access.”",
                "",
                "Rule for yourself: never forward Telegram codes or passwords.",
              ],
            }
          : profile === "malware"
            ? {
                ru: [
                  "💬 Готовая фраза",
                  "",
                  "Если вас просят открыть приложение, дать доступ или продиктовать код — скажите:",
                  "",
                  "«Я ничего не подтверждаю в приложении и не называю коды. Сначала изолирую телефон и проверю всё через официальный канал.»",
                  "",
                  "Близкому человеку скажите:",
                  `«Ситуация: ${title}. Побудь со мной, пока я держу авиарежим и проверяю банк с другого устройства».`,
                ],
                uz: [
                  "💬 Tayyor jumla",
                  "",
                  "Agar ilovani ochish, ruxsat berish yoki kod aytishni so'rashsa, ayting:",
                  "",
                  "«Ilovada hech narsani tasdiqlamayman va kod aytmayman. Avval telefonni ajratib, hammasini rasmiy kanal orqali tekshiraman.»",
                  "",
                  "Yaqiningizga shunday deng:",
                  `«Vaziyat: ${title}. Aviaparvozni yoqib, bankni boshqa qurilmadan tekshirgunimcha yonimda bo'ling».`,
                ],
                en: [
                  "💬 Ready phrase",
                  "",
                  "If someone asks you to open an app, grant access, or read out a code, say:",
                  "",
                  "“I will not confirm anything in the app or share codes. First I will isolate the phone and check through an official channel.”",
                  "",
                  "Tell someone trusted:",
                  `“Situation: ${title}. Please stay with me while I keep airplane mode on and check the bank from another device.”`,
                ],
              }
            : profile === "voice_clone"
              ? {
                  ru: [
                    "💬 Готовая фраза",
                    "",
                    "Если на линии якобы близкий человек — не спорьте и не обвиняйте. Скажите:",
                    "",
                    "«Я переживаю за тебя. Я сейчас перезвоню тебе по сохранённому номеру и мы спокойно проверим это.»",
                    "",
                    "Если давят, требуют срочно или запрещают перезванивать — это опасный признак.",
                    "",
                    "Близкому человеку рядом скажите:",
                    `«Ситуация: ${title}. Помоги мне не торопиться и проверить голос через сохранённый номер».`,
                  ],
                  uz: [
                    "💬 Tayyor jumla",
                    "",
                    "Agar liniyada go'yo yaqin odam bo'lsa — tortishmang va ayblamang. Ayting:",
                    "",
                    "«Men siz uchun xavotirdaman. Hozir saqlangan raqamingizga qayta qo'ng'iroq qilaman va buni xotirjam tekshiramiz.»",
                    "",
                    "Shoshirishsa, zudlik bilan talab qilishsa yoki qayta qo'ng'iroq qilishni taqiqlashsa — bu xavfli belgi.",
                    "",
                    "Yonizdagi yaqiningizga shunday deng:",
                    `«Vaziyat: ${title}. Shoshilmasdan ovozni saqlangan raqam orqali tekshirishga yordam bering».`,
                  ],
                  en: [
                    "💬 Ready phrase",
                    "",
                    "If the person on the line sounds like someone close, do not argue or accuse. Say:",
                    "",
                    "“I am worried about you. I will call you back on your saved number now and we will check this calmly.”",
                    "",
                    "If they pressure you, demand urgency, or forbid a callback, treat that as a danger sign.",
                    "",
                    "Tell someone trusted nearby:",
                    `“Situation: ${title}. Help me slow down and verify the voice using a saved number.”`,
                  ],
                }
              : profile === "fake_job" ||
                  profile === "delivery" ||
                  profile === "crypto" ||
                  profile === "government_grant"
                ? {
                    ru: [
                      "💬 Готовая фраза",
                      "",
                      "Если вас торопят оплатить, перейти по ссылке, подключить wallet или ввести данные — не спорьте. Поставьте паузу:",
                      "",
                      "«Я ничего не оплачиваю и не ввожу коды по ссылке из чата. Сначала спокойно проверю источник через официальный сайт или с близким человеком.»",
                      "",
                      "Близкому человеку скажите:",
                      `«Ситуация: ${title}. Помоги мне проверить ссылку/условия со стороны, прежде чем я что-то оплачу или введу данные».`,
                    ],
                    uz: [
                      "💬 Tayyor jumla",
                      "",
                      "Agar to'lash, havolaga o'tish, wallet ulash yoki ma'lumot kiritishga shoshirishsa — tortishmang. Pauza qiling:",
                      "",
                      "«Chatdagi havola orqali hech narsa to'lamayman va kod kiritmayman. Avval manbani rasmiy sayt yoki yaqin odam bilan xotirjam tekshiraman.»",
                      "",
                      "Yaqiningizga shunday deng:",
                      `«Vaziyat: ${title}. Biror narsa to'lash yoki ma'lumot kiritishdan oldin havola/shartlarni tashqaridan tekshirishga yordam bering».`,
                    ],
                    en: [
                      "💬 Ready phrase",
                      "",
                      "If someone rushes you to pay, open a link, connect a wallet, or enter data, do not argue. Pause:",
                      "",
                      "“I will not pay or enter codes through a chat link. First I will calmly verify the source through the official site or with someone I trust.”",
                      "",
                      "Tell someone trusted:",
                      `“Situation: ${title}. Help me review the link/terms from the outside before I pay or enter data.”`,
                    ],
                  }
                : {
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
        "✅ Хорошо, звонок завершён",
        "",
        "Следующий безопасный шаг: перезвоните в банк только по номеру из приложения, карты или официального сайта.",
        "",
        "Если код или карту не называли — просто спросите, был ли реальный запрос.",
        "Если уже назвали — нажмите «Все срочные шаги» или выберите в /panic сценарий про SMS-код/карту.",
      ],
      uz: [
        "✅ Yaxshi, qo'ng'iroq tugadi",
        "",
        "Keyingi xavfsiz qadam: bankka faqat ilova, karta yoki rasmiy saytdagi raqam orqali qo'ng'iroq qiling.",
        "",
        "Kod yoki karta aytmagan bo'lsangiz — haqiqiy so'rov bo'lganmi, shuni so'rang.",
        "Aytgan bo'lsangiz — «Barcha shoshilinch qadamlar»ni bosing yoki /panic ichida SMS-kod/karta ssenariysini tanlang.",
      ],
      en: [
        "✅ Good, the call is over",
        "",
        "Next safe step: call the bank only from the app, your card, or the official website.",
        "",
        "If you did not share a code or card data, ask whether there was a real request.",
        "If you already shared it, tap “All urgent steps” or choose the SMS-code/card scenario in /panic.",
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
      return guidedCallbackDirectory(panicId, lang);
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
