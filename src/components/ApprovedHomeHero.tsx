import type { RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDown, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { CheckInput } from "@/components/CheckInput";
import { FancyButton } from "@/components/FancyButton";
import { RiskResultCard, type CheckResult } from "@/components/RiskResultCard";
import type { Lang } from "@/lib/i18n";

type ApprovedHomeHeroProps = {
  lang: Lang;
  result: CheckResult | null;
  formRef: RefObject<HTMLDivElement | null>;
  onResult: (result: CheckResult | null) => void;
  onReset: () => void;
  onScrollToForm: () => void;
};

const heroCopy = {
  ru: {
    eyebrow: "Антискам-помощник для Узбекистана",
    line1: "Не доверяйте",
    line2: "на слово.",
    line3: "Проверьте.",
    lead: "Вставьте номер, Telegram, ссылку или сообщение. Получите понятный уровень риска и один безопасный следующий шаг.",
    check: "Проверить сейчас",
    telegram: "Открыть Telegram-бот",
    noSignup: "Без регистрации",
    privacy: "Исходные данные не публикуем",
    kicker: "Быстрая проверка",
    formTitle: "Что хотите проверить?",
    ready: "Готово",
    reset: "Сбросить",
  },
  uz: {
    eyebrow: "O‘zbekiston uchun antiskam-yordamchi",
    line1: "So‘zga darrov",
    line2: "ishonmang.",
    line3: "Tekshiring.",
    lead: "Raqam, Telegram, havola yoki xabarni kiriting. Tushunarli xavf darajasi va bitta xavfsiz keyingi qadamni oling.",
    check: "Hozir tekshirish",
    telegram: "Telegram-botni ochish",
    noSignup: "Ro‘yxatdan o‘tmasdan",
    privacy: "Asl ma’lumotlarni e’lon qilmaymiz",
    kicker: "Tezkor tekshiruv",
    formTitle: "Nimani tekshirmoqchisiz?",
    ready: "Tayyor",
    reset: "Tozalash",
  },
  en: {
    eyebrow: "Anti-scam helper for Uzbekistan",
    line1: "Don’t take it",
    line2: "on trust.",
    line3: "Check it.",
    lead: "Paste a number, Telegram handle, link or message. Get a clear risk level and one safe next step.",
    check: "Check now",
    telegram: "Open Telegram bot",
    noSignup: "No signup",
    privacy: "Original submissions are not published",
    kicker: "Quick check",
    formTitle: "What do you want to check?",
    ready: "Ready",
    reset: "Reset",
  },
} satisfies Record<Lang, Record<string, string>>;

export function ApprovedHomeHero({
  lang,
  result,
  formRef,
  onResult,
  onReset,
  onScrollToForm,
}: ApprovedHomeHeroProps) {
  const copy = heroCopy[lang];

  return (
    <section className="signal-hero" id="top">
      <div className="signal-hero-copy">
        <div className="signal-eyebrow">
          <span className="signal-live-dot" />
          {copy.eyebrow}
        </div>
        <h1>
          <span>{copy.line1}</span>
          <span className="signal-hero-accent">{copy.line2}</span>
          <span>{copy.line3}</span>
        </h1>
        <p className="signal-hero-lead">{copy.lead}</p>
        <div className="signal-hero-actions">
          <FancyButton type="button" onClick={onScrollToForm} showArrow={false}>
            {copy.check}
            <ArrowDown aria-hidden="true" />
          </FancyButton>
          <a
            className="signal-text-link"
            href="https://t.me/scamguard_bot"
            target="_blank"
            rel="noreferrer"
          >
            <Send aria-hidden="true" />
            {copy.telegram}
          </a>
        </div>
        <div className="signal-trust-points">
          <span>
            <LockKeyhole aria-hidden="true" />
            {copy.noSignup}
          </span>
          <span>
            <ShieldCheck aria-hidden="true" />
            {copy.privacy}
          </span>
          <span>RU · UZ · EN</span>
        </div>
      </div>

      <div className="signal-checker" id="checker" ref={formRef}>
        <div className="signal-checker-heading">
          <div>
            <span>{copy.kicker}</span>
            <h2>{copy.formTitle}</h2>
          </div>
          <em>
            <i />
            {copy.ready}
          </em>
        </div>
        <CheckInput hideInlineResult onResult={onResult} />
        {result && (
          <div className="signal-result">
            <div className="signal-result-actions">
              <button type="button" onClick={onReset}>
                {copy.reset}
              </button>
              <Link to="/report">
                {lang === "ru"
                  ? "Сообщить о случае"
                  : lang === "uz"
                    ? "Hodisa haqida xabar berish"
                    : "Report a case"}
              </Link>
            </div>
            <RiskResultCard result={result} />
          </div>
        )}
      </div>
    </section>
  );
}
