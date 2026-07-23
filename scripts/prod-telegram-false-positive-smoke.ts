// Production smoke for CORE-001 false-positive boundaries in the live Telegram path.
//
// Usage:
//   railway run npm run prod:telegram-false-positive-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-false-positive-smoke
//
// Security: uses synthetic Telegram users, never prints secrets or chat ids,
// posts only to TELEGRAM_QA_CHAT_ID, and removes its own DB rows after the check.
import { randomInt } from "node:crypto";
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Risk_Level } from "@/lib/risk/rules";
import {
  chatTypeForId,
  readTelegramSmokeChatId,
  type TelegramChatType,
} from "./telegram-smoke-chat";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const CHECK_WAIT_MS = 30_000;

interface CheckRow {
  id: string;
  created_at: string;
  redacted_input: string | null;
  input_type: string | null;
  risk_level: Risk_Level | null;
  reason_codes: string[] | null;
}

interface LastCheckSnapshot {
  level?: Risk_Level;
  reasons?: string[];
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
    lastCheck?: LastCheckSnapshot;
    [key: string]: unknown;
  } | null;
}

interface FalsePositiveCase {
  label: string;
  text: string;
  forbiddenReasons: string[];
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
        "Example: npm run prod:telegram-false-positive-smoke -- https://your-app.example.com",
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
    value += alphabet[randomInt(alphabet.length)];
  }
  return value;
}

function nextUpdateId(): number {
  return 1_784_000_000 + randomInt(1_000_000);
}

function syntheticTelegramUserId(offset: number): number {
  return 8_884_000_000_000 + randomInt(1_000_000) + offset;
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

async function readSession(userId: number): Promise<TelegramSessionRow | null> {
  const { data, error } = await untypedSupabase()
    .from("telegram_sessions")
    .select("telegram_user_id,scenario,scenario_step,scenario_data")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (error) fail(`telegram session lookup failed: ${error.message}`);
  return (data as TelegramSessionRow | null) ?? null;
}

async function readChecksByMarker(marker: string, startedAtIso: string): Promise<CheckRow[]> {
  const { data, error } = await untypedSupabase()
    .from("checks")
    .select("id,created_at,redacted_input,input_type,risk_level,reason_codes")
    .gte("created_at", startedAtIso)
    .ilike("redacted_input", `%${marker}%`)
    .order("created_at", { ascending: false });
  if (error) fail(`check lookup failed for marker ${marker}: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
}

async function waitForMarkedCheck(
  marker: string,
  startedAtIso: string,
  label: string,
): Promise<CheckRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: CheckRow[] = [];
  while (Date.now() < deadline) {
    latest = await readChecksByMarker(marker, startedAtIso);
    if (latest.length === 1) return latest[0];
    if (latest.length > 1) fail(`expected one ${label} check, got ${latest.length}`);
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

async function waitForSessionLastCheck(userId: number, label: string): Promise<TelegramSessionRow> {
  const deadline = Date.now() + CHECK_WAIT_MS;
  let latest: TelegramSessionRow | null = null;
  while (Date.now() < deadline) {
    latest = await readSession(userId);
    if (latest?.scenario_data?.lastCheck) return latest;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  fail(
    `timed out waiting for ${label} session; latest=${JSON.stringify({
      scenario: latest?.scenario ?? null,
      step: latest?.scenario_step ?? null,
      lastCheck: latest?.scenario_data?.lastCheck ?? null,
    })}`,
  );
}

function assertFalsePositiveBoundary(
  subject: string,
  level: Risk_Level | undefined | null,
  reasons: string[] | undefined | null,
  forbiddenReasons: string[],
): void {
  if (level === "high_risk") fail(`${subject} became high_risk`);

  const actual = new Set(reasons ?? []);
  for (const reason of forbiddenReasons) {
    if (actual.has(reason)) fail(`${subject} unexpectedly included reason ${reason}`);
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

async function runCase(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  chatId: number;
  chatType: TelegramChatType;
  marker: string;
  testCase: FalsePositiveCase;
}): Promise<void> {
  const userId = syntheticTelegramUserId(options.ctx.userIds.length + 1_000);
  const updateId = nextUpdateId();
  const startedAtIso = new Date().toISOString();
  const text = `${options.marker} ${options.testCase.text}`;

  options.ctx.userIds.push(userId);
  options.ctx.updateIds.push(updateId);
  options.ctx.markers.push(options.marker);

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
  if (res.status !== 200) {
    fail(`${options.testCase.label} webhook returned status=${res.status}`);
  }

  const check = await waitForMarkedCheck(options.marker, startedAtIso, options.testCase.label);
  options.ctx.checkIds.add(check.id);
  assertFalsePositiveBoundary(
    `${options.testCase.label} check`,
    check.risk_level,
    check.reason_codes,
    options.testCase.forbiddenReasons,
  );

  const session = await waitForSessionLastCheck(userId, options.testCase.label);
  assertFalsePositiveBoundary(
    `${options.testCase.label} session`,
    session.scenario_data?.lastCheck?.level,
    session.scenario_data?.lastCheck?.reasons,
    options.testCase.forbiddenReasons,
  );

  console.log(
    `OK ${options.testCase.label}: level=${check.risk_level ?? "null"}, reasons=${JSON.stringify(
      check.reason_codes ?? [],
    )}`,
  );
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const chatId = readTelegramSmokeChatId();
  const chatType = chatTypeForId(chatId);
  const markerRoot = `QACORE001FP${randomLetters(8)}`;
  const startedAtIso = new Date().toISOString();
  const ctx: SmokeContext = {
    checkIds: new Set<string>(),
    markers: [],
    updateIds: [],
    userIds: [],
  };
  const cases: FalsePositiveCase[] = [
    {
      label: "normal delivery status",
      text: "Kuryer ertaga posilkani olib keladi. Buyurtma punktda kutmoqda, olib ketishingiz mumkin.",
      forbiddenReasons: [
        "fake_delivery_payment",
        "payment_before_service",
        "gambling_prediction_promo",
        "crypto_casino_bonus_funnel",
      ],
    },
    {
      label: "ordinary sports news",
      text: "Sports news: the match score was updated after the second half. No bets or predictions.",
      forbiddenReasons: ["gambling_prediction_promo", "crypto_casino_bonus_funnel"],
    },
    {
      label: "Telegram product news",
      text: "The recent Telegram update lets people collapse apps and switch between them. Explore TON and Telegram Apps in the official catalog.",
      forbiddenReasons: [
        "crypto_casino_bonus_funnel",
        "giveaway_engagement_bait",
        "task_reward_engagement_bait",
        "wallet_action_urgency",
        "ton_referral_earning",
      ],
    },
  ];

  console.log(`Production Telegram false-positive smoke target: ${publicUrl}`);
  console.log(`QA marker root: ${markerRoot}`);
  console.log("Secret values, chat id, and synthetic Telegram ids are not printed.");

  try {
    for (const [index, testCase] of cases.entries()) {
      await runCase({
        ctx,
        publicUrl,
        webhookSecret,
        chatId,
        chatType,
        marker: `${markerRoot}${index + 1}`,
        testCase,
      });
    }
  } finally {
    await cleanup(ctx, startedAtIso);
  }

  console.log("OK cleanup done");
  console.log("OK production Telegram false-positive smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram false-positive smoke: ${message}`);
  process.exitCode = 1;
});
