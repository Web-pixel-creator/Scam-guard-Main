import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  AlertTriangle,
  Volume2,
  Square,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { ADVICE, REASON_LABELS, type ReasonCode, type RiskLevel } from "@/lib/risk/rules";
import { FancyShell } from "@/components/FancyButton";

export type CheckResult = {
  type: string;
  display: string;
  level: RiskLevel;
  score: number;
  reasons: ReasonCode[];
  explanation: string | null;
  knownReports: number;
  verifiedContact: { orgName: string; orgType: string; source: string } | null;
};

type LevelStyle = {
  icon: typeof ShieldCheck;
  key: string;
  accent: string; // hex used for dot/icon
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  tag: string; // SCAM/SAFE/WATCH text
  topBar: string; // gradient class for top stripe
};

const TAG_LABELS: Record<RiskLevel, { ru: string; uz: string; en: string }> = {
  safe: { ru: "Безопасно", uz: "Xavfsiz", en: "Safe" },
  unknown: { ru: "Неизвестно", uz: "Noma'lum", en: "Unknown" },
  suspicious: { ru: "Подозрительно", uz: "Shubhali", en: "Watch" },
  high_risk: { ru: "Обман", uz: "Aldov", en: "Scam" },
};

const LEVEL_STYLES: Record<RiskLevel, LevelStyle> = {
  safe: {
    icon: ShieldCheck,
    key: "risk_safe",
    accent: "#059669",
    badgeBg: "bg-[#ECFDF5]",
    badgeBorder: "border-[#A7F3D0]/70",
    badgeText: "text-[#065F46]",
    tag: "safe",
    topBar: "from-[#10B981] via-[#34D399] to-[#6EE7B7]",
  },
  unknown: {
    icon: ShieldQuestion,
    key: "risk_unknown",
    accent: "#71717A",
    badgeBg: "bg-[#F4F4F5]",
    badgeBorder: "border-[#E4E4E7]",
    badgeText: "text-[#3F3F46]",
    tag: "unknown",
    topBar: "from-[#FDBA74]/40 via-[#E2E0D8] to-[#FDBA74]/40",
  },
  suspicious: {
    icon: AlertTriangle,
    key: "risk_suspicious",
    accent: "#D97706",
    badgeBg: "bg-[#FFFBEB]",
    badgeBorder: "border-[#FCD34D]/70",
    badgeText: "text-[#92400E]",
    tag: "suspicious",
    topBar: "from-[#F59E0B] via-[#FBBF24] to-[#FCD34D]",
  },
  high_risk: {
    icon: ShieldAlert,
    key: "risk_high",
    accent: "#DC2626",
    badgeBg: "bg-[#FEF2F2]",
    badgeBorder: "border-[#FCA5A5]/60",
    badgeText: "text-[#991B1B]",
    tag: "high_risk",
    topBar: "from-[#F97316] via-[#FB923C] to-[#C2410C]",
  },
};

const TYPE_LABELS: Record<string, { ru: string; uz: string; en: string }> = {
  phone: { ru: "Телефон", uz: "Telefon", en: "Phone" },
  telegram: { ru: "Telegram", uz: "Telegram", en: "Telegram" },
  url: { ru: "Ссылка", uz: "Havola", en: "Link" },
  text: { ru: "Текст сообщения", uz: "Xabar matni", en: "Message text" },
  unknown: { ru: "Запрос", uz: "So‘rov", en: "Input" },
};

export function RiskResultCard({ result }: { result: CheckResult }) {
  const { lang } = useLang();
  const s = LEVEL_STYLES[result.level];
  const Icon = s.icon;
  const advice = ADVICE[result.level][lang];
  const isHot = result.level === "high_risk" || result.level === "suspicious";
  const isUnknown = result.level === "unknown";
  const typeLabel = TYPE_LABELS[result.type]?.[lang] ?? result.type;
  const displayScore = Math.min(100, Math.max(0, Math.round(result.score)));

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

  return (
    <div className="apex-shell">
      <div className="relative bg-white">
        <div
          className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${s.topBar} z-[1]`}
        />
        <div className="p-7 sm:p-9 md:p-10">
          {/* Header strip */}
          <div className="flex items-center justify-between gap-4 mb-8 pb-5 border-b border-[#E2E0D8]">
            <span className="apex-mono inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {isHot && (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
                    style={{ backgroundColor: s.accent }}
                  />
                )}
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: s.accent }}
                />
              </span>
              {{ ru: "Результат", uz: "Natija", en: "Result" }[lang]}
            </span>
            <span className="apex-mono text-right tabular-nums">
              {isUnknown
                ? {
                    ru: "Оценка риска · Недостаточно данных",
                    uz: "Xavf bahosi · Ma'lumot yetarli emas",
                    en: "Risk score · Insufficient data",
                  }[lang]
                : `${{ ru: "Оценка", uz: "Baho", en: "Score" }[lang]} · ${displayScore}%`}
            </span>
          </div>

          {/* Read-aloud control — bigger tap target for elderly users */}
          <div className="-mt-4 mb-6 flex justify-end">
            <button
              type="button"
              onClick={speak}
              aria-pressed={speaking}
              className="inline-flex items-center gap-2 min-h-11 px-4 rounded-[6px] border border-[#E2E0D8] bg-white text-[13.5px] font-semibold text-[#18181B] hover:border-[#F97316] hover:text-[#C2410C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] transition-colors"
            >
              {speaking ? (
                <>
                  <Square
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={2}
                    fill="currentColor"
                  />
                  {{ ru: "Остановить чтение", uz: "O'qishni to'xtatish", en: "Stop reading" }[lang]}
                </>
              ) : (
                <>
                  <Volume2 aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                  {{ ru: "Прочитать вслух", uz: "Ovoz chiqarib o'qish", en: "Read aloud" }[lang]}
                </>
              )}
            </button>
          </div>

          {/* Title block */}
          <div className="flex items-start gap-5">
            <div
              className="grid h-12 w-12 place-items-center rounded-[4px] border border-[#E2E0D8] shrink-0"
              style={{ color: s.accent }}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 text-[12px] text-[#71717A]">
                <span>{{ ru: "Тип:", uz: "Turi:", en: "Type:" }[lang]}</span>
                <span className="text-[#18181B] font-medium">{typeLabel}</span>
                <span className="text-[#A1A1AA]">·</span>
                <span className="text-[#18181B] font-medium uppercase tracking-wider">
                  {TAG_LABELS[result.level][lang]}
                </span>
              </div>

              <h3 className="font-sans text-[26px] sm:text-3xl md:text-[34px] font-medium tracking-[-0.04em] text-[#18181B] leading-[1.1]">
                {t(s.key as never, lang)}
              </h3>
              {result.type === "text" ? (
                <blockquote className="mt-3 border-l-2 border-[#E2E0D8] pl-3 text-[13.5px] leading-[1.6] text-[#52525B] font-sans whitespace-pre-wrap break-words line-clamp-4">
                  {result.display}
                </blockquote>
              ) : (
                <p className="mt-2 font-mono text-[13.5px] text-[#52525B] break-all">
                  {result.display}
                </p>
              )}

              {result.explanation && (
                <p className="mt-5 text-[14.5px] md:text-[15px] leading-[1.65] text-[#52525B] whitespace-pre-line text-pretty">
                  {result.explanation}
                </p>
              )}
              {!result.explanation && result.reasons.includes("hosted_app_platform") && (
                <p className="mt-5 text-[14.5px] md:text-[15px] leading-[1.65] text-[#52525B] whitespace-pre-line text-pretty">
                  {
                    {
                      ru: "Этот адрес размещён на публичной платформе для веб-приложений. Сам домен не является признаком мошенничества, но владелец конкретной страницы не подтверждён.\n\nНе вводите OTP, PIN, CVV, пароли или данные карты, если не уверены в источнике ссылки.",
                      uz: "Bu manzil veb-ilovalar uchun ommaviy platformada joylashgan. Domen o'zi firibgarlik belgisi emas, lekin aniq sahifa egasi tasdiqlanmagan.\n\nAgar havola manbasiga ishonchingiz komil bo'lmasa, OTP, PIN, CVV, parol yoki karta ma'lumotlarini kiritmang.",
                      en: "This address is hosted on a public web application platform. The domain itself is not a sign of fraud, but the owner of this specific page is not verified.\n\nDo not enter OTP, PIN, CVV, passwords or card details unless you are sure about the link source.",
                    }[lang]
                  }
                </p>
              )}

              {/* Verified official contact match (D-011) */}
              {result.verifiedContact && (
                <div className="mt-5 p-4 rounded-lg border border-[#A7F3D0]/70 bg-[#ECFDF5]">
                  <p className="text-[14px] font-medium text-[#065F46] mb-2">
                    ✅{" "}
                    {
                      {
                        ru: "Номер совпадает с официальным контактом:",
                        uz: "Raqam rasmiy kontakt bilan mos keladi:",
                        en: "Number matches an official contact:",
                      }[lang]
                    }{" "}
                    {result.verifiedContact.orgName}
                  </p>
                  <p className="text-[13px] text-[#52525B] leading-[1.5]">
                    {
                      {
                        ru: "⚠️ Caller ID может быть подменён. Если вас просят SMS-код, PIN, CVV, пароль, установить приложение или перевести деньги — завершите разговор и перезвоните самостоятельно по официальному номеру.",
                        uz: "⚠️ Caller ID soxta bo'lishi mumkin. Agar sizdan SMS-kod, PIN, CVV, parol so'rashsa yoki ilova o'rnatishni/pul o'tkazishni aytishsa — suhbatni tugating va rasmiy raqamga o'zingiz qo'ng'iroq qiling.",
                        en: "⚠️ Caller ID can be spoofed. If someone asks for your SMS code, PIN, CVV, password, to install an app or transfer money — hang up and call back using the official number yourself.",
                      }[lang]
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reasons */}
          {result.reasons.length > 0 && (
            <div className="mt-8 pt-6 border-t border-[#E2E0D8]">
              <p className="label-md mb-4">{t("why_title", lang)}</p>
              <ul className="space-y-2.5">
                {result.reasons.map((r, idx) => (
                  <li key={r} className="flex gap-3 text-[14.5px] leading-[1.6] text-[#52525B]">
                    <span className="font-mono text-[12px] text-[#A1A1AA] shrink-0 mt-[2px] tabular-nums">
                      {(idx + 1).toString().padStart(2, "0")}
                    </span>
                    <span className="text-pretty">{REASON_LABELS[r]?.[lang] ?? r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Advice — emphasized as primary action block */}
          <div className="mt-8">
            <div className="rounded-[6px] border border-[#FDBA74]/40 bg-[#FFF7ED] p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                <p className="apex-mono text-[#9A3412]">{t("what_to_do", lang)}</p>
              </div>
              <ul className="space-y-3">
                {advice.map((a, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-[1.6] text-[#18181B]">
                    <span className="text-[#F97316] shrink-0 mt-[1px] font-semibold" aria-hidden>
                      →
                    </span>
                    <span className="text-pretty">{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#E2E0D8] flex flex-wrap items-center justify-between gap-4">
            <span className="apex-mono text-[#71717A]">
              {{ ru: "Жалобы", uz: "Shikoyatlar", en: "Reports" }[lang]} ·{" "}
              {result.knownReports > 0 ? result.knownReports : "0"}
            </span>

            <div className="flex flex-wrap gap-3">
              <Link to="/report" className="fancy-btn">
                <FancyShell>{t("report_btn", lang)}</FancyShell>
              </Link>
              {isHot && (
                <Link
                  to="/emergency"
                  className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#52525B] underline-offset-4 decoration-[#E2E0D8] hover:text-[#18181B] hover:underline hover:decoration-[#F97316] transition-colors self-center"
                >
                  {t("emergency_cta", lang)}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
