// Global test setup, loaded before each test file (see vitest.config.ts `setupFiles`).
//
// Server modules read secrets from environment variables inside their handlers
// (CODING_RULES §6). Tests must never use real secrets, so we seed deterministic
// fake values here. Individual tests can still override these with `vi.stubEnv`.
process.env.TELEGRAM_BOT_TOKEN ??= "test-telegram-bot-token";
process.env.TELEGRAM_WEBHOOK_SECRET ??= "test-telegram-webhook-secret";
process.env.HASH_PEPPER_SECRET ??= "test-pepper-secret-for-vitest-only";
process.env.OPENAI_API_KEY ??= "test-openai-api-key";
