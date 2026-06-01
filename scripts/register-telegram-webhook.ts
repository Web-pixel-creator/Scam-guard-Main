// One-shot admin script: register the Telegram webhook with the Bot API.
//
// This is NOT part of the runtime. Run it manually once per deployment (or
// whenever the public URL / secret changes) to point Telegram at our webhook
// endpoint and install the secret token that every incoming update must carry.
//
// It is a server-only Node script — it reads secrets from the environment via
// the same `config.server.ts` accessors the app uses, and calls the existing
// `setWebhook` helper from `api.server.ts`. It is never imported by the client.
//
// Usage (see ai_docs/DEPLOYMENT.md for the full deploy flow):
//   PUBLIC_APP_URL=https://your-app.example.com \
//   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
//   npx vite-node scripts/register-telegram-webhook.ts
//
// or pass the base URL as the first CLI argument:
//   npx vite-node scripts/register-telegram-webhook.ts https://your-app.example.com
//
// Telegram then calls `<base>/api/telegram/webhook` and includes the secret in
// the `X-Telegram-Bot-Api-Secret-Token` header, which the webhook verifies
// FIRST and fails closed on (see src/lib/telegram/webhook.server.ts, R12/R17).
//
// Security: this script NEVER prints secret values (bot token / webhook
// secret). `setWebhook` does send the secret to Telegram over HTTPS — that is
// by design (Telegram echoes it back in the header) and is the only place the
// secret leaves our environment.
import process from "node:process";

import { getTelegramBotToken, getTelegramWebhookSecret } from "@/lib/config.server";
import { setWebhook } from "@/lib/telegram/api.server";

/** Fixed public path the Worker entry (src/server.ts) intercepts. */
const WEBHOOK_PATH = "/api/telegram/webhook";

/** Print an error and exit non-zero. Never echoes secret values. */
function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/**
 * Resolve the public base URL from argv[2] or PUBLIC_APP_URL, validate it is a
 * well-formed https URL, and build the full webhook endpoint URL.
 */
function resolveWebhookUrl(): string {
  const raw = process.argv[2] ?? process.env.PUBLIC_APP_URL;
  if (!raw) {
    fail(
      "missing public app URL. Pass it as the first argument or set PUBLIC_APP_URL, e.g.\n" +
        "  npx vite-node scripts/register-telegram-webhook.ts https://your-app.example.com",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid public app URL: "${raw}"`);
  }

  if (parsed.protocol !== "https:") {
    fail(`public app URL must use https (Telegram requires TLS), got: "${parsed.protocol}"`);
  }

  // Strip any trailing slash from the base path before appending the endpoint.
  const base = `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  return `${base}${WEBHOOK_PATH}`;
}

async function main(): Promise<void> {
  // Fail closed when secrets are not configured. Do NOT print their values.
  const botToken = getTelegramBotToken();
  if (!botToken) {
    fail("TELEGRAM_BOT_TOKEN is not set in the environment.");
  }

  const secret = getTelegramWebhookSecret();
  if (!secret) {
    fail("TELEGRAM_WEBHOOK_SECRET is not set in the environment.");
  }

  const webhookUrl = resolveWebhookUrl();
  console.log(`→ Registering Telegram webhook: ${webhookUrl}`);
  console.log("  (bot token and webhook secret read from env; values are not printed)");

  const { ok } = await setWebhook(webhookUrl, secret);
  if (!ok) {
    fail(
      "Telegram setWebhook returned not-ok. Check that TELEGRAM_BOT_TOKEN is valid and the " +
        "URL is publicly reachable over https. (No secret values are logged.)",
    );
  }

  console.log("✓ Webhook registered successfully.");
  console.log("  Telegram will now POST updates with the X-Telegram-Bot-Api-Secret-Token header.");
}

main().catch((err: unknown) => {
  fail(`unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
});
