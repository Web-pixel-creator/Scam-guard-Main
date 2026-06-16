# Design

## Overview

AI Voice-Clone SOS v1 extends the existing Telegram emergency copilot with one new panic scenario. It is intentionally a copy/routing feature, not a biometric detector. The bot teaches a safe verification protocol: pause, stop the call, call back through a saved trusted route, ask a private question, and only escalate to bank/police if money or threats are involved.

## Architecture

The feature stays inside `src/lib/telegram/emergency.ts`:

- `PanicScenarioId` expands from `1..10` to `1..11`.
- `PANIC_MENU_TITLES` adds the voice-clone title.
- `COMPACT_PANIC_CARDS` adds the first-screen card.
- `buildScenarios()` adds the detailed checklist for `panicctx:full`.
- `parsePanicCallback()` and `asPanicScenarioId()` accept `11`.
- `buildPanicKeyboardPage2()` renders scenarios `7..11`.
- `followUpProfile()` maps `11` to a new `voice_clone` profile.
- `moreAdviceText()`, `guidedCallbackDirectory()`, `guidedTrustedPersonText()` and `guidedScriptText()` render scenario-specific follow-ups.

No database schema, AI provider, OCR, STT, external API or raw media storage changes are required.

## Data Models

```ts
type PanicFollowUpProfile =
  | "financial"
  | "malware"
  | "telegram_recovery"
  | "live_call"
  | "blackmail"
  | "romance"
  | "minor"
  | "voice_clone";
```

`voice_clone` is presentation/routing metadata only. The existing session context still stores only `lastPanicId` and `lastPanicAt`.

## Error Handling

If a user sends a real URL, phone number, username, code-like token or long suspicious text after the scenario, the existing follow-up classifier avoids interception and lets the risk pipeline analyze the payload. If the user asks short questions like "что дальше" or "куда обратиться", the recent panic context routes them to scenario-specific guidance.

## Testing Strategy

Unit tests in `src/lib/telegram/emergency-followup.test.ts` cover:

- second-page menu contains `panic:11`;
- callback parser accepts `panic:11`;
- first card includes saved-number and code-word guidance;
- ready phrase, trusted-person guidance and contact/help copy do not regress to generic bank/call wording.
