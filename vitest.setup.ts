// Global test setup, loaded before each test file (see vitest.config.ts `setupFiles`).
//
// Server modules read secrets from environment variables inside their handlers
// (CODING_RULES §6). Tests must never use real secrets, so we seed deterministic
// fake values here. Individual tests can still override these with `vi.stubEnv`.
process.env.TELEGRAM_BOT_TOKEN = "test-telegram-bot-token";
process.env.TELEGRAM_WEBHOOK_SECRET = "test-telegram-webhook-secret";
process.env.HASH_PEPPER_SECRET = "test-pepper-secret-for-vitest-only";
process.env.OPENAI_API_KEY = "test-openai-api-key";

// Tests must opt in to every network-shaped interaction by replacing fetch
// with an explicit mock. This prevents a developer's real local API key from
// ever being used by an accidentally unmocked provider/reputation/Telegram
// path. Keep the error free of the requested URL because it may contain a bot
// token or another secret.
globalThis.fetch = (async () => {
  throw new Error(
    "Unexpected network request in Vitest. Mock globalThis.fetch explicitly for this test.",
  );
}) as typeof fetch;
