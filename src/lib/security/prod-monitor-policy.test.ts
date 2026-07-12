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
    expect(workflow).toMatch(/^\s+TELEGRAM_UPDATE_DELIVERY_MODE:\s*["']?polling["']?\s*$/mu);
    expect(workflow).toContain("TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}");
    expect(workflow).toContain("TELEGRAM_WEBHOOK_SECRET: ${{ secrets.TELEGRAM_WEBHOOK_SECRET }}");
  });

  it("scopes production secrets to an immutable final consumer step", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/prod-monitor.yml", import.meta.url),
      "utf8",
    );
    const stepsIndex = workflow.indexOf("\n    steps:");
    const monitorIndex = workflow.indexOf("\n      - name: Run monitor");

    expect(stepsIndex).toBeGreaterThan(0);
    expect(monitorIndex).toBeGreaterThan(stepsIndex);
    expect(workflow.slice(0, stepsIndex)).not.toContain("${{ secrets.");

    const requiredSecrets = [
      "MONITOR_ALERT_CHAT_ID",
      "MONITOR_ALERT_BOT_TOKEN",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "OPENAI_API_KEY",
      "OPENAI_BASE_URL",
      "OPENAI_MODEL",
    ];
    const monitorStep = workflow.slice(monitorIndex);
    for (const key of requiredSecrets) {
      const expression = `${key}: \${{ secrets.${key} }}`;
      expect(monitorStep).toContain(expression);
      expect(workflow.split(expression)).toHaveLength(2);
    }

    const preConsumerActions = [
      ...workflow.slice(stepsIndex, monitorIndex).matchAll(/^\s+uses:\s+[^@\s]+@([^\s#]+)/gmu),
    ];
    expect(preConsumerActions).toHaveLength(2);
    for (const action of preConsumerActions) {
      expect(action[1]).toMatch(/^[0-9a-f]{40}$/);
    }

    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toMatch(/^\s+bun-version:\s*["']1\.3\.14["']\s*$/mu);
    expect(workflow).not.toMatch(/^\s+bun-version:\s*["']?latest["']?\s*$/mu);
    expect(monitorStep.match(/^\s+- name:/gmu)).toHaveLength(1);
  });

  it("rejects Telegram webhook concurrency drift above one connection", () => {
    expect(TELEGRAM_WEBHOOK_MAX_CONNECTIONS).toBe(1);
    expect(hasSafeTelegramWebhookConcurrency(1)).toBe(true);
    expect(hasSafeTelegramWebhookConcurrency(40)).toBe(false);
    expect(hasSafeTelegramWebhookConcurrency(undefined)).toBe(false);
  });
});
