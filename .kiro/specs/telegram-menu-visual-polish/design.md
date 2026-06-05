# Technical Design

## Overview

This document describes the implementation plan for **Result Message UX v2** — a complete overhaul of the Telegram bot's check result formatting. The redesign introduces risk-level-specific templates, a human-readable verdict line, AI explanation length control, context-aware advice, short emoji-anchored section headers, visual separators, and extended inline buttons. All formatting remains MarkdownV2-compliant and trilingual (ru, uz, en).

## Architecture

The change is localised to the formatting layer. No changes to risk evaluation, AI calls, or database logic are needed.

```
┌─────────────────────────────────────────────────────────────┐
│                     Bot Router (unchanged)                    │
└───────────────────────────────┬──────────────────────────────┘
                                │ RunCheckResult + Lang
                                ▼
┌─────────────────────────────────────────────────────────────┐
│              formatCheckResult() — REDESIGNED                 │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │TemplateRouter│  │ AI Truncator │  │AdviceContextFilter│  │
│  │(by RiskLevel)│  │(max 5 lines) │  │ (by reason codes) │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬──────────┘  │
│         │                  │                   │             │
│         ▼                  ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         Section Renderer (headers, separators)           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │         Button Builder (risk-aware inline keyboard)       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    FormattedResult { text, keyboard }
```

## Data Models

### Template Model

```typescript
// src/lib/telegram/templates.ts
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

export type RiskTemplate = SectionId[];

export const TEMPLATES: Record<RiskLevel, RiskTemplate> = {
  safe: ["verdict", "brief", "what_noticed", "safe_steps"],
  unknown: ["verdict", "brief", "what_noticed", "safe_steps", "more_context_prompt"],
  suspicious: ["verdict", "reasons", "safe_steps"],
  high_risk: ["verdict", "action_now", "why_dangerous", "where_report"],
};
```

### Truncation Options

```typescript
// src/lib/telegram/truncate.ts
export interface TruncateOptions {
  maxLines: number;     // default 5
  maxChars: number;     // default 280
}
```

### Advice Filter Result

```typescript
// src/lib/telegram/advice-filter.ts
// Returns max 3 advice strings filtered by detected reasons
export function filterAdvice(
  level: RiskLevel,
  reasons: ReasonCode[],
  lang: Lang
): string[];
```

### i18n Additions (bot_dict entries)

Verdict lines:
- `verdict_safe`, `verdict_unknown`, `verdict_suspicious`, `verdict_high_risk`

Section titles (max 15 chars):
- `section_brief`, `section_reasons`, `section_noticed`, `section_action_now`, `section_safe_steps`, `section_why_danger`, `section_where_report`

Context-specific advice:
- `advice_crypto_topic_only`, `advice_send_more_context`, `prompt_more_context`

Updated buttons:
- `btn_report` (📢), `btn_check_another` (🔁), `btn_why` (❓), `btn_emergency` (🆘)

## Components and Interfaces

### 1. Template Router (`src/lib/telegram/templates.ts` — NEW)

Defines section order per risk level. Exports `TEMPLATES`, `SECTION_EMOJI`, and `SECTION_TITLE_KEY` mappings.

### 2. AI Explanation Truncator (`src/lib/telegram/truncate.ts` — NEW)

Pure function `truncateExplanation(text, options?)`:
1. Split by `\n` into lines.
2. If lines ≤ maxLines and total chars ≤ maxChars → return as-is.
3. Otherwise, take first N lines that fit within maxChars.
4. Ensure the result ends at a sentence boundary if possible.
5. Append "…" if any content was removed.

### 3. Context-Aware Advice Filter (`src/lib/telegram/advice-filter.ts` — NEW)

Function `filterAdvice(level, reasons, lang)`:
- Maps reason codes to relevant advice categories (OTP-related → OTP advice, link-related → link advice)
- For `unknown` with only topic context (crypto/investment without URL/phone/payment): returns context-specific single line
- Returns max 3 items

### 4. Refactored Formatter (`src/lib/telegram/format.ts` — UPDATED)

The `formatCheckResult` function becomes template-driven:
- Looks up `TEMPLATES[result.level]` for section order
- Iterates sections, rendering each with emoji header + bold title + content
- Joins with thin separator (┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈)
- Enforces 4096 char limit with progressive section dropping

### 5. Button Builder (`src/lib/telegram/format.ts` — UPDATED)

Updated `buildResultKeyboard`:
- All levels: Report (📢), Check another (🔁), Why? (❓)
- high_risk additionally: Emergency steps (🆘)
- callback_data values unchanged (CB.report, CB.checkAnother, CB.why, CB.emergency)

## Error Handling

1. **4096 char overflow**: If assembled text exceeds Telegram's limit, progressively drop trailing sections while keeping Risk_Header + Verdict + first action section.
2. **Empty AI explanation**: When `result.explanation === null`, the "brief" section uses deterministic advice for that risk level.
3. **Zero reason codes**: For `safe`/`unknown` with no reasons, the "What I noticed" section is omitted entirely.
4. **MarkdownV2 parse failure**: If Telegram rejects the message (HTTP 400), retry with bold markers stripped (plain text fallback).
5. **Missing i18n key**: Fall back to Russian variant of the string (existing behavior in the codebase).

## Testing Strategy

### Snapshot Tests (12 combinations)
- 4 risk levels × 3 languages
- Each creates a representative `RunCheckResult` and asserts output matches stored snapshot

### Unit Tests
- `truncate.test.ts`: short text (no-op), long text (truncated), multi-language, empty string, single long line
- `advice-filter.test.ts`: high_risk with multiple reasons, unknown with no reasons, unknown with crypto-only, suspicious with mixed reasons

### Property-Based Test
- For any valid `RunCheckResult` and any `Lang`: output length ≤ 4096, passes MarkdownV2 validation, contains exactly one verdict line

### MarkdownV2 Validation
- Helper function checks for unescaped special characters outside intentional bold markers
- Applied in all snapshot tests

## Correctness Properties

### Property 1: Message Length Invariant
For any valid `RunCheckResult` and any `Lang`, `formatCheckResult(result, lang).text.length` is less than or equal to 4096 characters.
**Validates: Requirements 9.1**

### Property 2: Template Section Order Compliance
The rendered output sections appear in the exact order defined by `TEMPLATES[result.level]`. No section appears out of order or is duplicated.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3**

### Property 3: Truncation Bound
For any input string, `truncateExplanation(text).split('\n').length` is less than or equal to 5 lines and total character count is less than or equal to 280.
**Validates: Requirements 2.1, 2.3**

### Property 4: Advice Item Count Limit
For any valid combination of `level`, `reasons`, and `lang`, `filterAdvice(level, reasons, lang).length` is less than or equal to 3 items.
**Validates: Requirements 6.1, 9.2**

### Property 5: MarkdownV2 Validity
The output of `formatCheckResult` contains no unescaped MarkdownV2 special characters (_, *, [, ], (, ), ~, `, >, #, +, -, =, |, {, }, ., !) outside intentional bold marker pairs.
**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 6: Verdict Line Presence
Every rendered Result_Message contains exactly one Verdict_Line that corresponds to the input `result.level`.
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 7: Separator Placement
The rendered output has no Section_Separator before the first content block or after the last content block.
**Validates: Requirements 8.4**

### Property 8: Emergency Button Exclusivity
Results with `level === "high_risk"` always include the emergency button in the keyboard. Results with other levels never include the emergency button.
**Validates: Requirements 11.2**

