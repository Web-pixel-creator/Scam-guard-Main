import type { Lang } from "@/lib/i18n";
import type { SensitiveSecretClass } from "@/lib/risk/sensitive-text";
import { normalizeIntentTextForMatching } from "@/lib/text/intent-text-normalization";
export {
  detectSensitiveSecretValue as detectTelegramSensitiveSecret,
  hasPastedSensitiveSecretValue,
} from "@/lib/risk/sensitive-secret-detection";

export interface SensitiveSecretGuidance {
  title: string;
  description: string;
}

export interface SensitiveSecretFollowUpContext {
  /** Bounded enum-only secret categories; never the secret value or source text. */
  classes: readonly SensitiveSecretClass[];
  /** Language resolved from the original message, not the Telegram profile. */
  lang: Lang;
  at: string;
}

export type SensitiveSecretFollowUpAction = "why" | "next_steps";

export interface SensitiveSecretFollowUp {
  action: SensitiveSecretFollowUpAction;
  context: SensitiveSecretFollowUpContext;
}

export const SENSITIVE_SECRET_FOLLOW_UP_CONTEXT_WINDOW_MS = 20 * 60 * 1_000;

const SENSITIVE_SECRET_CLASSES = new Set<SensitiveSecretClass>([
  "password",
  "code",
  "recovery_phrase",
  "private_key",
  "access_token",
]);
const SENSITIVE_SECRET_CONTEXT_LANGS = new Set<Lang>(["ru", "uz", "en"]);
const SENSITIVE_SECRET_WHY_FOLLOW_UP_RE =
  /^(?:(?:почему|пачему)(?:\s+(?:(?:это|так)\s+(?:опасно|рискованно)(?:\s+и\s+что\s+(?:мне\s+)?делать\s+дальше)?|им\s+нельзя\s+доверять))?|nega(?:\s+(?:(?:bu\s+)?(?:xavfli|xatarli)(?:\s+va\s+(?:keyin\s+)?nima\s+qilay)?|ularga\s+ishonmasligim\s+kerak))?|nima\s+uchun|why(?:\s+(?:(?:is\s+(?:this|that|it)\s+(?:dangerous|risky))(?:\s+and\s+what\s+should\s+i\s+do\s+next)?|should\s+i\s+not\s+trust\s+them))?)[?!.,\s]*$/iu;
const SENSITIVE_SECRET_NEXT_STEPS_FOLLOW_UP_RE =
  /^(?:что\s+(?:мне\s+)?(?:теперь|сейчас)\s+делать|что\s+(?:мне\s+)?делать\s+дальше|(?:а\s+)?(?:что\s+дальше|дальше\s+что)|(?:endi|keyin)\s+nima(?:\s+(?:qilishim\s+kerak|qilay))?|what\s+(?:should\s+i\s+do\s+(?:now|next)|next)|now\s+what)[?!.,\s]*$/iu;

export function buildSensitiveSecretGuidance(
  classes: readonly SensitiveSecretClass[],
  lang: Lang,
): SensitiveSecretGuidance {
  const hasRecovery = classes.includes("recovery_phrase");
  const hasPrivateKey = classes.includes("private_key");
  const hasAccessToken = classes.includes("access_token");
  const hasPassword = classes.includes("password");
  const hasCode = classes.includes("code");

  if (hasRecovery || hasPrivateKey) {
    if (lang === "uz") {
      return {
        title: hasRecovery ? "Tiklash iborasi yashirildi" : "Maxfiy kalit yashirildi",
        description:
          "Uni hech kimga yubormang. Agar bu haqiqiy sir bo'lsa va oshkor qilingan bo'lsa, rasmiy ilovada yangi hamyon yarating.",
      };
    }
    if (lang === "en") {
      return {
        title: hasRecovery ? "Recovery phrase hidden" : "Private key hidden",
        description:
          "Never share it. If it was real and already exposed, create a new wallet in the official app and move the assets safely.",
      };
    }
    return {
      title: hasRecovery ? "Сид-фраза скрыта" : "Приватный ключ скрыт",
      description:
        "Никому не сообщайте этот секрет. Если он настоящий и уже раскрыт, создайте новый кошелёк в официальном приложении и безопасно перенесите активы.",
    };
  }

  if (hasAccessToken) {
    if (lang === "uz") {
      return {
        title: "Kirish tokeni yashirildi",
        description:
          "API, access yoki bot tokenini chatga kiritmang. Agar u haqiqiy bo'lsa va oshkor qilingan bo'lsa, xizmatning rasmiy boshqaruv panelida uni darhol bekor qiling va yangisini yarating.",
      };
    }
    if (lang === "en") {
      return {
        title: "Access token hidden",
        description:
          "Do not paste an API, access, or bot token into chat. If it was real and exposed, revoke it immediately and create a replacement in the service's official dashboard.",
      };
    }
    return {
      title: "Токен доступа скрыт",
      description:
        "Не вставляйте API-, access- или bot-токен в чат. Если токен настоящий и уже раскрыт, немедленно отзовите его и создайте новый в официальной панели сервиса.",
    };
  }

  if (hasPassword) {
    if (lang === "uz") {
      return {
        title: "Parol yashirildi: uni yubormang",
        description: `Haqiqiy parol${hasCode ? " yoki kod" : ""}ni chatga kiritmang. Agar yuborgan bo'lsangiz, rasmiy sayt yoki ilovada parolni almashtiring va sessiyalarni yoping.`,
      };
    }
    if (lang === "en") {
      return {
        title: "Password hidden: do not share it",
        description: `Do not paste a real password${hasCode ? " or code" : ""} into chat. If you shared it, change it in the official site or app and revoke other sessions.`,
      };
    }
    return {
      title: "Пароль скрыт: не сообщайте его",
      description: `Не вставляйте настоящий пароль${hasCode ? " или код" : ""} в чат. Если уже отправили, смените его на официальном сайте или в приложении и завершите другие сессии.`,
    };
  }

  if (hasCode) {
    if (lang === "uz") {
      return {
        title: "Kod yashirildi: hech kimga aytmang",
        description:
          "Haqiqiy SMS/OTP/PINni chatga kiritmang. Kod kelgan rasmiy ilovani o'zingiz ochib, operatsiyani tekshiring.",
      };
    }
    if (lang === "en") {
      return {
        title: "Code hidden: do not share it",
        description:
          "Do not paste a real SMS code, OTP, or PIN into chat. Open the official app yourself and inspect the operation.",
      };
    }
    return {
      title: "Код скрыт: никому не сообщайте",
      description:
        "Не вставляйте настоящий SMS-код, OTP или PIN в чат. Самостоятельно откройте официальное приложение и проверьте операцию.",
    };
  }

  throw new Error("Sensitive-secret guidance requires at least one secret class");
}

export function buildSensitiveSecretFollowUpContext(
  classes: readonly SensitiveSecretClass[],
  lang: Lang,
  now = new Date(),
): SensitiveSecretFollowUpContext {
  const boundedClasses = [...new Set(classes)].filter((value) =>
    SENSITIVE_SECRET_CLASSES.has(value),
  );
  if (boundedClasses.length === 0) {
    throw new Error("Sensitive-secret follow-up context requires a secret class");
  }
  return { classes: boundedClasses, lang, at: now.toISOString() };
}

function activeSensitiveSecretFollowUpContext(
  value: unknown,
  now: Date,
): SensitiveSecretFollowUpContext | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.classes) ||
    candidate.classes.length < 1 ||
    candidate.classes.length > SENSITIVE_SECRET_CLASSES.size ||
    !candidate.classes.every(
      (secretClass) =>
        typeof secretClass === "string" &&
        SENSITIVE_SECRET_CLASSES.has(secretClass as SensitiveSecretClass),
    ) ||
    typeof candidate.lang !== "string" ||
    !SENSITIVE_SECRET_CONTEXT_LANGS.has(candidate.lang as Lang) ||
    typeof candidate.at !== "string" ||
    !Number.isFinite(Date.parse(candidate.at))
  ) {
    return null;
  }
  const ageMs = now.getTime() - Date.parse(candidate.at);
  if (ageMs < 0 || ageMs > SENSITIVE_SECRET_FOLLOW_UP_CONTEXT_WINDOW_MS) return null;

  return {
    classes: [...new Set(candidate.classes as SensitiveSecretClass[])],
    lang: candidate.lang as Lang,
    at: candidate.at,
  };
}

/**
 * Attach only a narrow, artifact-free second-turn question to a recent secret
 * warning. URLs, numbers and pasted values do not match these anchored forms.
 */
export function classifySensitiveSecretFollowUp(
  text: string,
  value: unknown,
  now = new Date(),
): SensitiveSecretFollowUp | null {
  const context = activeSensitiveSecretFollowUpContext(value, now);
  if (!context) return null;
  const normalized = normalizeIntentTextForMatching(text).trim();
  const action: SensitiveSecretFollowUpAction | null = SENSITIVE_SECRET_WHY_FOLLOW_UP_RE.test(
    normalized,
  )
    ? "why"
    : SENSITIVE_SECRET_NEXT_STEPS_FOLLOW_UP_RE.test(normalized)
      ? "next_steps"
      : null;
  return action ? { action, context } : null;
}

/**
 * The accepted follow-up grammar is deliberately narrow, so its leading words
 * are stronger language evidence than a generic one-word detector. Preserve
 * the saved secret language only for a future/unknown form.
 */
export function resolveSensitiveSecretFollowUpLanguage(text: string, fallback: Lang): Lang {
  const normalized = normalizeIntentTextForMatching(text).trim();
  if (/^(?:почему|пачему|что|дальше|а\s+что)(?:\s|[?!.,]|$)/iu.test(normalized)) {
    return "ru";
  }

  if (/^(?:nega|nima\s+uchun|endi|keyin)(?:\s|[?!.,]|$)/iu.test(normalized)) return "uz";
  if (/^(?:why|what|now)(?:\s|[?!.,]|$)/iu.test(normalized)) return "en";
  return fallback;
}

/** Human follow-up copy generated only from enum classes and language. */
export function buildSensitiveSecretFollowUpText(followUp: SensitiveSecretFollowUp): string {
  const { classes, lang } = followUp.context;
  const hasRecovery = classes.includes("recovery_phrase");
  const hasPrivateKey = classes.includes("private_key");
  const hasAccessToken = classes.includes("access_token");
  const hasPassword = classes.includes("password");

  if (hasRecovery || hasPrivateKey) {
    const label = hasRecovery
      ? { ru: "Сид-фраза", uz: "Seed phrase", en: "A seed phrase" }[lang]
      : { ru: "Приватный ключ", uz: "Maxfiy kalit", en: "A private key" }[lang];
    return {
      ru: `${label} даёт полный доступ к криптокошельку. Тот, кто получит этот секрет, может вывести активы; настоящая поддержка не просит его в чате.\n\nНе сообщайте его. Если уже раскрыли, с чистого устройства создайте новый кошелёк в официальном приложении и безопасно перенесите активы.`,
      uz: `${label} kriptohamyonga to'liq kirish imkonini beradi. Uni olgan odam aktivlarni chiqarishi mumkin; haqiqiy yordam xizmati bunday sirni chatda so'ramaydi.\n\nUni yubormang. Agar oshkor qilgan bo'lsangiz, toza qurilmada rasmiy ilova orqali yangi hamyon yarating va aktivlarni xavfsiz ko'chiring.`,
      en: `${label} gives full access to a crypto wallet. Anyone who gets this secret may move the assets; legitimate support will not ask for it in chat.\n\nDo not share it. If it was exposed, use a clean device to create a new wallet in the official app and move the assets safely.`,
    }[lang];
  }

  if (hasAccessToken) {
    return {
      ru: "Токен доступа позволяет программам или боту действовать от имени вашей учётной записи. Настоящая поддержка не просит присылать его в чате.\n\nНе используйте раскрытый токен снова: отзовите его и создайте новый в официальной панели сервиса. Затем проверьте журналы и активные интеграции.",
      uz: "Kirish tokeni dastur yoki botga akkauntingiz nomidan ishlash imkonini beradi. Haqiqiy yordam xizmati uni chatda yuborishni so'ramaydi.\n\nOshkor qilingan tokenni qayta ishlatmang: uni rasmiy boshqaruv panelida bekor qiling va yangisini yarating. Keyin jurnallar va faol integratsiyalarni tekshiring.",
      en: "An access token can let software or a bot act as your account. Legitimate support will not ask you to send it in chat.\n\nDo not reuse an exposed token: revoke it and create a replacement in the service's official dashboard. Then review logs and active integrations.",
    }[lang];
  }

  if (hasPassword) {
    return {
      ru: "Пароль даёт доступ к вашей учётной записи. Настоящая поддержка не просит присылать его в чате.\n\nНе сообщайте пароль. Если уже раскрыли, смените его на официальном сайте или в приложении, завершите другие сессии и включите двухэтапную защиту.",
      uz: "Parol akkauntingizga kirish imkonini beradi. Haqiqiy yordam xizmati uni chatda yuborishni so'ramaydi.\n\nParolni aytmang. Agar oshkor qilgan bo'lsangiz, uni rasmiy sayt yoki ilovada almashtiring, boshqa sessiyalarni yoping va ikki bosqichli himoyani yoqing.",
      en: "A password gives access to your account. Legitimate support will not ask you to send it in chat.\n\nDo not share the password. If it was exposed, change it on the official site or app, revoke other sessions, and enable two-step protection.",
    }[lang];
  }

  return {
    ru: "SMS-код, OTP или PIN может подтвердить вход, смену доступа либо денежную операцию. Тот, кто получит код, может действовать от вашего имени.\n\nКод не сообщайте. Самостоятельно откройте официальное приложение и проверьте операцию; если уже раскрыли код, сразу свяжитесь с официальной поддержкой.",
    uz: "SMS-kod, OTP yoki PIN akkauntga kirish, kirishni o'zgartirish yoki pul operatsiyasini tasdiqlashi mumkin. Kodni olgan odam sizning nomingizdan harakat qilishi mumkin.\n\nKodni aytmang. Rasmiy ilovani o'zingiz ochib, operatsiyani tekshiring; kodni oshkor qilgan bo'lsangiz, darhol rasmiy yordam xizmatiga murojaat qiling.",
    en: "An SMS code, OTP, or PIN can approve a login, an access change, or a money operation. Whoever gets the code may be able to act as you.\n\nDo not share the code. Open the official app yourself and inspect the operation; if the code was exposed, contact official support immediately.",
  }[lang];
}
