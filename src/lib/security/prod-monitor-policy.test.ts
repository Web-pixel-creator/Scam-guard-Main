import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { shouldFailMonitor, skippedSecretMonitorCheck } from "../../../scripts/prod-monitor-policy";
import {
  hasSafeTelegramWebhookConcurrency,
  TELEGRAM_WEBHOOK_MAX_CONNECTIONS,
} from "@/lib/telegram/webhook-delivery-policy";

describe("production monitor required-check policy", () => {
  it("makes a required skipped secret check fail the run even when warnings are non-fatal", () => {
    const skipped = skippedSecretMonitorCheck("telegram bot api", "TELEGRAM_BOT_TOKEN", true);

    expect(skipped.severity).toBe("fail");
    expect(shouldFailMonitor([skipped], false)).toBe(true);
  });

  it("keeps optional local secret checks as non-fatal warnings", () => {
    const skipped = skippedSecretMonitorCheck("telegram bot api", "TELEGRAM_BOT_TOKEN", false);

    expect(skipped.severity).toBe("warn");
    expect(shouldFailMonitor([skipped], false)).toBe(false);
  });

  it("commits fail-hard secret checks in the scheduled workflow", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/prod-monitor.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toMatch(/^\s+MONITOR_REQUIRE_SECRET_CHECKS:\s*["']?true["']?\s*$/mu);
    expect(workflow).toContain("TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}");
    expect(workflow).toContain("TELEGRAM_WEBHOOK_SECRET: ${{ secrets.TELEGRAM_WEBHOOK_SECRET }}");
  });

  it("rejects Telegram webhook concurrency drift above one connection", () => {
    expect(TELEGRAM_WEBHOOK_MAX_CONNECTIONS).toBe(1);
    expect(hasSafeTelegramWebhookConcurrency(1)).toBe(true);
    expect(hasSafeTelegramWebhookConcurrency(40)).toBe(false);
    expect(hasSafeTelegramWebhookConcurrency(undefined)).toBe(false);
  });
});
