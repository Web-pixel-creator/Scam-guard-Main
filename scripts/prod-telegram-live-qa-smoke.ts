// Production smoke for live Telegram image/QR and Guardian Angel flows.
//
// Usage:
//   railway run npm run prod:telegram-live-qa-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-live-qa-smoke
//
// Security: uses synthetic Telegram users, never prints secrets or chat ids,
// posts only to TELEGRAM_QA_CHAT_ID, and removes its own DB rows.
import { Buffer } from "node:buffer";
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";
import QRCode from "qrcode";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chatTypeForId,
  readTelegramSmokeChatId,
  type TelegramChatType,
} from "./telegram-smoke-chat";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const CHECK_WAIT_MS = 30_000;

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id?: string;
  width?: number;
  height?: number;
  file_size?: number;
}

interface SendPhotoResult {
  message_id: number;
  chat: {
    id: number;
    type?: TelegramChatType;
  };
  photo?: TelegramPhotoSize[];
}

interface TelegramApiEnvelope<T> {
  ok?: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

interface SessionSummary {
  level?: string;
  type?: string;
  context?: string;
  reasons?: string[];
  at?: string;
}

interface TelegramSessionRow {
  telegram_user_id: number;
  scenario: string;
  scenario_step: number;
  scenario_data: {
    chatScope?: {
      chatId?: number;
      chatType?: string;
    };
    lastCheck?: SessionSummary;
    guardian?: SessionSummary;
    [key: string]: unknown;
  } | null;
}

interface CheckRow {
  id: string;
  created_at: string;
  redacted_input: string | null;
  input_type: string | null;
  risk_level: string | null;
  reason_codes: string[] | null;
  ai_explanation: string | null;
}

interface SmokeContext {
  checkIds: Set<string>;
  markers: string[];
  messageIds: number[];
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
        "Example: npm run prod:telegram-live-qa-smoke -- https://your-app.example.com",
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
  return 1_783_000_000 + Math.floor(Math.random() * 1_000_000);
}

function syntheticTelegramUserId(offset: number): number {
  return 8_883_000_000_000 + Math.floor(Math.random() * 1_000_000) + offset;
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
}) {
  return {
    update_id: options.updateId,
    message: {
      message_id: options.messageId,
      from: { id: options.userId, is_bot: false, first_name: "QA" },
      chat: { id: options.chatId, type: options.chatType },
      date: Math.floor(Date.now() / 1000),
      text: options.text,
    },
  };
}

function photoUpdate(options: {
  updateId: number;
  messageId: number;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  photo: TelegramPhotoSize[];
}) {
  return {
    update_id: options.updateId,
    message: {
      message_id: options.messageId,
      from: { id: options.userId, is_bot: false, first_name: "QA" },
      chat: { id: options.chatId, type: options.chatType },
      date: Math.floor(Date.now() / 1000),
      photo: options.photo,
    },
  };
}

async function callTelegramJson<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Telegram ${method} returned status=${res.status}`);

  const data = (await res.json()) as TelegramApiEnvelope<T>;
  if (data.ok !== true || data.result === undefined) {
    const code = data.error_code === undefined ? "unknown" : String(data.error_code);
    const description = data.description ? ` ${data.description}` : "";
    fail(`Telegram ${method} failed code=${code}${description}`);
  }
  return data.result;
}

async function callTelegramForm<T>(botToken: string, method: string, form: FormData): Promise<T> {
  const res = await fetch(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) fail(`Telegram ${method} returned status=${res.status}`);

  const data = (await res.json()) as TelegramApiEnvelope<T>;
  if (data.ok !== true || data.result === undefined) {
    const code = data.error_code === undefined ? "unknown" : String(data.error_code);
    const description = data.description ? ` ${data.description}` : "";
    fail(`Telegram ${method} failed code=${code}${description}`);
  }
  return data.result;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) fail("QRCode did not produce a base64 data URL");
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
  return new Blob([bytes], { type: match[1] });
}

async function uploadQrPhoto(
  botToken: string,
  chatId: number,
  qrPayload: string,
): Promise<SendPhotoResult> {
  const dataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 384,
  });
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("caption", "Ishonch Guard QA synthetic QR smoke. This message will be deleted.");
  form.set("photo", dataUrlToBlob(dataUrl), "ishonch-qa-qr.png");

  const result = await callTelegramForm<SendPhotoResult>(botToken, "sendPhoto", form);
  if (!result.photo || result.photo.length === 0) {
    fail("Telegram sendPhoto response did not include photo file ids");
  }
  return result;
}

async function deleteTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
): Promise<void> {
  try {
    await callTelegramJson<boolean>(botToken, "deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`WARN cleanup deleteMessage failed: ${message}`);
  }
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
      guardian: latest?.scenario_data?.guardian ?? null,
    })}`,
  );
}

async function readChecksByMarker(marker: string, startedAtIso: string): Promise<CheckRow[]> {
  const { data, error } = await untypedSupabase()
    .from("checks")
    .select("id,created_at,redacted_input,input_type,risk_level,reason_codes,ai_explanation")
    .gte("created_at", startedAtIso)
    .ilike("redacted_input", `%${marker}%`)
    .order("created_at", { ascending: false });
  if (error) fail(`check lookup failed for marker ${marker}: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
}

async function rememberMarkedCheck(
  ctx: SmokeContext,
  marker: string,
  startedAtIso: string,
  predicate: (row: CheckRow) => boolean,
  label: string,
): Promise<CheckRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: CheckRow[] = [];
  while (Date.now() < deadline) {
    latest = await readChecksByMarker(marker, startedAtIso);
    const matching = latest.filter(predicate);
    if (matching.length === 1) {
      ctx.checkIds.add(matching[0].id);
      return matching[0];
    }
    if (matching.length > 1) fail(`expected one ${label} check, got ${matching.length}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  fail(
    `timed out waiting for ${label} check; rows=${JSON.stringify(
      latest.map((row) => ({
        id: row.id,
        risk: row.risk_level,
        type: row.input_type,
        reasons: row.reason_codes,
      })),
    )}`,
  );
}

function assertScopedHighRiskSession(
  row: TelegramSessionRow,
  chatId: number,
  chatType: TelegramChatType,
  requiredReason: string,
  label: string,
): void {
  const data = row.scenario_data;
  const lastCheck = data?.lastCheck;
  const guardian = data?.guardian;
  if (row.scenario !== "none" || row.scenario_step !== 0) {
    fail(`${label} did not return to neutral scenario`);
  }
  if (data?.chatScope?.chatId !== chatId || data.chatScope.chatType !== chatType) {
    fail(`${label} saved wrong chatScope`);
  }
  if (lastCheck?.level !== "high_risk") {
    fail(`${label} expected lastCheck high_risk, got ${lastCheck?.level ?? "null"}`);
  }
  if (!lastCheck.reasons?.includes(requiredReason)) {
    fail(`${label} lastCheck missing reason ${requiredReason}`);
  }
  if (guardian?.level !== "high_risk") {
    fail(`${label} expected guardian high_risk, got ${guardian?.level ?? "null"}`);
  }
  if (!guardian.reasons?.includes(requiredReason)) {
    fail(`${label} guardian missing reason ${requiredReason}`);
  }
}

function assertNoRawImagePersisted(
  row: TelegramSessionRow,
  largestPhotoFileId: string,
  qrMarker: string,
): void {
  const persisted = JSON.stringify(row);
  const forbidden = ["data:image", "photos/", "file_", largestPhotoFileId, qrMarker];
  const leaked = forbidden.find((needle) => needle && persisted.includes(needle));
  if (leaked) fail(`QR session persisted raw image or QR payload detail: ${leaked}`);
}

async function cleanup(
  ctx: SmokeContext,
  botToken: string,
  chatId: number,
  startedAtIso: string,
): Promise<void> {
  for (const marker of ctx.markers) {
    try {
      for (const row of await readChecksByMarker(marker, startedAtIso)) {
        ctx.checkIds.add(row.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`WARN cleanup check lookup failed: ${message}`);
    }
  }

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

  for (const messageId of ctx.messageIds) {
    await deleteTelegramMessage(botToken, chatId, messageId);
  }
}

async function runTextGuardianSmoke(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
  marker: string;
}): Promise<void> {
  const userId = syntheticTelegramUserId(1_000);
  const updateId = nextUpdateId();
  options.ctx.userIds.push(userId);
  options.ctx.updateIds.push(updateId);

  const startedAtIso = new Date().toISOString();
  const text =
    `${options.marker} Bank security urgently asks for verification code from SMS and CVV ` +
    "to cancel an operation.";
  const res = await postWebhook(
    options.publicUrl,
    options.webhookSecret,
    textUpdate({
      updateId,
      messageId: updateId,
      userId,
      chatId: options.chatId,
      chatType: options.chatType,
      text,
    }),
  );
  if (res.status !== 200) fail(`high-risk text webhook returned status=${res.status}`);

  const session = await waitForSession(
    userId,
    (row) => row?.scenario_data?.guardian?.level === "high_risk",
    "high-risk Guardian session",
  );
  assertScopedHighRiskSession(
    session,
    options.chatId,
    options.chatType,
    "asks_for_sms_code",
    "text",
  );

  await rememberMarkedCheck(
    options.ctx,
    options.marker,
    startedAtIso,
    (row) =>
      row.risk_level === "high_risk" && (row.reason_codes ?? []).includes("asks_for_sms_code"),
    "high-risk text",
  );
}

async function runQrImageSmoke(options: {
  ctx: SmokeContext;
  botToken: string;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
  marker: string;
}): Promise<void> {
  const userId = syntheticTelegramUserId(2_000);
  const updateId = nextUpdateId();
  options.ctx.userIds.push(userId);
  options.ctx.updateIds.push(updateId);

  const qrPayload = `payme:${options.marker}:invoice`;
  const upload = await uploadQrPhoto(options.botToken, options.chatId, qrPayload);
  options.ctx.messageIds.push(upload.message_id);
  const photo = upload.photo ?? [];
  const largestPhoto = [...photo].sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0))[0];
  if (!largestPhoto) fail("Telegram sendPhoto returned no usable photo size");

  const startedAtIso = new Date().toISOString();
  const res = await postWebhook(
    options.publicUrl,
    options.webhookSecret,
    photoUpdate({
      updateId,
      messageId: updateId,
      userId,
      chatId: options.chatId,
      chatType: upload.chat.type ?? options.chatType,
      photo,
    }),
  );
  if (res.status !== 200) fail(`QR image webhook returned status=${res.status}`);

  const session = await waitForSession(
    userId,
    (row) => row?.scenario_data?.lastCheck?.reasons?.includes("asks_to_scan_qr") === true,
    "QR image check session",
  );
  assertScopedHighRiskSession(
    session,
    options.chatId,
    upload.chat.type ?? options.chatType,
    "asks_to_scan_qr",
    "QR image",
  );
  assertNoRawImagePersisted(session, largestPhoto.file_id, options.marker);

  await rememberMarkedCheck(
    options.ctx,
    options.marker,
    startedAtIso,
    (row) => row.risk_level === "high_risk" && (row.reason_codes ?? []).includes("asks_to_scan_qr"),
    "QR image",
  );
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const chatId = readTelegramSmokeChatId();
  const chatType = chatTypeForId(chatId);
  const markerRoot = `QAPONETGLIVE${randomLetters(8)}`;
  const textMarker = `${markerRoot}TEXT`;
  const qrMarker = `${markerRoot}QR`;
  const startedAtIso = new Date().toISOString();
  const ctx: SmokeContext = {
    checkIds: new Set<string>(),
    markers: [textMarker, qrMarker],
    messageIds: [],
    updateIds: [],
    userIds: [],
  };

  console.log(`Production Telegram live QA smoke target: ${publicUrl}`);
  console.log(`QA marker root: ${markerRoot}`);
  console.log("Secret values, chat id, and synthetic Telegram ids are not printed.");

  try {
    await runTextGuardianSmoke({
      ctx,
      publicUrl,
      webhookSecret,
      chatId,
      chatType,
      marker: textMarker,
    });
    console.log("OK high-risk Guardian text path processed and persisted safe context");

    await runQrImageSmoke({
      ctx,
      botToken,
      publicUrl,
      webhookSecret,
      chatId,
      chatType,
      marker: qrMarker,
    });
    console.log("OK live Telegram QR photo path decoded and persisted safe context");
  } finally {
    await cleanup(ctx, botToken, chatId, startedAtIso);
  }

  console.log("OK cleanup done");
  console.log("OK production Telegram live QA smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram live QA smoke: ${message}`);
  process.exitCode = 1;
});
