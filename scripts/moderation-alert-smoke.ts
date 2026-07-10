// Smoke test for the optional private moderation Telegram chat.
//
// Usage:
//   railway run npm run moderation:smoke
//
// Security: this script never prints bot tokens, chat ids, report text,
// screenshots, OCR, phone numbers, URLs, codes or card data.
import process from "node:process";

import {
  notifyHighSignalResearchModeration,
  notifyModeration,
} from "@/lib/telegram/moderation-notifier.server";

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!env("TELEGRAM_BOT_TOKEN")) {
    fail("TELEGRAM_BOT_TOKEN is not configured");
  }
  if (!env("TELEGRAM_MODERATION_CHAT_ID")) {
    fail("TELEGRAM_MODERATION_CHAT_ID is not configured");
  }

  const result = await notifyModeration({
    kind: "smoke",
    label: "manual operator chat check",
  });

  if (!result.ok) {
    fail("moderation alert was not sent; check bot membership and chat id");
  }

  if (process.argv.includes("--research")) {
    const research = await notifyHighSignalResearchModeration({ limit: 5 });
    if (!research.ok) {
      fail("research moderation alert was not sent; check bot membership and chat id");
    }
    console.log("OK research moderation alert smoke test sent");
  }

  console.log("OK moderation alert smoke test sent");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown error";
  fail(`moderation smoke failed: ${message}`);
});
