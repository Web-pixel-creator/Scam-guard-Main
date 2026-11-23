import {
  Question,
  SealCheck,
  ShieldCheck,
  ShieldWarning,
  SpeakerHigh,
  Stop,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { ADVICE, REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";
import type { PhoneIntelligencePassport } from "@/lib/risk/phone-intelligence";
import type { PhoneReputationSummary } from "@/lib/risk/phone-reputation";
import {
  buildRiskPassportSummary,
  type RiskPassportSection,
  type RiskPassportSummary,
} from "@/lib/risk/risk-passport";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import type { BankSmsKind } from "@/lib/risk/reported-bank-sms";
import { Callout, Pill, PillButton } from "@/components/viper/kit";
import { displayRiskScore } from "@/lib/risk/display-score";

export type CheckResult = {
  reportedBankSms?: BankSmsKind | null; // UI-only hint from the submitted revision; no raw text.
  type: string;
  display: string;
  level: RiskLevel;
  score: number;
  reasons: ReasonCode[];
  explanation: string | null;
  knownReports: number;
  verifiedContact: {
    orgName: string;
    orgType: string;
    source: string;
    display: string;
    contactType: string;
    verificationLevel: "high" | "medium";
    description: string;
  } | null;
  phoneIntelligence?: PhoneIntelligencePassport | null;
  phoneReputation?: PhoneReputationSummary | null;
};

type LevelStyle = {
  icon: typeof ShieldCheck;
  key: string;
  tag: "low" | "medium" | "high" | "critical";
};

const TAG_LABELS: Record<RiskLevel, { ru: string; uz: string; en: string }> = {
  safe: { ru: "Безопасно", uz: "Xavfsiz", en: "Safe" },
  unknown: { ru: "Неизвестно", uz: "Noma’lum", en: "Unknown" },
  suspicious: { ru: "Подозрительно", uz: "Shubhali", en: "Watch" },
  high_risk: { ru: "Обман", uz: "Aldov", en: "Scam" },
};

const LEVEL_STYLES: Record<RiskLevel, LevelStyle> = {
  safe: { icon: ShieldCheck, key: "risk_safe", tag: "low" },
  unknown: { icon: Question, key: "risk_unknown", tag: "medium" },
  suspicious: { icon: Warning, key: "risk_suspicious", tag: "high" },
  high_risk: { icon: ShieldWarning, key: "risk_high", tag: "critical" },
};

const TYPE_LABELS: Record<string, { ru: string; uz: string; en: string }> = {
  phone: { ru: "Телефон", uz: "Telefon", en: "Phone" },
  telegram: { ru: "Telegram", uz: "Telegram", en: "Telegram" },
  url: { ru: "Ссылка", uz: "Havola", en: "Link" },
  text: { ru: "Текст сообщения", uz: "Xabar matni", en: "Message text" },
  unknown: { ru: "Запрос", uz: "So‘rov", en: "Input" },
};

const PASSPORT_CONTEXT_REASON_CODES = new Set<ReasonCode>([
  "valid_uz_phone",
  "non_uz_phone",
  "unknown_sender",
  "new_telegram_account",
]);

export function RiskResultCard({ result }: { result: CheckResult }) {
  const { lang } = useLang();
  const s = LEVEL_STYLES[result.level];
  const Icon = s.icon;
  const contextualAdvice = filterAdvice(result.level, result.reasons, lang, {
    reportedBankSms: result.reportedBankSms,
  });
  const fallbackAdvice = ADVICE[result.level][lang].slice(
    0,
    result.level === "safe" || result.level === "unknown" ? 2 : 3,
  );
  const advice = contextualAdvice.length > 0 ? contextualAdvice : fallbackAdvice;
  const isHot = result.level === "high_risk" || result.level === "suspicious";
  const isUnknown = result.level === "unknown";
  const typeLabel = TYPE_LABELS[result.type]?.[lang] ?? result.type;
  const displayScore = displayRiskScore(result.score);
  const passport = buildRiskPassportSummary(result, lang);
  const title = passport?.title ?? t(s.key as never, lang);
  const reasonsToShow = passport
    ? result.reasons.filter((reason) => !PASSPORT_CONTEXT_REASON_CODES.has(reason))
    : result.reasons;

  // "Read aloud" — Web Speech API. Cleans up on unmount and on result change.
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [result]);

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const verdict = t(s.key as never, lang);
    const whatToDo = { ru: "Что делать:", uz: "Nima qilish kerak:", en: "What to do:" }[lang];
    const parts = [
      `${TAG_LABELS[result.level][lang]}. ${verdict}.`,
      result.explanation ?? "",
      `${whatToDo} ${advice.join(". ")}`,
    ].filter(Boolean);
    const utter = new SpeechSynthesisUtterance(parts.join(" "));
    utter.lang = { ru: "ru-RU", uz: "uz-UZ", en: "en-US" }[lang];
    utter.rate = 0.95;
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  const scoreLabel = isUnknown
    ? {
        ru: "Оценка риска · Недостаточно данных",
        uz: "Xavf bahosi · Ma’lumot yetarli emas",
        en: "Risk score · Insufficient data",
      }[lang]
    : `${{ ru: "Оценка", uz: "Baho", en: "Score" }[lang]} · ${displayScore} / 100`;

  return (
    <div className={`vp-report vp-report--${result.level}`}>
      <div className="vp-report-head">
        <span className="vp-report-label">
          <i aria-hidden="true" className={isHot ? "is-hot" : undefined} />
          {{ ru: "Результат", uz: "Natija", en: "Result" }[lang]}
        </span>
        <span className="vp-report-score">{scoreLabel}</span>
      </div>

      <div className="vp-report-title">
        <span className="vp-report-icon" aria-hidden="true">
          <Icon weight="fill" />
        </span>
        <div>
          <p className="vp-report-meta">
            {{ ru: "Тип:", uz: "Turi:", en: "Type:" }[lang]} <b>{typeLabel}</b>
            <span className={`vp-tag vp-tag--${s.tag}`}>{TAG_LABELS[result.level][lang]}</span>
          </p>
          <h3>{title}</h3>
        </div>
      </div>

      {result.type === "text" ? (
        <blockquote className="vp-report-quote">{result.display}</blockquote>
      ) : (
        <p className="vp-report-display" translate="no">
          {result.display}
        </p>
      )}

      <PillButton
        tone="outline"
        className="vp-pill--small vp-report-speak"
        onClick={speak}
        aria-pressed={speaking}
        icon={speaking ? <Stop weight="fill" /> : <SpeakerHigh weight="fill" />}
      >
        {speaking
          ? { ru: "Остановить чтение", uz: "O‘qishni to‘xtatish", en: "Stop reading" }[lang]
          : { ru: "Прочитать вслух", uz: "Ovoz chiqarib o‘qish", en: "Read aloud" }[lang]}
      </PillButton>

      {passport && <RiskPassportPanel passport={passport} />}

      {!passport && result.explanation && <p className="vp-report-text">{result.explanation}</p>}
      {!passport && !result.explanation && result.reasons.includes("hosted_app_platform") && (
        <p className="vp-report-text">
          {
            {
              ru: "Этот адрес размещён на публичной платформе для веб-приложений. Сам домен не является признаком мошенничества, но владелец конкретной страницы не подтверждён.\n\nНе вводите OTP, PIN, CVV, пароли или данные карты, если не уверены в источнике ссылки.",
              uz: "Bu manzil veb-ilovalar uchun ommaviy platformada joylashgan. Domen o‘zi firibgarlik belgisi emas, lekin aniq sahifa egasi tasdiqlanmagan.\n\nAgar havola manbasiga ishonchingiz komil bo‘lmasa, OTP, PIN, CVV, parol yoki karta ma’lumotlarini kiritmang.",
              en: "This address is hosted on a public web application platform. The domain itself is not a sign of fraud, but the owner of this specific page is not verified.\n\nDo not enter OTP, PIN, CVV, passwords or card details unless you are sure about the link source.",
            }[lang]
          }
        </p>
      )}

      {/* Verified official contact match (D-011) */}
      {result.verifiedContact && (
        <Callout
          tone="ok"
          icon={<SealCheck weight="fill" />}
          title={`${
            {
              ru: "Точное совпадение в официальном справочнике:",
              uz: "Rasmiy ma’lumotnomada aniq moslik:",
              en: "Exact match in the official directory:",
            }[lang]
          } ${result.verifiedContact.orgName}`}
        >
          <p>
            {{ ru: "Контакт", uz: "Kontakt", en: "Contact" }[lang]}:{" "}
            {result.verifiedContact.display}. {result.verifiedContact.description}.{" "}
            {{ ru: "Проверка", uz: "Tekshiruv", en: "Verification" }[lang]}:{" "}
            {
              {
                ru: result.verifiedContact.verificationLevel === "high" ? "высокая" : "средняя",
                uz: result.verifiedContact.verificationLevel === "high" ? "yuqori" : "o'rta",
                en: result.verifiedContact.verificationLevel,
              }[lang]
            }
            .
          </p>
          <p>
            {
              {
                ru: "Это не доказывает, что входящий звонок безопасен. Номер на экране могут подменить. Если просят код, карту, приложение или перевод — положите трубку и перезвоните сами.",
                uz: "Bu kiruvchi qo‘ng‘iroq xavfsizligini isbotlamaydi. Ekrandagi raqam soxtalashtirilishi mumkin. Kod, karta, ilova yoki pul so‘rashsa — go‘shakni qo‘ying va o‘zingiz qayta qo‘ng‘iroq qiling.",
                en: "This does not prove an incoming call is safe. Caller ID can be spoofed. If they ask for a code, card, app or transfer — hang up and call back yourself.",
              }[lang]
            }
          </p>
        </Callout>
      )}
      {!passport && !result.verifiedContact && result.phoneIntelligence?.officialLookalike && (
        <Callout
          tone="alert"
          icon={<Warning weight="fill" />}
          title={`${
            {
              ru: "Похож на официальный контакт, но не совпадает:",
              uz: "Rasmiy kontaktga o‘xshaydi, lekin aniq mos emas:",
              en: "Similar to an official contact, but not an exact match:",
            }[lang]
          } ${result.phoneIntelligence.officialLookalike.org[lang]} — ${result.phoneIntelligence.officialLookalike.display}`}
        >
          <p>
            {
              {
                ru: "Это не доказывает мошенничество. Не перезванивайте по входящему номеру: используйте приложение, карту, официальный сайт или проверенный контакт.",
                uz: "Bu firibgarlikni isbotlamaydi. Kiruvchi raqamga qayta qo‘ng‘iroq qilmang: ilova, karta, rasmiy sayt yoki tekshirilgan kontaktdan foydalaning.",
                en: "This does not prove fraud. Do not call back via the incoming number: use the app, card, official site, or verified contact.",
              }[lang]
            }
          </p>
        </Callout>
      )}

      {reasonsToShow.length > 0 && (
        <div className="vp-report-block">
          <h4>{t("why_title", lang)}</h4>
          <ol className="vp-numbered">
            {reasonsToShow.map((reason, index) => (
              <li key={reason}>
                <span aria-hidden="true">{index + 1}</span>
                <span>{REASON_LABELS[reason]?.[lang] ?? reason}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="vp-report-advice">
        <h4>
          <ShieldCheck weight="fill" aria-hidden="true" />
          {t("what_to_do", lang)}
        </h4>
        <ul className="vp-list vp-list--check">
          {advice.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="vp-report-foot">
        <span>
          {{ ru: "Жалобы", uz: "Shikoyatlar", en: "Reports" }[lang]} ·{" "}
          {result.knownReports > 0 ? result.knownReports : "0"}
        </span>
        <div className="vp-actions">
          {isHot && <Pill to="/emergency">{t("emergency_cta", lang)}</Pill>}
          <Pill to="/report" tone={isHot ? "outline" : "dark"}>
            {t("report_btn", lang)}
          </Pill>
        </div>
      </div>
    </div>
  );
}

function RiskPassportPanel({ passport }: { passport: RiskPassportSummary }) {
  return (
    <div className="vp-report-passport" aria-label={passport.title}>
      <div className="vp-card-top">
        <span>{passport.eyebrow}</span>
        <span className="vp-tag">{passport.kind}</span>
      </div>
      <div className="vp-report-passport-grid">
        {passport.sections.map((section, index) => (
          <RiskPassportSectionBlock section={section} key={`${section.id}-${index}`} />
        ))}
      </div>
    </div>
  );
}

function RiskPassportSectionBlock({ section }: { section: RiskPassportSection }) {
  return (
    <section className={`vp-report-passport-section is-${section.tone ?? "neutral"}`}>
      <h4>{section.title}</h4>
      <ul className="vp-list vp-list--dot">
        {section.lines.slice(0, 3).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
