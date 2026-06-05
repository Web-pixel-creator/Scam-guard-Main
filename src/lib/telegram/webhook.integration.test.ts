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
  getFileCalls: [] as string[],
  downloadCalls: [] as string[],
  sendShouldThrow: false,

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
      return { ok: true };
    }),
    sendChatAction: vi.fn(async (chatId: number) => {
      h.chatActionCalls.push(chatId);
    }),
    answerCallbackQuery: vi.fn(async (id: string) => {
      h.answerCalls.push(id);
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
import { handleTelegramWebhook } from "./webhook.server";
import { CB, RISK_EMOJI } from "./format";
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
function textUpdate(opts: { userId: number; chatId: number; text: string }): unknown {
  return {
    update_id: opts.userId,
    message: {
      message_id: 1,
      from: { id: opts.userId, language_code: "ru" },
      chat: { id: opts.chatId },
      text: opts.text,
    },
  };
}

/** A photo message update (two sizes — the router picks the largest). */
function photoUpdate(opts: { userId: number; chatId: number }): unknown {
  return {
    update_id: opts.userId,
    message: {
      message_id: 1,
      from: { id: opts.userId, language_code: "ru" },
      chat: { id: opts.chatId },
      photo: [
        { file_id: "thumb", file_size: 100 },
        { file_id: "full", file_size: 5000 },
      ],
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
    update_id: opts.userId,
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
  h.sendCalls.length = 0;
  h.chatActionCalls.length = 0;
  h.answerCalls.length = 0;
  h.getFileCalls.length = 0;
  h.downloadCalls.length = 0;
  h.ocrCalls.length = 0;
  h.fromCalls.length = 0;
  h.inserts.length = 0;
  h.upserts.length = 0;
  h.sendShouldThrow = false;
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

    // Exactly one outgoing message, addressed to the update's chat.
    expect(h.sendCalls).toHaveLength(1);
    const sent = h.sendCalls[0];
    expect(sent.chatId).toBe(5001);

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
      ]),
    );
  });

  it("sends /menu with the same quick-action main menu as /start", async () => {
    const update = textUpdate({ userId: 1105, chatId: 5105, text: "/menu" });

    const response = await handleTelegramWebhook(webhookRequest(update));

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(callbackData(h.sendCalls[0].keyboard)).toEqual([
      CB.checkAnother,
      CB.emergency,
      CB.report,
      CB.safety,
      CB.showLang,
      CB.howItWorks,
    ]);
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

  it.each([
    ["check another", CB.checkAnother],
    ["report", CB.report],
    ["emergency", CB.emergency],
    ["panic scenario", "panic:1"],
    ["show language picker", CB.showLang],
    ["safety", CB.safety],
    ["how it works", CB.howItWorks],
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
        "livecall:call_bank",
        "livecall:sent_code",
        "livecall:tell_family",
      ]),
    );
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
      expect.arrayContaining(["panicctx:contacts", "panicctx:trusted_person"]),
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
      webhookRequest(textUpdate({ userId, chatId: 5121, text: "дай номер банка" })),
    );

    expect(response.status).toBe(200);
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).toContain("Официальный обратный звонок");
    expect(h.sendCalls[0].text).toContain("Не звоните по номеру");
    expect(h.sendCalls[0].text).toContain("1340");
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
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].text).not.toContain("Следующий безопасный шаг");
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

    // One result message went out (same format as the text path).
    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].chatId).toBe(5003);
    expect(h.sendCalls[0].text).toContain(RISK_EMOJI.high_risk);

    // ── The image is NOT saved anywhere ───────────────────────────────────
    // No upsert at all on this path, and the only insert is the redacted
    // `checks` row — never a storage bucket or a raw-file table.
    expect(h.upserts).toHaveLength(0);
    expect(h.inserts.every((i) => i.table === "checks")).toBe(true);
    expect(h.inserts.length).toBeGreaterThanOrEqual(1);

    // No persisted payload (nor any DB table touched) carries the raw image
    // bytes / data URL — the screenshot lived only in memory.
    const persisted = JSON.stringify([...h.inserts, ...h.upserts]);
    expect(persisted).not.toContain("data:image");
    expect(persisted).not.toContain("U0NSRUVOU0hPVF9CWVRFUw"); // the base64 sentinel
    expect(h.fromCalls).not.toContain("storage");
    expect(h.fromCalls).not.toContain("objects");
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
    expect(h.sendCalls[0].text).toContain("Сам QR\\-код не является признаком скама");

    const checkInsert = h.inserts.find((i) => i.table === "checks");
    expect(JSON.stringify(checkInsert)).not.toContain("asks_to_scan_qr");
  });

  it("still flags a QR login screenshot as high risk", async () => {
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
    expect(h.sendCalls[0].text).toContain(RISK_EMOJI.high_risk);
    expect(JSON.stringify(h.inserts)).toContain("asks_to_scan_qr");
  });
});
