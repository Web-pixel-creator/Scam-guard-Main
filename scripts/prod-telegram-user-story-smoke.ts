// Production smoke for Telegram P1 user-story flows.
//
// Usage:
//   railway run npm run prod:telegram-user-story-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-user-story-smoke
//
// Security: uses synthetic Telegram users only, never prints secrets/chat ids,
// posts only to TELEGRAM_QA_CHAT_ID, and removes its own checks / sessions / webhook dedup rows.
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalize } from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";
import {
  chatTypeForId,
  readTelegramSmokeChatId,
  type TelegramChatType,
} from "./telegram-smoke-chat";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const CHECK_WAIT_MS = 30_000;
const NO_CHECK_WAIT_MS = 2_500;

type SupportedLang = "ru" | "uz" | "en";

interface SessionSummary {
  level?: string;
  type?: string;
  context?: string;
  reasons?: string[];
  at?: string;
}

interface TelegramSessionRow {
  telegram_user_id: number;
  lang: SupportedLang;
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
  input_hash: string | null;
  input_type: string | null;
  risk_level: string | null;
  reason_codes: string[] | null;
}

interface SmokeContext {
  checkIds: Set<string>;
  markers: string[];
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
        "Example: npm run prod:telegram-user-story-smoke -- https://your-app.example.com",
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

function randomDigits(length: number): string {
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += Math.floor(Math.random() * 10);
  }
  return value;
}

function nextUpdateId(): number {
  return 1_784_000_000 + Math.floor(Math.random() * 1_000_000);
}

function syntheticTelegramUserId(offset: number): number {
  return 8_884_000_000_000 + Math.floor(Math.random() * 1_000_000) + offset;
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
        language_code: options.languageCode ?? "en",
      },
      chat: { id: options.chatId, type: options.chatType },
      date: Math.floor(Date.now() / 1000),
      text: options.text,
    },
  };
}

function callbackUpdate(options: {
  updateId: number;
  callbackId: string;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  data: string;
}) {
  return {
    update_id: options.updateId,
    callback_query: {
      id: options.callbackId,
      from: { id: options.userId, is_bot: false, first_name: "QA" },
      message: {
        message_id: options.updateId,
        chat: { id: options.chatId, type: options.chatType },
      },
      data: options.data,
    },
  };
}

async function readSession(userId: number): Promise<TelegramSessionRow | null> {
  const { data, error } = await untypedSupabase()
    .from("telegram_sessions")
    .select("telegram_user_id,lang,scenario,scenario_step,scenario_data")
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
      lang: latest?.lang ?? null,
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
    .select("id,created_at,redacted_input,input_hash,input_type,risk_level,reason_codes")
    .gte("created_at", startedAtIso)
    .ilike("redacted_input", `%${marker}%`)
    .order("created_at", { ascending: false });
  if (error) fail(`check lookup failed for marker ${marker}: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
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

async function rememberHashedCheck(
  ctx: SmokeContext,
  hash: string,
  startedAtIso: string,
  predicate: (row: CheckRow) => boolean,
  label: string,
): Promise<CheckRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: CheckRow[] = [];
  while (Date.now() < deadline) {
    latest = await readChecksByHash(hash, startedAtIso);
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

async function assertNoCheckByTextHash(
  ctx: SmokeContext,
  text: string,
  startedAtIso: string,
  label: string,
): Promise<void> {
  const hash = await hashIdentifier(normalize(text, "text"));
  const deadline = Date.now() + NO_CHECK_WAIT_MS;
  let rows: CheckRow[] = [];
  while (Date.now() < deadline) {
    rows = await readChecksByHash(hash, startedAtIso);
    if (rows.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (rows.length === 0) return;

  rows.forEach((row) => ctx.checkIds.add(row.id));
  fail(`${label} unexpectedly created ${rows.length} check row(s)`);
}

function assertScopedSession(
  row: TelegramSessionRow,
  chatId: number,
  chatType: TelegramChatType,
  label: string,
): void {
  const scope = row.scenario_data?.chatScope;
  if (scope?.chatId !== chatId || scope.chatType !== chatType) {
    fail(`${label} saved wrong chatScope`);
  }
}

function assertNoGuardian(row: TelegramSessionRow, label: string): void {
  if (row.scenario_data?.guardian) {
    fail(`${label} unexpectedly stored Guardian context`);
  }
}

async function cleanup(ctx: SmokeContext, startedAtIso: string): Promise<void> {
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
}

async function sendText(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  text: string;
  languageCode?: SupportedLang;
  label: string;
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

async function sendCallback(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  data: string;
  label: string;
}): Promise<void> {
  const updateId = nextUpdateId();
  options.ctx.updateIds.push(updateId);
  const res = await postWebhook(
    options.publicUrl,
    options.webhookSecret,
    callbackUpdate({
      updateId,
      callbackId: `qa-user-story-${updateId}`,
      userId: options.userId,
      chatId: options.chatId,
      chatType: options.chatType,
      data: options.data,
    }),
  );
  if (res.status !== 200) fail(`${options.label} webhook returned status=${res.status}`);
}

async function runStartAndLanguageSmoke(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
}): Promise<void> {
  const userId = syntheticTelegramUserId(1_000);
  options.ctx.userIds.push(userId);

  await sendText({
    ...options,
    userId,
    text: "/start",
    languageCode: "en",
    label: "/start",
  });

  for (const lang of ["ru", "uz", "en"] as const) {
    await sendCallback({
      ...options,
      userId,
      data: `lang:${lang}`,
      label: `lang:${lang}`,
    });
    const session = await waitForSession(
      userId,
      (row) => row?.lang === lang,
      `language ${lang} session`,
    );
    if (session.scenario !== "none" || session.scenario_step !== 0) {
      fail(`language ${lang} changed scenario unexpectedly`);
    }
  }
}

async function runPhonePassportSmoke(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
}): Promise<void> {
  const userId = syntheticTelegramUserId(2_000);
  options.ctx.userIds.push(userId);
  const tail = randomDigits(7);
  const phone = `+998 90 ${tail.slice(0, 3)} ${tail.slice(3, 5)} ${tail.slice(5)}`;
  const phoneHash = await hashIdentifier(normalize(phone, "phone"));
  const startedAtIso = new Date().toISOString();

  await sendText({
    ...options,
    userId,
    text: phone,
    label: "phone passport",
  });

  const session = await waitForSession(
    userId,
    (row) => row?.scenario_data?.lastCheck?.context === "phone",
    "phone passport session",
  );
  assertScopedSession(session, options.chatId, options.chatType, "phone passport");
  assertNoGuardian(session, "phone passport");
  const lastCheck = session.scenario_data?.lastCheck;
  if (lastCheck?.type !== "phone") fail(`phone passport session type=${lastCheck?.type ?? "null"}`);
  if (lastCheck.level === "high_risk") fail("phone passport became high_risk");
  if (!lastCheck.reasons?.includes("valid_uz_phone")) {
    fail("phone passport session missing valid_uz_phone");
  }

  await rememberHashedCheck(
    options.ctx,
    phoneHash,
    startedAtIso,
    (row) =>
      row.input_type === "phone" &&
      row.risk_level !== "high_risk" &&
      (row.reason_codes ?? []).includes("valid_uz_phone"),
    "phone passport",
  );
}

async function runDeliveryConversationSmoke(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
  marker: string;
  lang: SupportedLang;
}): Promise<void> {
  const userId = syntheticTelegramUserId(3_000);
  options.ctx.userIds.push(userId);
  const deliveryText = `${options.marker} Your parcel is ready for pickup at branch today.`;
  const deliveryStartedAtIso = new Date().toISOString();

  await sendCallback({
    ...options,
    userId,
    data: `lang:${options.lang}`,
    label: `conversation language ${options.lang}`,
  });
  await waitForSession(
    userId,
    (row) => row?.lang === options.lang,
    `conversation language ${options.lang}`,
  );

  await sendText({
    ...options,
    userId,
    text: deliveryText,
    languageCode: options.lang,
    label: `benign delivery ${options.lang}`,
  });

  const session = await waitForSession(
    userId,
    (row) => row?.scenario_data?.lastCheck?.context === "delivery",
    `benign delivery ${options.lang} session`,
  );
  assertScopedSession(session, options.chatId, options.chatType, "benign delivery");
  assertNoGuardian(session, "benign delivery");
  const lastCheck = session.scenario_data?.lastCheck;
  if (lastCheck?.level === "high_risk") fail("benign delivery became high_risk");
  if ((lastCheck?.reasons ?? []).some((reason) => reason === "fake_delivery_payment")) {
    fail("benign delivery was flagged as fake_delivery_payment");
  }

  await rememberMarkedCheck(
    options.ctx,
    options.marker,
    deliveryStartedAtIso,
    (row) =>
      row.input_type === "text" &&
      row.risk_level !== "high_risk" &&
      !(row.reason_codes ?? []).includes("fake_delivery_payment"),
    "benign delivery",
  );

  const acknowledgement = "thanks.";
  const acknowledgementStartedAtIso = new Date().toISOString();
  await sendText({
    ...options,
    userId,
    text: acknowledgement,
    languageCode: options.lang,
    label: `acknowledgement follow-up ${options.lang}`,
  });
  await assertNoCheckByTextHash(
    options.ctx,
    acknowledgement,
    acknowledgementStartedAtIso,
    "acknowledgement follow-up",
  );

  const confirmation = "They asked for confirmation.";
  const confirmationStartedAtIso = new Date().toISOString();
  await sendText({
    ...options,
    userId,
    text: confirmation,
    languageCode: options.lang,
    label: `confirmation follow-up ${options.lang}`,
  });
  await assertNoCheckByTextHash(
    options.ctx,
    confirmation,
    confirmationStartedAtIso,
    "confirmation follow-up",
  );
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const chatId = readTelegramSmokeChatId();
  const chatType = chatTypeForId(chatId);
  const markerRoot = `QAPONETGUSERSTORY${randomLetters(8)}`;
  const deliveryMarkers = {
    ru: `${markerRoot}DELIVERYRU`,
    uz: `${markerRoot}DELIVERYUZ`,
    en: `${markerRoot}DELIVERYEN`,
  } satisfies Record<SupportedLang, string>;
  const startedAtIso = new Date().toISOString();
  const ctx: SmokeContext = {
    checkIds: new Set<string>(),
    markers: Object.values(deliveryMarkers),
    updateIds: [],
    userIds: [],
  };

  console.log(`Production Telegram user-story smoke target: ${publicUrl}`);
  console.log(`QA marker root: ${markerRoot}`);
  console.log("Secret values, chat id, and synthetic Telegram ids are not printed.");

  try {
    await runStartAndLanguageSmoke({
      ctx,
      publicUrl,
      webhookSecret,
      chatId,
      chatType,
    });
    console.log("OK /start accepted and RU/UZ/EN language callbacks persisted");

    await runPhonePassportSmoke({
      ctx,
      publicUrl,
      webhookSecret,
      chatId,
      chatType,
    });
    console.log("OK phone passport path persisted non-high-risk lastCheck");

    for (const lang of ["ru", "uz", "en"] as const) {
      await runDeliveryConversationSmoke({
        ctx,
        publicUrl,
        webhookSecret,
        chatId,
        chatType,
        marker: deliveryMarkers[lang],
        lang,
      });
    }
    console.log("OK RU/UZ/EN benign delivery and conversational follow-ups stayed out of runCheck");
  } finally {
    await cleanup(ctx, startedAtIso);
  }

  console.log("OK cleanup done");
  console.log("OK production Telegram user-story smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram user-story smoke: ${message}`);
  process.exitCode = 1;
});
