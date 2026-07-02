import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  ShieldAlert,
  ShieldQuestion,
} from "lucide-react";

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

const MAX_INPUT_CHARS = 1000;
const MIN_INPUT_CHARS = 3;

type EmbedCheckWidgetProps = {
  lang: Lang;
  partner?: string | null;
};

const LEVEL_COPY: Record<
  RiskLevel,
  {
    icon: typeof CheckCircle2;
    tone: string;
    title: Record<Lang, string>;
    label: Record<Lang, string>;
  }
> = {
  safe: {
    icon: CheckCircle2,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
    title: {
      ru: "Явных признаков скама не найдено",
      uz: "Aniq scam belgisi topilmadi",
      en: "No clear scam signals found",
    },
    label: { ru: "Безопасно", uz: "Xavfsiz", en: "Safe" },
  },
  unknown: {
    icon: ShieldQuestion,
    tone: "border-zinc-200 bg-zinc-50 text-zinc-900",
    title: {
      ru: "Нужно больше контекста",
      uz: "Ko'proq kontekst kerak",
      en: "More context needed",
    },
    label: { ru: "Недостаточно данных", uz: "Ma'lumot yetarli emas", en: "Not enough data" },
  },
  suspicious: {
    icon: AlertTriangle,
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    title: {
      ru: "Есть подозрительные признаки",
      uz: "Shubhali belgilar bor",
      en: "Suspicious signs found",
    },
    label: { ru: "Осторожно", uz: "Ehtiyot bo'ling", en: "Caution" },
  },
  high_risk: {
    icon: ShieldAlert,
    tone: "border-red-200 bg-red-50 text-red-950",
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
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [metaResponse, setMetaResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(
    () => (touched ? validationMessage(value, lang) : null),
    [lang, touched, value],
  );

  async function runCheck() {
    setTouched(true);
    const message = validationMessage(value, lang);
    if (message) {
      setError(message);
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setMetaResponse(null);
    try {
      const response = await checkFn({
        data: { input: value.trim().slice(0, MAX_INPUT_CHARS), lang },
      });
      if (isMetaIntentResult(response)) {
        setMetaResponse(response.response);
      } else {
        setResult(response as CheckResult);
      }
    } catch (e: unknown) {
      setError(safeCheckErrorMessage(e, lang));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = value.trim().length >= MIN_INPUT_CHARS && !loading && !validation;
  const placeholder = {
    ru: "Номер, Telegram, ссылка или текст сообщения…",
    uz: "Raqam, Telegram, havola yoki xabar matni…",
    en: "Number, Telegram, link or message text…",
  }[lang];

  return (
    <section className="min-h-screen bg-[#FCFAF9] text-[#18181B]">
      <div className="mx-auto flex min-h-screen max-w-[520px] flex-col border border-[#E2E0D8] bg-white shadow-[0_18px_55px_-34px_rgba(11,11,15,0.35)]">
        <header className="border-b border-[#E2E0D8] bg-[#F4F2EB] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#C2410C]">
                Ishonch Guard
              </p>
              <h1 className="mt-1 text-[18px] font-extrabold leading-tight tracking-[-0.02em]">
                {
                  {
                    ru: "Проверка риска",
                    uz: "Xavfni tekshirish",
                    en: "Risk check",
                  }[lang]
                }
              </h1>
            </div>
            <span className="rounded-[4px] border border-[#E2E0D8] bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#52525B]">
              {lang}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#52525B]">
            {
              {
                ru: "Вставьте подозрительный номер, ссылку или сообщение. Проверка идёт через Ishonch Guard, партнёр не видит ваш ввод.",
                uz: "Shubhali raqam, havola yoki xabarni kiriting. Tekshiruv Ishonch Guard orqali o'tadi, hamkor kiritgan matningizni ko'rmaydi.",
                en: "Paste a suspicious number, link or message. The check runs through Ishonch Guard; the partner does not see your input.",
              }[lang]
            }
          </p>
          {partner && (
            <p className="mt-2 text-[11px] font-medium text-[#71717A]">
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
        </header>

        <div className="flex-1 px-5 py-5">
          <label className="block text-[12px] font-bold uppercase tracking-[0.14em] text-[#71717A]">
            {
              {
                ru: "Что проверить",
                uz: "Nimani tekshirish",
                en: "What to check",
              }[lang]
            }
          </label>
          <textarea
            value={value}
            maxLength={MAX_INPUT_CHARS}
            onBlur={() => setTouched(true)}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
              setResult(null);
              setMetaResponse(null);
            }}
            placeholder={placeholder}
            className="mt-2 min-h-[118px] w-full resize-none rounded-[6px] border border-[#E2E0D8] bg-white px-3.5 py-3 text-[14px] leading-relaxed text-[#18181B] outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[#71717A]">
            <span className="text-[#B91C1C]">{validation ?? error ?? ""}</span>
            <span>
              {value.trim().length}/{MAX_INPUT_CHARS}
            </span>
          </div>

          <button
            type="button"
            onClick={runCheck}
            disabled={!canSubmit}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#0B0B0F] px-4 text-[14px] font-bold text-white transition hover:bg-[#18181B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? t("checking", lang) : t("check_now", lang)}
          </button>

          <p className="mt-3 text-[11.5px] leading-relaxed text-[#71717A]">
            {t("privacy_promise", lang)}
          </p>

          {metaResponse && (
            <div className="mt-5 rounded-[6px] border border-[#E2E0D8] bg-[#FCFAF9] p-4 text-[13px] leading-relaxed text-[#3F3F46] whitespace-pre-line">
              {truncate(metaResponse, 420)}
            </div>
          )}

          {result && <EmbedResult result={result} lang={lang} />}
        </div>

        <footer className="border-t border-[#E2E0D8] px-5 py-3 text-[11px] text-[#71717A]">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#C2410C] underline decoration-[#FED7AA] underline-offset-4"
          >
            {
              {
                ru: "Открыть полный Ishonch Guard",
                uz: "To'liq Ishonch Guardni ochish",
                en: "Open full Ishonch Guard",
              }[lang]
            }
          </a>
        </footer>
      </div>
    </section>
  );
}

export function EmbedResult({ result, lang }: { result: CheckResult; lang: Lang }) {
  const style = LEVEL_COPY[result.level];
  const Icon = style.icon;
  const passport = buildRiskPassportSummary(result, lang);
  const advice = filterAdvice(result.level, result.reasons, lang);
  const fallback = ADVICE[result.level][lang];
  const topAdvice = (advice.length > 0 ? advice : fallback).slice(0, 2);
  const reasons = passport ? [] : result.reasons.slice(0, 3);

  return (
    <div className={`mt-5 rounded-[8px] border p-4 ${style.tone}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[5px] bg-white/70">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-75">
            {passport?.eyebrow ?? style.label[lang]}
          </p>
          <h2 className="mt-1 text-[17px] font-extrabold leading-snug tracking-[-0.02em]">
            {passport?.title ?? style.title[lang]}
          </h2>
          {passport ? (
            <EmbedRiskPassport passport={passport} />
          ) : (
            result.explanation && (
              <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed">
                {truncate(result.explanation)}
              </p>
            )
          )}
        </div>
      </div>

      {reasons.length > 0 && (
        <div className="mt-4 border-t border-current/15 pt-3">
          <p className="text-[12px] font-bold">
            {{ ru: "Что заметили", uz: "Nima ko'rindi", en: "What we noticed" }[lang]}
          </p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed">
            {reasons.map((reason) => (
              <li key={reason}>• {REASON_LABELS[reason]?.[lang] ?? reason}</li>
            ))}
          </ul>
        </div>
      )}

      {!passport && (
        <div className="mt-4 border-t border-current/15 pt-3">
          <p className="text-[12px] font-bold">{t("what_to_do", lang)}</p>
          <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed">
            {topAdvice.map((line) => (
              <li key={line}>• {line}</li>
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
    <div className="mt-3 space-y-3">
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
    <section className="border-t border-current/15 pt-2 first:border-t-0 first:pt-0">
      <p className="text-[12px] font-bold">{section.title}</p>
      <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed">
        {section.lines.slice(0, 2).map((line, index) => (
          <li key={`${line}-${index}`}>вЂў {truncate(line, 150)}</li>
        ))}
      </ul>
    </section>
  );
}
