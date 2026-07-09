// Production smoke for Telegram context-stitching UX.
//
// Usage:
//   railway run npm run prod:telegram-context-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-context-smoke
//
// Security: uses synthetic Telegram users, posts only to TELEGRAM_QA_CHAT_ID,
// prints no secrets/chat ids, and removes its own DB rows.
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize } from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";
import {
  chatTypeForId,
  readTelegramSmokeChatId,
  type TelegramChatType,
} from "./telegram-smoke-chat";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const CHECK_WAIT_MS = 30_000;
const NO_CHECK_WAIT_MS = 3_000;

type SupportedLang = "ru" | "uz" | "en";

interface TelegramSessionRow {
  telegram_user_id: number;
  scenario: string;
  scenario_step: number;
  scenario_data: {
    chatScope?: {
      chatId?: number;
      chatType?: string;
    };
    lastCheck?: {
      level?: string;
      type?: string;
      context?: string;
      reasons?: string[];
      at?: string;
    };
    [key: string]: unknown;
  } | null;
}

interface CheckRow {
  id: string;
  created_at: string;
  redacted_input: string | null;
  input_hash: string | null;
  input_type: string | null;
  risk_level: string | null;
  reason_codes: string[] | null;
}

interface SmokeContext {
  checkIds: Set<string>;
  updateIds: number[];
  userIds: number[];
}

function fail(message: string): never {
  throw new Error(message);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

function parsePublicUrl(): string {
  const arg = process.argv.slice(2).find((value) => !value.startsWith("--"));
  const raw = arg ?? process.env.PUBLIC_APP_URL;
  if (!raw) {
    fail(
      "missing public URL. Pass it as the first argument or set PUBLIC_APP_URL. " +
        "Example: npm run prod:telegram-context-smoke -- https://your-app.example.com",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid public URL: ${raw}`);
  }

  if (parsed.protocol !== "https:") {
    fail(`public URL must use https, got ${parsed.protocol}`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function untypedSupabase(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function randomLetters(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function nextUpdateId(): number {
  return 1_786_000_000 + Math.floor(Math.random() * 1_000_000);
}

function syntheticTelegramUserId(offset: number): number {
  return 8_886_000_000_000 + Math.floor(Math.random() * 1_000_000) + offset;
}

async function inputHash(value: string): Promise<string> {
  const detected = detectInputType(value);
  return hashIdentifier(normalize(value, detected));
}

async function postWebhook(
  publicUrl: string,
  webhookSecret: string,
  update: unknown,
): Promise<Response> {
  return fetch(`${publicUrl}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SECRET_HEADER]: webhookSecret,
    },
    body: JSON.stringify(update),
  });
}

function textUpdate(options: {
  updateId: number;
  messageId: number;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  text: string;
  languageCode?: SupportedLang;
}) {
  return {
    update_id: options.updateId,
    message: {
      message_id: options.messageId,
      from: {
        id: options.userId,
        is_bot: false,
        first_name: "QA",
        language_code: options.languageCode ?? "ru",
      },
      chat: { id: options.chatId, type: options.chatType },
      date: Math.floor(Date.now() / 1000),
      text: options.text,
    },
  };
}

async function sendText(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  text: string;
  label: string;
  languageCode?: SupportedLang;
}): Promise<void> {
  const updateId = nextUpdateId();
  options.ctx.updateIds.push(updateId);
  const res = await postWebhook(
    options.publicUrl,
    options.webhookSecret,
    textUpdate({
      updateId,
      messageId: updateId,
      userId: options.userId,
      chatId: options.chatId,
      chatType: options.chatType,
      text: options.text,
      languageCode: options.languageCode,
    }),
  );
  if (res.status !== 200) fail(`${options.label} webhook returned status=${res.status}`);
}

async function readSession(userId: number): Promise<TelegramSessionRow | null> {
  const { data, error } = await untypedSupabase()
    .from("telegram_sessions")
    .select("telegram_user_id,scenario,scenario_step,scenario_data")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (error) fail(`telegram session lookup failed: ${error.message}`);
  return (data as TelegramSessionRow | null) ?? null;
}

async function waitForSession(
  userId: number,
  predicate: (row: TelegramSessionRow | null) => boolean,
  label: string,
): Promise<TelegramSessionRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: TelegramSessionRow | null = null;
  while (Date.now() < deadline) {
    latest = await readSession(userId);
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(
    `timed out waiting for ${label}; latest=${JSON.stringify({
      scenario: latest?.scenario ?? null,
      step: latest?.scenario_step ?? null,
      lastCheck: latest?.scenario_data?.lastCheck ?? null,
    })}`,
  );
}

async function readChecksByHash(hash: string, startedAtIso: string): Promise<CheckRow[]> {
  const { data, error } = await untypedSupabase()
    .from("checks")
    .select("id,created_at,redacted_input,input_hash,input_type,risk_level,reason_codes")
    .gte("created_at", startedAtIso)
    .eq("input_hash", hash)
    .order("created_at", { ascending: false });
  if (error) fail(`check lookup failed by hash: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
}

async function readChecksByMarker(marker: string, startedAtIso: string): Promise<CheckRow[]> {
  const { data, error } = await untypedSupabase()
    .from("checks")
    .select("id,created_at,redacted_input,input_hash,input_type,risk_level,reason_codes")
    .gte("created_at", startedAtIso)
    .ilike("redacted_input", `%${marker}%`)
    .order("created_at", { ascending: false });
  if (error) fail(`check lookup failed by marker: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
}

async function waitForMarkedCheck(options: {
  ctx: SmokeContext;
  marker: string;
  startedAtIso: string;
  predicate: (row: CheckRow) => boolean;
  label: string;
}): Promise<CheckRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: CheckRow[] = [];
  while (Date.now() < deadline) {
    latest = await readChecksByMarker(options.marker, options.startedAtIso);
    const match = latest.find(options.predicate);
    if (match) {
      latest.forEach((row) => options.ctx.checkIds.add(row.id));
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(
    `timed out waiting for ${options.label}; latest=${JSON.stringify(
      latest.map((row) => ({
        type: row.input_type,
        level: row.risk_level,
        reasons: row.reason_codes,
      })),
    )}`,
  );
}

async function waitForHashedCheck(options: {
  ctx: SmokeContext;
  hash: string;
  startedAtIso: string;
  predicate: (row: CheckRow) => boolean;
  label: string;
}): Promise<CheckRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: CheckRow[] = [];
  while (Date.now() < deadline) {
    latest = await readChecksByHash(options.hash, options.startedAtIso);
    const match = latest.find(options.predicate);
    if (match) {
      latest.forEach((row) => options.ctx.checkIds.add(row.id));
      return match;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(
    `timed out waiting for ${options.label}; latest=${JSON.stringify(
      latest.map((row) => ({
        type: row.input_type,
        level: row.risk_level,
        reasons: row.reason_codes,
      })),
    )}`,
  );
}

async function assertNoCheckByInput(options: {
  ctx: SmokeContext;
  text: string;
  startedAtIso: string;
  label: string;
}): Promise<void> {
  const hash = await inputHash(options.text);
  const deadline = Date.now() + NO_CHECK_WAIT_MS;
  let rows: CheckRow[] = [];
  while (Date.now() < deadline) {
    rows = await readChecksByHash(hash, options.startedAtIso);
    if (rows.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (rows.length === 0) return;
  rows.forEach((row) => options.ctx.checkIds.add(row.id));
  fail(`${options.label} unexpectedly created ${rows.length} check row(s)`);
}

function assertScopedLastCheck(
  session: TelegramSessionRow,
  chatId: number,
  chatType: TelegramChatType,
  label: string,
): void {
  const scope = session.scenario_data?.chatScope;
  if (scope?.chatId !== chatId || scope.chatType !== chatType) {
    fail(`${label} session scope mismatch`);
  }
  if (!session.scenario_data?.lastCheck) fail(`${label} missing lastCheck`);
}

async function cleanup(ctx: SmokeContext, startedAtIso: string): Promise<void> {
  const markerChecks = await readChecksByMarker("QACTX", startedAtIso).catch(() => []);
  markerChecks.forEach((row) => ctx.checkIds.add(row.id));

  if (ctx.checkIds.size > 0) {
    const { error } = await untypedSupabase()
      .from("checks")
      .delete()
      .in("id", [...ctx.checkIds]);
    if (error) console.error(`WARN cleanup checks failed: ${error.message}`);
  }

  if (ctx.updateIds.length > 0) {
    const { error } = await untypedSupabase()
      .from("telegram_webhook_updates")
      .delete()
      .in("update_id", ctx.updateIds);
    if (error) console.error(`WARN cleanup telegram_webhook_updates failed: ${error.message}`);
  }

  if (ctx.userIds.length > 0) {
    const { error } = await untypedSupabase()
      .from("telegram_sessions")
      .delete()
      .in("telegram_user_id", ctx.userIds);
    if (error) console.error(`WARN cleanup telegram_sessions failed: ${error.message}`);
  }
}

async function runLinkThenWhySmoke(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
  marker: string;
}): Promise<void> {
  const userId = syntheticTelegramUserId(1_000);
  options.ctx.userIds.push(userId);

  const lowSignalPrompt = "Мне прислали ссылку";
  const lowSignalStartedAt = new Date().toISOString();
  await sendText({ ...options, userId, text: lowSignalPrompt, label: "low-signal link preface" });
  await assertNoCheckByInput({
    ctx: options.ctx,
    text: lowSignalPrompt,
    startedAtIso: lowSignalStartedAt,
    label: "low-signal link preface",
  });

  const url = `https://digital-quik.com/gallery/${options.marker}`;
  const urlStartedAt = new Date().toISOString();
  const urlHash = await inputHash(url);
  await sendText({ ...options, userId, text: url, label: "follow-up URL after preface" });
  await waitForHashedCheck({
    ctx: options.ctx,
    hash: urlHash,
    startedAtIso: urlStartedAt,
    label: "follow-up URL check",
    predicate: (row) => row.input_type === "url" && row.risk_level !== null,
  });

  const session = await waitForSession(
    userId,
    (row) => row?.scenario_data?.lastCheck?.type === "url",
    "URL lastCheck session",
  );
  assertScopedLastCheck(session, options.chatId, options.chatType, "URL lastCheck");

  const why = "Почему домен подозрительный?";
  const whyStartedAt = new Date().toISOString();
  await sendText({ ...options, userId, text: why, label: "why follow-up after URL" });
  await assertNoCheckByInput({
    ctx: options.ctx,
    text: why,
    startedAtIso: whyStartedAt,
    label: "why follow-up after URL",
  });
}

async function runAdminTextThenCodeSmoke(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
}): Promise<void> {
  const userId = syntheticTelegramUserId(2_000);
  options.ctx.userIds.push(userId);

  const preface = "Мне пишет администратор канала";
  const prefaceStartedAt = new Date().toISOString();
  await sendText({ ...options, userId, text: preface, label: "channel admin preface" });
  await assertNoCheckByInput({
    ctx: options.ctx,
    text: preface,
    startedAtIso: prefaceStartedAt,
    label: "channel admin preface",
  });

  const request = "Он просит прислать ему СМС код";
  const requestStartedAt = new Date().toISOString();
  await sendText({ ...options, userId, text: request, label: "channel admin SMS-code request" });
  await assertNoCheckByInput({
    ctx: options.ctx,
    text: request,
    startedAtIso: requestStartedAt,
    label: "channel admin SMS-code direct guidance",
  });
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  getRequiredEnv("SUPABASE_URL");
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const chatId = readTelegramSmokeChatId();
  const chatType = chatTypeForId(chatId);
  const marker = `QACTX${randomLetters(10)}`;
  const startedAtIso = new Date().toISOString();
  const ctx: SmokeContext = { checkIds: new Set(), updateIds: [], userIds: [] };

  console.log(`Production Telegram context smoke target: ${publicUrl}`);
  console.log(`QA marker root: ${marker}`);
  console.log("Secret values, chat id, and synthetic Telegram ids are not printed.");

  try {
    await runLinkThenWhySmoke({ ctx, publicUrl, webhookSecret, chatId, chatType, marker });
    console.log("OK link preface -> URL check -> why follow-up context stayed stitched");

    await runAdminTextThenCodeSmoke({ ctx, publicUrl, webhookSecret, chatId, chatType });
    console.log("OK channel-admin preface -> SMS-code request stayed in direct guidance");
  } finally {
    await cleanup(ctx, startedAtIso);
  }

  console.log("OK cleanup done");
  console.log("OK production Telegram context smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram context smoke: ${message}`);
  process.exitCode = 1;
});
