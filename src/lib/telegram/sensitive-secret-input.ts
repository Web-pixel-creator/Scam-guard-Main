import type { Lang } from "@/lib/i18n";
import {
  sanitizeSensitiveTextForSink,
  type SensitiveSecretClass,
  type SensitiveTextSanitization,
} from "@/lib/risk/sensitive-text";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

export interface SensitiveSecretGuidance {
  title: string;
  description: string;
}

const SECRET_CYRILLIC_TO_LATIN: Readonly<Record<string, string>> = Object.freeze({
  а: "a",
  в: "b",
  е: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
});
const SECRET_LATIN_TO_CYRILLIC: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SECRET_CYRILLIC_TO_LATIN).map(([cyrillic, latin]) => [latin, cyrillic]),
  ),
);

function mapSecretLabelConfusables(
  value: string,
  mapping: Readonly<Record<string, string>>,
): string {
  return Array.from(value, (character) => mapping[character] ?? character).join("");
}

/**
 * Secret labels get a stricter detection-only normalization than ordinary
 * intents. Multiple homoglyphs must not turn a pasted credential into visible
 * Inline output; the original text is still never replaced, stored or echoed.
 */
function secretDetectionCandidates(original: string): string[] {
  const normalized = normalizeIntentTextForMatching(original);
  return [
    original,
    normalized,
    mapSecretLabelConfusables(normalized, SECRET_CYRILLIC_TO_LATIN),
    mapSecretLabelConfusables(normalized, SECRET_LATIN_TO_CYRILLIC),
  ].filter((value, index, values) => values.indexOf(value) === index);
}

function hasValueShapedPasswordLabel(original: string): boolean {
  return secretDetectionCandidates(original).some(
    (candidate) =>
      /(?:password|парол(?:ь|я|ем|ю)?|parol(?:i|ni|ini)?|maxfiy\s+so['’]?z)\s*[:=]\s*\S{4,}/iu.test(
        candidate,
      ) ||
      /(?:password|парол(?:ь|я|ем|ю)?|parol(?:i|ni|ini)?|maxfiy\s+so['’]?z).{0,12}\S*[\d!@#$%^&*_.-]\S{3,}/iu.test(
        candidate,
      ) ||
      /\S*[\d!@#$%^&*_.-]\S{3,}.{0,12}(?:password|парол(?:ь|я|ем|ю)?|parol(?:i|ni|ini)?)/iu.test(
        candidate,
      ),
  );
}

/**
 * Detect a pasted secret without letting invisible controls or one visual
 * Cyrillic/Latin confusable hide its label. The normalized copy is used only
 * for detection and a private warning; callers must retain the original input
 * for every other purpose.
 */
export function detectTelegramSensitiveSecret(original: string): SensitiveTextSanitization | null {
  const detections = secretDetectionCandidates(original)
    .map(sanitizeSensitiveTextForSink)
    .filter((candidate) => candidate.redacted);
  if (detections.length === 0) return null;
  const classes = [...new Set(detections.flatMap((candidate) => candidate.classes))];
  const detected = detections.reduce((best, candidate) =>
    candidate.classes.length > best.classes.length ? candidate : best,
  );
  if (classes.length === 1 && classes[0] === "password" && !hasValueShapedPasswordLabel(original)) {
    return null;
  }
  return { ...detected, classes };
}

export function buildSensitiveSecretGuidance(
  classes: readonly SensitiveSecretClass[],
  lang: Lang,
): SensitiveSecretGuidance {
  const hasRecovery = classes.includes("recovery_phrase");
  const hasPrivateKey = classes.includes("private_key");
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
