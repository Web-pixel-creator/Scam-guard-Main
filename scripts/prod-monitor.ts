// Production monitor for the deployed app + Telegram bot channel.
//
// Intended for scheduled execution from Railway, GitHub Actions, cron or a
// local operator shell:
//   railway run npm run monitor:prod -- https://your-app.example.com
//
// Optional alerting:
//   set MONITOR_ALERT_CHAT_ID in the shell or scheduler environment.
//
// Security: this script never prints bot tokens, webhook secrets, alert chat ids,
// Supabase keys or user content.
import { randomInt } from "node:crypto";
import process from "node:process";
import {
  shouldFailMonitor,
  skippedSecretMonitorCheck,
  type MonitorCheck,
  type MonitorSeverity,
} from "./prod-monitor-policy";
import { hasSafeTelegramWebhookConcurrency } from "@/lib/telegram/webhook-delivery-policy";

const WEBHOOK_PATH = "/api/telegram/webhook";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_STALE_TELEGRAM_ERROR_MS = 15 * 60 * 1000;

type Severity = MonitorSeverity;

interface MonitorConfig {
  publicUrl: string;
  timeoutMs: number;
  label: string;
  maxPendingUpdates: number;
  staleTelegramErrorMs: number;
  requireSecretChecks: boolean;
  failOnWarn: boolean;
  alertOnWarn: boolean;
  alertChatId: string | null;
  alertBotToken: string | null;
  telegramDeliveryMode: "webhook" | "polling";
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function skippedSecretCheck(name: string, secretName: string, config: MonitorConfig): MonitorCheck {
  return skippedSecretMonitorCheck(name, secretName, config.requireSecretChecks);
}

function numberEnv(name: string, fallback: number): number {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

function boolEnv(name: string, fallback = false): boolean {
  const raw = env(name);
  if (!raw) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(raw.toLowerCase());
}

function parseConfig(): MonitorConfig {
  const args = process.argv.slice(2);
  const publicUrlRaw = args.find((arg) => !arg.startsWith("--")) ?? env("PUBLIC_APP_URL");
  if (!publicUrlRaw) {
    throw new Error("missing public URL. Pass it as the first argument or set PUBLIC_APP_URL");
  }

  let parsed: URL;
  try {
    parsed = new URL(publicUrlRaw);
  } catch {
    throw new Error(`invalid public URL: ${publicUrlRaw}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`public URL must use https, got ${parsed.protocol}`);
  }

  const alertChatId = env("MONITOR_ALERT_CHAT_ID");
  const deliveryMode = env("TELEGRAM_UPDATE_DELIVERY_MODE")?.toLowerCase() ?? "webhook";
  if (deliveryMode !== "webhook" && deliveryMode !== "polling") {
    throw new Error("TELEGRAM_UPDATE_DELIVERY_MODE must be webhook or polling");
  }
  return {
    publicUrl: `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`,
    timeoutMs: numberEnv("MONITOR_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    label: env("MONITOR_LABEL") ?? "production",
    maxPendingUpdates: numberEnv("MONITOR_MAX_PENDING_UPDATES", 0),
    staleTelegramErrorMs: numberEnv(
      "MONITOR_STALE_TELEGRAM_ERROR_MS",
      DEFAULT_STALE_TELEGRAM_ERROR_MS,
    ),
    requireSecretChecks: boolEnv("MONITOR_REQUIRE_SECRET_CHECKS"),
    failOnWarn: boolEnv("MONITOR_FAIL_ON_WARN"),
    alertOnWarn: boolEnv("MONITOR_ALERT_ON_WARN"),
    alertChatId,
    alertBotToken: alertChatId
      ? (env("MONITOR_ALERT_BOT_TOKEN") ?? env("TELEGRAM_BOT_TOKEN"))
      : null,
    telegramDeliveryMode: deliveryMode,
  };
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    timer = setTimeout(() => controller.abort(), timeoutMs);
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function result(name: string, severity: Severity, detail: string): MonitorCheck {
  return { name, severity, detail };
}

async function checkStatus(
  name: string,
  url: string,
  expectedStatus: number,
  timeoutMs: number,
): Promise<MonitorCheck> {
  try {
    const res = await fetchWithTimeout(url, {}, timeoutMs, name);
    return result(
      name,
      res.status === expectedStatus ? "ok" : "fail",
      `status=${res.status}, expected=${expectedStatus}`,
    );
  } catch (error) {
    return result(name, "fail", error instanceof Error ? error.message : "request failed");
  }
}

async function checkWebhookSecretFlow(config: MonitorConfig): Promise<MonitorCheck[]> {
  const webhookSecret = env("TELEGRAM_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return [skippedSecretCheck("webhook secret flow", "TELEGRAM_WEBHOOK_SECRET", config)];
  }

  const webhookUrl = `${config.publicUrl}${WEBHOOK_PATH}`;
  const baseUpdate = () => ({
    update_id: 1_782_000_000 + randomInt(1_000_000),
  });

  const missingSecret = await postWebhook(
    "webhook rejects missing secret",
    webhookUrl,
    baseUpdate(),
    {},
    401,
    config.timeoutMs,
  );
  const expectedAuthenticatedStatus = config.telegramDeliveryMode === "webhook" ? 200 : 503;
  const validSecret = await postWebhook(
    config.telegramDeliveryMode === "webhook"
      ? "webhook accepts valid secret"
      : "webhook disabled after valid secret",
    webhookUrl,
    baseUpdate(),
    { "X-Telegram-Bot-Api-Secret-Token": webhookSecret },
    expectedAuthenticatedStatus,
    config.timeoutMs,
  );
  return [missingSecret, validSecret];
}

async function postWebhook(
  name: string,
  url: string,
  payload: unknown,
  headers: Record<string, string>,
  expectedStatus: number,
  timeoutMs: number,
): Promise<MonitorCheck> {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(payload),
      },
      timeoutMs,
      name,
    );
    return result(
      name,
      res.status === expectedStatus ? "ok" : "fail",
      `status=${res.status}, expected=${expectedStatus}`,
    );
  } catch (error) {
    return result(name, "fail", error instanceof Error ? error.message : "request failed");
  }
}

async function checkTelegramBot(config: MonitorConfig): Promise<MonitorCheck[]> {
  const botToken = env("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    return [skippedSecretCheck("telegram bot api", "TELEGRAM_BOT_TOKEN", config)];
  }

  const checks: MonitorCheck[] = [];

  try {
    const getMe = await telegramApi(botToken, "getMe", {}, config.timeoutMs);
    checks.push(
      result(
        "telegram getMe",
        getMe.ok === true ? "ok" : "fail",
        getMe.ok === true ? "bot token works" : `telegram returned not-ok`,
      ),
    );
  } catch (error) {
    checks.push(result("telegram getMe", "fail", safeError(error)));
  }

  try {
    const data = await telegramApi(botToken, "getWebhookInfo", {}, config.timeoutMs);
    const webhook = data.result as
      | {
          url?: string;
          pending_update_count?: number;
          max_connections?: number;
          last_error_date?: number;
          last_error_message?: string;
        }
      | undefined;
    const expectedUrl =
      config.telegramDeliveryMode === "polling" ? "" : `${config.publicUrl}${WEBHOOK_PATH}`;
    const actualUrl = webhook?.url ?? "";
    const pending = webhook?.pending_update_count ?? -1;
    const maxConnections = webhook?.max_connections;
    const lastError = webhook?.last_error_message ?? "";
    const lastErrorDate = webhook?.last_error_date;
    const lastErrorAgeMs =
      typeof lastErrorDate === "number" ? Date.now() - lastErrorDate * 1000 : null;
    const recentError =
      Boolean(lastError) &&
      (lastErrorAgeMs === null || lastErrorAgeMs <= config.staleTelegramErrorMs);

    const urlOk = actualUrl === expectedUrl;
    const pendingOk = pending <= config.maxPendingUpdates;
    const concurrencyOk =
      config.telegramDeliveryMode === "polling"
        ? true
        : hasSafeTelegramWebhookConcurrency(maxConnections);
    const errorOk = config.telegramDeliveryMode === "polling" || !recentError;
    const severity: Severity = urlOk && pendingOk && concurrencyOk && errorOk ? "ok" : "fail";
    const lastErrorDetail = lastError
      ? `${recentError ? "recent" : "stale"} telegram error`
      : "none";
    checks.push(
      result(
        "telegram update delivery info",
        severity,
        `mode=${config.telegramDeliveryMode}, url_ok=${urlOk}, pending=${pending}, max=${config.maxPendingUpdates}, max_connections=${maxConnections ?? "missing"}, concurrency_ok=${concurrencyOk}, last_error=${lastErrorDetail}`,
      ),
    );
  } catch (error) {
    checks.push(result("telegram update delivery info", "fail", safeError(error)));
  }

  if (config.telegramDeliveryMode === "polling") {
    const webhookSecret = env("TELEGRAM_WEBHOOK_SECRET");
    if (!webhookSecret) {
      checks.push(skippedSecretCheck("telegram polling leader", "TELEGRAM_WEBHOOK_SECRET", config));
    } else {
      try {
        const response = await fetchWithTimeout(
          `${config.publicUrl}/api/telegram/polling-health`,
          { headers: { "X-Telegram-Bot-Api-Secret-Token": webhookSecret } },
          config.timeoutMs,
          "telegram polling leader",
        );
        checks.push(
          result(
            "telegram polling leader",
            response.status === 200 ? "ok" : "fail",
            `status=${response.status}, expected=200`,
          ),
        );
      } catch (error) {
        checks.push(result("telegram polling leader", "fail", safeError(error)));
      }
    }
  }

  return checks;
}

async function telegramApi(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ ok?: boolean; result?: unknown; description?: string }> {
  const res = await fetchWithTimeout(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: Object.keys(payload).length > 0 ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined,
    },
    timeoutMs,
    `telegram ${method}`,
  );
  if (!res.ok) throw new Error(`telegram ${method} status=${res.status}`);
  return (await res.json()) as { ok?: boolean; result?: unknown; description?: string };
}

async function checkAiProvider(config: MonitorConfig): Promise<MonitorCheck> {
  const apiKey = env("OPENAI_API_KEY");
  if (!apiKey) return result("ai provider", "warn", "skipped: OPENAI_API_KEY is not set");

  const baseUrl = (env("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = env("OPENAI_MODEL") ?? "gpt-4o-mini";
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "Reply with one short word." },
            { role: "user", content: "ping" },
          ],
        }),
      },
      config.timeoutMs,
      "ai provider",
    );
    if (!res.ok) {
      const severity: Severity = res.status === 429 || res.status >= 500 ? "warn" : "fail";
      return result("ai provider", severity, `model=${model}, status=${res.status}`);
    }
    return result("ai provider", "ok", `model=${model}, status=${res.status}`);
  } catch (error) {
    return result("ai provider", "warn", safeError(error));
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function printCheck(check: MonitorCheck): void {
  const mark = check.severity.toUpperCase();
  console.log(`${mark} ${check.name}: ${check.detail}`);
}

function shouldAlert(checks: MonitorCheck[], config: MonitorConfig): boolean {
  if (!config.alertChatId || !config.alertBotToken) return false;
  return checks.some(
    (check) => check.severity === "fail" || (config.alertOnWarn && check.severity === "warn"),
  );
}

function shouldFail(checks: MonitorCheck[], config: MonitorConfig): boolean {
  return shouldFailMonitor(checks, config.failOnWarn);
}

async function sendAlert(checks: MonitorCheck[], config: MonitorConfig): Promise<MonitorCheck> {
  if (!config.alertChatId || !config.alertBotToken) {
    return result("telegram alert", "warn", "skipped: MONITOR_ALERT_CHAT_ID is not set");
  }

  const failing = checks.filter(
    (check) => check.severity === "fail" || (config.alertOnWarn && check.severity === "warn"),
  );
  const lines = [
    `Ishonch Guard monitor: ${config.label}`,
    `Status: ${checks.some((check) => check.severity === "fail") ? "FAIL" : "WARN"}`,
    `Time: ${new Date().toISOString()}`,
    "",
    ...failing.slice(0, 8).map((check) => `- ${check.name}: ${check.detail}`),
    "",
    "Runbook:",
    `railway run npm run prod:smoke -- ${config.publicUrl}`,
    "railway logs",
  ];

  try {
    const data = await telegramApi(
      config.alertBotToken,
      "sendMessage",
      {
        chat_id: config.alertChatId,
        text: lines.join("\n").slice(0, 3500),
        disable_web_page_preview: true,
      },
      config.timeoutMs,
    );
    return result(
      "telegram alert",
      data.ok === true ? "ok" : "fail",
      data.ok === true ? "sent" : "telegram returned not-ok",
    );
  } catch (error) {
    return result("telegram alert", "fail", safeError(error));
  }
}

async function main(): Promise<void> {
  const config = parseConfig();
  console.log(`Production monitor target: ${config.publicUrl} (${config.label})`);
  console.log("Secret values are read from env and are not printed.");

  const checks: MonitorCheck[] = [];
  checks.push(await checkStatus("home", config.publicUrl, 200, config.timeoutMs));
  checks.push(await checkStatus("healthz", `${config.publicUrl}/healthz`, 200, config.timeoutMs));
  checks.push(...(await checkWebhookSecretFlow(config)));
  checks.push(...(await checkTelegramBot(config)));
  checks.push(await checkAiProvider(config));

  for (const check of checks) printCheck(check);

  if (shouldAlert(checks, config)) {
    const alertResult = await sendAlert(checks, config);
    printCheck(alertResult);
    checks.push(alertResult);
  }

  if (shouldFail(checks, config)) {
    process.exitCode = 1;
    return;
  }

  console.log("OK production monitor passed.");
}

main().catch((error) => {
  console.error(`FAIL production monitor crashed: ${safeError(error)}`);
  process.exitCode = 1;
});
