import process from "node:process";
import { getTelegramUpdateDeliveryMode } from "@/lib/config.server";
import { deleteWebhook } from "@/lib/telegram/api.server";
import { getTelegramUpdateLeaderStatus } from "@/lib/telegram/update-lifecycle.server";

async function main(): Promise<void> {
  if (getTelegramUpdateDeliveryMode() !== "polling") {
    throw new Error("TELEGRAM_UPDATE_DELIVERY_MODE must be polling before cutover");
  }

  const leader = await getTelegramUpdateLeaderStatus();
  if (!leader?.active) {
    throw new Error("No active Telegram polling leader; webhook was not changed");
  }

  const result = await deleteWebhook(false);
  if (!result.ok) throw new Error("Telegram deleteWebhook failed; pending updates were preserved");
  console.log("Telegram polling cutover complete; pending updates preserved");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Telegram polling cutover failed");
  process.exitCode = 1;
});
