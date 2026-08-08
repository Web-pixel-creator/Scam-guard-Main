// Production smoke test for the deployed Node SSR app + Telegram bot channel.
//
// Usage:
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:smoke
//   npm run prod:smoke -- https://your-app.example.com
//   railway run npx vite-node scripts/prod-smoke.ts https://your-app.example.com --live-telegram
//   # Add --check-ai only for one explicitly approved provider request.
//
// Security: this script never prints bot tokens, webhook secrets, Supabase
// service-role keys, API keys, Telegram user ids or chat ids.
import { randomInt } from "node:crypto";
import process from "node:process";
import { checkAiProvider as runAiProviderCheck } from "./prod-monitor-ai";
import {
  expectedAuthenticatedWebhookStatus,
  parseTelegramDeliveryMode,
  telegramDeliveryInfoIsHealthy,
  type TelegramDeliveryMode,
} from "@/lib/security/telegram-delivery-policy";

const WEBHOOK_PATH = "/api/telegram/webhook";
const STALE_TELEGRAM_ERROR_MS = 15 * 60 * 1000;
const AI_PROVIDER_TIMEOUT_MS = 8_000;
const DEFAULT_HIGH_RISK_TEXT =
  "Служба безопасности банка просит срочно назвать SMS-код для отмены операции";

interface SmokeResult {
  name: string;
  ok: boolean;
  detail: string;
}

function parseArgs(): {
  publicUrl: string;
  liveTelegram: boolean;
  checkAiProvider: boolean;
  deliveryMode: TelegramDeliveryMode;
} {
  const args = process.argv.slice(2);
  const liveTelegram = args.includes("--live-telegram");
  const checkAiProvider = args.includes("--check-ai");
  const publicUrl = args.find((arg) => !arg.startsWith("--")) ?? process.env.PUBLIC_APP_URL;

  if (!publicUrl) {
    fail(
      "missing public URL. Pass it as the first argument or set PUBLIC_APP_URL. " +
        "Example: npm run prod:smoke -- https://your-app.example.com",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(publicUrl);
  } catch {
    fail(`invalid public URL: ${publicUrl}`);
  }

  if (parsed.protocol !== "https:") {
    fail(`public URL must use https, got ${parsed.protocol}`);
  }

  return {
    publicUrl: `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`,
    liveTelegram,
    checkAiProvider,
    deliveryMode: parseTelegramDeliveryMode(process.env.TELEGRAM_UPDATE_DELIVERY_MODE),
  };
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

function getOptionalEnv(name: string): string | null {
  return process.env[name] || null;
}

function printResult(result: SmokeResult): void {
  const mark = result.ok ? "OK" : "FAIL";
  console.log(`${mark} ${result.name}: ${result.detail}`);
}

async function checkHttpStatus(
  name: string,
  input: RequestInfo | URL,
  init: RequestInit,
  expected: number,
) {
  const res = await fetch(input, init);
  return {
    name,
    ok: res.status === expected,
    detail: `status=${res.status}, expected=${expected}`,
  } satisfies SmokeResult;
}

async function checkApp(
  publicUrl: string,
  webhookSecret: string,
  deliveryMode: TelegramDeliveryMode,
): Promise<SmokeResult[]> {
  const webhookUrl = `${publicUrl}${WEBHOOK_PATH}`;
  const authenticatedStatus = expectedAuthenticatedWebhookStatus(deliveryMode);
  return [
    await checkHttpStatus("home", publicUrl, {}, 200),
    await checkHttpStatus("healthz", `${publicUrl}/healthz`, {}, 200),
    await checkHttpStatus(
      "webhook rejects missing secret",
      webhookUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update_id: nextUpdateId() }),
      },
      401,
    ),
    await checkHttpStatus(
      deliveryMode === "webhook"
        ? "webhook accepts valid secret"
        : "webhook disabled after valid secret",
      webhookUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
        },
        body: JSON.stringify({ update_id: nextUpdateId() }),
      },
      authenticatedStatus,
    ),
  ];
}

async function checkTelegramWebhook(
  botToken: string,
  deliveryMode: TelegramDeliveryMode,
): Promise<SmokeResult> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
  if (!res.ok) {
    return { name: "telegram getWebhookInfo", ok: false, detail: `status=${res.status}` };
  }

  const data = (await res.json()) as {
    ok?: boolean;
    result?: {
      pending_update_count?: number;
      last_error_date?: number;
      last_error_message?: string;
      url?: string;
    };
  };

  const pending = data.result?.pending_update_count ?? -1;
  const lastError = data.result?.last_error_message ?? "";
  const lastErrorDate = data.result?.last_error_date;
  const lastErrorAgeMs =
    typeof lastErrorDate === "number" ? Date.now() - lastErrorDate * 1000 : null;
  const isStaleLastError =
    typeof lastErrorAgeMs === "number" && lastErrorAgeMs > STALE_TELEGRAM_ERROR_MS;
  const hasUrl = Boolean(data.result?.url);
  const hasRecentError = Boolean(lastError) && !isStaleLastError;
  const lastErrorDetail = lastError ? `${lastError}${isStaleLastError ? " (stale)" : ""}` : "none";

  return {
    name: "telegram update delivery info",
    ok:
      data.ok === true &&
      telegramDeliveryInfoIsHealthy({
        mode: deliveryMode,
        hasWebhookUrl: hasUrl,
        pendingUpdates: pending,
        hasRecentError,
      }),
    detail: `mode=${deliveryMode}, has_url=${hasUrl}, pending=${pending}, last_error=${lastErrorDetail}`,
  };
}

async function checkPollingLeader(publicUrl: string, webhookSecret: string): Promise<SmokeResult> {
  return checkHttpStatus(
    "telegram polling leader",
    `${publicUrl}/api/telegram/polling-health`,
    { headers: { "X-Telegram-Bot-Api-Secret-Token": webhookSecret } },
    200,
  );
}

async function checkAiProvider(enabled: boolean): Promise<SmokeResult> {
  const check = await runAiProviderCheck(
    {
      enabled,
      apiKey: getOptionalEnv("OPENAI_API_KEY"),
      baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      timeoutMs: AI_PROVIDER_TIMEOUT_MS,
      optInLabel: "--check-ai",
    },
    fetchWithTimeout,
  );

  return { name: check.name, ok: check.severity === "ok", detail: check.detail };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function latestTelegramUserId(): Promise<number | null> {
  const supabaseUrl = getOptionalEnv("SUPABASE_URL");
  const serviceRole = getOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return null;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/telegram_sessions?select=telegram_user_id&order=updated_at.desc&limit=1`,
    {
      headers: {
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`,
      },
    },
  );

  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ telegram_user_id?: number }>;
  return rows[0]?.telegram_user_id ?? null;
}

async function checkLiveTelegram(publicUrl: string, webhookSecret: string): Promise<SmokeResult> {
  const userId = await latestTelegramUserId();
  if (!userId) {
    return {
      name: "live telegram synthetic update",
      ok: false,
      detail: "no latest telegram session found or Supabase env unavailable",
    };
  }

  const updateId = nextUpdateId();
  const res = await fetch(`${publicUrl}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
    },
    body: JSON.stringify({
      update_id: updateId,
      message: {
        message_id: updateId,
        from: { id: userId, is_bot: false, first_name: "QA" },
        chat: { id: userId, type: "private" },
        date: Math.floor(Date.now() / 1000),
        text: DEFAULT_HIGH_RISK_TEXT,
      },
    }),
  });

  return {
    name: "live telegram synthetic update",
    ok: res.status === 200,
    detail: `status=${res.status}, sent_to_latest_session=true`,
  };
}

function nextUpdateId(): number {
  return 1_781_000_000 + randomInt(1_000_000);
}

async function main(): Promise<void> {
  const { publicUrl, liveTelegram, checkAiProvider: shouldCheckAi, deliveryMode } = parseArgs();
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");

  console.log(`Production smoke target: ${publicUrl}`);
  console.log("Secret values are read from env and are not printed.");

  const results: SmokeResult[] = [];
  results.push(...(await checkApp(publicUrl, webhookSecret, deliveryMode)));
  results.push(await checkTelegramWebhook(botToken, deliveryMode));
  if (deliveryMode === "polling") {
    results.push(await checkPollingLeader(publicUrl, webhookSecret));
  }
  results.push(await checkAiProvider(shouldCheckAi));
  if (liveTelegram) {
    if (deliveryMode === "webhook") {
      results.push(await checkLiveTelegram(publicUrl, webhookSecret));
      results.push(await checkTelegramWebhook(botToken, deliveryMode));
    } else {
      results.push({
        name: "live telegram synthetic update",
        ok: false,
        detail: "polling mode requires prod:telegram-polling-dispatch-smoke",
      });
    }
  }

  for (const result of results) printResult(result);

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("OK production smoke passed.");
}

main().catch((err: unknown) => {
  fail(`unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
});
