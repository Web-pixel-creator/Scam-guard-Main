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

  it("commits a fail-hard, cost-safe scheduled baseline", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/prod-monitor.yml", import.meta.url),
      "utf8",
    );

    expect(workflow).toMatch(/^\s+MONITOR_REQUIRE_SECRET_CHECKS:\s*["']?true["']?\s*$/mu);
    expect(workflow).toMatch(/^\s+TELEGRAM_UPDATE_DELIVERY_MODE:\s*["']?polling["']?\s*$/mu);
    expect(workflow).toMatch(/^\s+MONITOR_CHECK_AI:\s*["']?false["']?\s*$/mu);
    expect(workflow).toMatch(/^\s+MONITOR_FAIL_ON_WARN:\s*["']?true["']?\s*$/mu);
    expect(workflow).toMatch(/^\s+MONITOR_ALERT_ON_WARN:\s*["']?true["']?\s*$/mu);
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
    const aiJobIndex = workflow.indexOf("\n  ai-provider-monitor:");
    const aiMonitorIndex = workflow.indexOf("\n      - name: Run opt-in AI provider check");

    expect(stepsIndex).toBeGreaterThan(0);
    expect(monitorIndex).toBeGreaterThan(stepsIndex);
    expect(aiJobIndex).toBeGreaterThan(monitorIndex);
    expect(aiMonitorIndex).toBeGreaterThan(aiJobIndex);
    expect(workflow.slice(0, stepsIndex)).not.toContain("${{ secrets.");

    const requiredSecrets = [
      "MONITOR_ALERT_CHAT_ID",
      "MONITOR_ALERT_BOT_TOKEN",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
    ];
    const monitorStep = workflow.slice(monitorIndex, aiJobIndex);
    for (const key of requiredSecrets) {
      const expression = `${key}: \${{ secrets.${key} }}`;
      expect(monitorStep).toContain(expression);
    }
    expect(monitorStep).not.toContain("OPENAI_");

    const aiJobPrelude = workflow.slice(aiJobIndex, aiMonitorIndex);
    expect(aiJobPrelude).toContain(
      "if: ${{ github.event_name == 'workflow_dispatch' && inputs.check_ai_provider == true }}",
    );
    expect(aiJobPrelude).not.toContain("${{ secrets.");
    expect(aiJobPrelude).toMatch(/^\s+MONITOR_LABEL:\s*github-manual-ai-provider\s*$/mu);
    expect(aiJobPrelude).toMatch(/^\s+MONITOR_CHECK_AI:\s*["']?true["']?\s*$/mu);

    const aiMonitorStep = workflow.slice(aiMonitorIndex);
    expect(aiMonitorStep).toContain("OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}");
    expect(aiMonitorStep).toContain("OPENAI_BASE_URL: ${{ secrets.OPENAI_BASE_URL }}");
    expect(aiMonitorStep).toContain("OPENAI_MODEL: ${{ secrets.OPENAI_MODEL }}");
    expect(aiMonitorStep).not.toContain("TELEGRAM_");
    expect(aiMonitorStep).not.toContain("MONITOR_ALERT_");
    expect(aiMonitorStep).toContain("--ai-only");

    expect(workflow).toMatch(/^\s+check_ai_provider:\s*$/mu);
    expect(workflow).toMatch(/^\s+default:\s*false\s*$/mu);
    expect(workflow).toMatch(/^\s+type:\s*boolean\s*$/mu);
    expect(workflow).toContain(
      "group: prod-monitor-${{ github.event_name == 'schedule' && 'scheduled' || github.run_id }}",
    );
    expect(workflow).toContain("cancel-in-progress: ${{ github.event_name == 'schedule' }}");

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

  it("keeps the general production smoke AI check explicitly opt-in", () => {
    const smoke = readFileSync(new URL("../../../scripts/prod-smoke.ts", import.meta.url), "utf8");

    expect(smoke).toContain('const checkAiProvider = args.includes("--check-ai")');
    expect(smoke).toContain("enabled,");
    expect(smoke).toContain('apiKey: getOptionalEnv("OPENAI_API_KEY")');
    expect(smoke).not.toContain("const degraded =");
  });

  it("removes AI and TTS provider access before the polling-dispatch QA handlers run", () => {
    const smoke = readFileSync(
      new URL("../../../scripts/prod-telegram-polling-dispatch-smoke.ts", import.meta.url),
      "utf8",
    );
    const disableIndex = smoke.indexOf("\n  disableProviderAccessForPollingQa();");
    const installIndex = smoke.indexOf("\n  installTelegramHandlers();");

    expect(disableIndex).toBeGreaterThan(0);
    expect(installIndex).toBeGreaterThan(disableIndex);
    expect(smoke).toContain("delete process.env[name]");
    for (const name of [
      "OPENAI_API_KEY",
      "OPENAI_FALLBACK_API_KEY",
      "OPENAI_TTS_API_KEY",
      "GEMINI_TTS_API_KEY",
      "GOOGLE_TTS_API_KEY",
    ]) {
      expect(smoke).toContain(`"${name}"`);
    }
  });

  it("rejects Telegram webhook concurrency drift above one connection", () => {
    expect(TELEGRAM_WEBHOOK_MAX_CONNECTIONS).toBe(1);
    expect(hasSafeTelegramWebhookConcurrency(1)).toBe(true);
    expect(hasSafeTelegramWebhookConcurrency(40)).toBe(false);
    expect(hasSafeTelegramWebhookConcurrency(undefined)).toBe(false);
  });
});
