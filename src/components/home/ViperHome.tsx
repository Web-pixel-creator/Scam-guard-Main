import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowBendUpRight,
  CaretLeft,
  Check,
  Image as ImageIcon,
  Lock,
  Megaphone,
  PaperPlaneTilt,
  Plus,
  ShieldCheck,
  Translate,
  WarningCircle,
} from "@phosphor-icons/react";
import { Dots, MetaBar, Pill, Rich } from "@/components/viper/kit";
import { getPublicStats } from "@/lib/check.functions";
import { useLang } from "@/lib/lang-context";
import { getActiveVerifiedContacts } from "@/lib/risk/verified-contacts";
import { HeroChecker, HeroChips, KindsBand, UrgentPlans, UrgentPlaque } from "./blocks";
import { HOME_COPY } from "./home-copy";

const TELEGRAM_BOT_URL = "https://t.me/scamguard_bot";
// Public totals stay hidden until they are large enough to reassure rather
// than undermine trust; the verified directory count is always shown.
const MIN_PUBLIC_CHECKS = 1000;

// Icons follow the order of `bot.rows` in the copy.
const BOT_ROW_ICONS = [ArrowBendUpRight, ImageIcon, Translate] as const;

// Fixed multilingual illustration for the "in your language" card.
const LANGUAGE_VERDICTS = [
  ["Yuqori xavf", "SMS-kod so‘ralmoqda"],
  ["High risk", "Asks for an SMS code"],
  ["Высокий риск", "Просят код из SMS"],
] as const;

export function ViperHome() {
  const { lang } = useLang();
  const copy = HOME_COPY[lang];
  const [faqOpen, setFaqOpen] = useState(0);

  const statsFn = useServerFn(getPublicStats);
  const { data: publicStats } = useQuery({
    queryKey: ["check-stats"],
    queryFn: () => statsFn({ data: undefined }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const totalChecks = publicStats?.total ?? 0;

  const verifiedContacts = getActiveVerifiedContacts();
  const directoryStats = [
    verifiedContacts.length,
    new Set(verifiedContacts.map((c) => c.org.ru)).size,
    verifiedContacts.filter((c) => c.orgType === "bank" && c.contactType !== "telegram").length,
  ];
  const numberFormat = new Intl.NumberFormat(
    lang === "en" ? "en-US" : lang === "uz" ? "uz-UZ" : "ru-RU",
  );

  const moreLinks = [
    { to: "/scam-trends", icon: WarningCircle },
    { to: "/report", icon: Megaphone },
    { to: "/privacy", icon: Lock },
  ] as const;

  return (
    <div className="vp-home" id="top">
      {/* HERO — two-tone headline, reassurance and the shared checker card */}
      <section className="vp-hero">
        <span className="vp-shape vp-shape--hero-right" aria-hidden="true" />
        <div className="vp-shell vp-hero-grid">
          <div className="vp-hero-copy">
            <div className="vp-eyebrow">
              <span aria-hidden="true">
                <ShieldCheck weight="bold" />
              </span>
              {copy.hero.eyebrow}
            </div>
            <h1 className="vp-hero-title">
              <span>{copy.hero.title[0]}</span>
              <span>{copy.hero.title[1]}</span>
            </h1>
            <p className="vp-hero-lead">
              <Rich text={copy.hero.lead} />
            </p>
            <HeroChips
              extra={
                totalChecks >= MIN_PUBLIC_CHECKS
                  ? `${numberFormat.format(totalChecks)} ${copy.hero.checks}`
                  : undefined
              }
            />
            <UrgentPlaque target="#help" />
            <div className="vp-hero-bot">
              <a href={TELEGRAM_BOT_URL} target="_blank" rel="noreferrer">
                {copy.hero.bot}
                <PaperPlaneTilt aria-hidden="true" />
              </a>
              <span>{copy.hero.botNote}</span>
            </div>
          </div>

          <HeroChecker />
        </div>

        {/* WHAT YOU CAN CHECK — Nubo-style spec cards under the hero */}
        <KindsBand />
      </section>

      {/* HOW IT WORKS — statement and the three steps */}
      <section className="vp-section" id="how">
        <div className="vp-shell">
          <MetaBar label={copy.how.label} index={1} />
          <p className="vp-statement">
            {copy.how.statement[0]}
            <em>{copy.how.statement[1]}</em>
          </p>
          <div className="vp-steps">
            {copy.how.steps.map((step, index) => (
              <article className="vp-step" key={step.title}>
                <div className="vp-step-top">
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <Dots on={index + 1} />
                </div>
                {/* One forwarded scam followed through the three steps. */}
                <div className={`vp-step-demo vp-step-demo--${index + 1}`} aria-hidden="true">
                  {index === 0 && (
                    <>
                      <small>{copy.bot.chatForwarded}</small>
                      <span>{copy.bot.chatScam}</span>
                      <i>
                        <ArrowRight weight="bold" />
                      </i>
                    </>
                  )}
                  {index === 1 && (
                    <>
                      <span className="vp-step-verdict">{copy.bot.chatVerdict}</span>
                      <span>{copy.bot.chatReason}</span>
                    </>
                  )}
                  {index === 2 && (
                    <>
                      <i>
                        <Check weight="bold" />
                      </i>
                      <span>{copy.bot.chatNext}</span>
                    </>
                  )}
                </div>
                <h3>{step.title}</h3>
                <p>
                  <Rich text={step.text} />
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* TELEGRAM BOT — Viper "benefits" trio of tall cards */}
      <section className="vp-section vp-bot-section" id="bot">
        <span className="vp-shape vp-shape--left" aria-hidden="true" />
        <span className="vp-shape vp-shape--right" aria-hidden="true" />
        <div className="vp-shell">
          <MetaBar label={copy.bot.label} index={2} />
          <div className="vp-center-head">
            <span className="vp-badge">
              <PaperPlaneTilt aria-hidden="true" />
              {copy.bot.badge}
            </span>
            <h2 className="vp-display">{copy.bot.title}</h2>
            <p className="vp-lead">{copy.bot.lead}</p>
          </div>

          <div className="vp-benefits">
            <article className="vp-benefit vp-benefit--fast">
              <span className="vp-corner vp-corner--tl" aria-hidden="true" />
              <span className="vp-corner vp-corner--br" aria-hidden="true" />
              <div>
                <h3>{copy.bot.fastTitle}</h3>
                <p>{copy.bot.fastText}</p>
              </div>
              <div className="vp-benefit-motion" aria-hidden="true">
                <span className="vp-benefit-bubble">
                  <small>{copy.bot.chatForwarded}</small>
                  {copy.bot.chatScam}
                  <span className="vp-benefit-send">
                    <ArrowBendUpRight weight="bold" />
                  </span>
                </span>
              </div>
              <span className="vp-benefit-mark" aria-hidden="true">
                Ishonch<b>*</b>
              </span>
            </article>

            <article className="vp-benefit vp-benefit--lang">
              <div className="vp-benefit-inner">
                <span className="vp-kicker">Русский · O‘zbekcha · English</span>
                <h3>{copy.bot.langTitle}</h3>
                <div className="vp-verdict-stack" aria-hidden="true">
                  {LANGUAGE_VERDICTS.map(([level, reason]) => (
                    <div key={level}>
                      <span>
                        <span>
                          <i />
                          {level}
                        </span>
                        <small>75/100</small>
                      </span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="vp-benefit vp-benefit--reply">
              <span className="vp-corner vp-corner--tr" aria-hidden="true" />
              <span className="vp-kicker">{copy.bot.replyKicker}</span>
              <h3>{copy.bot.replyTitle}</h3>
              <p>{copy.bot.replyText}</p>
              <div className="vp-mini-phone" aria-hidden="true">
                <div className="vp-mini-screen">
                  <div className="vp-mini-bar">
                    <CaretLeft weight="bold" />
                    <span className="vp-mini-avatar">
                      <ShieldCheck weight="fill" />
                    </span>
                    <span>
                      <strong>Ishonch Guard</strong>
                      <small>{copy.bot.chatSubtitle}</small>
                    </span>
                  </div>
                  <div className="vp-mini-chat">
                    <div className="vp-mini-in">
                      <small>{copy.bot.chatForwarded}</small>
                      {copy.bot.chatScam}
                    </div>
                    <div className="vp-mini-bot">
                      <span className="vp-mini-verdict">{copy.bot.chatVerdict}</span>
                      <span>{copy.bot.chatReason}</span>
                      <span className="vp-mini-next">{copy.bot.chatNext}</span>
                    </div>
                    <div className="vp-mini-keys">
                      {copy.bot.chatButtons.map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div className="vp-botcard">
            <div className="vp-botcard-cta">
              <span className="vp-botcard-handle">
                <PaperPlaneTilt weight="fill" aria-hidden="true" />
                @scamguard_bot
              </span>
              <h3>{copy.bot.rowsTitle}</h3>
              <p>{copy.bot.rowsText}</p>
              <Pill href={TELEGRAM_BOT_URL} external tone="white">
                {copy.bot.rowsCta}
              </Pill>
            </div>
            <ul className="vp-botcard-rows">
              {copy.bot.rows.map(([name, detail, value], index) => {
                const Icon = BOT_ROW_ICONS[index];
                return (
                  <li key={name}>
                    <span className="vp-botcard-icon" aria-hidden="true">
                      <Icon weight="bold" />
                    </span>
                    <span className="vp-botcard-text">
                      <strong>{name}</strong>
                      <span>{detail}</span>
                    </span>
                    <span className="vp-botcard-value">{value}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* URGENT — Viper pricing cards built from the verified directory */}
      <section className="vp-section vp-urgent-section" id="help">
        <span className="vp-shape vp-shape--left" aria-hidden="true" />
        <span className="vp-shape vp-shape--right" aria-hidden="true" />
        <div className="vp-shell">
          <MetaBar label={copy.urgent.label} index={3} />
          <div className="vp-center-head">
            <span className="vp-badge">
              <WarningCircle weight="bold" aria-hidden="true" />
              {copy.urgent.badge}
            </span>
            <h2 className="vp-display">{copy.urgent.title}</h2>
            <p className="vp-lead">{copy.urgent.lead}</p>
            <Pill to="/emergency">{copy.urgent.guide}</Pill>
          </div>

          <UrgentPlans />

          <div className="vp-rows-block">
            <div>
              <h3 className="vp-rows-title">{copy.urgent.stepsTitle}</h3>
              <p className="vp-lead">{copy.urgent.stepsLead}</p>
            </div>
            <div>
              <ol className="vp-rows vp-rows--steps">
                {copy.urgent.steps.map(([title, detail], index) => (
                  <li key={title}>
                    <span className="vp-step-num">{index + 1}</span>
                    <span className="vp-step-text">
                      <strong>{title}</strong>
                      <span>{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="vp-note">
                <ShieldCheck weight="fill" aria-hidden="true" />
                {copy.urgent.note}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* DIRECTORY — Viper centred feature block with hairline stat cells */}
      <section className="vp-section vp-directory" id="official">
        <div className="vp-shell">
          <MetaBar label={copy.directory.label} index={4} />
          <div className="vp-directory-head">
            <span className="vp-badge">
              <ShieldCheck weight="fill" aria-hidden="true" />
              {copy.directory.badge}
            </span>
            <h2 className="vp-h2">{copy.directory.title}</h2>
            <p className="vp-lead">{copy.directory.lead}</p>
            <Pill to="/official-numbers">{copy.directory.cta}</Pill>
          </div>
          <div className="vp-stats">
            {copy.directory.stats.map(([label, text], index) => (
              <article key={label}>
                <div className="vp-stat-top">
                  <span>{label}</span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <b>{numberFormat.format(directoryStats[index])}</b>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <p className="vp-note">
            <ShieldCheck weight="fill" aria-hidden="true" />
            {copy.directory.note}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="vp-section" id="faq">
        <div className="vp-shell">
          <MetaBar label={copy.faq.label} index={5} />
          <div className="vp-faq">
            <div className="vp-faq-intro">
              <h2 className="vp-h2">{copy.faq.title}</h2>
              <p className="vp-lead">{copy.faq.lead}</p>
              <Pill to="/emergency">{copy.urgent.guide}</Pill>
            </div>
            <div className="vp-faq-list">
              {copy.faq.items.map((item, index) => {
                const open = faqOpen === index;
                return (
                  <div className={`vp-faq-item${open ? " is-open" : ""}`} key={item.q}>
                    <button
                      type="button"
                      className="vp-faq-q"
                      id={`faq-q-${index}`}
                      aria-expanded={open}
                      aria-controls={`faq-a-${index}`}
                      onClick={() => setFaqOpen(open ? -1 : index)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span>{item.q}</span>
                      <span className="vp-faq-icon" aria-hidden="true">
                        <Plus weight="bold" />
                      </span>
                    </button>
                    <div
                      className="vp-faq-a"
                      id={`faq-a-${index}`}
                      role="region"
                      aria-labelledby={`faq-q-${index}`}
                      hidden={!open}
                    >
                      <div>
                        <p>{item.a}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* MORE — schemes, reporting and privacy live on their own pages */}
      <section className="vp-section">
        <div className="vp-shell">
          <MetaBar label={copy.more.label} index={6} />
          <div className="vp-more">
            {moreLinks.map(({ to, icon: Icon }, index) => (
              <Link key={to} to={to}>
                <span className="vp-more-top">
                  <Icon weight="fill" aria-hidden="true" />
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <h3>{copy.more.cards[index].title}</h3>
                <p>
                  <Rich text={copy.more.cards[index].text} />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
