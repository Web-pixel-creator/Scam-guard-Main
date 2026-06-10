# Design Document

## Overview

Telegram Evidence Brief v1 is a presentation-layer improvement. The existing risk engine and Telegram metadata lookup already provide the needed inputs: reason codes, known report count, and public/private target status. This feature adds a pure formatter helper that converts those inputs into a short scenario-first brief.

The feature does not add new Telegram API capabilities and does not claim unavailable facts. It simply changes the order and specificity of the explanation: visible scam pattern first, Telegram limitations second.

## Architecture

The flow remains:

`Telegram message -> runCheck -> public metadata enrichment -> reputation enrichment -> formatCheckResult`

The new helper sits inside the public metadata enrichment step:

1. `buildTelegramPublicMetadataBrief(metadata, lang, result)` receives metadata plus risk reasons.
2. It calls a new scenario builder before composing the final brief.
3. If the scenario builder returns text, the final brief is ordered as:
   - scenario summary
   - visible signals
   - safe next step
   - compact Telegram limitation
4. If no scenario is found, the existing found/not-found/private/internal brief is used.

## Components and Interfaces

### Telegram Scenario Brief Builder

New pure helper:

```ts
function buildTelegramScenarioBrief(
  metadata: TelegramPublicMetadata,
  lang: Lang,
  result?: Pick<RunCheckResult, "reasons" | "knownReports">,
): string | null;
```

It groups existing reason codes into scenario families:

- `betting_or_casino`
- `giveaway_or_task`
- `wallet_or_defi`
- `account_takeover`
- `official_or_credential`
- `private_invite_only`

### Existing Metadata Briefs

Existing `foundBrief`, `notFoundBrief`, `privateInviteBrief`, `internalLinkBrief`, and `unavailableBrief` remain as fallback and limitation text.

### Signal Rendering

Existing `telegramSignalText` remains the compact visible-signal renderer. It is reused after the scenario summary.

### Next Step Rendering

Existing `telegramNextStep` is expanded for account takeover and official/credential scenarios. It stays short and pattern-specific.

## Data Models

No new persisted data is introduced.

The feature uses:

```ts
type TelegramPublicMetadata =
  | { status: "found"; username: string; chat: TelegramChatFullInfo }
  | { status: "not_found"; username: string }
  | { status: "unavailable"; username: string }
  | { status: "private_invite"; value: string }
  | { status: "internal_or_private"; value: string }
  | { status: "not_telegram" };
```

and existing `ReasonCode` values.

## Correctness Properties

1. Enrichment preserves deterministic risk fields.
2. Private invite and internal links do not trigger public `getChat` lookup.
3. Scenario-specific reasons place scenario text before generic Telegram limitation text.
4. Unknown/not-found usernames never become proof of scam by themselves.
5. Output never claims hidden Telegram SCAM labels, account age, Telegram report counts, or spam history without source-backed data.
6. Empty or non-Telegram inputs continue to bypass metadata enrichment.

## Error Handling

The helper is pure and should not throw for unknown reason codes. If no scenario applies, it returns `null` and the existing metadata brief is used. Telegram API failures remain handled by the existing `unavailable` metadata status.

## Testing Strategy

Add unit coverage to `public-metadata.server.test.ts` for:

- private invite plus betting/VIP scenario;
- casino/free-spins public channel scenario;
- NFT/Stars giveaway/captcha/voting scenario;
- wallet/DeFi urgency scenario;
- Telegram account takeover scenario;
- not-found username with no scam proof;
- field preservation through `enrichTelegramPublicMetadata`.

Existing full test, typecheck, lint, build, and production smoke checks remain required before deployment.
