// Feature: telegram-bot-mvp, Property 3
// Feature: telegram-bot-mvp, Property 7
//
// Property-based tests for the Telegram webhook CORE contract (task 9.2). The
// unit under test is the pure handler `handleTelegramWebhook(request: Request)`
// exported from `webhook.server.ts`; its step order is fixed by Requirement 12.
//
// Property 3 (design.md → "Webhook без валидного токена не обрабатывает update
//   и не валидирует структуру", Validates: Requirements 12.1, 12.2):
//     ∀ update, ∀ absent/empty/mismatched `X-Telegram-Bot-Api-Secret-Token`
//     (and ∀ missing-config cases): the response status == 401, `dispatchUpdate`
//     is NEVER called, and the request body is NEVER parsed/validated.
//
// Property 7 (design.md → "Webhook после валидного токена и валидной структуры
//   всегда отвечает 200", Validates: Requirements 12.4, 12.5):
//     ∀ valid update + matching token, the response status == 200 — even when
//     `dispatchUpdate` throws (processing error after a valid token → log + 200,
//     so Telegram does not retry forever).
//
// To exercise the real contract while keeping the test hermetic:
//   - `@/lib/telegram/router` is mocked PARTIALLY via `vi.importActual` so the
//     REAL `telegramUpdateSchema` validates structure, while `dispatchUpdate` is
//     replaced by a counting/throwing spy.
//   - `@/lib/telegram/handlers` is mocked so `installTelegramHandlers` is a
//     no-op (avoids pulling the whole side-effecting handler/Bot-API/core chain).
//   - secrets are driven through `process.env` (fake values) and restored after
//     each test; `console.error` is silenced (the misconfig path logs).
import process from "node:process";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted state referenced inside the (hoisted) vi.mock factory below.
const hoisted = vi.hoisted(() => ({
  dispatchCalls: 0,
  dispatchShouldThrow: false,
}));

// Partial mock: keep the REAL telegramUpdateSchema, replace dispatchUpdate with
// a spy that counts calls and can be made to throw (Property 7).
vi.mock("@/lib/telegram/router", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/router")>();
  return {
    ...actual,
    dispatchUpdate: vi.fn(async () => {
      hoisted.dispatchCalls++;
      if (hoisted.dispatchShouldThrow) {
        throw new Error("dispatch boom (simulated processing error)");
      }
    }),
  };
});

// No-op the handler aggregator so importing the webhook core does not drag in
// the concrete handlers (and their Bot-API / service-role imports).
vi.mock("@/lib/telegram/handlers", () => ({
  installTelegramHandlers: () => {},
}));

vi.mock("@/lib/telegram/webhook-dedup.server", () => ({
  claimTelegramWebhookUpdate: vi.fn(async () => "claimed"),
}));

import { __resetTelegramWebhookDedupeForTests, handleTelegramWebhook } from "./webhook.server";

const WEBHOOK_URL = "https://example.com/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";

// Safe, non-empty ASCII token alphabet so generated secrets/headers are always
// valid HTTP header values (no control chars / newlines that `Headers` rejects).
const SAFE = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
const safeTokenArb = (min = 1, max = 24) =>
  fc
    .array(fc.integer({ min: 0, max: SAFE.length - 1 }), { minLength: min, maxLength: max })
    .map((idxs) => idxs.map((i) => SAFE[i]).join(""));

// Telegram ids kept within JS safe-integer range so JSON round-trips exactly.
const userIdArb = fc.integer({ min: 1, max: 2_147_483_647 });
const chatIdArb = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 });

// Snapshot the real env so each test restores it.
const ORIG_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ORIG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function setSecrets(secret: string | undefined, token: string | undefined): void {
  if (secret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = secret;
  if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = token;
}

/**
 * Build a synthetic webhook Request. `header === null` → header absent;
 * otherwise the header is set verbatim (including `""`). When `spyJson` is set,
 * `request.json` is replaced by a spy that REJECTS, so any attempt to parse the
 * body on the 401 path is detected both by the spy and by the status check.
 */
function buildRequest(opts: { header: string | null; body: string; spyJson?: boolean }): {
  request: Request;
  jsonSpy?: ReturnType<typeof vi.fn>;
} {
  const headers = new Headers();
  if (opts.header !== null) headers.set(SECRET_HEADER, opts.header);
  const request = new Request(WEBHOOK_URL, { method: "POST", headers, body: opts.body });
  if (opts.spyJson) {
    const jsonSpy = vi.fn(() =>
      Promise.reject(new Error("body must not be parsed on the 401 path")),
    );
    Object.defineProperty(request, "json", { value: jsonSpy, configurable: true, writable: true });
    return { request, jsonSpy };
  }
  return { request };
}

beforeEach(() => {
  hoisted.dispatchCalls = 0;
  hoisted.dispatchShouldThrow = false;
  __resetTelegramWebhookDedupeForTests();
  // The misconfig branch logs via console.error — silence it across runs.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  setSecrets(ORIG_SECRET, ORIG_TOKEN);
  vi.restoreAllMocks();
});

describe("webhook contract — Property 3: no valid token ⇒ 401, no dispatch, no body parse", () => {
  // Feature: telegram-bot-mvp, Property 3
  // Validates: Requirements 12.1, 12.2
  it("returns 401 without dispatching or parsing the body for any invalid-token / misconfig case (fast-check, ≥100 runs)", async () => {
    // How the secret header is supplied when the config IS present.
    const headerModeArb = fc.constantFrom<"absent" | "empty" | "wrong">("absent", "empty", "wrong");
    // Which secrets are configured. "ok" = both present (then the header must be
    // invalid); the others omit at least one secret → fail-closed 401 (R17.4).
    const configCaseArb = fc.constantFrom<"ok" | "noSecret" | "noToken" | "neither">(
      "ok",
      "noSecret",
      "noToken",
      "neither",
    );
    // Arbitrary request bodies, including invalid JSON and valid-looking JSON —
    // none of it should ever be read on the 401 path.
    const bodyArb = fc.oneof(
      fc.string({ maxLength: 80 }),
      fc.constant("{ this is : not json"),
      fc.constant('{"update_id":1,"message":{"message_id":1,"chat":{"id":1},"text":"hi"}}'),
      fc.constant(""),
    );

    await fc.assert(
      fc.asyncProperty(
        safeTokenArb(),
        safeTokenArb(),
        safeTokenArb(),
        headerModeArb,
        configCaseArb,
        bodyArb,
        async (secret, token, wrongRaw, headerMode, configCase, body) => {
          hoisted.dispatchCalls = 0;

          // Configure secrets per the case.
          const configuredSecret =
            configCase === "ok" || configCase === "noToken" ? secret : undefined;
          const configuredToken =
            configCase === "ok" || configCase === "noSecret" ? token : undefined;
          setSecrets(configuredSecret, configuredToken);

          // Build a header guaranteed NOT to be a valid match.
          let header: string | null;
          if (headerMode === "absent") {
            header = null;
          } else if (headerMode === "empty") {
            header = ""; // secret is always non-empty → mismatch
          } else {
            // "wrong" — ensure it differs from the configured secret.
            header = wrongRaw === secret ? `${wrongRaw}x` : wrongRaw;
          }

          const { request, jsonSpy } = buildRequest({ header, body, spyJson: true });
          const response = await handleTelegramWebhook(request);

          // (1) Token-stage failure always answers 401 (never 200) — R12.2 / R12.6.
          expect(response.status).toBe(401);
          // (2) The update is never handed to dispatch — R12.2.
          expect(hoisted.dispatchCalls).toBe(0);
          // (3) The body is never parsed/validated before the token is accepted.
          expect(jsonSpy!).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("webhook contract - duplicate update ids", () => {
  it("acks duplicate update_id deliveries without dispatching twice", async () => {
    setSecrets("secret", "bot-token");
    const update = {
      update_id: 4242,
      message: {
        message_id: 1,
        from: { id: 1001, language_code: "ru" },
        chat: { id: 5001 },
        text: "hello",
      },
    };

    const first = await handleTelegramWebhook(
      buildRequest({ header: "secret", body: JSON.stringify(update) }).request,
    );
    const second = await handleTelegramWebhook(
      buildRequest({ header: "secret", body: JSON.stringify(update) }).request,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(hoisted.dispatchCalls).toBe(1);
  });
});

describe("webhook contract - oversized bodies", () => {
  it("acks an oversized body after a valid token without dispatching", async () => {
    setSecrets("secret", "bot-token");
    const headers = new Headers({
      "content-type": "application/json",
      "content-length": String(1024 * 1024 + 1),
    });
    headers.set(SECRET_HEADER, "secret");

    const request = new Request(WEBHOOK_URL, {
      method: "POST",
      headers,
      body: "{}",
    });

    const response = await handleTelegramWebhook(request);

    expect(response.status).toBe(200);
    expect(hoisted.dispatchCalls).toBe(0);
  });
});

describe("webhook contract — Property 7: valid token + valid structure ⇒ always 200", () => {
  // Feature: telegram-bot-mvp, Property 7
  // Validates: Requirements 12.4, 12.5
  it("returns 200 for any valid update, even when dispatchUpdate throws (fast-check, ≥100 runs)", async () => {
    // Valid updates that satisfy the REAL telegramUpdateSchema.
    const messageUpdateArb = fc.record({
      update_id: fc.integer({ min: 1, max: 2_147_483_647 }),
      message: fc.record({
        message_id: fc.integer({ min: 1, max: 2_147_483_647 }),
        from: fc.record({
          id: userIdArb,
          language_code: fc.constantFrom("ru", "uz", "en"),
        }),
        chat: fc.record({ id: chatIdArb }),
        text: fc.string({ maxLength: 60 }),
      }),
    });
    const callbackUpdateArb = fc.record({
      update_id: fc.integer({ min: 1, max: 2_147_483_647 }),
      callback_query: fc.record({
        id: safeTokenArb(1, 12),
        from: fc.record({ id: userIdArb }),
        message: fc.record({ chat: fc.record({ id: chatIdArb }) }),
        data: fc.constantFrom("lang:ru", "lang:uz", "report", "check_another", "emergency"),
      }),
    });
    const validUpdateArb = fc.oneof(messageUpdateArb, callbackUpdateArb);

    await fc.assert(
      fc.asyncProperty(
        safeTokenArb(),
        safeTokenArb(),
        validUpdateArb,
        fc.boolean(),
        async (secret, token, update, shouldThrow) => {
          hoisted.dispatchCalls = 0;
          hoisted.dispatchShouldThrow = shouldThrow;
          __resetTelegramWebhookDedupeForTests();
          setSecrets(secret, token);

          // Matching token + a JSON body that parses cleanly with the real schema.
          const { request } = buildRequest({
            header: secret,
            body: JSON.stringify(update),
          });
          const response = await handleTelegramWebhook(request);

          // Always 200 after a valid token + valid structure — including when the
          // handler threw (the error is logged and swallowed) — R12.4 / R12.5.
          expect(response.status).toBe(200);
          // The valid update reached dispatch exactly once.
          expect(hoisted.dispatchCalls).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
