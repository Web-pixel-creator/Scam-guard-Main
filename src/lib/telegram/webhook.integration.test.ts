// End-to-end integration tests for the Telegram webhook (Ishonch Guard bot) —
// task 9.3. The unit under test is the public `handleTelegramWebhook(request)`
// from `webhook.server.ts`, exercised through the REAL chain:
//
//     webhook.server → router (dispatchUpdate / decideRoute / schema)
//                     → handlers (commands / check / image / misc, via the real
//                       aggregator `installTelegramHandlers`)
//                     → format (formatCheckResult, real MarkdownV2)
//                     → check-core `runCheck` (real, rules-first scoring)
//
// Only the EXTERNAL boundaries are mocked, so the dispatch + routing + handler +
// formatting + scoring logic all run for real:
//
//   • `@/lib/telegram/api.server`            — Bot API I/O. We intercept
//        `sendMessage` (capture chatId / text / keyboard), no-op
//        `sendChatAction` / `answerCallbackQuery`, and stub `getFile` /
//        `downloadFileAsDataUrl`. `escapeMarkdownV2` is kept REAL (importActual)
//        so the formatter produces genuine MarkdownV2.
//   • `@/integrations/supabase/client.server` — `supabaseAdmin`. A chainable
//        in-memory fake records every `from()` / `insert` / `upsert` so we can
//        assert WHAT is persisted (and prove the screenshot is NOT).
//   • `@/lib/risk/check-core`                 — partial mock: `runCheck` is kept
//        REAL (real scoring) while `analyzeImageCore` is replaced with a stub
//        that returns controllable structured evidence for the photo case.
//   • global `fetch`                          — AI gateway. Stubbed so
//        `runCheck`'s `aiExplain` never hits the network.
//   • `@/lib/report.functions`                — `submitReport` stub (never hit on
//        the check/image path; mocked only to keep the import graph hermetic).
//
// Cases (task 9.3 / Requirements 5.3, 12.2, 12.4, 12.5):
//   1. Wrong/absent token → 401 AND no handler ran (no outgoing sendMessage).
//   2. Valid token + text update → 200 AND exactly one sendMessage at the
//      correct risk level (real router → handlers → format chain).
//   3. A throw inside a handler → still 200 (Telegram must not retry).
//   4. Photo update → getFile + downloadFileAsDataUrl (in memory) → OCR
//      (ocrExtractCore) → runCheck; the image is NEVER persisted (no storage /
//      no DB row holds the raw file).
import process from "node:process";
import QRCode from "qrcode";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted capture/control state — referenced inside the (hoisted) vi.mock
// factories below. Reset in beforeEach.
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  // Bot API capture
  sendCalls: [] as { chatId: number; text: string; keyboard?: unknown }[],
  chatActionCalls: [] as number[],
  answerCalls: [] as string[],
  inlineAnswerCalls: [] as Array<{ inlineQueryId: string; results: unknown[] }>,
  getFileCalls: [] as string[],
  downloadCalls: [] as string[],
  sendShouldThrow: false,
  sendNeverResolves: false,

  // Image analysis core stub
  ocrCalls: [] as { dataUrl: string; lang: string; key: string }[],
  ocrText: null as string | null,
  imageEvidence: null as unknown,

  // Stub data URL returned by the (mocked) downloader — contains a sentinel we
  // assert NEVER lands in any persisted payload.
  dataUrl: "data:image/jpeg;base64,U0NSRUVOU0hPVF9CWVRFUw==", // "SCREENSHOT_BYTES"

  // Supabase capture
  fromCalls: [] as string[],
  inserts: [] as { table: string; payload: unknown }[],
  upserts: [] as { table: string; payload: unknown }[],
  entityRow: null as unknown, // entities lookup result (null = no confirmed entity)
  sessionRow: null as unknown, // telegram_sessions row (null = default ru session)
}));

// ── Bot API: keep escapeMarkdownV2 real, replace all network helpers. ────────
vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: vi.fn(async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sendCalls.push(opts);
      if (h.sendShouldThrow) throw new Error("sendMessage boom (simulated handler error)");
      if (h.sendNeverResolves) return new Promise(() => {});
      return { ok: true };
    }),
    sendChatAction: vi.fn(async (chatId: number) => {
      h.chatActionCalls.push(chatId);
    }),
    answerCallbackQuery: vi.fn(async (id: string) => {
      h.answerCalls.push(id);
    }),
    answerInlineQuery: vi.fn(async (opts: { inlineQueryId: string; results: unknown[] }) => {
      h.inlineAnswerCalls.push(opts);
      return { ok: true };
    }),
    getFile: vi.fn(async (fileId: string) => {
      h.getFileCalls.push(fileId);
      return { filePath: "photos/file_42.jpg", fileSize: 2048 };
    }),
    downloadFileAsDataUrl: vi.fn(async (filePath: string) => {
      h.downloadCalls.push(filePath);
      return h.dataUrl;
    }),
  };
});

// ── Supabase service-role client: chainable in-memory fake. ──────────────────
vi.mock("@/integrations/supabase/client.server", () => {
  function builder(table: string) {
    const b = {
      select: () => b,
      eq: () => b,
      maybeSingle: async () => {
        if (table === "entities") return { data: h.entityRow, error: null };
        if (table === "telegram_sessions") return { data: h.sessionRow, error: null };
        return { data: null, error: null };
      },
      insert: async (payload: unknown) => {
        h.inserts.push({ table, payload });
        return { error: null };
      },
      upsert: async (payload: unknown) => {
        h.upserts.push({ table, payload });
        return { error: null };
      },
      update: () => b,
    };
    return b;
  }
  return {
    supabaseAdmin: {
      from: (table: string) => {
        h.fromCalls.push(table);
        return builder(table);
      },
    },
  };
});

// ── check-core: keep runCheck real, stub analyzeImageCore (photo path). ──────
vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return {
    ...actual,
    analyzeImageCore: vi.fn(async (dataUrl: string, lang: string, key: string) => {
      h.ocrCalls.push({ dataUrl, lang, key });
      if (h.imageEvidence) return h.imageEvidence;
      if (h.ocrText === null) return null;
      return {
        text: h.ocrText,
        visualCategory: "unknown",
        confidence: "medium",
        qr: { present: /qr/i.test(h.ocrText), visibleUrl: null, purpose: "unknown" },
        riskHints: [],
        summary: null,
      };
    }),
  };
});

// ── Report pipeline: never reached on the check/image path; stub to keep the
//    handler aggregator's import graph hermetic (no real createServerFn run). ──
vi.mock("@/lib/report.functions", () => ({
  submitReport: vi.fn(async () => ({ ok: true })),
  submitReportCore: vi.fn(async () => ({ ok: true })),
  reportRateLimitKeyForTelegram: (userId: number) => `report:tg:${userId}`,
}));

// Import AFTER the mocks are registered. The handler aggregator installs the
// REAL handlers into the REAL router via its module-load side effect, and
// webhook.server re-installs them (idempotent) before dispatching.
import { __resetTelegramWebhookDedupeForTests, handleTelegramWebhook } from "./webhook.server";
import { CB, RISK_EMOJI } from "./format";
import { imageTriageCallback } from "./image-fallback";
import { REPORT_NO_VALUE_CALLBACK, REPORT_RETRY_CALLBACK } from "./report-flow";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const WEBHOOK_URL = "https://app.example/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const SECRET = "test-webhook-secret";
const TOKEN = "test-bot-token";

const ORIG_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const ORIG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let syntheticUpdateId = 10_000;

function nextSyntheticUpdateId(): number {
  return syntheticUpdateId++;
}

/** Build a synthetic webhook Request. `header === null` → header absent. */
function webhookRequest(update: unknown, header: string | null = SECRET): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (header !== null) headers.set(SECRET_HEADER, header);
  return new Request(WEBHOOK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(update),
  });
}

/** A minimal valid text message update. */
function textUpdate(opts: {
  userId: number;
  chatId: number;
  text: string;
  message?: Record<string, unknown>;
}): unknown {
  return {
    update_id: nextSyntheticUpdateId(),
    message: {
      message_id: 1,
      from: { id: opts.userId, language_code: "ru" },
      chat: { id: opts.chatId },
      text: opts.text,
      ...opts.message,
    },
  };
}

/** A minimal valid inline-mode update. It intentionally has no chat id. */
function inlineQueryUpdate(opts: { userId: number; query: string; id?: string }): unknown {
  return {
    update_id: nextSyntheticUpdateId(),
    inline_query: {
      id: opts.id ?? `inline-${opts.userId}`,
      from: { id: opts.userId, language_code: "ru" },
      query: opts.query,
      offset: "",
    },
  };
}

/** A photo message update (two sizes — the router picks the largest). */
function photoUpdate(opts: {
  userId: number;
  chatId: number;
  messageId?: number;
  caption?: string;
  captionEntities?: unknown[];
  mediaGroupId?: string;
  replyMarkup?: unknown;
}): unknown {
  return {
    update_id: nextSyntheticUpdateId(),
    message: {
      message_id: opts.messageId ?? 1,
      from: { id: opts.userId, language_code: "ru" },
      chat: { id: opts.chatId },
      caption: opts.caption,
      caption_entities: opts.captionEntities,
      media_group_id: opts.mediaGroupId,
      reply_markup: opts.replyMarkup,
      photo: [
        { file_id: "thumb", file_size: 100 },
        { file_id: "full", file_size: 5000 },
      ],
    },
  };
}

/** A video update: text evidence wins; otherwise only thumbnail may be analyzed. */
function videoUpdate(opts: {
  userId: number;
  chatId: number;
  caption?: string;
  captionEntities?: unknown[];
  thumbnail?: { file_id: string; file_size?: number };
}): unknown {
  return {
    update_id: nextSyntheticUpdateId(),
    message: {
      message_id: 1,
      from: { id: opts.userId, language_code: "ru" },
      chat: { id: opts.chatId },
      caption: opts.caption,
      caption_entities: opts.captionEntities,
      video: {
        file_id: "video_1",
        file_size: 1024,
        duration: 2,
        thumbnail: opts.thumbnail,
      },
    },
  };
}

/** A callback query update from an inline keyboard button. */
function callbackUpdate(opts: {
  userId: number;
  chatId: number;
  data: string;
  id?: string;
}): unknown {
  return {
    update_id: nextSyntheticUpdateId(),
    callback_query: {
      id: opts.id ?? `cb-${opts.userId}`,
      from: { id: opts.userId },
      message: { chat: { id: opts.chatId } },
      data: opts.data,
    },
  };
}

/** Flatten an inline keyboard to its callback_data values. */
function callbackData(keyboard: unknown): string[] {
  if (!Array.isArray(keyboard)) return [];
  return (keyboard as { callback_data?: string }[][])
    .flat()
    .map((b) => b.callback_data)
    .filter((d): d is string => typeof d === "string");
}

function expectHighRiskResultWithGuardian(chatId: number) {
  expect(h.sendCalls).toHaveLength(2);
  const [result, guardian] = h.sendCalls;
  expect(result.chatId).toBe(chatId);
  expect(guardian.chatId).toBe(chatId);
  expect(result.text).toContain(RISK_EMOJI.high_risk);
  expect(guardian.text).toContain("после высокого риска");
  expect(callbackData(guardian.keyboard)).toContain("guardian:next");
  expect(callbackData(guardian.keyboard)).toContain("guardian:done");
  return result;
}

function loadLatestSessionUpsert(userId: number): void {
  const upsert = [...h.upserts].reverse().find((entry) => entry.table === "telegram_sessions")
    ?.payload as
    | {
        lang?: string;
        scenario?: string;
        scenario_step?: number;
        scenario_data?: unknown;
      }
    | undefined;

  h.sessionRow = {
    telegram_user_id: userId,
    lang: upsert?.lang ?? "ru",
    scenario: upsert?.scenario ?? "none",
    scenario_step: upsert?.scenario_step ?? 0,
    scenario_data: upsert?.scenario_data ?? {},
    updated_at: new Date().toISOString(),
  };
}

// A Russian text whose ONLY matched rule is `asks_to_scan_qr` (weight 50) →
// deterministic high_risk via `scoreFromCodes` (≥50). "Отсканируйте QR" matches
// the `скан.{0,15}qr` pattern; detectInputType → "text" (so no entities lookup).
const HIGH_RISK_TEXT = "Отсканируйте QR код для входа в аккаунт";

beforeEach(() => {
  // Reset capture state.
  syntheticUpdateId = 10_000;
  __resetTelegramWebhookDedupeForTests();
  h.sendCalls.length = 0;
  h.chatActionCalls.length = 0;
  h.answerCalls.length = 0;
  h.inlineAnswerCalls.length = 0;
  h.getFileCalls.length = 0;
  h.downloadCalls.length = 0;
  h.ocrCalls.length = 0;
  h.fromCalls.length = 0;
  h.inserts.length = 0;
  h.upserts.length = 0;
  h.sendShouldThrow = false;
  h.sendNeverResolves = false;
  h.ocrText = null;
  h.imageEvidence = null;
  h.entityRow = null;
  h.sessionRow = null;

  // Secrets the webhook reads per-request (R12.1 / R17.4). Fake values only.
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  process.env.TELEGRAM_BOT_TOKEN = TOKEN;

  // AI gateway boundary: runCheck.aiExplain → fetch. Return a clean completion
  // so it never touches the real network (explanation content is irrelevant to
  // the rules-based level).
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: "AI explanation stub." } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    ),
  );

  // Several paths log via console.error (misconfig, swallowed handler error) —
  // silence to keep the test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (ORIG_SECRET === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = ORIG_SECRET;
  if (ORIG_TOKEN === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
  else process.env.TELEGRAM_BOT_TOKEN = ORIG_TOKEN;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. Wrong / absent token → 401, no handler ran (no outgoing sendMessage).
// ---------------------------------------------------------------------------
describe("webhook end-to-end — invalid token (R12.2)", () => {
  it("rejects a mismatched token with 401 and never dispatches (no sendMessage)", async () => {
    const update = textUpdate({ userId: 1000, chatId: 5000, text: HIGH_RISK_TEXT });

    const response = await handleTelegramWebhook(webhookRequest(update, "totally-wrong-token"));

    expect(response.status).toBe(401);
    // The update never reached any handler — nothing was sent / looked up.
    expect(h.sendCalls).toHaveLength(0);
    expect(h.fromCalls).toHaveLength(0);
    expect(h.getFileCalls).toHaveLength(0);
  });

  it("rejects an absent token with 401 and never dispatches", async () => {
    const update = textUpdate({ userId: 1000, chatId: 5000, text: HIGH_RISK_TEXT });

    const response = await handleTelegramWebhook(webhookRequest(update, null));

    expect(response.status).toBe(401);
    expect(h.sendCalls).toHaveLength(0);
    expect(h.fromCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Valid token + text update → 200 + exactly one sendMessage at the correct
//    risk level (real router → handlers → format → runCheck chain).
// ---------------------------------------------------------------------------
describe("webhook end-to-end — text update reaches the real check chain (R12.4)", () => {
  it("responds 200 and sends exactly one high_risk result for a QR-scam text", async () => {
    const update = textUpdate({ userId: 1001, chatId: 5001, text: HIGH_RISK_TEXT });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);

    const sent = expectHighRiskResultWithGuardian(5001);

    // Correct risk level surfaced by the REAL formatter: high_risk emoji + the
    // localized "Высокий риск" label — proof the rules-based level reached format.
    expect(sent.text).toContain(RISK_EMOJI.high_risk); // 🔴
    expect(sent.text).toContain("Высокий риск");

    // high_risk keyboard carries the extra Emergency button (R20.3) alongside
    // Report / Check another — proof the level propagated through format.
    const data = callbackData(sent.keyboard);
    expect(data).toContain("report");
    expect(data).toContain("check_another");
    expect(data).toContain("emergency");

    // The real core logged the check (redacted) into `checks`.
    expect(h.inserts.some((i) => i.table === "checks")).toBe(true);
  });

  it("answers inline queries without chat id and without persisting partial previews", async () => {
    const update = inlineQueryUpdate({
      userId: 1099,
      id: "inline-check-1",
      query: "Срочно назовите SMS код от банка",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(0);
    expect(h.inlineAnswerCalls).toHaveLength(1);
    expect(h.inlineAnswerCalls[0].inlineQueryId).toBe("inline-check-1");
    expect(h.inlineAnswerCalls[0].results).toHaveLength(1);
    expect(h.inserts.some((i) => i.table === "checks")).toBe(false);
  });

  it("shows public forward source context without persisting the source metadata", async () => {
    const update = textUpdate({
      userId: 1002,
      chatId: 5002,
      text: "100 фриспинов за депозит. Вход по ссылке https://t.me/+giftNFT12345",
      message: {
        forward_origin: {
          type: "channel",
          chat: {
            id: -100123,
            type: "channel",
            title: "LUXEBET Promo",
            username: "luxebet_promo",
          },
          message_id: 77,
        },
      },
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    const sent = expectHighRiskResultWithGuardian(5002);
    expect(sent.text).toContain("Источник");
    expect(sent.text).toContain("LUXEBET Promo");
    expect(sent.text).toContain("Схема");
    expect(sent.text).toContain("Цель");
    expect(sent.text).toContain("Шаг");
    expect(sent.text).toContain("скрытые метки");
    expect(sent.text).toContain("казино");

    const persisted = JSON.stringify([...h.inserts, ...h.upserts]);
    expect(persisted).toContain("crypto_casino_bonus_funnel");
    expect(persisted).not.toContain("LUXEBET Promo");
    expect(persisted).not.toContain("luxebet_promo");
    expect(persisted).not.toContain("forward_origin");
  });

  it("answers a meta-question to the bot without running the risk pipeline", async () => {
    const update = textUpdate({
      userId: 1004,
      chatId: 5004,
      text: "Почему ты не смог проанализировать картинку?",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(5004);
    expect(h.sendCalls[0].text).toContain("изображение");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((i) => i.table === "checks")).toBe(false);
  });

  it("explains Telegram account visibility limits instead of returning insufficient data", async () => {
    const update = textUpdate({
      userId: 1005,
      chatId: 5005,
      text: "Ты видишь scam метку и возраст Telegram аккаунта?",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(5005);
    expect(h.sendCalls[0].text).toContain("скрытую метку SCAM");
    expect(h.sendCalls[0].text).toContain("возраст аккаунта");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((i) => i.table === "checks")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2b. Real /start + inline callback flows. This catches Telegram UX regressions
//     such as not answering callback_query (stuck button spinner).
// ---------------------------------------------------------------------------
describe("webhook end-to-end — start and quick button callbacks", () => {
  it("sends /start with language and quick-action buttons", async () => {
    const update = textUpdate({ userId: 1100, chatId: 5100, text: "/start" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(5100);

    const data = callbackData(h.sendCalls[0].keyboard);
    expect(data).toEqual(
      expect.arrayContaining([
        CB.checkAnother,
        CB.report,
        CB.emergency,
        CB.safety,
        CB.showLang,
        CB.howItWorks,
        CB.digest,
        CB.familyMenu,
      ]),
    );
  });

  it("sends /menu with the same quick-action main menu as /start", async () => {
    const update = textUpdate({ userId: 1105, chatId: 5105, text: "/menu" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      CB.emergency,
      CB.checkAnother,
      CB.familyMenu,
      CB.digest,
      CB.report,
      CB.safety,
      CB.howItWorks,
      CB.showLang,
    ]);
  });

  it("answers hidden /chatid command in a group without exposing secrets", async () => {
    const chatId = -100222333444;
    const update = textUpdate({
      userId: 1112,
      chatId,
      text: "/chatid",
      message: { chat: { id: chatId, type: "supergroup" } },
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(chatId);
    expect(h.sendCalls[0].text).toContain("Chat ID");
    expect(h.sendCalls[0].text).toContain(String(chatId));
    expect(h.sendCalls[0].text).toContain("moderation:smoke");
    expect(h.sendCalls[0].text).not.toContain("TELEGRAM_BOT_TOKEN");
    expect(h.sendCalls[0].text).not.toContain("WEBHOOK_SECRET");
  });

  it("sends /appeal with a public correction form button and report fallback", async () => {
    const update = textUpdate({ userId: 1109, chatId: 5109, text: "/appeal" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Исправить запись");
    expect(JSON.stringify(h.sendCalls[0].keyboard)).toContain("/appeal");
    expect(callbackData(h.sendCalls[0].keyboard)).toContain(CB.report);
  });

  it("does not expose Family Shield invite links in group chats", async () => {
    const update = {
      update_id: 1108,
      callback_query: {
        id: "cb-family-group",
        from: { id: 1108 },
        message: { chat: { id: -5108, type: "group" } },
        data: "family:invite",
      },
    };

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(-5108);
    expect(h.sendCalls[0].text).toContain("личном чате");
    expect(JSON.stringify(h.sendCalls[0])).not.toContain("https://t.me/");
  });

  it("sends /panic with paginated scenario buttons (page 1)", async () => {
    const update = textUpdate({ userId: 1104, chatId: 5104, text: "/panic" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      "panic:1",
      "panic:2",
      "panic:3",
      "panic:4",
      "panic:5",
      "panic:6",
      "panic:more",
    ]);
  });

  it("opens the live-call copilot directly with /call", async () => {
    const userId = 1110;
    const update = textUpdate({ userId, chatId: 5110, text: "/call" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Похоже, звонок рискованный");
    expect(h.sendCalls[0].text).toContain("Я сам перезвоню");
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      "livecall:hangup",
      "livecall:what_to_say",
      "livecall:sent_code",
      "livecall:tell_family",
    ]);
    expect(callbackData(h.sendCalls[0].keyboard)).not.toContain("livecall:call_bank");

    loadLatestSessionUpsert(userId);
    expect(h.sessionRow).toMatchObject({
      scenario: "none",
      scenario_step: 0,
      scenario_data: expect.objectContaining({ lastPanicId: 6 }),
    });
  });

  it("answers unsupported video with next-step buttons instead of a dead end", async () => {
    const update = videoUpdate({ userId: 1106, chatId: 5106 });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("аудиофайл до 60 секунд");
    expect(h.sendCalls[0].text).toContain("скрин кадра");
    expect(h.sendCalls[0].text).toContain("ставки");
    expect(h.sendCalls[0].text).toContain("гарантированный доход");
    expect(h.getFileCalls).toHaveLength(0);
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      CB.checkAnother,
      CB.emergency,
      CB.report,
      CB.mediaTips,
    ]);
  });

  it("answers media tips callback with concrete capture instructions", async () => {
    const response = await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId: 1106, chatId: 5106, data: CB.mediaTips })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Как прислать видео");
    expect(h.sendCalls[0].text).toContain("скрин кадра");
    expect(h.sendCalls[0].text).toContain("ссылку из описания");
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      CB.checkAnother,
      CB.emergency,
      CB.report,
      CB.mediaTips,
    ]);
  });

  it("answers unreadable-image triage callbacks with scenario-specific safe steps", async () => {
    const response = await handleTelegramWebhook(
      webhookRequest(
        callbackUpdate({
          userId: 1108,
          chatId: 5108,
          data: imageTriageCallback("casino"),
          id: "cb-img-casino",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-img-casino"]);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Казино");
    expect(h.sendCalls[0].text).toContain("депозит");
    expect(h.sendCalls[0].text).toContain("не платите за доступ");
    expect(h.sendCalls[0].text).not.toMatch(/точно мошенник|создан недавно|есть жалобы/i);
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      CB.checkAnother,
      CB.mediaTips,
      CB.emergency,
    ]);
    expect(callbackData(h.sendCalls[0].keyboard)).not.toContain(imageTriageCallback("gift"));
    expect(callbackData(h.sendCalls[0].keyboard)).not.toContain(imageTriageCallback("casino"));
  });

  it("answers orphan follow-up wording with guidance instead of insufficient-data risk card", async () => {
    const update = textUpdate({ userId: 1107, chatId: 5107, text: "Точно?" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("не вижу, к какой именно проверке");
    expect(h.sendCalls[0].text).toContain("сам QR не опасен");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
  });

  it.each([
    ["check another", CB.checkAnother],
    ["report", CB.report],
    ["emergency", CB.emergency],
    ["panic scenario", "panic:1"],
    ["show language picker", CB.showLang],
    ["safety", CB.safety],
    ["how it works", CB.howItWorks],
    ["family menu", CB.familyMenu],
    ["media tips", CB.mediaTips],
    ["image triage", imageTriageCallback("gift")],
    ["language switch", CB.lang("uz")],
  ])("acknowledges the %s callback and sends a response", async (_label, data) => {
    const update = callbackUpdate({
      userId: 1101,
      chatId: 5101,
      data,
      id: `cb-${data}`,
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual([`cb-${data}`]);
    expect(h.sendCalls.length).toBeGreaterThanOrEqual(1);
    expect(h.sendCalls.every((call) => call.chatId === 5101)).toBe(true);
  });

  it("starts the report scenario from the report button", async () => {
    const update = callbackUpdate({
      userId: 1102,
      chatId: 5102,
      data: CB.report,
      id: "cb-report-start",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-report-start"]);
    expect(h.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "telegram_sessions",
          payload: expect.objectContaining({
            telegram_user_id: 1102,
            scenario: "report_value",
            scenario_step: 0,
            scenario_data: {},
          }),
        }),
      ]),
    );
    expect(h.sendCalls).toHaveLength(1);
    expect(callbackData(h.sendCalls[0].keyboard)).toContain(REPORT_NO_VALUE_CALLBACK);
  });

  it("acknowledges report skip callbacks before advancing the report scenario", async () => {
    h.sessionRow = {
      telegram_user_id: 1103,
      lang: "ru",
      scenario: "report_scamType",
      scenario_step: 2,
      scenario_data: { value: "@bad", description: "long enough" },
      updated_at: new Date(0).toISOString(),
    };
    const update = callbackUpdate({
      userId: 1103,
      chatId: 5103,
      data: "report_skip",
      id: "cb-report-skip",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-report-skip"]);
    expect(h.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "telegram_sessions",
          payload: expect.objectContaining({
            telegram_user_id: 1103,
            scenario: "report_city",
            scenario_step: 3,
          }),
        }),
      ]),
    );
    expect(h.sendCalls).toHaveLength(1);
  });

  it("acknowledges the report no-value callback and advances to description", async () => {
    h.sessionRow = {
      telegram_user_id: 1105,
      lang: "ru",
      scenario: "report_value",
      scenario_step: 0,
      scenario_data: {},
      updated_at: new Date(0).toISOString(),
    };
    const update = callbackUpdate({
      userId: 1105,
      chatId: 5105,
      data: REPORT_NO_VALUE_CALLBACK,
      id: "cb-report-no-value",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-report-no-value"]);
    expect(h.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "telegram_sessions",
          payload: expect.objectContaining({
            telegram_user_id: 1105,
            scenario: "report_desc",
            scenario_step: 1,
            scenario_data: { noValue: true },
          }),
        }),
      ]),
    );
    expect(h.sendCalls).toHaveLength(1);
  });

  it("acknowledges the report retry callback and clears the draft after success", async () => {
    h.sessionRow = {
      telegram_user_id: 1106,
      lang: "ru",
      scenario: "report_amount",
      scenario_step: 4,
      scenario_data: {
        value: "+998900000000",
        description: "Достаточно длинное описание",
      },
      updated_at: new Date(0).toISOString(),
    };
    const update = callbackUpdate({
      userId: 1106,
      chatId: 5106,
      data: REPORT_RETRY_CALLBACK,
      id: "cb-report-retry",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-report-retry"]);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.upserts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "telegram_sessions",
          payload: expect.objectContaining({
            telegram_user_id: 1106,
            scenario: "none",
            scenario_step: 0,
            scenario_data: {},
          }),
        }),
      ]),
    );
  });

  it.each([
    "panic:1",
    "panic:2",
    "panic:3",
    "panic:4",
    "panic:5",
    "panic:7",
    "panic:8",
    "panic:9",
    "panic:10",
  ])("acknowledges %s and returns concrete panic advice", async (data) => {
    const update = callbackUpdate({
      userId: 1110,
      chatId: 5110,
      data,
      id: `cb-${data}`,
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual([`cb-${data}`]);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(5110);
    expect(h.sendCalls[0].text.length).toBeGreaterThan(50);
  });

  it("turns panic:6 into an interactive live-call copilot", async () => {
    const update = callbackUpdate({
      userId: 1111,
      chatId: 5111,
      data: "panic:6",
      id: "cb-panic-6",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-panic-6"]);
    expect(h.sendCalls).toHaveLength(1);
    const data = callbackData(h.sendCalls[0].keyboard);
    expect(data).toEqual(
      expect.arrayContaining([
        "livecall:hangup",
        "livecall:what_to_say",
        "livecall:sent_code",
        "livecall:tell_family",
      ]),
    );
    expect(data).not.toContain("livecall:call_bank");
  });

  it.each([
    ["why", CB.why],
    ["share advice", "share_advice"],
    ["live call hangup", "livecall:hangup"],
    ["live call words", "livecall:what_to_say"],
    ["live call bank", "livecall:call_bank"],
    ["live call sent code", "livecall:sent_code"],
    ["live call tell family", "livecall:tell_family"],
  ])("acknowledges the %s callback and sends a response", async (_label, data) => {
    const update = callbackUpdate({
      userId: 1112,
      chatId: 5112,
      data,
      id: `cb-${data}`,
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual([`cb-${data}`]);
    expect(h.sendCalls.length).toBeGreaterThanOrEqual(1);
    expect(h.sendCalls.every((call) => call.chatId === 5112)).toBe(true);
  });

  it("answers an APK panic follow-up with contextual next steps", async () => {
    const userId = 1120;
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5120, data: "panic:2", id: "cb-apk" })),
    );
    loadLatestSessionUpsert(userId);
    h.sendCalls.length = 0;

    const response = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId, chatId: 5120, text: "Что еще посоветуешь?" })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("авиарежим");
    expect(h.sendCalls[0].text).toContain("С другого телефона");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual(
      expect.arrayContaining(["panicctx:2:more", "panicctx:2:contacts", "family:notify"]),
    );
  });

  it("answers stale panic follow-up buttons using the callback scenario id instead of the latest session context", async () => {
    const userId = 1125;
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5125, data: "panic:2", id: "cb-old-apk" })),
    );
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5125, data: "panic:4", id: "cb-new-card" })),
    );
    loadLatestSessionUpsert(userId);
    h.sendCalls.length = 0;

    const response = await handleTelegramWebhook(
      webhookRequest(
        callbackUpdate({ userId, chatId: 5125, data: "panicctx:2:more", id: "cb-stale-apk-more" }),
      ),
    );

    expect(response.status).toBe(200);
    expect(h.answerCalls).toContain("cb-stale-apk-more");
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("авиарежим");
    expect(h.sendCalls[0].text).not.toContain("Проверьте последние операции");
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual(
      expect.arrayContaining(["panicctx:2:more", "panicctx:2:contacts"]),
    );
  });

  it("answers a card-data panic follow-up with verified bank contact guidance", async () => {
    const userId = 1121;
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5121, data: "panic:4", id: "cb-card" })),
    );
    loadLatestSessionUpsert(userId);
    h.sendCalls.length = 0;

    const response = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId, chatId: 5121, text: "Дай мне номер банка" })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Безопасный обратный звонок");
    expect(h.sendCalls[0].text).toContain("Не звоните на входящий номер");
    expect(h.sendCalls[0].text).toContain("1340");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
  });

  it("answers stress wording with trusted-person guidance after a panic scenario", async () => {
    const userId = 1124;
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5124, data: "panic:6", id: "cb-stress" })),
    );
    loadLatestSessionUpsert(userId);
    h.sendCalls.length = 0;

    const response = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId, chatId: 5124, text: "Я нервничаю, позови близкого" })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Позовите человека");
    expect(h.sendCalls[0].text).toContain("побудь со мной");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
  });

  it("answers live-call wording questions with a ready script", async () => {
    const userId = 1122;
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5122, data: "panic:6", id: "cb-call" })),
    );
    loadLatestSessionUpsert(userId);
    h.sendCalls.length = 0;

    const response = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId, chatId: 5122, text: "что сказать?" })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Готовая фраза");
    expect(h.sendCalls[0].text).toContain("Я сам перезвоню");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
  });

  it("keeps suspicious payloads on the risk pipeline even after panic context", async () => {
    const userId = 1123;
    await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId, chatId: 5123, data: "panic:2", id: "cb-risk" })),
    );
    loadLatestSessionUpsert(userId);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const response = await handleTelegramWebhook(
      webhookRequest(
        textUpdate({
          userId,
          chatId: 5123,
          text: "Проверь https://kapitalbank.uz.evil.com",
        }),
      ),
    );

    expect(response.status).toBe(200);
    const sent = expectHighRiskResultWithGuardian(5123);
    expect(sent.text).not.toContain("Следующий безопасный шаг");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(true);
  });

  it("acknowledges unknown callback data without sending a message", async () => {
    const update = callbackUpdate({
      userId: 1113,
      chatId: 5113,
      data: "totally_unknown_callback",
      id: "cb-unknown",
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.answerCalls).toEqual(["cb-unknown"]);
    expect(h.sendCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. A throw inside a handler → still 200 (Telegram must not retry, R12.5).
// ---------------------------------------------------------------------------
describe("webhook end-to-end — handler error still acknowledges 200 (R12.5)", () => {
  it("returns 200 even when a handler throws after a valid token", async () => {
    h.sendShouldThrow = true; // make the Bot API send throw inside the handler
    // /help routes straight to handleCommand → sendMessage (not wrapped in the
    // check-handler guard), so the throw propagates out of dispatchUpdate.
    const update = textUpdate({ userId: 1002, chatId: 5002, text: "/help" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    // The handler WAS reached (it attempted to send before throwing).
    expect(h.sendCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("returns 200 after the ack timeout even if dispatch is still running", async () => {
    vi.useFakeTimers();
    h.sendNeverResolves = true;
    const update = textUpdate({ userId: 1004, chatId: 5004, text: "/help" });

    const responsePromise = handleTelegramWebhook(webhookRequest(update));
    await vi.advanceTimersByTimeAsync(8_000);

    const response = await responsePromise;
    expect(response.status).toBe(200);
    expect(h.sendCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 4. Photo update → getFile + downloadFileAsDataUrl (in memory) → OCR → check;
//    the image itself is NEVER persisted (R5.3, R12.2/R12.4).
// ---------------------------------------------------------------------------
describe("webhook end-to-end — screenshot OCR flow without saving the image (R5.3)", () => {
  it("downloads in memory, OCRs, checks, and never persists the raw image", async () => {
    h.ocrText = HIGH_RISK_TEXT; // OCR yields a deterministic high_risk text
    const update = photoUpdate({ userId: 1003, chatId: 5003 });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);

    // getFile on the LARGEST photo, then download to a data URL (in memory).
    expect(h.getFileCalls).toEqual(["full"]);
    expect(h.downloadCalls).toEqual(["photos/file_42.jpg"]);

    // OCR ran on the downloaded data URL with the bot's tg:<userId> key.
    expect(h.ocrCalls).toHaveLength(1);
    expect(h.ocrCalls[0]).toMatchObject({
      dataUrl: h.dataUrl,
      lang: "ru",
      key: "tg:1003",
    });

    // Result + Guardian Angel companion went out.
    expectHighRiskResultWithGuardian(5003);

    // ── The image is NOT saved anywhere ───────────────────────────────────
    // Session metadata may be upserted, but the image never goes to storage or
    // a raw-file table; the `checks` row is redacted by the risk core.
    expect(h.upserts.every((i) => i.table === "telegram_sessions")).toBe(true);
    expect(h.inserts.every((i) => ["telegram_webhook_updates", "checks"].includes(i.table))).toBe(
      true,
    );
    expect(h.inserts.some((i) => i.table === "checks")).toBe(true);

    // No persisted payload (nor any DB table touched) carries the raw image
    // bytes / data URL — the screenshot lived only in memory.
    const persisted = JSON.stringify([...h.inserts, ...h.upserts]);
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("U0NSRUVOU0hPVF9CWVRFUw"); // the base64 sentinel
    expect(h.fromCalls).not.toContain("storage");
    expect(h.fromCalls).not.toContain("objects");
  });

  it("uses a video thumbnail as image evidence without fetching the full video", async () => {
    h.ocrText = HIGH_RISK_TEXT;
    const update = videoUpdate({
      userId: 1009,
      chatId: 5009,
      thumbnail: { file_id: "video_thumb", file_size: 900 },
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.getFileCalls).toEqual(["video_thumb"]);
    expect(h.getFileCalls).not.toContain("video_1");
    expect(h.downloadCalls).toEqual(["photos/file_42.jpg"]);
    expect(h.ocrCalls).toHaveLength(1);
    expect(h.ocrCalls[0]).toMatchObject({
      dataUrl: h.dataUrl,
      lang: "ru",
      key: "tg:1009",
    });
    expectHighRiskResultWithGuardian(5009);

    const persisted = JSON.stringify([...h.inserts, ...h.upserts]);
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("U0NSRUVOU0hPVF9CWVRFUw");
  });

  it("checks a photo caption with hidden Telegram link before OCR", async () => {
    const update = photoUpdate({
      userId: 1004,
      chatId: 5004,
      caption: "СЕГОДНЯ СТАВЛЮ НА МАТЧ США - ГЕРМАНИЯ. Посмотреть прогноз бесплатно",
      captionEntities: [
        {
          type: "text_link",
          offset: 45,
          length: 29,
          url: "https://t.me/+fdOETKx56pozNTBi",
        },
      ],
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.getFileCalls).toHaveLength(0);
    expect(h.downloadCalls).toHaveLength(0);
    expect(h.ocrCalls).toHaveLength(0);
    expectHighRiskResultWithGuardian(5004);
    expect(JSON.stringify(h.inserts)).toContain("suspicious_invite_link");
    expect(JSON.stringify(h.inserts)).toContain("gambling_prediction_promo");
  });

  it("checks inline keyboard URL buttons from forwarded image posts", async () => {
    const update = photoUpdate({
      userId: 1005,
      chatId: 5005,
      replyMarkup: {
        inline_keyboard: [[{ text: "Участвую", url: "https://t.me/+giftNFT12345" }]],
      },
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.getFileCalls).toHaveLength(0);
    expect(h.ocrCalls).toHaveLength(0);
    expectHighRiskResultWithGuardian(5005);
    expect(JSON.stringify(h.inserts)).toContain("suspicious_invite_link");
    expect(JSON.stringify(h.inserts)).toContain("giveaway_engagement_bait");
  });

  it("checks a video caption instead of returning unsupported-media fallback", async () => {
    const update = videoUpdate({
      userId: 1006,
      chatId: 5006,
      caption: "100 фриспинов за депозит, ссылка на Twin",
      thumbnail: { file_id: "video_thumb", file_size: 900 },
    });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.getFileCalls).toHaveLength(0);
    expect(h.downloadCalls).toHaveLength(0);
    expect(h.ocrCalls).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain(RISK_EMOJI.suspicious);
    expect(h.sendCalls[0].text).not.toContain("видео я пока не анализирую");
    expect(JSON.stringify(h.inserts)).toContain("gambling_prediction_promo");
  });

  it("sends only one OCR fallback for repeated photos from the same media group", async () => {
    h.ocrText = null;

    const first = await handleTelegramWebhook(
      webhookRequest(
        photoUpdate({ userId: 1007, chatId: 5007, messageId: 1, mediaGroupId: "album-42" }),
      ),
    );
    const second = await handleTelegramWebhook(
      webhookRequest(
        photoUpdate({ userId: 1007, chatId: 5007, messageId: 2, mediaGroupId: "album-42" }),
      ),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(h.getFileCalls).toHaveLength(2);
    expect(h.downloadCalls).toHaveLength(2);
    expect(h.ocrCalls).toHaveLength(2);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("не смог");
    expect(callbackData(h.sendCalls[0].keyboard)).toContain(imageTriageCallback("gift"));
    expect(callbackData(h.sendCalls[0].keyboard)).toContain(imageTriageCallback("casino"));
  });

  it("uses a short repeat fallback for repeated unreadable standalone images", async () => {
    h.ocrText = null;
    h.sessionRow = {
      telegram_user_id: 1008,
      lang: "en",
      scenario: "none",
      scenario_step: 0,
      scenario_data: {},
      updated_at: new Date().toISOString(),
    };

    const first = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1008, chatId: 5008, messageId: 1 })),
    );
    const second = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1008, chatId: 5008, messageId: 2 })),
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(h.getFileCalls).toHaveLength(2);
    expect(h.downloadCalls).toHaveLength(2);
    expect(h.ocrCalls).toHaveLength(2);
    expect(h.sendCalls).toHaveLength(2);
    expect(h.sendCalls[0].text).toContain("reliably read the text or QR");
    expect(h.sendCalls[1].text).toContain("received another image");
    expect(h.sendCalls[1].text).toContain("closer screenshot");
    expect(h.sendCalls[1].text).not.toContain("open it only when you trust");
    expect(callbackData(h.sendCalls[0].keyboard)).toContain(imageTriageCallback("wallet"));
    expect(callbackData(h.sendCalls[1].keyboard)).toContain(imageTriageCallback("qr_menu"));

    const persisted = JSON.stringify(h.upserts);
    expect(persisted).toContain("image_unreadable");
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("photos/file_42.jpg");
  });

  it("answers 'Sure?' from unreadable-image context instead of running an unknown risk check", async () => {
    h.ocrText = null;
    h.sessionRow = {
      telegram_user_id: 1009,
      lang: "en",
      scenario: "none",
      scenario_step: 0,
      scenario_data: {},
      updated_at: new Date().toISOString(),
    };

    const first = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1009, chatId: 5009 })),
    );
    expect(first.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);

    loadLatestSessionUpsert(1009);
    h.sessionRow = {
      ...(h.sessionRow as Record<string, unknown>),
      lang: "en",
    };
    h.sendCalls.length = 0;
    h.inserts.length = 0;
    h.upserts.length = 0;

    const followUp = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1009, chatId: 5009, text: "Sure?" })),
    );

    expect(followUp.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("cannot be sure from that image");
    expect(h.sendCalls[0].text).toContain("will not invent a risk");
    expect(h.sendCalls[0].text).not.toContain("Insufficient data");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
    expect(h.upserts).toHaveLength(0);
  });

  it("keeps a normal delivery pickup SMS screenshot out of high risk", async () => {
    h.imageEvidence = {
      text: "kutadi\nBuyurtma 106894935 sizni topshirish punktida kutmoqda. Uni 23.05.2026gacha olib keting",
      visualCategory: "delivery_sms",
      confidence: "high",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: [],
      summary: "Похоже на SMS о выдаче заказа.",
    };

    const response = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1010, chatId: 5010 })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain(RISK_EMOJI.safe);
    expect(h.sendCalls[0].text).not.toContain(RISK_EMOJI.high_risk);
    expect(h.sendCalls[0].text).toContain("доставке");

    const persisted = JSON.stringify(h.inserts);
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("U0NSRUVOU0hPVF9CWVRFUw");
  });

  it("does not flag a restaurant QR menu as high risk without dangerous requests", async () => {
    h.imageEvidence = {
      text: "Уважаемые гости! Посетите сайт chenson.uz. Узнайте больше о нашем меню, акциях и онлайн-бронировании столов. Зарегистрируйтесь в Telegram-боте, отсканировав QR-код ниже.",
      visualCategory: "restaurant_menu_qr",
      confidence: "high",
      qr: { present: true, visibleUrl: "https://chenson.uz/loyalty", purpose: "menu" },
      riskHints: [],
      summary: "Похоже на ресторанное меню и QR программы лояльности.",
    };

    const response = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1011, chatId: 5011 })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain(RISK_EMOJI.safe);
    expect(h.sendCalls[0].text).not.toContain(RISK_EMOJI.high_risk);
    expect(h.sendCalls[0].text).toContain("Адрес рядом с QR");
    expect(h.sendCalls[0].text).toContain("chenson\\.uz/loyalty");
    expect(h.sendCalls[0].text).toContain("Сам QR по пикселям не подтверждён");

    const checkInsert = h.inserts.find((i) => i.table === "checks");
    expect(JSON.stringify(checkInsert)).not.toContain("asks_to_scan_qr");
  });

  it("answers 'Точно?' from the last QR/menu check context instead of re-checking it", async () => {
    h.imageEvidence = {
      text: "Уважаемые гости! Посетите сайт chenson.uz. Узнайте больше о нашем меню, акциях и онлайн-бронировании столов.",
      visualCategory: "restaurant_menu_qr",
      confidence: "high",
      qr: { present: true, visibleUrl: "https://chenson.uz/loyalty", purpose: "menu" },
      riskHints: [],
      summary: "Похоже на ресторанное меню и QR программы лояльности.",
    };

    const first = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1013, chatId: 5013 })),
    );
    expect(first.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);

    loadLatestSessionUpsert(1013);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const followUp = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1013, chatId: 5013, text: "Точно?" })),
    );

    expect(followUp.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Не могу гарантировать на 100%");
    expect(h.sendCalls[0].text).toContain("информационный QR");
    expect(h.sendCalls[0].text).toContain("SMS");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
  });

  it("keeps result buttons routed as callbacks, not as last-check follow-ups", async () => {
    h.imageEvidence = {
      text: "Уважаемые гости! Меню и информационный QR ресторана.",
      visualCategory: "restaurant_menu_qr",
      confidence: "high",
      qr: { present: true, visibleUrl: "https://chenson.uz/menu", purpose: "menu" },
      riskHints: [],
      summary: "Похоже на ресторанное меню.",
    };

    const first = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1014, chatId: 5014 })),
    );
    expect(first.status).toBe(200);
    loadLatestSessionUpsert(1014);

    h.sendCalls.length = 0;
    const why = await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId: 1014, chatId: 5014, data: CB.why })),
    );

    expect(why.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("сам QR не является скамом");
    expect(h.sendCalls[0].text).toContain("код, карту, логин или оплату");
    expect(h.sendCalls[0].text).not.toContain("Как я проверяю");

    h.sendCalls.length = 0;
    h.upserts.length = 0;
    const checkAnother = await handleTelegramWebhook(
      webhookRequest(callbackUpdate({ userId: 1014, chatId: 5014, data: CB.checkAnother })),
    );

    expect(checkAnother.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Пришлите");
    expect(h.sendCalls[0].text).not.toContain("Не могу гарантировать");
    expect(h.upserts.some((entry) => entry.table === "telegram_sessions")).toBe(true);

    loadLatestSessionUpsert(1014);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const followUpAfterPrompt = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1014, chatId: 5014, text: "Точно?" })),
    );

    expect(followUpAfterPrompt.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Не могу гарантировать");
    expect(h.sendCalls[0].text).toContain("QR");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
  });

  it("answers a bank-number follow-up from the last phone check without re-checking it", async () => {
    const first = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1015, chatId: 5015, text: "+998 90 123 45 67" })),
    );
    expect(first.status).toBe(200);
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(true);

    loadLatestSessionUpsert(1015);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const followUp = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1015, chatId: 5015, text: "дай номер банка" })),
    );

    expect(followUp.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Официальный обратный звонок");
    expect(h.sendCalls[0].text).toContain("1340");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
  });

  it("answers a next-step follow-up after a high-risk check without losing context", async () => {
    const first = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1016, chatId: 5016, text: HIGH_RISK_TEXT })),
    );
    expect(first.status).toBe(200);

    loadLatestSessionUpsert(1016);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const followUp = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1016, chatId: 5016, text: "Что делать дальше?" })),
    );

    expect(followUp.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Следующий безопасный шаг");
    expect(h.sendCalls[0].text).toContain("QR");
    expect(h.sendCalls[0].text).toContain("код");
    expect(h.sendCalls[0].text).not.toContain("Недостаточно данных");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
  });

  it("explains the previous result when the user asks why", async () => {
    const first = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1017, chatId: 5017, text: HIGH_RISK_TEXT })),
    );
    expect(first.status).toBe(200);

    loadLatestSessionUpsert(1017);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const followUp = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1017, chatId: 5017, text: "Почему так?" })),
    );

    expect(followUp.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("видимые признаки риска");
    expect(h.sendCalls[0].text).not.toMatch(/score|threshold|вес/i);
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(false);
  });

  it("still sends a suspicious payload after a last check into the risk pipeline", async () => {
    const first = await handleTelegramWebhook(
      webhookRequest(textUpdate({ userId: 1018, chatId: 5018, text: HIGH_RISK_TEXT })),
    );
    expect(first.status).toBe(200);

    loadLatestSessionUpsert(1018);
    h.sendCalls.length = 0;
    h.inserts.length = 0;

    const payload = await handleTelegramWebhook(
      webhookRequest(
        textUpdate({
          userId: 1018,
          chatId: 5018,
          text: "Проверь https://kapitalbank.uz.evil.com",
        }),
      ),
    );

    expect(payload.status).toBe(200);
    const sent = expectHighRiskResultWithGuardian(5018);
    expect(sent.text).not.toContain("Следующий безопасный шаг");
    expect(h.inserts.some((entry) => entry.table === "checks")).toBe(true);
  });

  it("scores Telegram giveaway/captcha image evidence through the normal check pipeline", async () => {
    h.imageEvidence = {
      text: 'TON Знаток. Разыгрываем 3 RANDOM NFT из "Банка подарков" через 48 часов. Из условий только: пройти капчу, 3 реакции, проголосовать за @TonZnatok.',
      visualCategory: "crypto_giveaway_or_nft",
      confidence: "high",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: ["fake_captcha_or_voting", "giveaway_or_prize_actions"],
      summary: "Видно розыгрыш NFT с условиями в виде капчи, реакций и голосования.",
    };

    const response = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1019, chatId: 5019 })),
    );

    expect(response.status).toBe(200);
    const sent = expectHighRiskResultWithGuardian(5019);
    expect(sent.text).toContain("Капча");
    expect(sent.text).not.toContain("не смог надёжно прочитать");

    const persisted = JSON.stringify(h.inserts);
    expect(persisted).toContain("giveaway_engagement_bait");
    expect(persisted).toContain("fake_captcha_or_voting");
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("U0NSRUVOU0hPVF9CWVRFUw");
  });

  it("uses decoded QR pixels when structured AI image analysis returns null", async () => {
    h.imageEvidence = null;
    h.dataUrl = await QRCode.toDataURL("https://kapitalbank.uz.evil.top/login", {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
    });

    const response = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1020, chatId: 5020 })),
    );

    expect(response.status).toBe(200);
    const sent = expectHighRiskResultWithGuardian(5020);
    expect(sent.text).not.toContain("не смог надёжно прочитать");
    expect(h.ocrCalls).toHaveLength(1);

    const persisted = JSON.stringify(h.inserts);
    expect(persisted).toContain("weird_domain");
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("U0NSRUVOU0hPVF9CWVRFUw");
  });

  it("still flags a QR login screenshot as high risk", async () => {
    h.dataUrl = await QRCode.toDataURL("tg://login?token=very-secret-login-token", {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
    });
    h.imageEvidence = {
      text: "Отсканируйте QR-код, чтобы войти в личный кабинет и подтвердить операцию",
      visualCategory: "qr_login_or_payment",
      confidence: "high",
      qr: { present: true, visibleUrl: null, purpose: "login" },
      riskHints: ["qr_login"],
      summary: "QR используется для входа или подтверждения аккаунта.",
    };

    const response = await handleTelegramWebhook(
      webhookRequest(photoUpdate({ userId: 1012, chatId: 5012 })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(5012);
    expect(h.sendCalls[0].text).toContain(RISK_EMOJI.high_risk);
    expect(h.sendCalls[0].text).toContain("Telegram login QR");
    expect(h.sendCalls[0].text).not.toContain("Я рядом");
    const persisted = JSON.stringify([...h.inserts, ...h.upserts]);
    expect(persisted).toContain("asks_to_scan_qr");
    expect(persisted).toContain("guardian");
  });
});
