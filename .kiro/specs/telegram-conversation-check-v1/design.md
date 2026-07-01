# Design: Telegram Conversation Check v1

## Overview

The existing bot is intentionally single-item-first: text, image, voice, contact
and forwarded text all enter the check pipeline immediately. That is good for
urgent safety, but it misses long scams where the risk appears across messages.

Conversation Check v1 adds an explicit short-lived collector and a privacy-safe
conversation analyzer. The collector stores only derived metadata between
Telegram updates. Raw text is used only inside the current request while
extracting signals.

## User Flow

1. User taps a future "Check conversation" button or sends a dedicated command.
2. Bot starts a `conversation_check` scenario scoped to the current chat.
3. User forwards or pastes up to 8 messages.
4. For each message, the bot extracts safe features and appends them to the
   draft snapshot. It does not send a verdict for every intermediate message.
5. User taps "Analyze conversation" or sends a localized done phrase.
6. Bot renders a conversation result with:
   - stage timeline;
   - pressure escalation;
   - requested action;
   - strongest risk signals;
   - one safest next step;
   - normal "Report" and "New check" actions.
7. Bot clears the conversation draft and persists only the normal safe
   `lastCheck` snapshot for follow-up questions.

## Session Data

Add a new scenario only when implementation begins:

```ts
type Scenario = "conversation_check" | ...existing;
```

Add a safe draft shape under `scenarioData.conversation`:

```ts
interface ConversationDraftSnapshot {
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  strongestLevel: RiskLevel;
  stageCounts: Partial<Record<ConversationStage, number>>;
  reasonCounts: Partial<Record<ReasonCode, number>>;
  requestedActions: ConversationRequestedAction[];
  pressureFlags: ConversationPressureFlag[];
}
```

The draft must not contain:

- raw message text;
- full or partial URLs;
- phone numbers;
- usernames;
- card data;
- OTP/PIN/CVV/password/seed values;
- OCR text;
- image bytes or file ids.

## Signal Extraction

For each message, derive a small `ConversationMessageSignals` object:

- `level`: `safe | unknown | suspicious | high_risk`;
- `reasons`: reason codes from deterministic/risk check output;
- `stages`: coarse labels such as `opener`, `trust_building`,
  `authority_claim`, `urgency`, `verification_request`, `payment_request`,
  `apk_install`, `qr_login`, `investment_pitch`, `romance_pivot`;
- `requestedActions`: `say_code`, `send_card`, `transfer_money`,
  `install_app`, `scan_qr`, `connect_wallet`, `send_document`, `keep_call`;
- `pressureFlags`: `urgent`, `secrecy`, `fear`, `promised_profit`,
  `relationship_trust`, `official_impersonation`.

If a full transcript is pasted in one Telegram message, analysis may happen
entirely in memory and then save only the final `lastCheck` snapshot.

## Risk Core Boundary

The first implementation should prefer deterministic feature extraction from
existing reason codes and lightweight regexes. If an AI summarizer is added
later, it must receive a redacted transcript, use existing provider timeouts,
pass through the AI-output safety firewall, and never write raw model input or
output to session state.

## Rendering

The result should be compact:

```text
🧵 Разговор выглядит рискованно

Как развивалось:
1. Сначала создавали доверие.
2. Потом перевели к деньгам/крипте.
3. Затем попросили действие: перевод / код / QR.

Самый опасный момент:
...

Следующий безопасный шаг:
...
```

The result should not quote the original conversation unless the quoted part is
already redacted and short enough to be safe. Prefer reason labels and stage
descriptions over raw excerpts.

## Routing

Conversation mode must be explicit. The normal route order remains:

1. callbacks;
2. commands;
3. active scenario;
4. ordinary content.

Inside `conversation_check`, supported text/forwarded text is collected.
Images, voice notes and contacts should either be rejected with a short helper
message or routed to the existing single-item check after the conversation draft
is cancelled. Do not mix raw OCR/audio into the draft in v1.

## Error Handling

- Expired draft: clear scenario and ask the user to start again.
- Too many messages: keep the draft, tell the user to analyze or cancel.
- Too-long message: reject that message and keep the existing draft.
- Storage failure: fail closed by not collecting more messages; ask the user to
  paste the most suspicious single message for immediate check.

## Testing Strategy

- Unit tests for stage extraction on romance-to-investment, bank-code,
  fake-employer-payment and government-benefit-code chains.
- Unit tests that raw URLs, phones, usernames, OTP-like digits and card-like
  values are not present in `ConversationDraftSnapshot`.
- Router/handler tests for start, collect, analyze, cancel, expiry and limit.
- Regression tests proving ordinary URL/phone/username messages outside
  `conversation_check` still enter the normal check pipeline.
- Markdown/i18n completeness tests for new buttons and result copy.
