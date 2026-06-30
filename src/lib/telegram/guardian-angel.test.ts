import { describe, expect, it } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import {
  buildGuardianAngelIntro,
  buildGuardianAngelKeyboard,
  buildGuardianAngelSnapshot,
  buildGuardianAngelText,
  classifyGuardianAngelFollowUp,
  GUARDIAN_CB,
} from "@/lib/telegram/guardian-angel";
import type { ReportDraft } from "@/lib/telegram/session.server";

function highRiskResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "url",
    display: "https://masked.example",
    level: "high_risk",
    score: 80,
    reasons: ["asks_for_sms_code", "impersonates_bank"],
    explanation: "raw explanation that must not be stored",
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

describe("Guardian Angel v1", () => {
  it("stores only safe high-risk metadata, not raw evidence", () => {
    const snapshot = buildGuardianAngelSnapshot(
      highRiskResult({
        display: "+998 90 123 45 67",
        explanation: "send your card and SMS code",
      }),
      new Date("2026-06-16T10:00:00.000Z"),
    );

    expect(snapshot).toEqual({
      level: "high_risk",
      type: "url",
      reasons: ["asks_for_sms_code", "impersonates_bank"],
      at: "2026-06-16T10:00:00.000Z",
    });
    expect(JSON.stringify(snapshot)).not.toContain("+998");
    expect(JSON.stringify(snapshot)).not.toContain("send your card");
  });

  it("does not create a guidance snapshot for non-high-risk checks", () => {
    expect(
      buildGuardianAngelSnapshot(highRiskResult({ level: "suspicious", score: 30 })),
    ).toBeNull();
  });

  it("builds a one-step companion message and compact keyboard", () => {
    const snapshot = buildGuardianAngelSnapshot(highRiskResult())!;

    expect(buildGuardianAngelIntro(snapshot, "ru")).toContain("Я рядом");
    expect(buildGuardianAngelIntro(snapshot, "ru")).toContain("только один безопасный шаг");
    expect(buildGuardianAngelIntro(snapshot, "ru")).not.toContain("авто-подсказка");
    expect(buildGuardianAngelText(GUARDIAN_CB.next, snapshot, "ru")).toContain(
      "Следующий безопасный шаг",
    );

    const callbacks = buildGuardianAngelKeyboard("ru")
      .flat()
      .map((button) => button.callback_data);
    expect(callbacks).toEqual([
      "guardian:next",
      "guardian:done",
      "guardian:safe_call",
      "family:notify",
      "voiceout:guardian",
      "guardian:full_plan",
      "check_another",
    ]);
  });

  it("profiles the Guardian Angel keyboard by high-risk context", () => {
    const bankSnapshot = buildGuardianAngelSnapshot(
      highRiskResult({ reasons: ["asks_for_sms_code", "impersonates_bank"] }),
    )!;
    const cryptoSnapshot = buildGuardianAngelSnapshot(
      highRiskResult({
        type: "telegram",
        reasons: ["gambling_prediction_promo", "crypto_casino_bonus_funnel"],
      }),
    )!;
    const qrSnapshot = buildGuardianAngelSnapshot(
      highRiskResult({ reasons: ["asks_to_scan_qr", "fake_captcha_or_voting"] }),
    )!;

    expect(
      buildGuardianAngelKeyboard("ru", bankSnapshot)
        .flat()
        .map((button) => button.callback_data),
    ).toContain("guardian:safe_call");

    const cryptoCallbacks = buildGuardianAngelKeyboard("ru", cryptoSnapshot)
      .flat()
      .map((button) => button.callback_data);
    expect(cryptoCallbacks).not.toContain("guardian:safe_call");
    expect(cryptoCallbacks).toContain("family:notify");
    expect(cryptoCallbacks).toContain("guardian:full_plan");

    const qrCallbacks = buildGuardianAngelKeyboard("ru", qrSnapshot)
      .flat()
      .map((button) => button.callback_data);
    expect(qrCallbacks).not.toContain("guardian:safe_call");
    expect(qrCallbacks).toContain("guardian:full_plan");
  });

  it("routes human follow-ups to the active guardian context", () => {
    const guardian = buildGuardianAngelSnapshot(highRiskResult(), new Date("2026-06-16T10:00Z"))!;
    const scenarioData: ReportDraft = { guardian };
    const now = new Date("2026-06-16T10:05Z");

    expect(classifyGuardianAngelFollowUp("что дальше?", scenarioData, now)).toBe(GUARDIAN_CB.next);
    expect(classifyGuardianAngelFollowUp("готово, я позвонил", scenarioData, now)).toBe(
      GUARDIAN_CB.done,
    );
    expect(classifyGuardianAngelFollowUp("дай номер банка", scenarioData, now)).toBe(
      GUARDIAN_CB.safeCall,
    );
    expect(classifyGuardianAngelFollowUp("весь чеклист", scenarioData, now)).toBe(
      GUARDIAN_CB.fullPlan,
    );
  });

  it("does not hijack a new artifact as a guardian follow-up", () => {
    const guardian = buildGuardianAngelSnapshot(highRiskResult())!;
    expect(
      classifyGuardianAngelFollowUp("что дальше с https://example.com", { guardian }),
    ).toBeNull();
  });
});
