// Scam Patterns Library — reusable structured data about known scam schemes.
//
// Each pattern describes a known attack vector with:
//   - linked reason codes (connects to risk engine)
//   - severity level
//   - red flags (what to look for)
//   - what to do (actionable steps)
//   - examples (how it looks in real life)
//
// Used by: /scams page, "Почему так решил?", admin panel, future Scam DNA Graph.

import type { ReasonCode } from "@/lib/risk/rules";

export type ScamSeverity = "low" | "medium" | "high" | "critical";

export interface ScamPattern {
  /** Unique kebab-case ID (used in URLs: /scams/otp-code-scam) */
  id: string;
  /** Severity for prioritization and display */
  severity: ScamSeverity;
  /** Linked reason codes from the risk engine */
  reasonCodes: ReasonCode[];
  /** Human-readable title */
  title: { ru: string; uz: string; en: string };
  /** Short description of how this scam works */
  description: { ru: string; uz: string; en: string };
  /** Red flags users should watch for */
  redFlags: { ru: string[]; uz: string[]; en: string[] };
  /** What to do if you encounter this */
  whatToDo: { ru: string[]; uz: string[]; en: string[] };
  /** Real-world examples of how it looks */
  examples: { ru: string[]; uz: string[]; en: string[] };
}
