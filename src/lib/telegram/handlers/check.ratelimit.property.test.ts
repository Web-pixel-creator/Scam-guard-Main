// Feature: telegram-bot-mvp, Property 4
//
// Property-based test for the Telegram bot's rate-limit key (task 8.6).
//
// Property 4 (design.md → "Rate-limit ключ бота всегда основан на telegram_user_id",
// Validates: Requirements 10.1, 10.3):
//   ∀ update(from.id = U): the rateLimitKey passed into the shared risk core
//   (runCheck / ocrExtractCore) == "tg:" + U, and it NEVER depends on the chat
//   id, IP, request headers or any other field of the update.
//
// We exercise the real check handlers (`handleCheck`, `handlePhoneFromContact`,
// `handleImage`) and intercept the `rateLimitKey` they hand to the core. The
// per-update HandlerCtx is derived from a Telegram update via the router's pure
// `extractTarget`, so we additionally prove that the user id is taken from
// `from.id` and not from `chat.id` (R10.3) even when the two differ wildly and
// the update is loaded with extra noise fields.
//
// External dependencies are mocked so no real network / DB calls happen:
//   - `@/lib/risk/check-core` — `runCheck` / `analyzeImageCore` capture the key.
//   - `@/lib/telegram/api.server` — Bot API helpers are safe no-op stubs.
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted capture buffers — referenced inside the (hoisted) vi.mock factory, so
// they must be created before the mocks run.
const hoisted = vi.hoisted(() => ({
  runCheckKeys: [] as string[],
  ocrKeys: [] as string[],
}));

// A valid RunCheckResult shape returned by the mocked core. `level` must be a
// real RiskLevel so the real `formatCheckResult` (called by the handler) works.
const FAKE_RESULT = {
  type: "text" as const,
  display: "masked input",
  level: "suspicious" as const,
  score: 30,
  reasons: ["unknown_sender"],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

// Mock the transport-independent core: capture the rateLimitKey it receives.
vi.mock("@/lib/risk/check-core", () => ({
  runCheck: (params: { rateLimitKey: string }) => {
    hoisted.runCheckKeys.push(params.rateLimitKey);
    return Promise.resolve(FAKE_RESULT);
  },
  analyzeImageCore: (_dataUrl: string, _lang: string, rateLimitKey: string) => {
    hoisted.ocrKeys.push(rateLimitKey);
    return Promise.resolve({
      text: "extracted suspicious text",
      visualCategory: "chat_screenshot",
      confidence: "medium",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: [],
      summary: null,
    });
  },
}));

// Mock the Bot API helpers — all best-effort no-ops; escapeMarkdownV2 is needed
// by the real formatter (`format.ts`) and is fine as the identity here.
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: () => Promise.resolve({ ok: true }),
  sendChatAction: () => Promise.resolve(),
  getFile: () => Promise.resolve({ filePath: "photos/file_0.jpg", fileSize: 12_345 }),
  downloadFileAsDataUrl: () => Promise.resolve("data:image/jpeg;base64,AAAA"),
  getChatInfo: () => Promise.resolve({ ok: false, errorCode: 400, description: "chat not found" }),
  escapeMarkdownV2: (s: string) => s,
}));

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: () => Promise.resolve(),
  loadSession: () => Promise.resolve(null),
  resetScenario: () => Promise.resolve(),
}));

import { handleCheck, handleImage, handlePhoneFromContact } from "./check";
import { extractTarget, type HandlerCtx, type TelegramUpdate } from "@/lib/telegram/router";
import type { Session } from "@/lib/telegram/session.server";

const LANGS = ["ru", "uz", "en"] as const;

// Telegram user ids: a wide spread including BIGINT-like values beyond 2^31.
const userIdArb = fc.oneof(
  fc.integer({ min: 1, max: 2_147_483_647 }),
  fc.integer({ min: 2_147_483_648, max: Number.MAX_SAFE_INTEGER }),
);

// Chat ids: group chats are negative, private chats positive — independent of
// the user id, sometimes huge, to prove the key never derives from the chat.
const chatIdArb = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 });

const langArb = fc.constantFrom(...LANGS);

// Non-empty content within the 2000-char limit so handleCheck reaches the core.
const contentArb = fc.string({ minLength: 0, maxLength: 120 }).map((s) => `x${s}`.slice(0, 2000));

// Non-empty phone-like string so handlePhoneFromContact reaches the core.
const phoneArb = fc
  .array(fc.integer({ min: 0, max: 9 }), { minLength: 3, maxLength: 12 })
  .map((d) => `+998${d.join("")}`);

const fileIdArb = fc.string({ minLength: 1, maxLength: 30 }).map((s) => `AgAC${s}`);

const handlerKindArb = fc.constantFrom("text", "contact", "image");

const IP_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;

/**
 * Build a Telegram update for `userId`/`chatId` plus assorted NOISE fields that
 * must not influence the key (forward, caption, entities, language_code, and an
 * arbitrary unknown field allowed by the schema's `.passthrough()`), then derive
 * the HandlerCtx exactly as the router does (`extractTarget`).
 */
function makeCtx(userId: number, chatId: number, lang: (typeof LANGS)[number]): HandlerCtx {
  const update = {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: userId, language_code: "ru", is_bot: false, first_name: "Noise" },
      chat: { id: chatId, type: "private", title: "ignored" },
      text: "noise text",
      caption: "noise caption",
      forward_origin: { type: "user" },
      entities: [{ type: "mention", offset: 0, length: 1 }],
    },
    // Unknown top-level field — survives via `.passthrough()`, must be ignored.
    fake_ip: "203.0.113.7",
  } as unknown as TelegramUpdate;

  const target = extractTarget(update);
  // Sanity: the router can always answer this update.
  expect(target).not.toBeNull();
  // R10.3 — the user id comes from `from.id`, not the chat id.
  expect(target!.userId).toBe(userId);

  const session: Session = {
    telegramUserId: userId,
    lang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date(0).toISOString(),
  };
  return { chatId: target!.chatId, userId: target!.userId, session };
}

beforeEach(() => {
  hoisted.runCheckKeys.length = 0;
  hoisted.ocrKeys.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("check handlers — Property 4: rate-limit key is always tg:<telegram_user_id>", () => {
  it("derives the key solely from from.id for text / contact / image (fast-check, ≥100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(
        userIdArb,
        chatIdArb,
        langArb,
        handlerKindArb,
        contentArb,
        phoneArb,
        fileIdArb,
        async (userId, chatId, lang, kind, content, phone, fileId) => {
          hoisted.runCheckKeys.length = 0;
          hoisted.ocrKeys.length = 0;

          const ctx = makeCtx(userId, chatId, lang);

          if (kind === "text") {
            await handleCheck(content, ctx);
          } else if (kind === "contact") {
            await handlePhoneFromContact(phone, ctx);
          } else {
            await handleImage(fileId, ctx);
          }

          const expected = `tg:${userId}`;

          // The check pipeline was reached exactly once with the user-based key.
          expect(hoisted.runCheckKeys).toHaveLength(1);

          // Image path also runs OCR — it must use the SAME user-based key.
          if (kind === "image") {
            expect(hoisted.ocrKeys).toHaveLength(1);
          } else {
            expect(hoisted.ocrKeys).toHaveLength(0);
          }

          for (const key of [...hoisted.runCheckKeys, ...hoisted.ocrKeys]) {
            // (1) Always strictly "tg:" + telegram_user_id.
            expect(key).toBe(expected);
            // (2) Always namespaced with "tg:" — never the web "check:<ip>" form.
            expect(key.startsWith("tg:")).toBe(true);
            expect(key.startsWith("check:")).toBe(false);
            // (3) Never an IP-based key, and never derived from the chat id when
            //     it differs from the user id.
            expect(IP_RE.test(key)).toBe(false);
            if (chatId !== userId) {
              expect(key).not.toBe(`tg:${chatId}`);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
