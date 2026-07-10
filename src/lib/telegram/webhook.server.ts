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
//   4. A valid update is dispatched inside try/catch after a dedup claim. ANY
//      processing error after dispatch starts is logged WITHOUT Sensitive_Data
//      and still answered 200, so Telegram does not retry forever (R12.4 /
//      R12.5 / R19.1 / R19.2). If the shared dedup store is unavailable before
//      dispatch, return 503 so Telegram retries instead of risking duplicate
//      side effects.
//
// Handler wiring: importing/calling the aggregator (PART C) registers the
// concrete `Handlers` via `setHandlers(...)` before any dispatch happens.
//
// Server-only (.server.ts): reads secrets and pulls in service-role modules.
// Never import this file into the client bundle.
import { getTelegramBotToken, getTelegramWebhookSecret } from "@/lib/config.server";
import { dispatchUpdate, telegramUpdateSchema, type TelegramUpdate } from "@/lib/telegram/router";
import { installTelegramHandlers } from "@/lib/telegram/handlers";
import { claimTelegramWebhookUpdate } from "@/lib/telegram/webhook-dedup.server";

/** Telegram sends the configured secret in this header (case-insensitive). */
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const PROCESSED_UPDATE_TTL_MS = 10 * 60 * 1000;
const MAX_PROCESSED_UPDATES = 5_000;
const DISPATCH_ACK_TIMEOUT_MS = 8_000;

const processedUpdateIds = new Map<number, number>();
type UpdateProcessingDecision = "process" | "duplicate" | "retry";

/**
 * Handle a single Telegram webhook request. Returns 401 for any token-stage
 * failure (missing secrets or bad/absent header) and 200 for everything after a
 * valid token — including invalid bodies and handler errors — per Requirement
 * 12, except a pre-dispatch shared-dedup outage returns 503 so Telegram retries.
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

  // ── Step 4 — dispatch the valid update; any later error → log + 200. ──
  const processingDecision = await markUpdateForProcessing(update.update_id);
  if (processingDecision === "duplicate") {
    return new Response("ok", { status: 200 });
  }
  if (processingDecision === "retry") {
    return new Response("retry", {
      status: 503,
      headers: { "retry-after": "1" },
    });
  }

  const dispatchPromise = dispatchUpdate(update).catch((err) => {
    // R12.5 / R19.1 / R19.2 — log WITHOUT Sensitive_Data, still answer 200 so
    // Telegram does not retry indefinitely.
    console.error(
      "telegram webhook: dispatch failed",
      err instanceof Error ? err.message : "unknown",
    );
  });

  const completed = await waitForDispatch(dispatchPromise, DISPATCH_ACK_TIMEOUT_MS);
  if (!completed) {
    console.error("telegram webhook: dispatch still running after ack timeout");
  }
  return new Response("ok", { status: 200 });
}

async function waitForDispatch(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
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
  if (expiresAt !== undefined && expiresAt > nowMs) return "duplicate";

  const claim = await claimTelegramWebhookUpdate(updateId, nowMs);
  if (claim === "duplicate") return "duplicate";
  if (claim === "unavailable") return "retry";

  processedUpdateIds.set(updateId, nowMs + PROCESSED_UPDATE_TTL_MS);
  while (processedUpdateIds.size > MAX_PROCESSED_UPDATES) {
    const oldest = processedUpdateIds.keys().next().value as number | undefined;
    if (oldest === undefined) break;
    processedUpdateIds.delete(oldest);
  }

  return "process";
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
