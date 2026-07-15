// Telegram webhook CORE (Ishonch Guard bot) — task 9.1, PART A.
//
// A pure, framework-agnostic handler for incoming Telegram webhook requests:
// it takes a standard web `Request` and returns a standard web `Response`, with
// NO coupling to TanStack Start / Nitro / Cloudflare. This is the real, testable
// deliverable — the HTTP binding (PART B, src/server.ts) is a thin shell that
// simply forwards `POST /api/telegram/webhook` here, and tasks 9.2/9.3 call this
// function directly with synthetic `Request`s.
//
// Step order is FIXED by Requirement 12 and MUST NOT be reordered:
//
//   1. Read secrets per-request (CODING_RULES §6). If either the webhook secret
//      or the bot token is missing → log (no values) + HTTP 401. Fail closed
//      (R17.4 / R12.6) — a misconfigured deploy never silently accepts updates.
//   2. Compare the `X-Telegram-Bot-Api-Secret-Token` header against the secret
//      BEFORE any body parsing. On mismatch → 401, and `dispatchUpdate` is NOT
//      called and the body is NOT parsed (R12.1 / R12.2).
//   3. Only after the token is accepted: parse + validate the JSON body with
//      `telegramUpdateSchema`. Invalid/unsupported structure → 200 + ignore so
//      Telegram stops re-delivering (R12.3).
//   4. A valid update receives a metadata-only processing lease. HTTP 200 is
//      returned only after handler success and durable completion. Failure,
//      timeout, a busy lease or lifecycle outage returns 503 so Telegram keeps
//      the raw payload retryable. Only a completed retry is acknowledged.
//
// Handler wiring: importing/calling the aggregator (PART C) registers the
// concrete `Handlers` via `setHandlers(...)` before any dispatch happens.
//
// Server-only (.server.ts): reads secrets and pulls in service-role modules.
// Never import this file into the client bundle.
import {
  getTelegramBotToken,
  getTelegramUpdateDeliveryMode,
  getTelegramWebhookSecret,
} from "@/lib/config.server";
import { dispatchUpdate, telegramUpdateSchema, type TelegramUpdate } from "@/lib/telegram/router";
import { installTelegramHandlers } from "@/lib/telegram/handlers";
import { sendMessage } from "@/lib/telegram/api.server";
import { langFromTelegramCode } from "@/lib/telegram/session.server";
import { executeTelegramUpdate } from "@/lib/telegram/update-dispatch.server";
import { inlineDeliveryRetryAfterMs } from "@/lib/telegram/inline-answer-delivery-error";
import { installTelegramOutboundEffectFence } from "@/lib/telegram/outbound-effect-fence.server";
import {
  beginTelegramUpdate,
  completeTelegramUpdate,
  markTelegramUpdateFailure,
  renewTelegramUpdateLease,
  type TelegramUpdateLease,
} from "@/lib/telegram/update-lifecycle.server";

/** Telegram sends the configured secret in this header (case-insensitive). */
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const PROCESSED_UPDATE_TTL_MS = 10 * 60 * 1000;
const MAX_PROCESSED_UPDATES = 5_000;
const DISPATCH_ACK_TIMEOUT_MS = 8_000;

installTelegramOutboundEffectFence();

const processedUpdateIds = new Map<number, number>();
type UpdateProcessingDecision =
  | { decision: "process"; lease: TelegramUpdateLease }
  | { decision: "duplicate" }
  | { decision: "retry"; retryAfterSec: number };

/**
 * Handle a single Telegram webhook request. Returns 401 for any token-stage
 * failure (missing secrets or bad/absent header). Invalid bodies after valid
 * auth are acknowledged, while valid updates are acknowledged only after
 * durable completion; incomplete or uncertain work stays retryable with 503.
 */
export async function handleTelegramWebhook(request: Request): Promise<Response> {
  // ── Step 1 — read secrets INSIDE the handler (per-request). Fail closed. ──
  const secret = getTelegramWebhookSecret();
  const botToken = getTelegramBotToken();
  if (!secret || !botToken) {
    // R17.4 / R12.6 — never log the secret values themselves (R19.3).
    console.error("telegram webhook misconfigured: missing secrets");
    return new Response("unauthorized", { status: 401 });
  }

  // ── Step 2 — verify the secret token FIRST, before touching the body. ──
  // R12.1 / R12.2 — on mismatch we return 401 and never parse the body or call
  // dispatchUpdate.
  const header = request.headers.get(SECRET_HEADER);
  if (header !== secret) {
    return new Response("unauthorized", { status: 401 });
  }

  if (getTelegramUpdateDeliveryMode() !== "webhook") {
    return new Response("webhook disabled", {
      status: 503,
      headers: { "retry-after": "5" },
    });
  }

  // ── Step 3 — only now parse + validate the structure (R12.3). ──
  // Make sure the concrete handlers are wired before any dispatch.
  installTelegramHandlers();

  let update: TelegramUpdate;
  try {
    const body = await readJsonBodyCapped(request);
    if (body === null) return new Response("ok", { status: 200 });
    update = telegramUpdateSchema.parse(body);
  } catch {
    // Invalid JSON or unsupported structure → acknowledge + ignore (R12.3).
    return new Response("ok", { status: 200 });
  }

  // Step 4: lease, dispatch and acknowledge only after durable completion.
  const processingDecision = await markUpdateForProcessing(update.update_id);
  if (processingDecision.decision === "duplicate") {
    return new Response("ok", { status: 200 });
  }
  if (processingDecision.decision === "retry") {
    return new Response("retry", {
      status: 503,
      headers: { "retry-after": String(processingDecision.retryAfterSec) },
    });
  }

  const lease = processingDecision.lease;
  const dispatchPromise = executeAndCompleteTelegramUpdate(update, lease);
  const outcome = await waitForDispatch(dispatchPromise, DISPATCH_ACK_TIMEOUT_MS);
  if (outcome === "completed") {
    rememberCompletedUpdate(update.update_id);
    return new Response("ok", { status: 200 });
  }
  if (outcome === "timeout") {
    console.error("telegram webhook: dispatch still running after ack timeout");
  } else {
    // R12.5 / R19.1 / R19.2 — log WITHOUT Sensitive_Data, still answer 200 so
    // Telegram does not retry indefinitely.
    console.error("telegram webhook: dispatch failed", "handler_exception");
  }
  return new Response("retry", { status: 503, headers: { "retry-after": "1" } });
}

export async function executeAndCompleteTelegramUpdate(
  update: TelegramUpdate,
  lease: TelegramUpdateLease,
): Promise<boolean> {
  let leaseCurrent = true;
  let renewalRunning = false;
  const renewalTimer = setInterval(() => {
    if (renewalRunning || !leaseCurrent) return;
    renewalRunning = true;
    void renewTelegramUpdateLease(lease)
      .then((renewed) => {
        if (!renewed) leaseCurrent = false;
      })
      .finally(() => {
        renewalRunning = false;
      });
  }, 30_000);
  renewalTimer.unref?.();
  try {
    await executeTelegramUpdate(
      update,
      {
        dispatch: dispatchUpdate,
        onSessionWriteFailure: notifySessionWriteFailure,
      },
      { lease },
    );
  } catch (error) {
    clearInterval(renewalTimer);
    await markTelegramUpdateFailure(lease, "dispatch");
    // Polling needs the sanitized retry delay from Inline flood control. Other
    // dispatch errors retain the established boolean failure contract.
    if (inlineDeliveryRetryAfterMs(error) !== null) throw error;
    return false;
  }

  clearInterval(renewalTimer);
  if (!leaseCurrent) {
    await markTelegramUpdateFailure(lease, "heartbeat");
    return false;
  }
  const completed = await completeTelegramUpdate(lease);
  if (!completed) await markTelegramUpdateFailure(lease, "completion");
  return completed;
}

function sessionFailureTarget(update: TelegramUpdate): {
  chatId: number;
  languageCode?: string;
} | null {
  const message = update.message ?? update.callback_query?.message;
  if (!message) return null;
  const languageCode =
    update.message?.from?.language_code ?? update.callback_query?.from.language_code;
  return { chatId: message.chat.id, languageCode };
}

async function notifySessionWriteFailure(update: TelegramUpdate): Promise<void> {
  const target = sessionFailureTarget(update);
  if (!target) return;
  const lang = langFromTelegramCode(target.languageCode) ?? "ru";
  const text =
    lang === "uz"
      ? "Bu qadamning kontekstini saqlab bo'lmadi. Oxirgi amalni takrorlang; oldingi savolga javob bergandek davom etmang."
      : lang === "en"
        ? "I could not save the context for this step. Repeat your last action; do not continue as if the previous prompt was saved."
        : "Не удалось сохранить контекст этого шага. Повторите последнее действие и не продолжайте так, будто предыдущий вопрос сохранился.";
  const response = await sendMessage({ chatId: target.chatId, text, parseMode: "None" });
  if (!response.ok) console.error("telegram session failure warning failed");
}

async function waitForDispatch(
  promise: Promise<boolean>,
  timeoutMs: number,
): Promise<"completed" | "failed" | "timeout"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(
        (completed): "completed" | "failed" => (completed ? "completed" : "failed"),
        (): "failed" => "failed",
      ),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function markUpdateForProcessing(
  updateId: number,
  nowMs = Date.now(),
): Promise<UpdateProcessingDecision> {
  pruneProcessedUpdateIds(nowMs);

  const expiresAt = processedUpdateIds.get(updateId);
  if (expiresAt !== undefined && expiresAt > nowMs) return { decision: "duplicate" };

  const claim = await beginTelegramUpdate(updateId);
  if (claim.decision === "completed") return { decision: "duplicate" };
  if (claim.decision !== "acquired") {
    return { decision: "retry", retryAfterSec: claim.retryAfterSec };
  }
  return { decision: "process", lease: claim.lease };
}

function rememberCompletedUpdate(updateId: number, nowMs = Date.now()): void {
  processedUpdateIds.set(updateId, nowMs + PROCESSED_UPDATE_TTL_MS);
  while (processedUpdateIds.size > MAX_PROCESSED_UPDATES) {
    const oldest = processedUpdateIds.keys().next().value as number | undefined;
    if (oldest === undefined) break;
    processedUpdateIds.delete(oldest);
  }
}

function pruneProcessedUpdateIds(nowMs: number): void {
  for (const [updateId, expiresAt] of processedUpdateIds) {
    if (expiresAt <= nowMs) processedUpdateIds.delete(updateId);
  }
}

export function __resetTelegramWebhookDedupeForTests(): void {
  processedUpdateIds.clear();
}

async function readJsonBodyCapped(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BODY_BYTES) return null;

  const reader = request.body?.getReader();
  if (!reader) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_WEBHOOK_BODY_BYTES) return null;
    return JSON.parse(text) as unknown;
  }

  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return JSON.parse(text) as unknown;
}
