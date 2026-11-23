import { createFileRoute } from "@tanstack/react-router";
import { ChatCircleText, Check, Flag, Plus, ShieldWarning } from "@phosphor-icons/react";
import { PageHero, Pill } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";
import { SCAM_PATTERNS, type ScamPattern, type ScamSeverity } from "@/lib/scam-patterns";

export const Route = createFileRoute("/scams")({
  component: ScamsPage,
});

const SEVERITY_LABEL: Record<ScamSeverity, Record<"ru" | "uz" | "en", string>> = {
  critical: { ru: "Критический", uz: "Kritik", en: "Critical" },
  high: { ru: "Высокий", uz: "Yuqori", en: "High" },
  medium: { ru: "Средний", uz: "O‘rtacha", en: "Medium" },
  low: { ru: "Низкий", uz: "Past", en: "Low" },
};

const COPY = {
  ru: {
    eyebrow: "Схемы мошенничества",
    title: ["Схемы мошенничества.", "Как их узнать заранее."],
    lead: "**Самые распространённые схемы обмана в Узбекистане**: как они начинаются, по каким признакам их узнать и что делать.",
    flags: "Красные флаги",
    todo: "Что делать",
    examples: "Примеры сообщений",
    listTitle: "Все схемы",
    check: "Проверить сообщение",
    report: "Сообщить о случае",
    disclaimer:
      "Ishonch Guard помогает сориентироваться, но не заменяет банк или правоохранительные органы.",
  },
  uz: {
    eyebrow: "Firibgarlik sxemalari",
    title: ["Firibgarlik sxemalari.", "Ularni oldindan qanday tanish mumkin."],
    lead: "**O‘zbekistondagi eng keng tarqalgan firibgarlik sxemalari**: qanday boshlanadi, qaysi belgilardan taniladi va nima qilish kerak.",
    flags: "Xavf belgilari",
    todo: "Nima qilish kerak",
    examples: "Xabar namunalari",
    listTitle: "Barcha sxemalar",
    check: "Xabarni tekshirish",
    report: "Holat haqida xabar berish",
    disclaimer:
      "Ishonch Guard yo‘l-yo‘riq beradi, lekin bank yoki huquq-tartibot organlarini almashtirmaydi.",
  },
  en: {
    eyebrow: "Scam schemes",
    title: ["Scam schemes.", "How to spot them early."],
    lead: "**The most common fraud schemes in Uzbekistan**: how they start, the signs that give them away and what to do.",
    flags: "Red flags",
    todo: "What to do",
    examples: "Example messages",
    listTitle: "All schemes",
    check: "Check a message",
    report: "Report an incident",
    disclaimer: "Ishonch Guard helps you orient, but does not replace banks or law enforcement.",
  },
} as const;

function ScamCard({ pattern, index }: { pattern: ScamPattern; index: number }) {
  const { lang } = useLang();
  const copy = COPY[lang];

  return (
    <article className={`vp-scheme vp-scheme--${pattern.severity}`}>
      <div className="vp-card-top">
        <span className={`vp-tag vp-tag--${pattern.severity}`}>
          {SEVERITY_LABEL[pattern.severity][lang]}
        </span>
        <span>{String(index + 1).padStart(2, "0")}</span>
      </div>
      <h3>{pattern.title[lang]}</h3>
      <p className="vp-card-text">{pattern.description[lang]}</p>

      <div className="vp-scheme-lists">
        <div>
          <h4 className="vp-scheme-flags">
            <Flag weight="fill" aria-hidden="true" />
            {copy.flags}
          </h4>
          <ul className="vp-list vp-list--flags">
            {pattern.redFlags[lang].map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="vp-scheme-todo">
            <Check weight="bold" aria-hidden="true" />
            {copy.todo}
          </h4>
          <ul className="vp-list vp-list--todo">
            {pattern.whatToDo[lang].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </div>

      <details className="vp-disclosure">
        <summary>
          <ChatCircleText weight="bold" aria-hidden="true" />
          {copy.examples}
          <Plus weight="bold" aria-hidden="true" className="vp-disclosure-icon" />
        </summary>
        <ul>
          {pattern.examples[lang].map((example) => (
            <li key={example}>{example}</li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function ScamsPage() {
  const { lang } = useLang();
  const copy = COPY[lang];

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <PageHero
          icon={<ShieldWarning weight="bold" />}
          eyebrow={copy.eyebrow}
          title={copy.title}
          lead={copy.lead}
        >
          <div className="vp-actions">
            <Pill to="/check">{copy.check}</Pill>
            <Pill to="/report" tone="outline">
              {copy.report}
            </Pill>
          </div>
        </PageHero>

        {/* Screen-reader section heading: cards use h3 and must not follow h1 directly. */}
        <h2 className="sr-only">{copy.listTitle}</h2>
        <div className="vp-schemes vp-page-section">
          {SCAM_PATTERNS.map((pattern, index) => (
            <ScamCard key={pattern.id} pattern={pattern} index={index} />
          ))}
        </div>

        <p className="vp-note vp-page-note">
          <ShieldWarning weight="fill" aria-hidden="true" />
          {copy.disclaimer}
        </p>
      </div>
    </div>
  );
}
