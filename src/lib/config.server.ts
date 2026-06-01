import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}

// --- Telegram bot secrets (server-only) ---
//
// Read per-request inside handlers (CODING_RULES §6). On Cloudflare the env
// binds at request time, so module-scope reads resolve to undefined. Each
// accessor returns `string | undefined` so callers can fail closed (e.g. the
// webhook returns 401 when a secret is missing — R17.4) instead of crashing.
// LOVABLE_API_KEY and the Supabase secrets already exist elsewhere and are not
// duplicated here.

/**
 * Telegram Bot API token, used to authenticate calls to the Bot API.
 * Returns undefined when not configured. (R17.1, R17.2)
 */
export function getTelegramBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

/**
 * Secret compared against the `X-Telegram-Bot-Api-Secret-Token` header to
 * authenticate incoming webhook requests. Returns undefined when not
 * configured so the webhook can reject the request. (R17.1, R17.4)
 */
export function getTelegramWebhookSecret(): string | undefined {
  return process.env.TELEGRAM_WEBHOOK_SECRET;
}
