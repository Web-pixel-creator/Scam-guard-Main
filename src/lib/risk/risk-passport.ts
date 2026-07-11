import type { Lang } from "@/lib/i18n";
import type { PhoneIntelligencePassport } from "@/lib/risk/phone-intelligence";
import type { PhoneReputationSummary } from "@/lib/risk/phone-reputation";
import {
  formatNoPhoneReputationLine,
  formatPhoneReputationEvidenceLine,
  formatPhoneReputationScopeLine,
  phoneReputationConfidence,
} from "@/lib/risk/phone-reputation";
import type { ReasonCode, RiskLevel } from "@/lib/risk/rules";

export type RiskPassportKind = "phone" | "telegram";
export type TelegramPassportProvenance =
  | "telegram_bot_api"
  | "ishonch_guard_moderated_reports"
  | "source_controlled";
export interface TelegramPassportEvidence {
  provenance: TelegramPassportProvenance;
  text: string;
}
export type RiskPassportSectionId =
  | "visible"
  | "directory"
  | "reputation"
  | "limits"
  | "meaning"
  | "bottom_line"
  | "next_step";

export interface RiskPassportInput {
  type: string;
  display: string;
  level: RiskLevel;
  reasons: ReasonCode[];
  explanation: string | null;
  knownReports: number;
  verifiedContact: unknown | null;
  phoneIntelligence?: PhoneIntelligencePassport | null;
  phoneReputation?: PhoneReputationSummary | null;
  /** Structured text kept separate from model-authored `explanation`. */
  telegramPassportEvidence?: TelegramPassportEvidence | null;
}

export interface RiskPassportSection {
  id: RiskPassportSectionId;
  title: string;
  lines: string[];
  tone: "neutral" | "warning" | "safe";
}

export interface RiskPassportSummary {
  kind: RiskPassportKind;
  title: string;
  eyebrow: string;
  display: string;
  sections: RiskPassportSection[];
}

const TELEGRAM_PASSPORT_RE =
  /(?:Telegram[-\s]passport|Telegram-паспорт|Telegram pasporti|Telegram invite passport|Telegram-паспорт invite-ссылки|Telegram passport:|Telegram-паспорт:)/iu;

const COPY: Record<
  Lang,
  {
    phoneTitle: string;
    telegramTitle: string;
    eyebrow: string;
    visible: string;
    directory: string;
    reputation: string;
    limits: string;
    meaning: string;
    bottomLine: string;
    nextStep: string;
    number: string;
    unknownCountry: string;
    weakFormat: string;
    foreignCallback: string;
    officialMatched: string;
    officialNotFound: string;
    notApplicable: string;
    lookalike: (org: string, contact: string) => string;
    lookalikeStep: string;
    contextMatters: string;
    phonePrompt: string;
    telegramVisibleFallback: string;
    telegramLimitFallback: string;
    telegramBottomFallback: string;
    telegramPrompt: string;
  }
> = {
  ru: {
    phoneTitle: "Паспорт номера",
    telegramTitle: "Telegram-паспорт",
    eyebrow: "Контекст, а не вердикт",
    visible: "Что видно",
    directory: "Справочник",
    reputation: "Репутация Ishonch",
    limits: "Что недоступно",
    meaning: "Что это значит",
    bottomLine: "Вывод",
    nextStep: "Следующий шаг",
    number: "Номер",
    unknownCountry: "страну/оператора надёжно определить не удалось",
    weakFormat: "Формат номера выглядит неполным или необычным.",
    foreignCallback:
      "Это не узбекский номер. Если представляются банком или службой Узбекистана — завершите разговор и перезвоните сами.",
    officialMatched: "Есть совпадение в официальном справочнике Ishonch Guard.",
    officialNotFound: "В официальном справочнике Ishonch Guard совпадения нет.",
    notApplicable: "Официальный справочник для этого типа номера не применяется.",
    lookalike: (org, contact) =>
      `Похож на официальный контакт, но не совпадает: ${org} — ${contact}.`,
    lookalikeStep:
      "Не перезванивайте по входящему номеру: используйте приложение, карту, официальный сайт или проверенный контакт.",
    contextMatters:
      "Сам номер не доказывает мошенничество. Важнее, просили ли SMS-код, карту, перевод, APK, QR-вход или удалённый доступ.",
    phonePrompt:
      "Напишите, что попросили: SMS-код, данные карты, перевод, APK, QR-вход или удалённый доступ.",
    telegramVisibleFallback:
      "Можно оценить только публично видимые признаки и текст, который вы прислали.",
    telegramLimitFallback:
      "Bot API не показывает возраст аккаунта, скрытые SCAM-метки, жалобы Telegram или личную историю переписки.",
    telegramBottomFallback:
      "Username сам по себе не доказывает безопасность или мошенничество. Главное — что именно вас просят сделать.",
    telegramPrompt:
      "Пришлите текст сообщения, скриншот или просьбу собеседника для более точной проверки.",
  },
  uz: {
    phoneTitle: "Raqam pasporti",
    telegramTitle: "Telegram pasporti",
    eyebrow: "Kontekst, yakuniy hukm emas",
    visible: "Nima ko'rinadi",
    directory: "Ma'lumotnoma",
    reputation: "Ishonch reputatsiyasi",
    limits: "Nima ko'rinmaydi",
    meaning: "Bu nimani bildiradi",
    bottomLine: "Xulosa",
    nextStep: "Keyingi qadam",
    number: "Raqam",
    unknownCountry: "mamlakat/operatorni ishonchli aniqlab bo'lmadi",
    weakFormat: "Raqam formati to'liq emas yoki noodatiy ko'rinadi.",
    foreignCallback:
      "Bu O'zbekiston raqami emas. Agar o'zini bank yoki xizmat deb tanishtirsa — qo'ng'iroqni tugating va rasmiy raqamga o'zingiz qo'ng'iroq qiling.",
    officialMatched: "Ishonch Guard rasmiy ma'lumotnomasida moslik bor.",
    officialNotFound: "Ishonch Guard rasmiy ma'lumotnomasida moslik topilmadi.",
    notApplicable: "Bu raqam turi uchun rasmiy ma'lumotnoma qo'llanmaydi.",
    lookalike: (org, contact) =>
      `Rasmiy kontaktga o'xshaydi, lekin aniq mos emas: ${org} — ${contact}.`,
    lookalikeStep:
      "Kiruvchi raqamga qayta qo'ng'iroq qilmang; ilova, karta, rasmiy sayt yoki tekshirilgan kontaktdan foydalaning.",
    contextMatters:
      "Raqamning o'zi firibgarlikni isbotlamaydi. SMS-kod, karta, pul o'tkazma, APK, QR-login yoki masofaviy kirish so'ralganmi — shu muhim.",
    phonePrompt:
      "Nima so'ralganini yozing: SMS-kod, karta ma'lumoti, pul o'tkazma, APK, QR-login yoki masofaviy kirish.",
    telegramVisibleFallback:
      "Faqat ommaga ko'rinadigan belgilar va siz yuborgan matnni baholash mumkin.",
    telegramLimitFallback:
      "Bot API akkaunt yoshi, yashirin SCAM belgisi, Telegram shikoyatlari yoki shaxsiy yozishmalar tarixini ko'rsatmaydi.",
    telegramBottomFallback:
      "Usernamening o'zi xavfsiz yoki firibgar ekanini isbotlamaydi. Muhimi — sizdan nima qilishni so'rashmoqda.",
    telegramPrompt:
      "Aniqroq tekshiruv uchun xabar matni, skrinshot yoki suhbatdosh so'rovini yuboring.",
  },
  en: {
    phoneTitle: "Number passport",
    telegramTitle: "Telegram passport",
    eyebrow: "Context, not a verdict",
    visible: "Visible",
    directory: "Directory",
    reputation: "Ishonch reputation",
    limits: "Not visible",
    meaning: "What this means",
    bottomLine: "Bottom line",
    nextStep: "Next step",
    number: "Number",
    unknownCountry: "country/operator could not be identified reliably",
    weakFormat: "The number format looks incomplete or unusual.",
    foreignCallback:
      "This is not an Uzbek number. If they claim to be an Uzbek bank or service, hang up and call back yourself.",
    officialMatched: "There is a match in the Ishonch Guard official directory.",
    officialNotFound: "No match in the Ishonch Guard official directory.",
    notApplicable: "The official directory does not apply to this number type.",
    lookalike: (org, contact) =>
      `Looks similar to an official contact, but it is not an exact match: ${org} — ${contact}.`,
    lookalikeStep:
      "Do not call back via the incoming number; use the app, card, official site, or verified contact.",
    contextMatters:
      "The number alone does not prove a scam. What matters is whether they ask for an SMS code, card, transfer, APK, QR login, or remote access.",
    phonePrompt:
      "Tell me what they asked for: SMS code, card details, transfer, APK, QR login, or remote access.",
    telegramVisibleFallback: "Only public profile clues and the text you send can be assessed.",
    telegramLimitFallback:
      "The Bot API cannot see account age, hidden SCAM labels, Telegram reports, or private chat history.",
    telegramBottomFallback:
      "A username alone cannot honestly prove safe or scam. What matters is what they ask you to do.",
    telegramPrompt: "Send the message text, screenshot, or request for a more useful check.",
  },
};

export function buildRiskPassportSummary(
  result: RiskPassportInput,
  lang: Lang,
): RiskPassportSummary | null {
  const kind = detectRiskPassportKind(result);
  if (kind === "phone") return buildPhonePassportSummary(result, lang);
  if (kind === "telegram") return buildTelegramPassportSummary(result, lang);
  return null;
}

export function detectRiskPassportKind(result: RiskPassportInput): RiskPassportKind | null {
  const isLowRiskLevel = result.level === "unknown" || result.level === "safe";
  if (!isLowRiskLevel || result.verifiedContact) return null;

  if (
    result.phoneIntelligence ||
    result.type === "phone" ||
    result.reasons.includes("valid_uz_phone") ||
    result.reasons.includes("non_uz_phone")
  ) {
    return "phone";
  }

  if (result.level === "unknown" && result.type === "telegram") return "telegram";

  return null;
}

function buildPhonePassportSummary(result: RiskPassportInput, lang: Lang): RiskPassportSummary {
  const copy = COPY[lang];
  const passport = result.phoneIntelligence;
  const sections: RiskPassportSection[] = [];

  if (passport) {
    const country = passport.country
      ? `${passport.country.name[lang]} (+${passport.country.callingCode})`
      : copy.unknownCountry;
    const visibleLines = [`${copy.number}: ${country}`];
    if (passport.uzOperator) visibleLines.push(passport.uzOperator[lang]);
    if (!passport.isValidFormat) visibleLines.push(copy.weakFormat);
    if (passport.country && !passport.isUzbekistan) visibleLines.push(copy.foreignCallback);
    sections.push(section("visible", copy.visible, visibleLines, "neutral"));

    const directoryLines = phoneDirectoryLines(passport, copy, lang);
    if (directoryLines.length > 0) {
      sections.push(section("directory", copy.directory, directoryLines, "neutral"));
    }
  } else {
    sections.push(section("visible", copy.visible, [copy.unknownCountry], "neutral"));
  }

  const reputationLines = phoneReputationLines(result, lang);
  sections.push(
    section(
      "reputation",
      copy.reputation,
      reputationLines,
      result.phoneReputation ? "warning" : "safe",
    ),
  );
  sections.push(section("meaning", copy.meaning, [copy.contextMatters], "neutral"));
  sections.push(section("next_step", copy.nextStep, [copy.phonePrompt], "warning"));

  return {
    kind: "phone",
    title: copy.phoneTitle,
    eyebrow: copy.eyebrow,
    display: result.display,
    sections,
  };
}

function phoneReputationLines(result: RiskPassportInput, lang: Lang): string[] {
  if (result.phoneReputation) {
    return [
      formatPhoneReputationEvidenceLine(result.phoneReputation, lang),
      formatPhoneReputationScopeLine(lang),
    ];
  }

  if (result.knownReports > 0) {
    return [
      formatPhoneReputationEvidenceLine(
        {
          source: "ishonch_guard_moderated_reports",
          confirmedReportCount: result.knownReports,
          confidence: phoneReputationConfidence(result.knownReports),
          riskLevel: result.level,
          publicScope: "confirmed_moderated_reports_only",
        },
        lang,
      ),
      formatPhoneReputationScopeLine(lang),
    ];
  }

  return [formatNoPhoneReputationLine(lang), formatPhoneReputationScopeLine(lang)];
}

function phoneDirectoryLines(
  passport: PhoneIntelligencePassport,
  copy: (typeof COPY)[Lang],
  lang: Lang,
): string[] {
  if (passport.officialLookalike) {
    return [
      copy.lookalike(passport.officialLookalike.org[lang], passport.officialLookalike.display),
      copy.lookalikeStep,
    ];
  }

  if (passport.officialDirectoryStatus === "matched") return [copy.officialMatched];
  if (passport.officialDirectoryStatus === "not_found") return [copy.officialNotFound];
  if (passport.officialDirectoryStatus === "not_applicable") return [copy.notApplicable];
  return [];
}

function buildTelegramPassportSummary(result: RiskPassportInput, lang: Lang): RiskPassportSummary {
  const copy = COPY[lang];
  const parsed = result.telegramPassportEvidence
    ? parseTelegramPassportSections(result.telegramPassportEvidence.text, lang)
    : [];
  const sections =
    parsed.length > 0
      ? parsed
      : [
          section("visible", copy.visible, [copy.telegramVisibleFallback], "neutral"),
          section("limits", copy.limits, [copy.telegramLimitFallback], "neutral"),
          section("bottom_line", copy.bottomLine, [copy.telegramBottomFallback], "neutral"),
        ];

  if (!sections.some((item) => item.id === "next_step")) {
    sections.push(section("next_step", copy.nextStep, [copy.telegramPrompt], "warning"));
  }

  return {
    kind: "telegram",
    title: copy.telegramTitle,
    eyebrow: copy.eyebrow,
    display: result.display,
    sections,
  };
}

function parseTelegramPassportSections(text: string, lang: Lang): RiskPassportSection[] {
  if (!TELEGRAM_PASSPORT_RE.test(text)) return [];

  const copy = COPY[lang];
  return text
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !TELEGRAM_PASSPORT_RE.test(block.split(/\r?\n/u)[0] ?? ""))
    .map((block) => {
      const [headingRaw = "", ...rawLines] = block.split(/\r?\n/u).map((line) => line.trim());
      const heading = stripMarker(headingRaw);
      const id = classifyTelegramSection(heading);
      const title = telegramSectionTitle(id, heading, copy);
      const lines = rawLines.map(stripMarker).filter(Boolean);
      if (lines.length === 0 && heading) lines.push(heading);
      return section(id, title, lines, id === "next_step" ? "warning" : "neutral");
    })
    .filter((item) => item.lines.length > 0)
    .slice(0, 5);
}

function classifyTelegramSection(heading: string): RiskPassportSectionId {
  if (/not visible|недоступ|ko'rinmay|ko‘rinmay/i.test(heading)) return "limits";
  if (/visible|что видно|nima ko/i.test(heading)) return "visible";
  if (/bottom|вывод|xulosa/i.test(heading)) return "bottom_line";
  if (/next|следующ|keyingi|safe step|безопасн|xavfsiz/i.test(heading)) return "next_step";
  return "visible";
}

function telegramSectionTitle(
  id: RiskPassportSectionId,
  fallback: string,
  copy: (typeof COPY)[Lang],
): string {
  if (id === "visible") return copy.visible;
  if (id === "limits") return copy.limits;
  if (id === "bottom_line") return copy.bottomLine;
  if (id === "next_step") return copy.nextStep;
  return fallback;
}

function stripMarker(value: string): string {
  return value
    .replace(/^[^\p{L}\p{N}@+]+/u, "")
    .replace(/^[•\-–—]\s*/u, "")
    .trim();
}

function section(
  id: RiskPassportSectionId,
  title: string,
  lines: string[],
  tone: RiskPassportSection["tone"],
): RiskPassportSection {
  return {
    id,
    title,
    lines: lines.filter(Boolean),
    tone,
  };
}
