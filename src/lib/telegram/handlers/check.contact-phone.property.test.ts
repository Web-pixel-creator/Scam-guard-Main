// Feature: telegram-bot-mvp, Property 9
//
// Property-based test for the Telegram bot's contact-card check (task 8.7).
//
// Property 9 (design.md → "Контакт-карта эквивалентна телефону",
// Validates: Requirements 21.1, 21.2):
//   ∀ phone: handlePhoneFromContact(phone).{level,score,reasons}
//          = runCheck({ input: phone, type: "phone", ... }).{level,score,reasons}
//
// In words: forwarding a Telegram contact card must be EQUIVALENT to typing the
// same number as text of type "phone". The contact path may not distort the
// verdict in any way, and the contact's name / extra fields must never reach the
// core (R21.3 — additionally asserted here).
//
// Strategy: the shared, transport-independent core (`runCheck`) is replaced by a
// DETERMINISTIC fake whose `{level,score,reasons}` depend ONLY on the trimmed
// input and the detected type — exactly the two things `runCheck` derives a
// verdict from. We then:
//   1. capture the params `handlePhoneFromContact` hands to the core, and
//   2. compare the verdict it forwards to the reply against the verdict a DIRECT
//      `runCheck({ input: phone, type: "phone", ... })` call would yield.
// Because the fake is a pure function of (trimmed input, type), equivalence of
// the two verdicts reduces to the handler passing `input = phone` and
// `type = "phone"` to the core and forwarding the result untouched — which is
// precisely Property 9. We also assert the formatted message that actually goes
// out matches `formatCheckResult` of that same verdict, proving the
// {level,score,reasons} survive all the way to the reply.
//
// External dependencies are mocked so no real network / DB / server modules load:
//   - `@/lib/risk/check-core` — deterministic fake `runCheck`, captures params.
//   - `@/lib/telegram/api.server` — Bot API helpers are safe stubs; sendMessage
//     captures the outgoing text + keyboard; escapeMarkdownV2 is the identity.
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted capture buffers + the deterministic fake core. These are referenced
// inside the (hoisted) vi.mock factory, so they must exist before the mock runs.
const hoisted = vi.hoisted(() => {
  type Params = {
    input: string;
    type?: string;
    lang: string;
    rateLimitKey: string;
    channel?: string;
  };
  interface FakeResult {
    type: string;
    display: string;
    level: "safe" | "unknown" | "suspicious" | "high_risk";
    score: number;
    reasons: string[];
    explanation: string | null;
    knownReports: number;
    verifiedContact: null;
  }

  const runCheckCalls: Array<{ params: Params; result: FakeResult }> = [];
  const sentMessages: Array<{ chatId: number; text: string; keyboard?: unknown }> = [];

  // All four real RiskLevels (formatCheckResult must handle each one).
  const LEVELS = ["safe", "unknown", "suspicious", "high_risk"] as const;
  // Valid ReasonCodes that exist in REASON_LABELS so the real formatter renders.
  const REASON_POOL = ["unknown_sender", "uses_urgency", "impersonates_bank"] as const;

  // Tiny deterministic 32-bit hash (FNV-1a) — keeps the fake verdict stable.
  const hashStr = (s: string): number => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  // The fake `runCheck`: verdict depends ONLY on (trimmed input, detected type),
  // mirroring how the real core trims input and scores by type/content. AI and
  // network play no role in {level,score,reasons}, exactly like the real core.
  const fakeCore = (params: Params): FakeResult => {
    const input = params.input.trim();
    const detected = params.type && params.type !== "unknown" ? params.type : "text";
    const h = hashStr(`${detected}::${input}`);
    const level = LEVELS[h % LEVELS.length];
    const score = h % 100;
    const reasons = REASON_POOL.filter((_, i) => ((h >>> i) & 1) === 1);
    return {
      type: detected,
      display: input, // not rendered by formatCheckResult; irrelevant to Property 9
      level,
      score,
      reasons: [...reasons],
      explanation: null,
      knownReports: 0,
      verifiedContact: null,
    };
  };

  return { runCheckCalls, sentMessages, fakeCore };
});

// Mock the transport-independent core: deterministic verdict + param capture.
vi.mock("@/lib/risk/check-core", () => ({
  runCheck: (params: {
    input: string;
    type?: string;
    lang: string;
    rateLimitKey: string;
    channel?: string;
  }) => {
    const result = hoisted.fakeCore(params);
    hoisted.runCheckCalls.push({ params, result });
    return Promise.resolve(result);
  },
  // Not exercised by handlePhoneFromContact, but present so the import resolves.
  analyzeImageCore: () => Promise.resolve(null),
}));

// Mock the Bot API helpers. sendMessage captures the outgoing reply; the rest are
// safe no-ops. escapeMarkdownV2 is the identity here — both the handler's reply
// path and our expected `formatCheckResult` call use this same identity, so the
// comparison stays consistent.
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: (opts: { chatId: number; text: string; keyboard?: unknown }) => {
    hoisted.sentMessages.push(opts);
    return Promise.resolve({ ok: true });
  },
  sendChatAction: () => Promise.resolve(),
  getFile: () => Promise.resolve(null),
  downloadFileAsDataUrl: () => Promise.resolve(null),
  escapeMarkdownV2: (s: string) => s,
}));

import { handlePhoneFromContact } from "./check";
import { formatCheckResult } from "@/lib/telegram/format";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";
import type { RunCheckResult } from "@/lib/risk/check-core";

const LANGS = ["ru", "uz", "en"] as const;

// Telegram user ids: a wide spread including BIGINT-like values beyond 2^31.
const userIdArb = fc.oneof(
  fc.integer({ min: 1, max: 2_147_483_647 }),
  fc.integer({ min: 2_147_483_648, max: Number.MAX_SAFE_INTEGER }),
);

const langArb = fc.constantFrom(...LANGS);

// Diverse, realistic phone-card strings: optional "+", various country codes,
// grouped digits with space/dash separators, optional parentheses, and optional
// surrounding whitespace (to exercise trimming). Always non-empty after trim and
// always contains at least one digit.
const phoneArb = fc
  .record({
    plus: fc.boolean(),
    cc: fc.constantFrom("998", "7", "1", "44", ""),
    digits: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 3, maxLength: 11 }),
    sep: fc.constantFrom(" ", "-", " - ", ""),
    parens: fc.boolean(),
    pad: fc.constantFrom("", " ", "  ", "\n", " \t "),
  })
  .map(({ plus, cc, digits, sep, parens, pad }) => {
    const ds = digits.join("");
    const head = parens && cc ? `(${cc})` : cc;
    const grouped = ds.replace(/(\d{3})(?=\d)/g, `$1${sep}`);
    const core = `${plus ? "+" : ""}${head}${head ? sep : ""}${grouped}`;
    return `${pad}${core}${pad}`;
  })
  .filter((s) => s.trim().length > 0 && /\d/.test(s));

/** Build a HandlerCtx directly (no router/session module loaded at runtime). */
function makeCtx(userId: number, chatId: number, lang: (typeof LANGS)[number]): HandlerCtx {
  const session: Session = {
    telegramUserId: userId,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date(0).toISOString(),
  };
  return { chatId, userId, session };
}

/** Project the verdict fields Property 9 is about. */
function verdict(r: { level: string; score: number; reasons: string[] }) {
  return { level: r.level, score: r.score, reasons: r.reasons };
}

const ALLOWED_PARAM_KEYS = ["input", "type", "lang", "rateLimitKey", "channel", "skipAi"];

beforeEach(() => {
  hoisted.runCheckCalls.length = 0;
  hoisted.sentMessages.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("handlePhoneFromContact — Property 9: contact card ≡ phone-text check", () => {
  it("verdict {level,score,reasons} matches runCheck(phone, type='phone') (fast-check, ≥100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(
        phoneArb,
        userIdArb,
        fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 }),
        langArb,
        async (phone, userId, chatId, lang) => {
          hoisted.runCheckCalls.length = 0;
          hoisted.sentMessages.length = 0;

          const ctx = makeCtx(userId, chatId, lang);
          await handlePhoneFromContact(phone, ctx);

          // The core was reached exactly once (non-empty number → real check).
          expect(hoisted.runCheckCalls).toHaveLength(1);
          const { params: actualParams, result: fromContact } = hoisted.runCheckCalls[0];

          // R21.1 — the card's number is passed as input of type "phone", with
          // the Telegram-specific key/channel/lang. (Equivalence of the INPUTS.)
          const trimmed = phone.trim();
          expect(actualParams.input).toBe(trimmed);
          expect(actualParams.type).toBe("phone");
          expect(actualParams.lang).toBe(lang);
          expect(actualParams.rateLimitKey).toBe(`tg:${userId}`);
          expect(actualParams.channel).toBe("telegram");

          // R21.3 — only Check_Pipeline fields are forwarded; no contact name or
          // other card field leaks into the core call.
          for (const key of Object.keys(actualParams)) {
            expect(ALLOWED_PARAM_KEYS).toContain(key);
          }

          // The DIRECT equivalent: runCheck of the same number as phone-text.
          // fakeCore trims internally, so passing the raw (untrimmed) phone here
          // proves whitespace in the card cannot change the verdict either.
          const direct = hoisted.fakeCore({
            input: phone,
            type: "phone",
            lang,
            rateLimitKey: `tg:${userId}`,
            channel: "telegram",
          });

          // Property 9 core: the verdict the handler forwards is identical to the
          // verdict of the direct phone-text check.
          expect(verdict(fromContact)).toEqual(verdict(direct));

          // …and it actually reaches the reply unchanged: the outgoing message is
          // exactly formatCheckResult() of that same verdict.
          expect(hoisted.sentMessages).toHaveLength(1);
          const sent = hoisted.sentMessages[0];
          const expectedFormatted = formatCheckResult(direct as unknown as RunCheckResult, lang);
          expect(sent.chatId).toBe(chatId);
          expect(sent.text).toBe(expectedFormatted.text);
          expect(sent.keyboard).toEqual(expectedFormatted.keyboard);
        },
      ),
      { numRuns: 100 },
    );
  });
});
