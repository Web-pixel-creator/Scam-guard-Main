// Polling-compatible production Telegram handler smoke.
//
// Usage:
//   railway run npm run prod:telegram-polling-dispatch-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com railway run npm run prod:telegram-polling-dispatch-smoke
//
// This intentionally does not acquire the singleton polling leader or inject a
// fake update into getUpdates. Synthetic payloads stay in this process, while
// real handler replies are allowed only to TELEGRAM_QA_CHAT_ID and are deleted.
import { randomInt } from "node:crypto";
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize } from "@/lib/risk/detect";
import { hashIdentifier, isHashPepperConfigured } from "@/lib/risk/hash";
import { installTelegramHandlers } from "@/lib/telegram/handlers";
import { createTelegramQaFetchGuard } from "@/lib/telegram/qa-fetch-guard.server";
import { dispatchUpdate, telegramUpdateSchema } from "@/lib/telegram/router";
import { executeTelegramUpdate } from "@/lib/telegram/update-dispatch.server";
import {
  chatTypeForId,
  readTelegramSmokeChatId,
  type TelegramChatType,
} from "./telegram-smoke-chat";

const POLLING_HEALTH_PATH = "/api/telegram/polling-health";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

interface CheckRow {
  id: string;
  input_hash: string | null;
  input_type: string | null;
  risk_level: string | null;
  reason_codes: string[] | null;
}

interface SessionRow {
  telegram_user_id: number;
  scenario_data: {
    lastCheck?: {
      level?: string;
      type?: string;
      reasons?: string[];
    };
    [key: string]: unknown;
  } | null;
}

interface SmokeContext {
  checkIds: Set<string>;
  messageIds: Set<number>;
  userIds: number[];
}

const PROVIDER_SECRET_ENV_NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_FALLBACK_API_KEY",
  "OPENAI_TTS_API_KEY",
  "GEMINI_TTS_API_KEY",
  "GOOGLE_TTS_API_KEY",
] as const;

function disableProviderAccessForPollingQa(): void {
  for (const name of PROVIDER_SECRET_ENV_NAMES) delete process.env[name];
}

function fail(message: string): never {
  throw new Error(message);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is not set`);
  return value;
}

function parsePublicUrl(): string {
  const raw =
    process.argv.slice(2).find((value) => !value.startsWith("--")) ??
    process.env.PUBLIC_APP_URL?.trim();
  if (!raw) fail("missing public URL. Pass it as the first argument or set PUBLIC_APP_URL");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail("PUBLIC_APP_URL is invalid");
  }
  if (url.protocol !== "https:") fail("PUBLIC_APP_URL must use https");
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function untypedSupabase(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function randomLetters(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += alphabet[randomInt(alphabet.length)];
  }
  return value;
}

function syntheticTelegramUserId(offset: number): number {
  return 8_889_000_000_000 + randomInt(1_000_000) + offset;
}

function nextUpdateId(): number {
  return 1_789_000_000 + randomInt(1_000_000);
}

function textUpdate(options: {
  updateId: number;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  text: string;
}) {
  return telegramUpdateSchema.parse({
    update_id: options.updateId,
    message: {
      message_id: options.updateId,
      from: {
        id: options.userId,
        is_bot: false,
        first_name: "QA",
        language_code: "ru",
      },
      chat: { id: options.chatId, type: options.chatType },
      date: Math.floor(Date.now() / 1000),
      text: options.text,
    },
  });
}

function plainTelegramText(text: string): string {
  return text.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/gu, "$1");
}

function assertReply(label: string, replies: string[], required: RegExp[]): void {
  if (replies.length === 0) fail(`${label} produced no sendMessage reply`);
  const combined = replies.map(plainTelegramText).join("\n\n");
  for (const pattern of required) {
    if (!pattern.test(combined)) fail(`${label} reply did not match ${pattern}`);
  }
  if (/Недостаточно данных для точной оценки/iu.test(combined)) {
    fail(`${label} fell back to a new insufficient-data card`);
  }
}

async function checkHash(value: string): Promise<string> {
  const type = detectInputType(value);
  return hashIdentifier(normalize(value, type));
}

async function checksByHash(hash: string, startedAtIso: string): Promise<CheckRow[]> {
  const { data, error } = await untypedSupabase()
    .from("checks")
    .select("id,input_hash,input_type,risk_level,reason_codes")
    .gte("created_at", startedAtIso)
    .eq("input_hash", hash);
  if (error) fail(`check lookup failed: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
}

async function requireOneCheck(
  ctx: SmokeContext,
  input: string,
  startedAtIso: string,
  label: string,
): Promise<CheckRow> {
  const rows = await checksByHash(await checkHash(input), startedAtIso);
  if (rows.length !== 1) fail(`${label} expected one check row, got ${rows.length}`);
  ctx.checkIds.add(rows[0].id);
  return rows[0];
}

async function assertNoCheck(input: string, startedAtIso: string, label: string): Promise<void> {
  const rows = await checksByHash(await checkHash(input), startedAtIso);
  if (rows.length > 0) fail(`${label} unexpectedly created ${rows.length} check row(s)`);
}

async function readSession(userId: number): Promise<SessionRow> {
  const { data, error } = await untypedSupabase()
    .from("telegram_sessions")
    .select("telegram_user_id,scenario_data")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (error) fail(`telegram session lookup failed: ${error.message}`);
  if (!data) fail("Telegram handler did not persist a QA session");
  return data as SessionRow;
}

async function verifyPollingHealth(publicUrl: string, webhookSecret: string): Promise<void> {
  const response = await fetch(`${publicUrl}${POLLING_HEALTH_PATH}`, {
    headers: { [SECRET_HEADER]: webhookSecret },
  });
  const body = await response.text();
  if (response.status !== 200 || body !== "ok") {
    fail(`production polling health failed status=${response.status}`);
  }
}

async function dispatchText(options: {
  chatId: number;
  chatType: TelegramChatType;
  userId: number;
  text: string;
  messageOffset: number;
  messages: Array<{ text: string; messageId?: number; responseOk?: boolean }>;
  violations: string[];
}): Promise<string[]> {
  const before = options.messages.length;
  const update = textUpdate({
    updateId: nextUpdateId() + options.messageOffset,
    userId: options.userId,
    chatId: options.chatId,
    chatType: options.chatType,
    text: options.text,
  });

  await executeTelegramUpdate(update, {
    dispatch: dispatchUpdate,
    onSessionWriteFailure: async () => fail("Telegram session write failed during QA dispatch"),
  });

  if (options.violations.length > 0) {
    fail(`Telegram QA transport guard blocked an effect: ${options.violations.join("; ")}`);
  }
  const records = options.messages.slice(before);
  if (records.some((record) => record.responseOk !== true)) {
    fail("Telegram sendMessage did not receive an ok Bot API response");
  }
  return records.map((record) => record.text);
}

async function deleteTelegramMessage(
  originalFetch: typeof fetch,
  botToken: string,
  chatId: number,
  messageId: number,
): Promise<string | null> {
  try {
    const response = await originalFetch(`${TELEGRAM_API_BASE}${botToken}/deleteMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    const envelope = (await response.json()) as { ok?: boolean };
    if (!response.ok || envelope.ok !== true) throw new Error(`status=${response.status}`);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `deleteMessage failed: ${message}`;
  }
}

async function cleanup(
  ctx: SmokeContext,
  originalFetch: typeof fetch,
  botToken: string,
  chatId: number,
): Promise<string[]> {
  const errors: string[] = [];
  if (ctx.checkIds.size > 0) {
    const { error } = await untypedSupabase()
      .from("checks")
      .delete()
      .in("id", [...ctx.checkIds]);
    if (error) errors.push(`checks delete failed: ${error.message}`);
  }
  if (ctx.userIds.length > 0) {
    const { error } = await untypedSupabase()
      .from("telegram_sessions")
      .delete()
      .in("telegram_user_id", ctx.userIds);
    if (error) errors.push(`telegram_sessions delete failed: ${error.message}`);
  }
  for (const messageId of [...ctx.messageIds].reverse()) {
    const error = await deleteTelegramMessage(originalFetch, botToken, chatId, messageId);
    if (error) errors.push(error);
  }

  if (ctx.checkIds.size > 0) {
    const { data, error } = await untypedSupabase()
      .from("checks")
      .select("id")
      .in("id", [...ctx.checkIds]);
    if (error) errors.push(`checks cleanup read-back failed: ${error.message}`);
    else if ((data ?? []).length > 0) errors.push("checks cleanup read-back found remaining rows");
  }
  if (ctx.userIds.length > 0) {
    const { data, error } = await untypedSupabase()
      .from("telegram_sessions")
      .select("telegram_user_id")
      .in("telegram_user_id", ctx.userIds);
    if (error) errors.push(`telegram_sessions cleanup read-back failed: ${error.message}`);
    else if ((data ?? []).length > 0) {
      errors.push("telegram_sessions cleanup read-back found remaining rows");
    }
  }
  return errors;
}

async function main(): Promise<void> {
  // `railway run` injects the production service environment. This smoke is a
  // deterministic routing/delivery check, so provider access must be removed
  // inside the child process before any Telegram handler can call `runCheck`.
  disableProviderAccessForPollingQa();
  if (requiredEnv("TELEGRAM_UPDATE_DELIVERY_MODE") !== "polling") {
    fail("TELEGRAM_UPDATE_DELIVERY_MODE must be polling");
  }
  requiredEnv("SUPABASE_URL");
  requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!isHashPepperConfigured()) fail("hash pepper configuration is missing or invalid");
  const publicUrl = parsePublicUrl();
  const webhookSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const chatId = readTelegramSmokeChatId();
  const chatType = chatTypeForId(chatId);
  const originalFetch = globalThis.fetch;
  const guard = createTelegramQaFetchGuard({ botToken, qaChatId: chatId, originalFetch });
  const ctx: SmokeContext = { checkIds: new Set(), messageIds: new Set(), userIds: [] };
  const marker = `QAPOLL${randomLetters(10)}`;
  let cleanupErrors: string[] = [];

  console.log(`Production Telegram polling dispatch smoke target: ${publicUrl}`);
  console.log("Secret values, chat id, synthetic user ids, and update ids are not printed.");
  console.log(
    "Synthetic inbound payloads remain in this QA process; no polling lease is acquired.",
  );
  console.log("AI/TTS provider credentials are disabled inside this smoke process.");

  await verifyPollingHealth(publicUrl, webhookSecret);
  console.log("OK production polling leader is active");

  installTelegramHandlers();
  globalThis.fetch = guard.fetch;
  try {
    const highRiskUserId = syntheticTelegramUserId(1_000);
    ctx.userIds.push(highRiskUserId);
    const highRiskText =
      `${marker} Служба безопасности банка срочно просит SMS-код и CVV, ` +
      "чтобы отменить операцию.";
    const highRiskStartedAt = new Date().toISOString();
    await dispatchText({
      chatId,
      chatType,
      userId: highRiskUserId,
      text: highRiskText,
      messageOffset: 1,
      messages: guard.messages,
      violations: guard.violations,
    });
    const highRiskCheck = await requireOneCheck(
      ctx,
      highRiskText,
      highRiskStartedAt,
      "high-risk setup",
    );
    if (
      highRiskCheck.risk_level !== "high_risk" ||
      !(highRiskCheck.reason_codes ?? []).includes("asks_for_sms_code")
    ) {
      fail("high-risk setup did not preserve the expected risk evidence");
    }
    const highRiskSession = await readSession(highRiskUserId);
    if (highRiskSession.scenario_data?.lastCheck?.level !== "high_risk") {
      fail("high-risk setup did not persist a high-risk lastCheck");
    }

    const confidenceText = "Ты точно в этом уверен?";
    const confidenceStartedAt = new Date().toISOString();
    const confidenceReplies = await dispatchText({
      chatId,
      chatType,
      userId: highRiskUserId,
      text: confidenceText,
      messageOffset: 2,
      messages: guard.messages,
      violations: guard.violations,
    });
    assertReply("confidence follow-up", confidenceReplies, [
      /действовал как при реальном риске/iu,
      /официальному номеру/iu,
    ]);
    await assertNoCheck(confidenceText, confidenceStartedAt, "confidence follow-up");
    console.log("OK confidence follow-up used the previous result and safe action-first copy");

    const trustedText = "Я могу связаться с близким?";
    const trustedStartedAt = new Date().toISOString();
    const trustedReplies = await dispatchText({
      chatId,
      chatType,
      userId: highRiskUserId,
      text: trustedText,
      messageOffset: 3,
      messages: guard.messages,
      violations: guard.violations,
    });
    assertReply("trusted-person follow-up", trustedReplies, [
      /Свяжитесь с близким сами/iu,
      /сохран[её]нному номеру/iu,
      /автоматически сигнал не отправляет/iu,
    ]);
    await assertNoCheck(trustedText, trustedStartedAt, "trusted-person follow-up");
    console.log("OK trusted-person follow-up was explicit and did not trigger an automatic alert");

    const recheckText = "Перепроверь ещё раз.";
    const recheckStartedAt = new Date().toISOString();
    const recheckReplies = await dispatchText({
      chatId,
      chatType,
      userId: highRiskUserId,
      text: recheckText,
      messageOffset: 4,
      messages: guard.messages,
      violations: guard.violations,
    });
    assertReply("recheck follow-up", recheckReplies, [
      /Могу перепроверить/iu,
      /не храню исходную ссылку или текст/iu,
      /не буду делать вид, что перепроверка уже состоялась/iu,
    ]);
    await assertNoCheck(recheckText, recheckStartedAt, "recheck follow-up");
    console.log(
      "OK recheck follow-up requested resubmission and did not pretend to re-run analysis",
    );

    const disagreementText = "Я не согласен с результатом, ты ошибся.";
    const disagreementStartedAt = new Date().toISOString();
    const disagreementReplies = await dispatchText({
      chatId,
      chatType,
      userId: highRiskUserId,
      text: disagreementText,
      messageOffset: 5,
      messages: guard.messages,
      violations: guard.violations,
    });
    assertReply("disagreement follow-up", disagreementReplies, [
      /Вы можете не соглашаться с результатом/iu,
      /Это не обвинение/iu,
      /Проверьте независимо/iu,
    ]);
    await assertNoCheck(disagreementText, disagreementStartedAt, "disagreement follow-up");
    console.log(
      "OK disagreement follow-up stayed non-accusatory and recommended independent checks",
    );

    const domainUserId = syntheticTelegramUserId(2_000);
    ctx.userIds.push(domainUserId);
    const domainUrl = `https://payme1-security.xyz/login/${marker}`;
    const domainStartedAt = new Date().toISOString();
    await dispatchText({
      chatId,
      chatType,
      userId: domainUserId,
      text: domainUrl,
      messageOffset: 6,
      messages: guard.messages,
      violations: guard.violations,
    });
    const domainCheck = await requireOneCheck(ctx, domainUrl, domainStartedAt, "domain setup");
    if (
      domainCheck.input_type !== "url" ||
      !domainCheck.risk_level ||
      !(domainCheck.reason_codes ?? []).includes("weird_domain")
    ) {
      fail("domain setup did not persist deterministic suspicious-domain evidence");
    }
    const domainSession = await readSession(domainUserId);
    if (domainSession.scenario_data?.lastCheck?.type !== "url") {
      fail("domain setup did not persist URL lastCheck context");
    }

    const methodologyText =
      "Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?";
    const methodologyStartedAt = new Date().toISOString();
    const methodologyReplies = await dispatchText({
      chatId,
      chatType,
      userId: domainUserId,
      text: methodologyText,
      messageOffset: 7,
      messages: guard.messages,
      violations: guard.violations,
    });
    assertReply("domain methodology follow-up", methodologyReplies, [
      /Сохранённая причина именно по домену/iu,
      /Основание:/iu,
      /Ограничение:/iu,
      /сам по себе не доказывает, что владелец домена — мошенник/iu,
    ]);
    await assertNoCheck(methodologyText, methodologyStartedAt, "domain methodology follow-up");
    console.log(
      "OK domain-methodology follow-up named evidence and limitations without overclaiming",
    );

    const passportUserId = syntheticTelegramUserId(3_000);
    ctx.userIds.push(passportUserId);
    const safeSetupText = "1344";
    const safeSetupStartedAt = new Date().toISOString();
    await dispatchText({
      chatId,
      chatType,
      userId: passportUserId,
      text: safeSetupText,
      messageOffset: 8,
      messages: guard.messages,
      violations: guard.violations,
    });
    const safeSetupCheck = await requireOneCheck(
      ctx,
      safeSetupText,
      safeSetupStartedAt,
      "passport stale-safe setup",
    );
    if (safeSetupCheck.risk_level !== "safe") {
      fail("passport stale-safe setup did not persist a Safe lastCheck");
    }

    const passportText = "Почему мошенники просят фото паспорта?";
    const passportStartedAt = new Date().toISOString();
    const passportReplies = await dispatchText({
      chatId,
      chatType,
      userId: passportUserId,
      text: passportText,
      messageOffset: 9,
      messages: guard.messages,
      violations: guard.violations,
    });
    assertReply("passport new-safety request", passportReplies, [
      /Паспорт/iu,
      /не отправляйте/iu,
      /официальн/iu,
    ]);
    await assertNoCheck(passportText, passportStartedAt, "passport new-safety request");
    console.log(
      "OK passport request overrode stale Safe context and returned document-specific guidance",
    );
  } finally {
    for (const message of guard.messages) {
      if (message.messageId !== undefined) ctx.messageIds.add(message.messageId);
    }
    globalThis.fetch = originalFetch;
    cleanupErrors = await cleanup(ctx, originalFetch, botToken, chatId);
    for (const error of cleanupErrors) console.error(`WARN cleanup: ${error}`);
  }

  if (cleanupErrors.length > 0) {
    fail(`production QA cleanup failed at ${cleanupErrors.length} step(s)`);
  }
  if (guard.violations.length > 0) {
    fail(`Telegram QA transport guard recorded violations: ${guard.violations.join("; ")}`);
  }
  console.log("OK Bot API replies and synthetic DB rows cleaned up");
  console.log("OK production Telegram polling-compatible dispatch smoke passed");
  console.log("NOTE inline visual delivery still requires a real Telegram client inline_query_id");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram polling-compatible dispatch smoke: ${message}`);
  process.exitCode = 1;
});
