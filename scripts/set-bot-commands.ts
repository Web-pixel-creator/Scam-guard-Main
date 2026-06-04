// One-shot admin script: register per-language bot command menus via setMyCommands.
//
// This script replaces the old single-locale approach with per-language BCP-47
// command registration. Each supported language (ru, uz, en) gets its own
// native-language descriptions, plus a default scope (no language_code) that
// uses English as the fallback for unsupported client locales.
//
// It is a server-only Node script — it reads the bot token from the environment
// via the same `config.server.ts` accessor the app uses. It is never imported
// by the client or the runtime.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=... npx vite-node scripts/set-bot-commands.ts
//
// Security: this script NEVER prints secret values (bot token). The token is
// only used to authenticate the setMyCommands API calls over HTTPS.
import process from "node:process";

import { getTelegramBotToken } from "@/lib/config.server";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommandPayload {
  commands: { command: string; description: string }[];
  /** BCP-47 language code. Omitted for the default (language-agnostic) scope. */
  language_code?: string;
}

// ─── Payload builder (exported for testing) ─────────────────────────────────

/**
 * Build the 4 setMyCommands payloads: one per language (ru, uz, en) plus one
 * default scope without `language_code`. Each payload contains localized
 * descriptions for the 6 registered commands.
 */
export function buildCommandPayloads(): CommandPayload[] {
  const ru: CommandPayload = {
    language_code: "ru",
    commands: [
      { command: "start", description: "Начать работу" },
      { command: "check", description: "Проверить номер или ссылку" },
      { command: "report", description: "Сообщить о случае" },
      { command: "panic", description: "Экстренная помощь" },
      { command: "safety", description: "Правила безопасности" },
      { command: "lang", description: "Сменить язык" },
    ],
  };

  const uz: CommandPayload = {
    language_code: "uz",
    commands: [
      { command: "start", description: "Boshlash" },
      { command: "check", description: "Raqam yoki havolani tekshirish" },
      { command: "report", description: "Hodisa haqida xabar berish" },
      { command: "panic", description: "Shoshilinch yordam" },
      { command: "safety", description: "Xavfsizlik qoidalari" },
      { command: "lang", description: "Tilni o'zgartirish" },
    ],
  };

  const en: CommandPayload = {
    language_code: "en",
    commands: [
      { command: "start", description: "Get started" },
      { command: "check", description: "Check a number or link" },
      { command: "report", description: "Report an incident" },
      { command: "panic", description: "Emergency help" },
      { command: "safety", description: "Safety rules" },
      { command: "lang", description: "Change language" },
    ],
  };

  // Default scope (no language_code) — English descriptions as fallback
  const defaultPayload: CommandPayload = {
    commands: [
      { command: "start", description: "Get started" },
      { command: "check", description: "Check a number or link" },
      { command: "report", description: "Report an incident" },
      { command: "panic", description: "Emergency help" },
      { command: "safety", description: "Safety rules" },
      { command: "lang", description: "Change language" },
    ],
  };

  return [ru, uz, en, defaultPayload];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Print an error and exit non-zero. Never echoes secret values. */
function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const botToken = getTelegramBotToken();
  if (!botToken) {
    fail("TELEGRAM_BOT_TOKEN is not set in the environment.");
  }

  const payloads = buildCommandPayloads();
  const baseUrl = `https://api.telegram.org/bot${botToken}/setMyCommands`;

  console.log("→ Registering bot commands for each language scope…");
  console.log("  (bot token read from env; value is not printed)");

  for (const payload of payloads) {
    const label = payload.language_code ?? "default";

    const body: Record<string, unknown> = { commands: payload.commands };
    if (payload.language_code) {
      body.language_code = payload.language_code;
    }

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { ok: boolean; description?: string };

    if (!data.ok) {
      fail(
        `setMyCommands failed for scope "${label}": ${data.description ?? "unknown error"}. ` +
          "Check that TELEGRAM_BOT_TOKEN is valid.",
      );
    }

    console.log(`  ✓ [${label}] ${payload.commands.length} commands registered`);
  }

  console.log("✓ All command scopes registered successfully.");
}

main().catch((err: unknown) => {
  fail(`unexpected error: ${err instanceof Error ? err.message : "unknown"}`);
});
