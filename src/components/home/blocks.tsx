import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ChatText,
  Check,
  Image as ImageIcon,
  Link as LinkIcon,
  Lock,
  Phone,
  WarningCircle,
} from "@phosphor-icons/react";
import { CheckInput } from "@/components/CheckInput";
import { RiskResultCard, type CheckResult } from "@/components/RiskResultCard";
import { useLang } from "@/lib/lang-context";
import { getPublicEmergencyContacts } from "@/lib/risk/public-emergency-contacts";
import { HOME_COPY } from "./home-copy";

/**
 * Homepage blocks reused by inner pages (/check, /emergency) so the checker,
 * "what you can check" cards and urgent call cards look and behave the same
 * everywhere.
 */

// Icons follow the order of `kinds.items` in the copy.
const KIND_ICONS = [Phone, LinkIcon, ChatText, ImageIcon] as const;

/** The framed checker card: live CheckInput, short result and full breakdown. */
export function HeroChecker() {
  const { lang } = useLang();
  const copy = HOME_COPY[lang].hero;
  const [result, setResult] = useState<CheckResult | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const getLabelId = useId();

  return (
    <div className="vp-checker" id="checker">
      <div className="vp-checker-head">
        <span className="vp-checker-label">{copy.checkerLabel}</span>
      </div>
      <div className="vp-checker-body">
        <h2>{copy.checkerTitle}</h2>
        <CheckInput
          onResult={(next) => {
            setResult(next);
            setDetailsOpen(false);
          }}
        />
        {result && (
          <>
            <button
              type="button"
              className="vp-details-toggle"
              aria-expanded={detailsOpen}
              aria-controls="check-details"
              onClick={() => setDetailsOpen((open) => !open)}
            >
              {detailsOpen ? copy.hideDetails : copy.details}
            </button>
            {detailsOpen && (
              <div className="vp-details" id="check-details">
                <RiskResultCard result={result} />
              </div>
            )}
          </>
        )}
      </div>
      <div className="vp-checker-foot">
        {!result && (
          <>
            <p className="vp-get-label" id={getLabelId}>
              {copy.getLabel}
            </p>
            <ul className="vp-get" aria-labelledby={getLabelId}>
              {copy.get.map(([title, detail]) => (
                <li key={title}>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="vp-checker-privacy">
          <Lock aria-hidden="true" />
          {copy.privacy}
        </p>
      </div>
    </div>
  );
}

/** "✓ Free ✓ No signup …" inline reassurance row. */
export function HeroChips({ extra }: { extra?: string }) {
  const { lang } = useLang();
  const chips = HOME_COPY[lang].hero.chips;
  return (
    <ul className="vp-chips">
      {[...chips, ...(extra ? [extra] : [])].map((chip) => (
        <li key={chip}>
          <Check weight="bold" aria-hidden="true" />
          {chip}
        </li>
      ))}
    </ul>
  );
}

/** Red "already sent a code or money?" exit: an in-page anchor or the guide. */
export function UrgentPlaque({ target }: { target: "#help" | "/emergency" }) {
  const { lang } = useLang();
  const copy = HOME_COPY[lang].hero;
  const body = (
    <>
      <span className="vp-plaque-icon" aria-hidden="true">
        <WarningCircle weight="bold" />
      </span>
      <span>
        <strong>{copy.urgentTitle}</strong>
        <span>{copy.urgentText}</span>
      </span>
      {target === "#help" ? (
        <ArrowDown className="vp-plaque-arrow" weight="bold" aria-hidden="true" />
      ) : (
        <ArrowRight className="vp-plaque-arrow" weight="bold" aria-hidden="true" />
      )}
    </>
  );
  return target === "#help" ? (
    <a className="vp-plaque" href="#help">
      {body}
    </a>
  ) : (
    <Link className="vp-plaque" to="/emergency">
      {body}
    </Link>
  );
}

/** Nubo spec cards: phone, link, message, screenshot. */
export function KindsBand() {
  const { lang } = useLang();
  const copy = HOME_COPY[lang].kinds;
  return (
    <div className="vp-shell vp-kinds">
      <div className="vp-rowhead">
        <h2>
          <span aria-hidden="true" />
          {copy.label}
        </h2>
        <i aria-hidden="true" />
        <p>{copy.note}</p>
      </div>
      <div className="vp-kinds-grid">
        {copy.items.map((item, index) => {
          const Icon = KIND_ICONS[index];
          return (
            <article className="vp-kind" key={item.name}>
              <div className="vp-kind-top">
                <span className="vp-kind-name">
                  <span className="vp-kind-icon" aria-hidden="true">
                    <Icon weight="bold" />
                  </span>
                  {item.name}
                </span>
                <span className="vp-kind-index">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <div className="vp-kind-foot">
                <span>{copy.example}</span>
                <code translate="no">{item.sample}</code>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Nubo pricing-style call cards built from the verified emergency directory. */
export function UrgentPlans() {
  const { lang } = useLang();
  const copy = HOME_COPY[lang].urgent;
  const contacts = getPublicEmergencyContacts(lang);
  return (
    <div className="vp-plans">
      {contacts.map((contact, index) => {
        const card = copy.cards[contact.dial];
        return (
          <article key={contact.dial} className="vp-plan">
            <div className="vp-plan-head">
              <div className="vp-plan-top">
                <span className="vp-plan-index">{String(index + 1).padStart(2, "0")}</span>
                {card?.tag && (
                  <span className={`vp-tag${index === 0 ? " vp-tag--alert" : ""}`}>{card.tag}</span>
                )}
              </div>
              <h3 className="vp-plan-title">{contact.title}</h3>
              <p>{card?.text ?? contact.note}</p>
            </div>
            <div className="vp-plan-body">
              <span className="vp-plan-number" translate="no">
                {contact.number}
              </span>
              <a
                className="vp-pill vp-pill--dark vp-plan-call"
                href={`tel:${contact.dial}`}
                aria-label={`${copy.call}: ${contact.title}, ${contact.number}`}
              >
                <span className="vp-pill-dot" aria-hidden="true">
                  <Phone weight="fill" />
                </span>
                {copy.call}
              </a>
            </div>
            {card && card.when.length > 0 && (
              <div className="vp-plan-when">
                <span>{copy.when}</span>
                <ul>
                  {card.when.map((item) => (
                    <li key={item}>
                      <span aria-hidden="true">
                        <Check weight="bold" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
