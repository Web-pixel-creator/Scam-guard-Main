import type { InputType } from "@/lib/risk/detect";
import type { ReasonCode } from "@/lib/risk/rules";
import { VERIFIED_CONTACTS } from "@/lib/risk/verified-contacts";
import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import type { ReportDraft } from "@/lib/telegram/session.server";

const RECENT_GUARDIAN_WINDOW_MS = 30 * 60 * 1000;

const NEW_ARTIFACT_RE =
  /(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/|@[a-zA-Z0-9_]{3,}|\+?\d[\d\s().-]{6,}\d)/i;
const DONE_RE =
  /(?:сделал|сделала|готово|позвонил|позвонила|заблокировал|заблокировала|положил|положила|done|finished|called|blocked|qildim|tayyor|qo'ng'iroq qildim)/i;
const SAFE_CALL_RE =
  /(?:номер|банк|позвон|куда звон|горяч|официальн|call|bank|number|hotline|raqam|bankka|qo'ng'iroq)/i;
const FULL_PLAN_RE =
  /(?:весь|полный|чек.?лист|план|инструкц|all steps|full plan|checklist|to'liq|reja)/i;
const NEXT_RE =
  /(?:что дальше|что делать|следующий шаг|что еще|посовет|как быть|what next|next step|what should|nima qilay|keyin nima)/i;

export const GUARDIAN_CB = {
  next: "guardian:next",
  done: "guardian:done",
  safeCall: "guardian:safe_call",
  fullPlan: "guardian:full_plan",
} as const;

export type GuardianAngelAction = (typeof GUARDIAN_CB)[keyof typeof GUARDIAN_CB];

export interface GuardianAngelSnapshot {
  level: "high_risk";
  type: InputType;
  reasons: ReasonCode[];
  at: string;
}

type GuardianContext = "apk" | "bank" | "card" | "money" | "telegram" | "qr" | "crypto" | "generic";

const BANK_REASONS = new Set<ReasonCode>([
  "asks_for_otp",
  "asks_for_sms_code",
  "asks_for_pin",
  "impersonates_bank",
  "telegram_bank_contact",
  "asks_not_to_hang_up",
  "threatens_account_block",
]);

const CARD_REASONS = new Set<ReasonCode>([
  "asks_for_card_cvv",
  "requests_card_digits",
  "requests_personal_data",
]);

const APK_REASONS = new Set<ReasonCode>([
  "asks_to_install_apk",
  "apk_download_link",
  "malicious_file_bait",
]);

const MONEY_REASONS = new Set<ReasonCode>([
  "asks_to_transfer_to_safe_account",
  "payment_before_service",
  "fake_delivery_payment",
  "fake_loan_offer",
  "dropper_recruitment",
]);

const TELEGRAM_REASONS = new Set<ReasonCode>([
  "telegram_account_takeover_phishing",
  "suspicious_invite_link",
  "fake_captcha_or_voting",
]);

const QR_REASONS = new Set<ReasonCode>(["asks_to_scan_qr"]);

const CRYPTO_REASONS = new Set<ReasonCode>([
  "crypto_casino_bonus_funnel",
  "gambling_prediction_promo",
  "giveaway_engagement_bait",
  "task_reward_engagement_bait",
  "wallet_action_urgency",
  "ton_referral_earning_scheme",
  "investment_fast_profit_pitch",
]);

function hasReason(snapshot: GuardianAngelSnapshot, set: Set<ReasonCode>): boolean {
  return snapshot.reasons.some((reason) => set.has(reason));
}

function contextOf(snapshot: GuardianAngelSnapshot): GuardianContext {
  if (snapshot.type === "apk" || hasReason(snapshot, APK_REASONS)) return "apk";
  if (snapshot.type === "payment" || hasReason(snapshot, MONEY_REASONS)) return "money";
  if (hasReason(snapshot, CARD_REASONS)) return "card";
  if (hasReason(snapshot, BANK_REASONS)) return "bank";
  if (snapshot.type === "telegram" || hasReason(snapshot, TELEGRAM_REASONS)) return "telegram";
  if (hasReason(snapshot, QR_REASONS)) return "qr";
  if (hasReason(snapshot, CRYPTO_REASONS)) return "crypto";
  return "generic";
}

function shouldShowSafeCallButton(snapshot?: GuardianAngelSnapshot): boolean {
  if (!snapshot) return true;
  const context = contextOf(snapshot);
  return context === "apk" || context === "bank" || context === "card" || context === "money";
}

function isRecent(snapshot: GuardianAngelSnapshot, now = new Date()): boolean {
  const at = Date.parse(snapshot.at);
  return Number.isFinite(at) && now.getTime() - at <= RECENT_GUARDIAN_WINDOW_MS;
}

function hasNewerPanicContext(
  data: ReportDraft | undefined,
  snapshot: GuardianAngelSnapshot,
): boolean {
  const panicAt = Date.parse(data?.lastPanicAt ?? "");
  const guardianAt = Date.parse(snapshot.at);
  return Number.isFinite(panicAt) && Number.isFinite(guardianAt) && panicAt > guardianAt;
}

function bankContacts(lang: Lang): string {
  return VERIFIED_CONTACTS.filter(
    (contact) =>
      (contact.orgType === "bank" || contact.orgType === "payment_system") &&
      contact.contactType === "short_code",
  )
    .slice(0, 6)
    .map((contact) => `• ${contact.org[lang]} — ${contact.display}`)
    .join("\n");
}

function primaryStep(snapshot: GuardianAngelSnapshot, lang: Lang): string {
  const context = contextOf(snapshot);
  if (lang === "uz") {
    const uz: Record<GuardianContext, string> = {
      apk: "telefonni ajrating: aviаrejimni yoqing va bankka boshqa qurilmadan qo'ng'iroq qiling",
      bank: "bankka faqat rasmiy raqam orqali qo'ng'iroq qiling va hisobni tekshirtiring",
      card: "kartani darhol bloklang va oxirgi operatsiyalarni tekshiring",
      money: "bankka qo'ng'iroq qilib o'tkazmani muzlatish yoki e'tiroz bildirishni so'rang",
      telegram: "Telegramdagi noma'lum seanslarni yoping va ikki bosqichli parolni yoqing",
      qr: "QR orqali kirishni to'xtating va Telegram/SMS kodini kiritmang",
      crypto: "wallet ulashni, kod kiritishni yoki komissiya to'lashni to'xtating",
      generic: "muloqotni to'xtating, kod/karta/pul yubormang va dalillarni saqlang",
    };
    return uz[context];
  }
  if (lang === "en") {
    const en: Record<GuardianContext, string> = {
      apk: "isolate the phone: turn on airplane mode and call the bank from another device",
      bank: "call the bank only using an official number and ask them to check the account",
      card: "block the card now and check the latest transactions",
      money: "call the bank and ask to freeze or dispute the transfer",
      telegram: "terminate unknown Telegram sessions and enable two-step verification",
      qr: "stop the QR login flow and do not enter Telegram or SMS codes",
      crypto: "stop wallet connects, code entry, and any fee payment",
      generic: "stop the conversation, do not send codes/cards/money, and save evidence",
    };
    return en[context];
  }
  const ru: Record<GuardianContext, string> = {
    apk: "изолируйте телефон: включите авиарежим и звоните в банк с другого устройства",
    bank: "позвоните в банк только по официальному номеру и попросите проверить счёт",
    card: "заблокируйте карту сейчас и проверьте последние операции",
    money: "позвоните в банк и попросите заморозить или оспорить перевод",
    telegram: "завершите неизвестные сеансы Telegram и включите двухэтапный пароль",
    qr: "остановите QR-вход и не вводите Telegram/SMS-код",
    crypto: "остановите wallet connect, ввод кодов и оплату любых комиссий",
    generic: "остановите разговор, не отправляйте код/карту/деньги и сохраните доказательства",
  };
  return ru[context];
}

function nextSteps(snapshot: GuardianAngelSnapshot, lang: Lang): string[] {
  const context = contextOf(snapshot);
  const steps: Record<Lang, Record<GuardianContext, string[]>> = {
    ru: {
      apk: [
        "Оставьте авиарежим включённым, пока не удалите приложение.",
        "С другого телефона позвоните в банк и временно заблокируйте карты.",
        "С чистого устройства смените пароли банка, Telegram и почты.",
      ],
      bank: [
        "Завершите разговор и не отвечайте на новые вопросы.",
        "Перезвоните в банк по номеру из приложения, карты или официального сайта.",
        "Скажите: «Меня просили код/деньги/приложение. Проверьте мой счёт».",
      ],
      card: [
        "Заблокируйте карту в приложении или по официальному номеру банка.",
        "Проверьте последние операции и попросите оспорить неизвестные.",
        "Если вводили пароль онлайн-банка — смените его с другого устройства.",
      ],
      money: [
        "Позвоните в банк и попросите заморозить/оспорить перевод.",
        "Не делайте «возвратный перевод» — это частая вторая схема.",
        "Сохраните чек, чат, номер получателя и время операции.",
      ],
      telegram: [
        "Зайдите в Telegram с другого устройства и завершите неизвестные сеансы.",
        "Включите двухэтапный пароль.",
        "Предупредите близких: от вашего имени могут просить деньги или код.",
      ],
      qr: [
        "Не сканируйте QR повторно и не подтверждайте вход.",
        "Если страница уже открыта — не вводите Telegram/SMS-код, карту или пароль.",
        "Закройте страницу и проверьте сервис только через официальное приложение или сайт.",
      ],
      crypto: [
        "Не подключайте wallet и не подписывайте транзакции.",
        "Не платите комиссию за «вывод», «подарок» или «активацию».",
        "Сохраните ссылку/скрин и проверьте сервис через официальный сайт.",
      ],
      generic: [
        "Остановите разговор и не отправляйте новые данные.",
        "Сохраните скриншоты, номер, ссылку и время сообщений.",
        "Если уже отправили код/карту/деньги — выберите подходящий сценарий в /panic.",
      ],
    },
    uz: {
      apk: [
        "Ilovani o'chirmaguncha aviаrejimni yoqilgan holda qoldiring.",
        "Boshqa telefondan bankka qo'ng'iroq qilib kartalarni vaqtincha bloklang.",
        "Toza qurilmadan bank, Telegram va pochta parollarini almashtiring.",
      ],
      bank: [
        "Suhbatni tugating va yangi savollarga javob bermang.",
        "Bankka faqat ilova, karta yoki rasmiy saytdagi raqam orqali qo'ng'iroq qiling.",
        "Ayting: «Mendan kod/pul/ilova so'rashdi. Hisobimni tekshiring».",
      ],
      card: [
        "Kartani ilova orqali yoki bankning rasmiy raqami orqali bloklang.",
        "Oxirgi operatsiyalarni tekshiring va begona operatsiyaga e'tiroz bildiring.",
        "Agar bank parolini kiritgan bo'lsangiz, uni boshqa qurilmadan almashtiring.",
      ],
      money: [
        "Bankka qo'ng'iroq qilib o'tkazmani muzlatish yoki qaytarishni so'rang.",
        "«Qaytarish uchun yana o'tkazma» qilmang — bu ko'p uchraydigan ikkinchi tuzoq.",
        "Chek, chat, oluvchi raqami va operatsiya vaqtini saqlang.",
      ],
      telegram: [
        "Telegramga boshqa qurilmadan kiring va noma'lum seanslarni tugating.",
        "Ikki bosqichli parolni yoqing.",
        "Yaqinlaringizni ogohlantiring: sizning nomingizdan pul yoki kod so'rashlari mumkin.",
      ],
      qr: [
        "QRni qayta skanerlamang va loginni tasdiqlamang.",
        "Sahifa ochilgan bo'lsa ham Telegram/SMS kodi, karta yoki parol kiritmang.",
        "Sahifani yoping va servisni faqat rasmiy ilova yoki sayt orqali tekshiring.",
      ],
      crypto: [
        "Wallet ulamang va tranzaksiyani tasdiqlamang.",
        "«Yechish», «sovg'a» yoki «aktivatsiya» uchun komissiya to'lamang.",
        "Havola/skrinshotni saqlang va servisni rasmiy sayt orqali tekshiring.",
      ],
      generic: [
        "Muloqotni to'xtating va yangi ma'lumot yubormang.",
        "Skrinshot, raqam, havola va xabar vaqtini saqlang.",
        "Kod/karta/pul yuborgan bo'lsangiz, /panic ichidan mos holatni tanlang.",
      ],
    },
    en: {
      apk: [
        "Keep airplane mode on until the app is removed.",
        "From another phone, call the bank and temporarily block your cards.",
        "From a clean device, change bank, Telegram, and email passwords.",
      ],
      bank: [
        "End the conversation and stop answering new questions.",
        "Call the bank using the app, card, or official website only.",
        "Say: “They asked me for a code/money/app. Please check my account”.",
      ],
      card: [
        "Block the card in the app or via the bank's official number.",
        "Check recent transactions and dispute unknown ones.",
        "If you entered an online-bank password, change it from another device.",
      ],
      money: [
        "Call the bank and ask to freeze or dispute the transfer.",
        "Do not make a “return transfer” — that is a common second trap.",
        "Save the receipt, chat, recipient number, and transaction time.",
      ],
      telegram: [
        "Open Telegram from another device and terminate unknown sessions.",
        "Enable two-step verification.",
        "Warn close contacts: someone may ask for money or codes from your account.",
      ],
      qr: [
        "Do not scan the QR again or approve the login.",
        "If the page is already open, do not enter Telegram/SMS codes, card data, or passwords.",
        "Close the page and verify the service only through the official app or website.",
      ],
      crypto: [
        "Do not connect a wallet or sign transactions.",
        "Do not pay a fee for “withdrawal”, “gift”, or “activation”.",
        "Save the link/screenshot and verify the service through its official site.",
      ],
      generic: [
        "Stop the conversation and do not send new data.",
        "Save screenshots, number, link, and message time.",
        "If you already sent a code/card/money, choose the matching /panic scenario.",
      ],
    },
  };

  return steps[lang][context];
}

export function buildGuardianAngelSnapshot(
  result: RunCheckResult,
  now = new Date(),
): GuardianAngelSnapshot | null {
  if (result.level !== "high_risk") return null;
  return {
    level: "high_risk",
    type: result.type,
    reasons: result.reasons.slice(0, 5),
    at: now.toISOString(),
  };
}

export function parseGuardianAngelCallback(data: string): GuardianAngelAction | null {
  return Object.values(GUARDIAN_CB).includes(data as GuardianAngelAction)
    ? (data as GuardianAngelAction)
    : null;
}

export function buildGuardianAngelKeyboard(
  lang: Lang,
  snapshot?: GuardianAngelSnapshot,
): InlineKeyboard {
  const text = {
    ru: {
      next: "🧭 Что дальше",
      done: "✅ Сделал шаг",
      call: "📞 Позвонить безопасно",
      family: "👪 Позвать близкого",
      plan: "📋 Весь план",
      voice: "🔊 Коротко голосом",
      check: "🔁 Новая проверка",
    },
    uz: {
      next: "🧭 Keyingi qadam",
      done: "✅ Qildim",
      call: "📞 Xavfsiz qo'ng'iroq",
      family: "👪 Yaqinni chaqirish",
      plan: "📋 To'liq reja",
      voice: "🔊 Qisqa ovoz",
      check: "🔁 Yangi tekshiruv",
    },
    en: {
      next: "🧭 Next step",
      done: "✅ I did it",
      call: "📞 Safe callback",
      family: "👪 Call trusted person",
      plan: "📋 Full plan",
      voice: "🔊 Short voice",
      check: "🔁 New check",
    },
  }[lang];

  const keyboard: InlineKeyboard = [
    [
      { text: text.next, callback_data: GUARDIAN_CB.next },
      { text: text.done, callback_data: GUARDIAN_CB.done },
    ],
  ];

  const showSafeCall = shouldShowSafeCallButton(snapshot);
  if (showSafeCall) {
    keyboard.push([
      { text: text.call, callback_data: GUARDIAN_CB.safeCall },
      { text: text.family, callback_data: "family:notify" },
    ]);
  } else {
    keyboard.push([
      { text: text.family, callback_data: "family:notify" },
      { text: text.plan, callback_data: GUARDIAN_CB.fullPlan },
    ]);
  }

  if (showSafeCall) {
    keyboard.push([
      { text: text.voice, callback_data: "voiceout:guardian" },
      { text: text.plan, callback_data: GUARDIAN_CB.fullPlan },
    ]);
  } else {
    keyboard.push([{ text: text.voice, callback_data: "voiceout:guardian" }]);
  }
  keyboard.push([{ text: text.check, callback_data: "check_another" }]);
  return keyboard;
}

export function buildGuardianAngelIntro(snapshot: GuardianAngelSnapshot, lang: Lang): string {
  if (lang === "uz") {
    return (
      "Bu yuqori xavfdan keyingi avtomatik yordam — yangi tekshiruv emas va tugma bosilgan javob emas.\n\n" +
      "Hozir hammasini birdan qilmaymiz — faqat bitta xavfsiz qadam.\n\n" +
      `🧭 Hozir: ${primaryStep(snapshot, lang)}.\n\n` +
      "Qilsangiz — «✅ Qildim» ni bosing."
    );
  }
  if (lang === "en") {
    return (
      "This is an automatic safety prompt after a high-risk result, not a new check or a button response.\n\n" +
      "We will not do everything at once — only one safe step now.\n\n" +
      `🧭 Now: ${primaryStep(snapshot, lang)}.\n\n` +
      "When done, tap “✅ I did it”."
    );
  }
  return (
    "Это авто-подсказка после высокого риска — не новая проверка и не ответ на нажатую кнопку.\n\n" +
    "Сейчас не делаем всё сразу — только один безопасный шаг.\n\n" +
    `🧭 Сейчас: ${primaryStep(snapshot, lang)}.\n\n` +
    "Когда сделаете — нажмите «✅ Сделал шаг»."
  );
}

function buildSafeCallText(lang: Lang): string {
  const contacts = bankContacts(lang);
  if (lang === "uz") {
    return (
      "📞 Xavfsiz qayta qo'ng'iroq\n\n" +
      "1. SMSdagi yoki kiruvchi qo'ng'iroqdagi raqamga qo'ng'iroq qilmang.\n" +
      "2. Raqamni bank ilovasi, karta yoki rasmiy saytdan oling.\n" +
      "3. Raqamni o'zingiz tering. Xavotir bo'lsa, yaqin insoningiz yoningizda bo'lsin.\n\n" +
      "Operatorga ayting:\n" +
      "«Mendan kod, pul yoki ilova so'rashdi. Hisobimni tekshiring va xavfli operatsiyalarni bloklang».\n\n" +
      `Tekshirilgan qisqa raqamlar:\n${contacts}`
    );
  }
  if (lang === "en") {
    return (
      "📞 Safe callback\n\n" +
      "1. Do not call the incoming number or any number from an SMS.\n" +
      "2. Open the bank app, your card, or the official website.\n" +
      "3. Dial the number yourself. If you feel stressed, ask someone trusted to stay nearby.\n\n" +
      "Tell the operator:\n" +
      "“Someone asked me for a code, money, or an app. Please check my account and block risky operations”.\n\n" +
      `Verified short numbers:\n${contacts}`
    );
  }
  return (
    "📞 Безопасный обратный звонок\n\n" +
    "1. Не звоните на входящий номер и на номер из SMS.\n" +
    "2. Откройте приложение банка, карту или официальный сайт.\n" +
    "3. Наберите номер сами. Если волнуетесь, попросите близкого быть рядом.\n\n" +
    "Что сказать оператору:\n" +
    "«Меня просили назвать код, перевести деньги или установить приложение. Проверьте мой счёт и заблокируйте рискованные операции».\n\n" +
    `Проверенные короткие номера:\n${contacts}`
  );
}

function buildNextText(snapshot: GuardianAngelSnapshot, lang: Lang): string {
  const steps = nextSteps(snapshot, lang);
  if (lang === "uz") {
    return `Vahimasiz davom etamiz: faqat bitta xavfsiz qadam.\n\n🧭 Keyingi qadam\n\n${steps
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n")}`;
  }
  if (lang === "en") {
    return `Move calmly: one safe step at a time.\n\n🧭 Next safe step\n\n${steps
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n")}`;
  }
  return `Двигаемся спокойно: только один безопасный шаг за раз.\n\n🧭 Следующий безопасный шаг\n\n${steps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n")}`;
}

function buildDoneText(snapshot: GuardianAngelSnapshot, lang: Lang): string {
  const next = nextSteps(snapshot, lang).slice(1, 3);
  if (lang === "uz") {
    return `✅ Yaxshi, birinchi qadam bajarildi.\n\nEndi:\n${next
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n")}\n\nAgar yolg'iz qiyin bo'lsa, yaqin insoningizni chaqiring.`;
  }
  if (lang === "en") {
    return `✅ Good, the first step is done.\n\nNow:\n${next
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n")}\n\nIf this feels hard alone, call a trusted person.`;
  }
  return `✅ Хорошо, первый шаг сделан.\n\nТеперь:\n${next
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n")}\n\nЕсли одному сложно — позовите близкого.`;
}

function buildFullPlanText(snapshot: GuardianAngelSnapshot, lang: Lang): string {
  const steps = nextSteps(snapshot, lang);
  if (lang === "uz") {
    return (
      "📋 To'liq xavfsiz reja\n\n" +
      steps.map((step, index) => `${index + 1}. ${step}`).join("\n") +
      "\n4. Yangi kod, karta, parol, fayl yoki pul yubormang.\n" +
      "5. Agar pul yoki karta xavf ostida bo'lsa, bankka rasmiy raqam orqali qo'ng'iroq qiling."
    );
  }
  if (lang === "en") {
    return (
      "📋 Full safety plan\n\n" +
      steps.map((step, index) => `${index + 1}. ${step}`).join("\n") +
      "\n4. Do not send new codes, card data, passwords, files, or money.\n" +
      "5. If money or card data may be at risk, call the bank through an official number."
    );
  }
  return (
    "📋 Полный безопасный план\n\n" +
    steps.map((step, index) => `${index + 1}. ${step}`).join("\n") +
    "\n4. Не отправляйте новые коды, карту, пароли, файлы или деньги.\n" +
    "5. Если под угрозой деньги или карта — звоните в банк по официальному номеру."
  );
}

export function buildGuardianAngelText(
  action: GuardianAngelAction,
  snapshot: GuardianAngelSnapshot,
  lang: Lang,
): string {
  switch (action) {
    case GUARDIAN_CB.next:
      return buildNextText(snapshot, lang);
    case GUARDIAN_CB.done:
      return buildDoneText(snapshot, lang);
    case GUARDIAN_CB.safeCall:
      return buildSafeCallText(lang);
    case GUARDIAN_CB.fullPlan:
      return buildFullPlanText(snapshot, lang);
  }
}

export function buildGuardianAngelNoContextText(lang: Lang): string {
  if (lang === "uz") {
    return "Hozir faol xavfli tekshiruvni ko'rmayapman. Link, raqam, skrinshot yoki xabarni yuboring — men aniq xavfsiz qadamni aytaman.";
  }
  if (lang === "en") {
    return "I do not see an active high-risk check right now. Send a link, number, screenshot, or message and I will guide the next safe step.";
  }
  return "Сейчас я не вижу активной опасной проверки. Пришлите ссылку, номер, скриншот или сообщение — я подскажу следующий безопасный шаг.";
}

export function classifyGuardianAngelFollowUp(
  text: string,
  scenarioData: ReportDraft | undefined,
  now = new Date(),
): GuardianAngelAction | null {
  const trimmed = text.trim();
  if (!trimmed || NEW_ARTIFACT_RE.test(trimmed)) return null;

  const snapshot = scenarioData?.guardian;
  if (!snapshot || !isRecent(snapshot, now) || hasNewerPanicContext(scenarioData, snapshot)) {
    return null;
  }

  if (DONE_RE.test(trimmed)) return GUARDIAN_CB.done;
  if (SAFE_CALL_RE.test(trimmed)) return GUARDIAN_CB.safeCall;
  if (FULL_PLAN_RE.test(trimmed)) return GUARDIAN_CB.fullPlan;
  if (NEXT_RE.test(trimmed)) return GUARDIAN_CB.next;
  return null;
}
