import { useMemo, useReducer, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle,
  CircleNotch,
  MagnifyingGlass,
  Question,
  ShieldWarning,
  Warning,
} from "@phosphor-icons/react";

import { PillButton } from "@/components/viper/kit";

import { checkInput, type MetaIntentCheckResult } from "@/lib/check.functions";
import { safeCheckErrorMessage } from "@/lib/client-error";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import { ADVICE, REASON_LABELS, type RiskLevel } from "@/lib/risk/rules";
import {
  buildRiskPassportSummary,
  type RiskPassportSection,
  type RiskPassportSummary,
} from "@/lib/risk/risk-passport";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import type { CheckResult } from "@/components/RiskResultCard";
import { emptyEmbedDraft, embedCheckReducer } from "@/lib/embed-check-state";
import { reportedBankSms, type BankSmsKind } from "@/lib/risk/reported-bank-sms";

const MAX_INPUT_CHARS = 1000;
const MIN_INPUT_CHARS = 3;

type EmbedCheckWidgetProps = {
  lang: Lang;
  partner?: string | null;
};

type EmbedTelemetryContext = {
  partner?: string | null;
  referrer?: string | null;
};

const LEVEL_COPY: Record<
  RiskLevel,
  {
    icon: typeof CheckCircle;
    title: Record<Lang, string>;
    label: Record<Lang, string>;
  }
> = {
  safe: {
    icon: CheckCircle,
    title: {
      ru: "Явных признаков скама не найдено",
      uz: "Aniq firibgarlik belgisi topilmadi",
      en: "No clear scam signals found",
    },
    label: { ru: "Безопасно", uz: "Xavfsiz", en: "Safe" },
  },
  unknown: {
    icon: Question,
    title: {
      ru: "Нужно больше контекста",
      uz: "Ko‘proq ma’lumot kerak",
      en: "More context needed",
    },
    label: { ru: "Недостаточно данных", uz: "Ma’lumot yetarli emas", en: "Not enough data" },
  },
  suspicious: {
    icon: Warning,
    title: {
      ru: "Есть подозрительные признаки",
      uz: "Shubhali belgilar bor",
      en: "Suspicious signs found",
    },
    label: { ru: "Осторожно", uz: "Ehtiyot bo‘ling", en: "Caution" },
  },
  high_risk: {
    icon: ShieldWarning,
    title: {
      ru: "Высокий риск мошенничества",
      uz: "Firibgarlik xavfi yuqori",
      en: "High scam risk",
    },
    label: { ru: "Высокий риск", uz: "Yuqori xavf", en: "High risk" },
  },
};

function isMetaIntentResult(value: unknown): value is MetaIntentCheckResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "metaIntent" in value &&
    "response" in value &&
    typeof (value as { response?: unknown }).response === "string"
  );
}

function validationMessage(value: string, lang: Lang): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {
      ru: "Вставьте номер, ссылку, username или текст.",
      uz: "Raqam, havola, username yoki matn kiriting.",
      en: "Paste a number, link, username or text.",
    }[lang];
  }
  if (trimmed.length < MIN_INPUT_CHARS) {
    return {
      ru: "Слишком коротко для проверки.",
      uz: "Tekshirish uchun juda qisqa.",
      en: "Too short to check.",
    }[lang];
  }
  return null;
}

function truncate(value: string, max = 320): string {
  const compact = value.trim().replace(/\n{3,}/g, "\n\n");
  return compact.length > max ? `${compact.slice(0, max - 1).trim()}…` : compact;
}

export function EmbedCheckWidget({ lang, partner }: EmbedCheckWidgetProps) {
  const checkFn = useServerFn(checkInput);
  const [{ text: value, revision, outcome }, dispatch] = useReducer(
    embedCheckReducer,
    emptyEmbedDraft,
  );
  const [touched, setTouched] = useState(false);
  const loading = outcome.kind === "loading";
  const result = outcome.kind === "risk" ? outcome.result : null;
  const metaResponse = outcome.kind === "meta" ? outcome.message : null;
  const error = outcome.kind === "error" ? outcome.message : null;

  const validation = useMemo(
    () => (touched ? validationMessage(value, lang) : null),
    [lang, touched, value],
  );

  async function runCheck() {
    setTouched(true);
    if (validationMessage(value, lang) || loading) return;
    const input = value.trim().slice(0, MAX_INPUT_CHARS);
    dispatch({ type: "start", revision });
    try {
      const response = await checkFn({
        data: {
          input,
          lang,
          embed: collectEmbedTelemetryContext(partner),
        },
      });
      if (isMetaIntentResult(response)) {
        dispatch({
          type: "finish",
          revision,
          outcome: { kind: "meta", message: response.response },
        });
      } else {
        dispatch({
          type: "finish",
          revision,
          outcome: {
            kind: "risk",
            result: { ...(response as CheckResult), reportedBankSms: reportedBankSms(input) },
          },
        });
      }
    } catch (e: unknown) {
      dispatch({
        type: "finish",
        revision,
        outcome: { kind: "error", message: safeCheckErrorMessage(e, lang) },
      });
    }
  }

  const placeholder = {
    ru: "Номер, Telegram, ссылка или текст сообщения…",
    uz: "Raqam, Telegram, havola yoki xabar matni…",
    en: "Number, Telegram, link or message text…",
  }[lang];

  return (
    <section className="vp-home vp-widget">
      <div className="vp-formcard vp-widget-card">
        <header className="vp-formcard-head">
          <span className="vp-checker-label">Ishonch Guard</span>
          <span className="vp-tag">{lang}</span>
        </header>

        <div className="vp-formcard-body">
          <div>
            <h1 className="vp-widget-title">
              {
                {
                  ru: "Проверка риска",
                  uz: "Xavfni tekshirish",
                  en: "Risk check",
                }[lang]
              }
            </h1>
            <p className="vp-widget-lead">
              {
                {
                  ru: "Вставьте подозрительный номер, ссылку или сообщение. Проверка идёт через Ishonch Guard, партнёр не видит ваш ввод.",
                  uz: "Shubhali raqam, havola yoki xabarni kiriting. Tekshiruv Ishonch Guard orqali o‘tadi, hamkor kiritgan matningizni ko‘rmaydi.",
                  en: "Paste a suspicious number, link or message. The check runs through Ishonch Guard; the partner does not see your input.",
                }[lang]
              }
            </p>
            {partner && (
              <p className="vp-widget-partner">
                {
                  {
                    ru: "Встроено на:",
                    uz: "Joylashtirgan:",
                    en: "Embedded by:",
                  }[lang]
                }{" "}
                {partner}
              </p>
            )}
          </div>

          <div className="vp-field">
            <label htmlFor="embed-check-input">
              {
                {
                  ru: "Что проверить",
                  uz: "Nimani tekshirish",
                  en: "What to check",
                }[lang]
              }
            </label>
            <textarea
              id="embed-check-input"
              value={value}
              maxLength={MAX_INPUT_CHARS}
              onBlur={() => setTouched(true)}
              onChange={(event) => dispatch({ type: "edit", text: event.target.value })}
              placeholder={placeholder}
              className="vp-input"
            />
            <div className="vp-widget-meta">
              <span className="vp-widget-error" aria-live="polite">
                {validation ?? error ?? ""}
              </span>
              <span>
                {value.trim().length}/{MAX_INPUT_CHARS}
              </span>
            </div>
          </div>

          {/* Clickable when empty: runCheck explains what to paste. */}
          <PillButton
            onClick={runCheck}
            disabled={loading}
            className="vp-formcard-submit"
            icon={
              loading ? (
                <CircleNotch weight="bold" className="vp-spin" />
              ) : (
                <MagnifyingGlass weight="bold" />
              )
            }
          >
            {loading ? t("checking", lang) : t("check_now", lang)}
          </PillButton>

          {metaResponse && <div className="vp-alert">{truncate(metaResponse, 420)}</div>}

          {result && <EmbedResult result={result} lang={lang} />}
        </div>

        <footer className="vp-formcard-foot">
          <span>{t("privacy_promise", lang)}</span>
          <a href="/" target="_blank" rel="noreferrer">
            {
              {
                ru: "Открыть полный Ishonch Guard",
                uz: "Ishonch Guard’ning to‘liq saytini ochish",
                en: "Open full Ishonch Guard",
              }[lang]
            }
          </a>
        </footer>
      </div>
    </section>
  );
}

function collectEmbedTelemetryContext(partner?: string | null): EmbedTelemetryContext {
  return {
    partner: partner ?? null,
    referrer: typeof document === "undefined" ? null : document.referrer || null,
  };
}

export function EmbedResult({
  result,
  lang,
  reportedBankSms: reportedBankSmsHint,
}: {
  result: CheckResult;
  lang: Lang;
  reportedBankSms?: BankSmsKind | null;
}) {
  const style = LEVEL_COPY[result.level];
  const Icon = style.icon;
  const passport = buildRiskPassportSummary(result, lang);
  const advice = filterAdvice(result.level, result.reasons, lang, {
    reportedBankSms: reportedBankSmsHint ?? result.reportedBankSms,
  });
  const fallback = ADVICE[result.level][lang];
  const topAdvice = (advice.length > 0 ? advice : fallback).slice(0, 2);
  const reasons = passport ? [] : result.reasons.slice(0, 3);

  return (
    <div className={`vp-widget-result vp-widget-result--${result.level}`}>
      <div className="vp-widget-result-head">
        <span className="vp-widget-result-icon" aria-hidden="true">
          <Icon weight="fill" />
        </span>
        <div>
          <p className="vp-widget-result-eyebrow">{passport?.eyebrow ?? style.label[lang]}</p>
          <h2>{passport?.title ?? style.title[lang]}</h2>
        </div>
      </div>
      {passport ? (
        <EmbedRiskPassport passport={passport} />
      ) : (
        result.explanation && (
          <p className="vp-widget-result-text">{truncate(result.explanation)}</p>
        )
      )}

      {reasons.length > 0 && (
        <div className="vp-widget-result-block">
          <h3>{{ ru: "Что заметили", uz: "Nimani aniqladik", en: "What we noticed" }[lang]}</h3>
          <ul className="vp-list vp-list--dot">
            {reasons.map((reason) => (
              <li key={reason}>{REASON_LABELS[reason]?.[lang] ?? reason}</li>
            ))}
          </ul>
        </div>
      )}

      {!passport && (
        <div className="vp-widget-result-block">
          <h3>{t("what_to_do", lang)}</h3>
          <ul className="vp-list vp-list--check">
            {topAdvice.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EmbedRiskPassport({ passport }: { passport: RiskPassportSummary }) {
  const sections = compactPassportSections(passport);

  return (
    <div className="vp-widget-passport">
      {sections.map((section, index) => (
        <EmbedRiskPassportSection section={section} key={`${section.id}-${index}`} />
      ))}
    </div>
  );
}

function compactPassportSections(passport: RiskPassportSummary): RiskPassportSection[] {
  const body = passport.sections.filter((section) => section.id !== "next_step").slice(0, 3);
  const nextStep = passport.sections.find((section) => section.id === "next_step");
  return nextStep ? [...body, nextStep] : body;
}

function EmbedRiskPassportSection({ section }: { section: RiskPassportSection }) {
  return (
    <section className="vp-widget-result-block">
      <h3>{section.title}</h3>
      <ul className="vp-list vp-list--dot">
        {section.lines.slice(0, 2).map((line, index) => (
          <li key={`${line}-${index}`}>{truncate(line, 150)}</li>
        ))}
      </ul>
    </section>
  );
}
