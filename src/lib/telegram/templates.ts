// Template router for Result Message UX v2.
//
// Defines risk-level-specific section ordering, emoji anchors, and
// i18n key mappings for section titles. Pure data — no I/O.
//
// Contract: design.md → "Components and Interfaces → 1. Template Router"

import type { RiskLevel } from "@/lib/risk/rules";
import type { BotStringKey } from "@/lib/telegram/bot-i18n";

/** All possible content sections in a Result_Message. */
export type SectionId =
  | "verdict"
  | "brief"
  | "reasons"
  | "what_noticed"
  | "action_now"
  | "safe_steps"
  | "why_dangerous"
  | "where_report"
  | "more_context_prompt";

/** A template is an ordered list of sections to render for a given risk level. */
export type RiskTemplate = SectionId[];

/**
 * Section order per risk level.
 *
 * - safe: calm, reassuring — brief summary + observations + safe advice
 * - unknown: same as safe but with a prompt for more context
 * - suspicious: warning — show reasons + protective steps
 * - high_risk: action-first — urgent action + danger explanation + reporting info
 */
export const TEMPLATES: Record<RiskLevel, RiskTemplate> = {
  safe: ["verdict", "brief", "what_noticed", "safe_steps"],
  unknown: ["verdict", "brief", "what_noticed", "safe_steps", "more_context_prompt"],
  suspicious: ["verdict", "reasons", "safe_steps"],
  high_risk: ["verdict", "action_now", "why_dangerous", "where_report"],
};

/**
 * Emoji anchor for each section header.
 * Empty string means the section has no standalone emoji prefix
 * (e.g., verdict uses the risk-level emoji from Risk_Header instead).
 */
export const SECTION_EMOJI: Record<SectionId, string> = {
  verdict: "",
  brief: "💡",
  reasons: "⚠️",
  what_noticed: "📌",
  action_now: "🚨",
  safe_steps: "✅",
  why_dangerous: "📌",
  where_report: "🧾",
  more_context_prompt: "",
};

/**
 * Mapping from SectionId to bot_dict i18n key for the section title.
 * Empty string means the section has no separate title line
 * (e.g., verdict renders its own formatted line).
 */
export const SECTION_TITLE_KEY: Record<SectionId, BotStringKey | ""> = {
  verdict: "",
  brief: "section_brief",
  reasons: "section_reasons",
  what_noticed: "section_noticed",
  action_now: "section_action_now",
  safe_steps: "section_safe_steps",
  why_dangerous: "section_why_danger",
  where_report: "section_where_report",
  more_context_prompt: "",
};
