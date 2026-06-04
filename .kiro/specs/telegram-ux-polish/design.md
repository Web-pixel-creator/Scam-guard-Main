# Design Document: Telegram UX Polish

## Overview

This design covers five independent UX improvements to the Ishonch Guard Telegram bot: command menu localization, human-friendly explanation text, OCR/barcode false-positive reduction, panic menu pagination, and emergency text shortening.

## Architecture

This feature delivers five independent improvements to the Ishonch Guard Telegram bot. Each maps to its own module or modification, with no cross-dependencies between the five changes:

1. **Command Menu Localization** — new script `scripts/register-telegram-commands.ts`
2. **Why_Explanation Rewrite** — text update in `src/lib/telegram/bot-i18n.ts`
3. **Card Number Detector Fix** — logic change in `src/lib/risk/detect.ts` (`redactText`)
4. **Panic Menu Pagination** — handler change in `src/lib/telegram/handlers/misc.ts` + `commands.ts`
5. **Emergency Text Shortening** — text changes in `src/lib/telegram/emergency.ts`

All changes remain server-side (no client bundle impact). The existing TypeScript/Vitest/fast-check stack is used for testing.

---

## Components and Interfaces

### 1. setMyCommands Script (`scripts/register-telegram-commands.ts`)

A standalone one-shot script (same pattern as `register-telegram-webhook.ts`) that calls the Telegram Bot API `setMyCommands` method for each supported language.

```typescript
// scripts/register-telegram-commands.ts

interface CommandPayload {
  commands: { command: string; description: string }[];
  language_code?: string; // BCP-47 code: "ru", "uz", "en"; omitted for default
}

// Exported for testing — builds payloads without calling the API
export function buildCommandPayloads(): CommandPayload[];

// Main execution — calls setMyCommands for each payload
async function main(): Promise<void>;
```

**Behavior:**
- Reads bot token via `getTelegramBotToken()` (same accessor as webhook script)
- Builds 4 payloads: one per lang (`ru`, `uz`, `en`) + one default (no `language_code`)
- Registered commands: `start`, `check`, `report`, `panic`, `safety`, `lang`
- Each command gets a localized description matching `bot_dict` tone
- Exits non-zero if token is missing

### 2. Why_Explanation Rewrite (`src/lib/telegram/bot-i18n.ts`)

The `why_explanation` entry in `bot_dict` is rewritten to:
- Remove all numeric weights, thresholds ("≥ 50", "≥ 20"), and technical terms
- Use a numbered list of ≤5 plain-language steps
- Preserve the 🔒 privacy note at the end
- Stay within 800 characters per language

No interface changes — same `bt("why_explanation", lang)` call.

### 3. Card Number Detector (`src/lib/risk/detect.ts`)

The existing `redactText` function's `CARD_RE` logic is replaced with a context-aware approach:

```typescript
// New exports from detect.ts

/** Context words that signal a digit sequence is likely a card number */
export const CARD_CONTEXT_WORDS: string[];

/** 
 * Determine if a 13-19 digit sequence should be treated as a card number.
 * Returns true if:
 *   - The sequence is exactly 16 digits and passes the Luhn check, OR
 *   - At least one context word appears within 120 characters of the sequence
 */
export function shouldRedactAsCard(
  digitSequence: string,
  surroundingText: string,
  matchStart: number,
  matchEnd: number
): boolean;

/**
 * Luhn checksum validation for card number detection.
 * Returns true if the digit string passes the Luhn algorithm.
 */
export function luhnCheck(digits: string): boolean;
```

**CARD_CONTEXT_WORDS** includes (case-insensitive):
- Russian: карта, карту, банк, пин
- Uzbek: karta, bank, pin
- English: card, bank, cvv, cvc, pin

**redactText changes:**
- `CARD_RE` match → call `shouldRedactAsCard` with surrounding text context
- If `shouldRedactAsCard` returns false → leave digits unredacted
- Phone and OTP patterns remain unchanged (applied before card logic)

### 4. Panic Menu Pagination (`src/lib/telegram/handlers/misc.ts` + `commands.ts`)

The current flat 10-button layout is replaced with a paginated 6+1 layout.

```typescript
// New callback_data conventions (still panic: prefixed)
// "panic:more"  — show page 2 (scenarios 7-10 + back)
// "panic:back"  — return to page 1 (scenarios 1-6 + more)

// New/modified exports from emergency.ts
export function buildPanicKeyboardPage1(lang: Lang): InlineKeyboard;
export function buildPanicKeyboardPage2(lang: Lang): InlineKeyboard;
```

**Page 1 layout** (shown on `/panic`):
- 6 scenario buttons (IDs 1–6), 2 per row
- 1 "Другие ситуации" / "Boshqa vaziyatlar" / "Other situations" button

**Page 2 layout** (shown on "more" tap):
- 4 scenario buttons (IDs 7–10), 2 per row
- 1 "← Назад" / "← Orqaga" / "← Back" button

**Interaction model:**
- `/panic` → `sendMessage` with page 1
- "panic:more" → `editMessageText` on the original message → page 2
- "panic:back" → `editMessageText` → page 1
- "panic:N" (scenario tap) → `sendMessage` (new message) with scenario steps

Requires importing `editMessageText` from `api.server.ts`:

```typescript
// Addition to api.server.ts
export interface EditMessageOptions {
  chatId: number;
  messageId: number;
  text: string;
  keyboard?: InlineKeyboard;
  parseMode?: "MarkdownV2" | "HTML" | "None";
}

export async function editMessageText(opts: EditMessageOptions): Promise<{ ok: boolean }>;
```

The callback handler in `misc.ts` needs access to `message_id` from the callback query. The router (`HandlerCtx`) is extended:

```typescript
// Addition to HandlerCtx (router.ts)
export interface HandlerCtx {
  // ... existing fields
  messageId?: number; // populated from callback_query.message.message_id
}
```

### 5. Emergency Text Shortening (`src/lib/telegram/emergency.ts`)

Each scenario's `steps` arrays are shortened to keep per-scenario output ≤1500 characters per lang. The structure remains the same (`buildPanicScenarioText`), but:
- Each scenario starts with the most critical action in UPPERCASE
- Filler phrases and redundant reminders are removed
- The disclaimer is shortened

No interface changes — same `buildPanicScenarioText(id, lang)` signature.

---

## Data Models

No new database tables or persistent storage. All changes are in-memory text generation and Telegram API payloads.

**Command payload structure** (for Telegram `setMyCommands`):
```typescript
interface TelegramSetMyCommandsBody {
  commands: Array<{ command: string; description: string }>;
  language_code?: string;
  scope?: { type: "default" };
}
```

---

## Error Handling

| Component | Error Condition | Handling |
|-----------|----------------|----------|
| setMyCommands script | Missing bot token | `process.exit(1)` with error message (no secret values logged) |
| setMyCommands script | API call failure | Print error, exit non-zero |
| editMessageText | Network/API error | Return `{ ok: false }`, no throw (same as sendMessage) |
| redactText | Malformed input | Graceful fallback: if regex processing fails, return original text |
| Panic pagination | Unknown callback_data | Acknowledge callback (clear spinner), no action |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Why_Explanation well-formedness

*For any* supported language (ru, uz, en), the `why_explanation` text in `bot_dict` SHALL:
- contain no more than 800 characters,
- contain no numeric weight/threshold patterns (e.g., digits followed by "=", "≥" prefix),
- have at most 5 numbered list items,
- end with a privacy note containing the 🔒 emoji.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 2: Context-word gated card redaction

*For any* string containing a sequence of 13–19 digits (with optional space/dash separators) that does NOT pass the Luhn-16 check, the `redactText` function SHALL redact that sequence if and only if at least one context word from `CARD_CONTEXT_WORDS` appears within 120 characters of the digit sequence.

**Validates: Requirements 3.1, 3.2, 3.3, 5.6**

### Property 3: Luhn-16 unconditional redaction

*For any* string containing a 16-digit sequence that passes the Luhn checksum, the `redactText` function SHALL redact that sequence regardless of whether any context word is present in the surrounding text.

**Validates: Requirements 3.4, 5.6**

### Property 4: Emergency text well-formedness

*For any* panic scenario ID (1–10) and *for any* supported language (ru, uz, en), the output of `buildPanicScenarioText(id, lang)` SHALL:
- not exceed 1500 characters in length,
- begin its first content line (after the title) with an uppercase word or phrase signaling the most important action,
- contain at least one phone number or short code that exists in the `VERIFIED_CONTACTS` array.

**Validates: Requirements 5.1, 5.2, 5.4, 5.5**

### Property 5: Phone and OTP redaction invariance

*For any* string containing a phone number pattern (7+ digits with international prefix) or an OTP pattern (4-8 consecutive digits), applying the updated `redactText` function SHALL still redact those patterns identically to the prior behavior — the card-detection changes do not alter phone/OTP masking.

**Validates: Requirements 3.5**

---

## Testing Strategy

**Unit tests** (Vitest):
- setMyCommands payload generation: verify 4 payloads with correct structure per lang
- Panic menu keyboard structure: verify page 1 has 7 buttons, page 2 has 5 buttons
- editMessageText integration: verify callback routing for "panic:more" and "panic:back"
- Scenario 6 live-call header text verification

**Property-based tests** (fast-check + Vitest):
- Property 1: Why_Explanation well-formedness — iterate over all 3 langs
- Property 2: Context-word gated card redaction — generate random digit sequences (13-19 digits) with/without context words at varying distances
- Property 3: Luhn-16 unconditional redaction — generate Luhn-valid 16-digit sequences in arbitrary surrounding text
- Property 4: Emergency text well-formedness — iterate over all 10 scenarios × 3 langs
- Property 5: Phone/OTP redaction invariance — generate phone-like and OTP-like patterns, verify they are still masked after the card-detection refactor

**Configuration**: minimum 100 iterations per property test. Each property test references its design document property via tag format: `Feature: telegram-ux-polish, Property N: <title>`.
