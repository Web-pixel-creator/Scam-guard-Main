import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "@phosphor-icons/react";

/**
 * Shared Viper/Nubo building blocks (D-109/D-110) for the homepage and every
 * public inner page: pills, two-tone page heads, label rows and emphasis.
 */

const YEAR = 2026;

export type InternalPath =
  | "/"
  | "/check"
  | "/emergency"
  | "/official-numbers"
  | "/report"
  | "/scam-trends"
  | "/scams"
  | "/privacy"
  | "/appeal"
  | "/embed";

// Renders copy where `**phrase**` marks the words a reader should catch first.
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text
        .split("**")
        .map((part, index) => (index % 2 ? <strong key={index}>{part}</strong> : part))}
    </>
  );
}

export function MetaBar({ label, index }: { label: string; index: number }) {
  return (
    <div className="vp-meta">
      <span className="vp-label">{label}</span>
      <span>(IG — {String(index).padStart(2, "0")})</span>
      <span>©{YEAR}</span>
    </div>
  );
}

export function Dots({ on }: { on: number }) {
  return (
    <span className="vp-dots" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <i key={dot} className={dot < on ? "is-on" : undefined} />
      ))}
    </span>
  );
}

type PillTone = "light" | "dark" | "white" | "outline";

function pillClass(tone: PillTone, className?: string) {
  return `vp-pill${tone === "light" ? "" : ` vp-pill--${tone}`}${className ? ` ${className}` : ""}`;
}

function PillDot({ icon }: { icon?: ReactNode }) {
  return (
    <span className="vp-pill-dot" aria-hidden="true">
      {icon ?? <ArrowRight weight="bold" />}
    </span>
  );
}

type PillCommon = { children: ReactNode; tone?: PillTone; icon?: ReactNode; className?: string };

/** Viper pill link: an internal route (`to`) or a plain/external `href`. */
export function Pill(
  props: PillCommon & ({ to: InternalPath } | { href: string; external?: boolean }),
) {
  const { children, tone = "dark", icon, className } = props;
  if ("to" in props) {
    return (
      <Link to={props.to} className={pillClass(tone, className)}>
        <PillDot icon={icon} />
        {children}
      </Link>
    );
  }
  return (
    <a
      href={props.href}
      className={pillClass(tone, className)}
      {...(props.external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      <PillDot icon={icon} />
      {children}
    </a>
  );
}

/** The same pill as a real <button> for forms and in-page actions. */
export function PillButton({
  children,
  tone = "dark",
  icon,
  className,
  type = "button",
  ...rest
}: PillCommon & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type={type} className={pillClass(tone, className)} {...rest}>
      <PillDot icon={icon} />
      {children}
    </button>
  );
}

/**
 * Inner-page head: eyebrow, two-tone title (second line muted), lead with
 * `**emphasis**`, and an optional aside card on the right.
 */
export function PageHero({
  eyebrow,
  icon,
  alert,
  title,
  lead,
  aside,
  children,
}: {
  eyebrow: string;
  icon: ReactNode;
  alert?: boolean;
  title: readonly [string, string?];
  lead?: string;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`vp-page-hero${aside ? "" : " vp-page-hero--single"}`}>
      <div className="vp-page-hero-copy">
        <div className={`vp-eyebrow${alert ? " vp-eyebrow--alert" : ""}`}>
          <span aria-hidden="true">{icon}</span>
          {eyebrow}
        </div>
        <h1 className="vp-page-title">
          <span>{title[0]}</span>
          {title[1] && <span>{title[1]}</span>}
        </h1>
        {lead && (
          <p className="vp-page-lead">
            <Rich text={lead} />
          </p>
        )}
        {children}
      </div>
      {aside && <div className="vp-page-hero-aside">{aside}</div>}
    </section>
  );
}

/** Nubo label row: "■ LABEL ———— note". */
export function RowHead({
  label,
  note,
  id,
  as: Tag = "h2",
}: {
  label: string;
  note?: string;
  id?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div className="vp-rowhead">
      <Tag id={id}>
        <span aria-hidden="true" />
        {label}
      </Tag>
      <i aria-hidden="true" />
      {note && <p>{note}</p>}
    </div>
  );
}

/** Framed callout used in page heads and next to forms. */
export function Callout({
  icon,
  title,
  children,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  tone?: "neutral" | "alert" | "ok";
}) {
  return (
    <div className={`vp-callout vp-callout--${tone}`}>
      <span className="vp-callout-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}
