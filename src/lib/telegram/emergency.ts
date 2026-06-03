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
import { VERIFIED_CONTACTS, type VerifiedContact } from "@/lib/risk/verified-contacts";

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
  ru: "⚠️ Ishonch Guard помогает сориентироваться, но не заменяет банк или правоохранительные органы. Для официальных действий обращайтесь напрямую.",
  uz: "⚠️ Ishonch Guard yo'l-yo'riq beradi, lekin bank yoki huquq-tartibot organlarini almashtirmaydi. Rasmiy harakatlar uchun to'g'ridan-to'g'ri murojaat qiling.",
  en: "⚠️ Ishonch Guard helps you orient, but does not replace banks or law enforcement. For official action, contact them directly.",
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
    {
      title: {
        ru: "1️⃣ Я отправил SMS-код / OTP",
        uz: "1️⃣ Men SMS-kod / OTP yubordim",
        en: "1️⃣ I sent an SMS code / OTP",
      },
      steps: {
        ru: [
          "Немедленно позвоните в банк и заблокируйте карту/онлайн-банк:",
          bankList("ru"),
          paymentList("ru"),
          "Смените пароль от онлайн-банка и Telegram.",
          "Не переходите по ссылкам из сообщений, которые придут после.",
          `Подайте заявление: ${policeLine("ru")}`,
          "Сохраните скриншоты как доказательства.",
        ],
        uz: [
          "Darhol bankka qo'ng'iroq qilib, karta/onlayn-bankni bloklang:",
          bankList("uz"),
          paymentList("uz"),
          "Onlayn-bank va Telegram parolini o'zgartiring.",
          "Keyin kelgan xabarlardagi havolalarga o'tmang.",
          `Ariza bering: ${policeLine("uz")}`,
          "Skrinshotlarni dalil sifatida saqlang.",
        ],
        en: [
          "Immediately call your bank and block the card/online banking:",
          bankList("en"),
          paymentList("en"),
          "Change your online banking and Telegram passwords.",
          "Do not click links in follow-up messages.",
          `File a report: ${policeLine("en")}`,
          "Save screenshots as evidence.",
        ],
      },
    },
    {
      title: {
        ru: "2️⃣ Я установил APK / приложение",
        uz: "2️⃣ Men APK / ilova o'rnatdim",
        en: "2️⃣ I installed an APK / app",
      },
      steps: {
        ru: [
          "Включите авиарежим СЕЙЧАС (отключит удалённый доступ).",
          "Удалите подозрительное приложение.",
          "Заблокируйте карты через банк:",
          bankList("ru"),
          "Смените все пароли (банк, Telegram, email) с другого устройства.",
          `Подайте заявление: ${policeLine("ru")}`,
          cyberLine("ru") ? `Сообщите в UZCERT: ${cyberLine("ru")}` : "",
        ].filter(Boolean),
        uz: [
          "Hoziroq aviarezhimni yoqing (masofadan boshqaruvni uzadi).",
          "Shubhali ilovani o'chirib tashlang.",
          "Bank orqali kartalarni bloklang:",
          bankList("uz"),
          "Barcha parollarni (bank, Telegram, email) boshqa qurilmadan o'zgartiring.",
          `Ariza bering: ${policeLine("uz")}`,
          cyberLine("uz") ? `UZCERT'ga xabar bering: ${cyberLine("uz")}` : "",
        ].filter(Boolean),
        en: [
          "Turn on airplane mode NOW (cuts remote access).",
          "Delete the suspicious app.",
          "Block your cards through the bank:",
          bankList("en"),
          "Change all passwords (bank, Telegram, email) from another device.",
          `File a report: ${policeLine("en")}`,
          cyberLine("en") ? `Report to UZCERT: ${cyberLine("en")}` : "",
        ].filter(Boolean),
      },
    },
    {
      title: {
        ru: "3️⃣ Я перевёл деньги",
        uz: "3️⃣ Men pul o'tkazdim",
        en: "3️⃣ I transferred money",
      },
      steps: {
        ru: [
          "Позвоните в банк НЕМЕДЛЕННО — попросите отменить/заморозить перевод:",
          bankList("ru"),
          paymentList("ru"),
          "Чем быстрее — тем больше шансов вернуть деньги.",
          `Подайте заявление в полицию: ${policeLine("ru")}`,
          "Сохраните чек перевода, переписку, номер получателя.",
          "Не переводите «повторно для отмены» — это вторая схема обмана.",
        ],
        uz: [
          "DARHOL bankka qo'ng'iroq qiling — o'tkazmani bekor/muzlashni so'rang:",
          bankList("uz"),
          paymentList("uz"),
          "Qanchalik tez — pulni qaytarish imkoniyati shuncha ko'p.",
          `Politsiyaga ariza bering: ${policeLine("uz")}`,
          "O'tkazma chekini, yozishmani, qabul qiluvchi raqamini saqlang.",
          "«Bekor qilish uchun qayta o'tkazing» demang — bu ikkinchi firibgarlik sxemasi.",
        ],
        en: [
          "Call your bank IMMEDIATELY — ask to cancel/freeze the transfer:",
          bankList("en"),
          paymentList("en"),
          "The faster you act, the better the chance of getting money back.",
          `File a police report: ${policeLine("en")}`,
          "Save the transfer receipt, chat history, recipient's number.",
          "Do NOT transfer again 'to cancel' — that's a second scam scheme.",
        ],
      },
    },
    {
      title: {
        ru: "4️⃣ Я ввёл данные карты",
        uz: "4️⃣ Men karta ma'lumotlarini kiritdim",
        en: "4️⃣ I entered card details",
      },
      steps: {
        ru: [
          "Заблокируйте карту через банк немедленно:",
          bankList("ru"),
          paymentList("ru"),
          "Смените PIN и пароль онлайн-банка.",
          "Проверьте последние операции — оспорьте неизвестные.",
          `Подайте заявление: ${policeLine("ru")}`,
        ],
        uz: [
          "Kartani darhol bank orqali bloklang:",
          bankList("uz"),
          paymentList("uz"),
          "PIN va onlayn-bank parolini o'zgartiring.",
          "Oxirgi operatsiyalarni tekshiring — noma'lumlarini bahslang.",
          `Ariza bering: ${policeLine("uz")}`,
        ],
        en: [
          "Block your card through the bank immediately:",
          bankList("en"),
          paymentList("en"),
          "Change your PIN and online banking password.",
          "Check recent transactions — dispute unknown ones.",
          `File a report: ${policeLine("en")}`,
        ],
      },
    },
    {
      title: {
        ru: "5️⃣ Я потерял доступ к Telegram",
        uz: "5️⃣ Men Telegram'ga kirishni yo'qotdim",
        en: "5️⃣ I lost access to Telegram",
      },
      steps: {
        ru: [
          "Попробуйте восстановить через SMS-код на ваш номер.",
          "Если не удаётся — свяжитесь с оператором для блокировки SIM:",
          telecomList("ru"),
          "Свяжитесь с поддержкой Telegram: @recover или Settings → Ask a Question.",
          "Предупредите контакты (другим способом), что ваш аккаунт мог быть взломан.",
          `Подайте заявление: ${policeLine("ru")}`,
        ],
        uz: [
          "Raqamingizga kelgan SMS-kod orqali tiklashga harakat qiling.",
          "Iloji bo'lmasa — SIM-kartani bloklash uchun operatorga murojaat qiling:",
          telecomList("uz"),
          "Telegram qo'llab-quvvatlashga yozing: @recover yoki Settings → Ask a Question.",
          "Kontaktlaringizni (boshqa yo'l bilan) ogohlantiring — akkauntingiz buzilgan bo'lishi mumkin.",
          `Ariza bering: ${policeLine("uz")}`,
        ],
        en: [
          "Try to recover via SMS code sent to your number.",
          "If you can't — contact your operator to block the SIM:",
          telecomList("en"),
          "Contact Telegram support: @recover or Settings → Ask a Question.",
          "Warn your contacts (via other means) that your account may have been compromised.",
          `File a report: ${policeLine("en")}`,
        ],
      },
    },
    {
      title: {
        ru: "6️⃣ Мне звонят прямо сейчас",
        uz: "6️⃣ Menga hozir qo'ng'iroq qilyapti",
        en: "6️⃣ I'm on a suspicious call right now",
      },
      steps: {
        ru: [
          "ПОЛОЖИТЕ ТРУБКУ. Это самое важное действие.",
          "Если давят «не кладите трубку» — это 100% мошенничество.",
          "Не называйте SMS-код, PIN, CVV, пароль. Никогда.",
          "Не устанавливайте приложения по их указке.",
          "Не переводите деньги «на безопасный счёт».",
          "Сами перезвоните в организацию по официальному номеру:",
          bankList("ru"),
          telecomList("ru"),
        ],
        uz: [
          "GO'SHAKNI QO'YING. Bu eng muhim harakat.",
          "«Go'shakni qo'ymang» deb bosim qilishsa — bu 100% firibgarlik.",
          "SMS-kod, PIN, CVV, parolni aytmang. Hech qachon.",
          "Ularning ko'rsatmasi bilan ilova o'rnatmang.",
          "«Xavfsiz hisobga» pul o'tkazmang.",
          "Tashkilotga rasmiy raqami orqali o'zingiz qo'ng'iroq qiling:",
          bankList("uz"),
          telecomList("uz"),
        ],
        en: [
          "HANG UP. This is the most important action.",
          "If they pressure you to 'stay on the line' — it's 100% a scam.",
          "Never give your SMS code, PIN, CVV or password.",
          "Don't install apps they tell you to.",
          "Don't transfer money to a 'safe account'.",
          "Call the organization yourself on the official number:",
          bankList("en"),
          telecomList("en"),
        ],
      },
    },
    // ─── Sextortion / Romance scenarios (Sprint 3.2) ─────────────────────
    {
      title: {
        ru: "7️⃣ Меня шантажируют фото/видео",
        uz: "7️⃣ Meni foto/video bilan shantaj",
        en: "7️⃣ Photo/video blackmail",
      },
      steps: {
        ru: [
          "❤️ Вы НЕ виноваты.",
          "❌ НЕ платите — требования только растут.",
          "❌ НЕ отправляйте новые фото.",
          "✅ Заблокируйте шантажиста.",
          "✅ Сохраните скриншоты.",
          "✅ Полиция: 102.",
          "Большинство шантажистов не публикуют, если жертва перестаёт отвечать.",
        ],
        uz: [
          "❤️ Siz AYBDOR EMASSIZ.",
          "❌ PUL TO'LAMANG.",
          "❌ Yangi foto YUBORMANG.",
          "✅ Shantajchini BLOKLANG.",
          "✅ Skrinshotlarni saqlang.",
          "✅ Politsiya: 102.",
          "Ko'pchilik shantajchilar javob to'xtasa nashr qilmaydi.",
        ],
        en: [
          "❤️ You are NOT to blame.",
          "❌ Do NOT pay — demands grow.",
          "❌ Do NOT send new photos.",
          "✅ Block the blackmailer.",
          "✅ Save screenshots.",
          "✅ Police: 102.",
          "Most blackmailers don't publish if victim stops responding.",
        ],
      },
    },
    {
      title: {
        ru: "8️⃣ Просят деньги в отношениях",
        uz: "8️⃣ Munosabatda pul so'rash",
        en: "8️⃣ Money in relationships",
      },
      steps: {
        ru: [
          "⚠️ Признаки romance-скама:",
          "• Быстрое признание в любви",
          "• Просьба перейти в другой мессенджер",
          "• Избегает видеозвонков",
          "• Просит деньги или крипто-инвестиции",
          "",
          "✅ Прекратите переводы.",
          "✅ Проверьте фото через Google Images.",
          "✅ Не стыдитесь — это манипуляция.",
          "✅ Жалоба: 102 или /report.",
        ],
        uz: [
          "⚠️ Romance-scam belgilari:",
          "• Tez sevgi e'tirof",
          "• Boshqa messenjerga o'tish",
          "• Video qo'ng'iroqdan qochish",
          "• Pul yoki kripto so'rash",
          "",
          "✅ O'tkazmalarni to'xtating.",
          "✅ Fotoni Google orqali tekshiring.",
          "✅ Uyalmang — manipulyatsiya.",
          "✅ Shikoyat: 102 yoki /report.",
        ],
        en: [
          "⚠️ Romance scam signs:",
          "• Quick love confession",
          "• Switch to another messenger",
          "• Avoids video calls",
          "• Asks for money/crypto",
          "",
          "✅ Stop transfers.",
          "✅ Reverse-search their photo.",
          "✅ Don't be ashamed — it's manipulation.",
          "✅ Report: 102 or /report.",
        ],
      },
    },
    {
      title: {
        ru: "9️⃣ Угрожают публикацией",
        uz: "9️⃣ Nashr bilan tahdid",
        en: "9️⃣ Threats to publish",
      },
      steps: {
        ru: [
          "❌ НЕ платите.",
          "✅ Заблокируйте.",
          "✅ Сохраните доказательства.",
          "✅ Полиция: 102.",
          "✅ Если опубликовано — обратитесь к платформе.",
          "Вы жертва, не преступник.",
        ],
        uz: [
          "❌ TO'LAMANG.",
          "✅ BLOKLANG.",
          "✅ Dalillarni saqlang.",
          "✅ Politsiya: 102.",
          "✅ Chop etilgan bo'lsa — platformaga yozing.",
          "Siz jabrlanuvchisiz.",
        ],
        en: [
          "❌ Do NOT pay.",
          "✅ Block them.",
          "✅ Save evidence.",
          "✅ Police: 102.",
          "✅ If published — contact the platform.",
          "You are the victim.",
        ],
      },
    },
    {
      title: { ru: "🔟 Мне меньше 18 лет", uz: "🔟 Menga 18 yoshdan kam", en: "🔟 I'm under 18" },
      steps: {
        ru: [
          "❤️ Ты НЕ виноват(а).",
          "✅ Покажи взрослому, которому доверяешь.",
          "✅ Заблокируй этого человека.",
          "❌ Не отправляй фото/видео.",
          "❌ Не плати.",
          "✅ Позвони: 102.",
          "",
          "Тебе помогут. Ты не сделал(а) ничего плохого.",
        ],
        uz: [
          "❤️ Sen AYBDOR EMASSING.",
          "✅ Ishonchli kattaga ko'rsat.",
          "✅ Bu odamni BLOKLA.",
          "❌ Foto/video YUBORMA.",
          "❌ TO'LAMA.",
          "✅ Qo'ng'iroq qil: 102.",
          "",
          "Senga yordam berishadi.",
        ],
        en: [
          "❤️ You are NOT to blame.",
          "✅ Tell an adult you trust.",
          "✅ Block this person.",
          "❌ Do NOT send photos/videos.",
          "❌ Do NOT pay.",
          "✅ Call: 102.",
          "",
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
  1: { ru: "📱 Отправил SMS-код", uz: "📱 SMS-kod yubordim", en: "📱 Sent SMS code" },
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

/** callback_data prefix for panic scenario buttons. Full: "panic:1" – "panic:6". */
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

/**
 * Build the text for a single panic scenario (by ID).
 * Returns the scenario title + steps + disclaimer, pulling numbers from
 * the verified-contacts module.
 */
export function buildPanicScenarioText(id: PanicScenarioId, lang: Lang): string {
  const contacts = getEmergencyContacts();
  const scenarios = buildScenarios(contacts);
  const scenario = scenarios[id - 1]; // 1-indexed → 0-indexed

  const parts: string[] = [scenario.title[lang], ""];
  for (const step of scenario.steps[lang]) {
    parts.push(step);
  }
  parts.push("");
  parts.push(DISCLAIMER[lang]);

  return parts.join("\n");
}

/** Parse a panic callback_data ("panic:1" → 1, invalid → null). */
export function parsePanicCallback(data: string): PanicScenarioId | null {
  if (!data.startsWith(PANIC_CB_PREFIX)) return null;
  const n = Number(data.slice(PANIC_CB_PREFIX.length));
  if (n >= 1 && n <= 10) return n as PanicScenarioId;
  return null;
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
