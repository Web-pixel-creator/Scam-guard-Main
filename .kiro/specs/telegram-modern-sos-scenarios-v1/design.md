# Design

## Overview

Modern SOS Scenarios v1 extends the Telegram emergency copilot with a third panic-menu page for four common non-bank pressure patterns: fake job/easy money, delivery/top-up fees, crypto/TON/wallet funnels and government grant/benefit lures.

The feature is copy/routing only. It does not add a new database table, external provider, reputation claim or hidden Telegram metadata. The value comes from matching the user's panic situation with the correct short rescue script.

## Architecture

The change stays inside the Telegram emergency layer:

- `src/lib/telegram/emergency.ts`
  - expands `PanicScenarioId` from `1..11` to `1..15`;
  - adds menu titles for `12..15`;
  - adds compact first cards in `COMPACT_PANIC_CARDS`;
  - adds detailed checklists in `buildScenarios()`;
  - adds `buildPanicKeyboardPage3(lang)`;
  - accepts `panic:12` through `panic:15`;
  - adds follow-up profiles: `fake_job`, `delivery`, `crypto`, `government_grant`;
  - renders scenario-specific next-step, ready-phrase, trusted-person and help-directory copy.
- `src/lib/telegram/handlers/misc.ts`
  - handles `panic:more2` to show page 3;
  - handles `panic:back2` to return to page 2;
  - keeps scenario selection as a new message so the menu remains available.

## Data Models

```ts
type PanicScenarioId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

type PanicFollowUpProfile =
  | "financial"
  | "malware"
  | "telegram_recovery"
  | "live_call"
  | "blackmail"
  | "romance"
  | "minor"
  | "voice_clone"
  | "fake_job"
  | "delivery"
  | "crypto"
  | "government_grant";
```

The existing session context still stores only `lastPanicId` and `lastPanicAt`. No raw links, screenshots, payment data, codes or chats are persisted for these flows.

## Correctness Properties

1. Every panic scenario id from `1..15` must render compact and detailed text for RU/UZ/EN.
2. Every detailed checklist must include at least one verified official contact path.
3. Page 1, page 2 and page 3 must expose unique `panic:` callback data and navigation callbacks.
4. Short follow-up callbacks must stay in the selected scenario context unless the user sends a concrete artifact for risk scoring.
5. Modern SOS ready phrases must not reuse the generic incoming-call bank script.

## Error Handling

If Telegram cannot edit a menu message for `panic:more2` or `panic:back2`, the bot sends a new message with the requested page. If a user sends a URL, phone number, username, code-like token or long suspicious text after a scenario, the existing conservative router sends it to the normal risk pipeline instead of treating it as a short follow-up question.

## Testing Strategy

Regression tests cover:

- keyboard structure for page 3;
- callback parsing for `panic:12..15`;
- handler routing for `panic:more2`, `panic:back2` and `panic:15`;
- scenario-specific follow-up copy for modern scam profiles;
- RU/UZ/EN completeness and emergency well-formedness properties.
