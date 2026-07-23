// Production smoke for Telegram private/group session scoping.
//
// Usage:
//   railway run npm run prod:telegram-scope-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-scope-smoke
//
// Security: this script uses synthetic Telegram ids only, never prints secrets,
// and removes its own telegram_sessions / telegram_webhook_updates rows.
import { randomInt } from "node:crypto";
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const REPORT_CALLBACK = "report";
const REPORT_SKIP_CALLBACK = "report_skip";
const REPORT_SCENARIOS = new Set([
  "report_value",
  "report_desc",
  "report_scamType",
  "report_city",
  "report_amount",
]);

interface TelegramSessionRow {
  telegram_user_id: number;
  scenario: string;
  scenario_step: number;
  scenario_data: {
    chatScope?: {
      chatId?: number;
      chatType?: string;
    };
    [key: string]: unknown;
  } | null;
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
        "Example: npm run prod:telegram-scope-smoke -- https://your-app.example.com",
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

function nextUpdateId(): number {
  return 1_782_000_000 + randomInt(1_000_000);
}

function syntheticTelegramIds(): { userId: number; privateChatId: number; groupChatId: number } {
  const suffix = randomInt(1_000_000);
  const userId = 8_880_000_000_000 + suffix;
  return {
    userId,
    privateChatId: userId,
    groupChatId: -8_881_000_000_000 - suffix,
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

function callbackUpdate(options: {
  updateId: number;
  callbackId: string;
  userId: number;
  chatId: number;
  chatType: "private" | "group" | "supergroup";
  data: string;
}) {
  return {
    update_id: options.updateId,
    callback_query: {
      id: options.callbackId,
      from: { id: options.userId, first_name: "QA" },
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
): Promise<TelegramSessionRow | null> {
  const deadline = Date.now() + 12_000;
  let latest: TelegramSessionRow | null = null;
  while (Date.now() < deadline) {
    latest = await readSession(userId);
    if (predicate(latest)) return latest;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  fail(
    `timed out waiting for ${label}; latest=${JSON.stringify({
      scenario: latest?.scenario ?? null,
      step: latest?.scenario_step ?? null,
      scope: latest?.scenario_data?.chatScope ?? null,
    })}`,
  );
}

async function cleanup(userId: number, updateIds: number[]): Promise<void> {
  const sessionDelete = await untypedSupabase()
    .from("telegram_sessions")
    .delete()
    .eq("telegram_user_id", userId);
  if (sessionDelete.error) {
    console.error(`WARN cleanup telegram_sessions failed: ${sessionDelete.error.message}`);
  }

  if (updateIds.length > 0) {
    const dedupDelete = await untypedSupabase()
      .from("telegram_webhook_updates")
      .delete()
      .in("update_id", updateIds);
    if (dedupDelete.error) {
      console.error(`WARN cleanup telegram_webhook_updates failed: ${dedupDelete.error.message}`);
    }
  }
}

function assertPrivateReportSession(row: TelegramSessionRow | null, privateChatId: number): void {
  if (!row) fail("private report start did not create a telegram session");
  if (row.scenario !== "report_value") {
    fail(`expected private report scenario=report_value, got ${row.scenario}`);
  }
  const scope = row.scenario_data?.chatScope;
  if (scope?.chatId !== privateChatId || scope.chatType !== "private") {
    fail(`expected private chatScope, got ${JSON.stringify(scope ?? null)}`);
  }
}

function assertGroupDidNotAdvanceReport(row: TelegramSessionRow | null): void {
  if (!row) return;
  if (REPORT_SCENARIOS.has(row.scenario)) {
    fail(`group callback reused private report scenario (${row.scenario})`);
  }
  if (row.scenario !== "none" || row.scenario_step !== 0) {
    fail(`expected neutral session after group mismatch, got ${row.scenario}/${row.scenario_step}`);
  }
  if (Object.keys(row.scenario_data ?? {}).length > 0) {
    fail(
      `expected empty scenario_data after group mismatch, got ${JSON.stringify(row.scenario_data)}`,
    );
  }
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const { userId, privateChatId, groupChatId } = syntheticTelegramIds();
  const privateUpdateId = nextUpdateId();
  const groupUpdateId = nextUpdateId();
  const updateIds = [privateUpdateId, groupUpdateId];

  console.log(`Production Telegram scope smoke target: ${publicUrl}`);
  console.log("Secret values and synthetic Telegram ids are not printed.");

  try {
    await cleanup(userId, updateIds);

    const privateRes = await postWebhook(
      publicUrl,
      webhookSecret,
      callbackUpdate({
        updateId: privateUpdateId,
        callbackId: `qa-private-${privateUpdateId}`,
        userId,
        chatId: privateChatId,
        chatType: "private",
        data: REPORT_CALLBACK,
      }),
    );
    if (privateRes.status !== 200) {
      fail(`private report webhook returned status=${privateRes.status}`);
    }

    const privateSession = await waitForSession(
      userId,
      (row) => row?.scenario === "report_value",
      "private report session",
    );
    assertPrivateReportSession(privateSession, privateChatId);

    const groupRes = await postWebhook(
      publicUrl,
      webhookSecret,
      callbackUpdate({
        updateId: groupUpdateId,
        callbackId: `qa-group-${groupUpdateId}`,
        userId,
        chatId: groupChatId,
        chatType: "supergroup",
        data: REPORT_SKIP_CALLBACK,
      }),
    );
    if (groupRes.status !== 200) {
      fail(`group callback webhook returned status=${groupRes.status}`);
    }

    const groupSession = await waitForSession(
      userId,
      (row) => row?.scenario === "none",
      "group mismatch reset",
    );
    assertGroupDidNotAdvanceReport(groupSession);

    console.log("OK production Telegram private/group session scope smoke passed cleanup=pending");
  } finally {
    await cleanup(userId, updateIds);
  }

  console.log("OK cleanup done");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram scope smoke: ${message}`);
  process.exitCode = 1;
});
