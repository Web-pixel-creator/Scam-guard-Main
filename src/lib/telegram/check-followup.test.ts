import { describe, expect, it } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import {
  buildImageUnreadableSnapshot,
  buildLastCheckFollowUpText,
  buildLastCheckSnapshot,
  buildOrphanCheckFollowUpText,
  classifyOrphanCheckFollowUp,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import type { LastCheckSnapshot, ReportDraft } from "@/lib/telegram/session.server";

function baseResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "text",
    display: "test",
    level: "safe",
    score: 0,
    reasons: [],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

function scenarioWith(snapshot: LastCheckSnapshot, extra: Partial<ReportDraft> = {}): ReportDraft {
  return { ...extra, lastCheck: snapshot };
}

describe("last check follow-up router", () => {
  it("answers a short confidence question after a recent QR/menu check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        explanation: "Похоже на меню, акцию или информационный QR.",
      }),
      now,
    );

    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);

    expect(action).toBe("confidence");
    expect(buildLastCheckFollowUpText(action!, snapshot, "ru")).toContain(
      "Не могу гарантировать на 100%",
    );
    expect(buildLastCheckFollowUpText(action!, snapshot, "ru")).toContain("информационный QR");
  });

  it("routes a short next-step question to contextual guidance", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        level: "high_risk",
        reasons: ["asks_for_sms_code", "asks_to_scan_qr"],
      }),
      now,
    );

    const action = classifyLastCheckFollowUp("Что мне делать дальше?", scenarioWith(snapshot), now);

    expect(action).toBe("next_steps");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("Следующий безопасный шаг");
    expect(text).toContain("Не сообщайте SMS-код");
  });

  it("routes bank-number requests to official contact guidance after a phone check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ type: "phone", display: "+998 ** *** ** **", reasons: ["valid_uz_phone"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("дай номер банка", scenarioWith(snapshot), now);

    expect(action).toBe("contacts");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("Официальный обратный звонок");
    expect(text).toContain("1340");
    expect(text).not.toContain("+998 **");
  });

  it("routes short explanation questions without exposing scores", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["brand_impersonation"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("Почему так?", scenarioWith(snapshot), now);

    expect(action).toBe("explain");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("видимые признаки риска");
    expect(text).not.toMatch(/score|threshold|порог|коэффициент|вес\s*(?:риска|=|:)/i);
  });

  it("does not intercept real scam payloads that need a fresh check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);

    expect(
      classifyLastCheckFollowUp(
        "точно https://evil.example/login оплатить картой",
        scenarioWith(snapshot),
        now,
      ),
    ).toBeNull();
    expect(
      classifyLastCheckFollowUp("дай номер банка +998 90 123 45 67", scenarioWith(snapshot), now),
    ).toBeNull();
  });

  it("ignores stale last-check context", () => {
    const now = new Date("2026-06-06T05:30:01.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), new Date("2026-06-06T05:00:00.000Z"));

    expect(classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now)).toBeNull();
  });

  it("lets a newer emergency context win over an older check", () => {
    const now = new Date("2026-06-06T05:10:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), new Date("2026-06-06T05:00:00.000Z"));

    expect(
      classifyLastCheckFollowUp(
        "Точно?",
        scenarioWith(snapshot, {
          lastPanicId: 6,
          lastPanicAt: "2026-06-06T05:09:00.000Z",
        }),
        now,
      ),
    ).toBeNull();
  });

  it("classifies phone checks without storing the phone number", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({ type: "phone", display: "+998 ** *** ** **", reasons: ["valid_uz_phone"] }),
      new Date("2026-06-06T05:00:00.000Z"),
    );

    expect(snapshot.context).toBe("phone");
    expect(JSON.stringify(snapshot)).not.toContain("+998");
  });

  it("answers confidence questions after Telegram profile checks with profile-specific limits", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ type: "telegram" }), now);

    expect(snapshot.context).toBe("telegram_profile");
    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);
    expect(action).toBe("confidence");
    expect(buildLastCheckFollowUpText(action!, snapshot, "ru")).toContain(
      "по Telegram-профилю или каналу",
    );
  });

  it("answers confidence questions after an unreadable image without inventing risk", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildImageUnreadableSnapshot(now);

    const action = classifyLastCheckFollowUp("Sure?", scenarioWith(snapshot), now);

    expect(action).toBe("confidence");
    const text = buildLastCheckFollowUpText(action!, snapshot, "en");
    expect(text).toContain("cannot be sure from that image");
    expect(text).toContain("will not invent a risk");
  });

  it("answers next-step questions after an unreadable image with concrete capture guidance", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildImageUnreadableSnapshot(now);

    const action = classifyLastCheckFollowUp("what next?", scenarioWith(snapshot), now);

    expect(action).toBe("next_steps");
    const text = buildLastCheckFollowUpText(action!, snapshot, "en");
    expect(text).toContain("link it opens");
    expect(text).toContain("closer screenshot");
    expect(JSON.stringify(snapshot)).not.toContain("data:image");
  });

  it("answers orphan confidence follow-ups without running a fake risk check", () => {
    const action = classifyOrphanCheckFollowUp("Точно?");

    expect(action).toBe("confidence");
    const text = buildOrphanCheckFollowUpText(action!, "ru");
    expect(text).toContain("не вижу, к какой именно проверке");
    expect(text).toContain("сам QR не опасен");
    expect(text).not.toContain("Недостаточно данных");
  });

  it("answers orphan bank-contact requests with official callback guidance", () => {
    const action = classifyOrphanCheckFollowUp("дай номер банка");

    expect(action).toBe("contacts");
    const text = buildOrphanCheckFollowUpText(action!, "ru");
    expect(text).toContain("Официальный обратный звонок");
    expect(text).toContain("1340");
  });

  it("does not classify orphan follow-ups when the text contains a new artifact", () => {
    expect(classifyOrphanCheckFollowUp("Точно? https://kapitalbank.uz.evil.com")).toBeNull();
    expect(classifyOrphanCheckFollowUp("дай номер банка +998 90 123 45 67")).toBeNull();
  });
});
