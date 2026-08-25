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

  it.each([
    {
      lang: "ru",
      expected: /не переводите.*проверьте получателя/isu,
      forbidden: /замороз|оспор|уже перев|чек|время операции/iu,
    },
    {
      lang: "uz",
      expected: /pul o'tkazmang.*oluvchi/isu,
      forbidden: /muzlat|qaytar|o'tkazgan|chek|operatsiya vaqti/iu,
    },
    {
      lang: "en",
      expected: /do not transfer.*verify the recipient/isu,
      forbidden: /freeze|dispute|already (?:sent|transferred)|receipt|transaction time/iu,
    },
  ] as const)(
    "keeps a generic requested transfer at the prevention stage in $lang",
    ({ lang, expected, forbidden }) => {
      const snapshot = buildGuardianAngelSnapshot(
        highRiskResult({ type: "payment", reasons: ["asks_for_money_transfer"] }),
      )!;
      const messages = [
        buildGuardianAngelIntro(snapshot, lang),
        buildGuardianAngelText(GUARDIAN_CB.next, snapshot, lang),
        buildGuardianAngelText(GUARDIAN_CB.fullPlan, snapshot, lang),
      ];

      expect(messages.join("\n")).toMatch(expected);
      for (const message of messages) {
        expect(message).not.toMatch(forbidden);
      }
    },
  );

  it.each([
    ["ru", /безопасн.{0,30}102/isu, /банк|замороз|перевод/iu],
    ["uz", /xavfsiz.{0,30}102/isu, /bank|muzlat|o'tkazma/iu],
    ["en", /safe.{0,30}102/isu, /bank|freeze|transfer/iu],
  ] as const)(
    "prioritizes urgent physical safety for authority coercion in %s",
    (lang, expected, forbidden) => {
      const snapshot = buildGuardianAngelSnapshot(
        highRiskResult({ reasons: ["authority_coerced_dangerous_act"] }),
      )!;
      const text = [
        buildGuardianAngelIntro(snapshot, lang),
        buildGuardianAngelText(GUARDIAN_CB.next, snapshot, lang),
        buildGuardianAngelText(GUARDIAN_CB.fullPlan, snapshot, lang),
      ].join("\n");

      expect(text).toMatch(expected);
      expect(text).toMatch(/поджиг|yoqmang|burn/iu);
      expect(text).not.toMatch(forbidden);
      expect(JSON.stringify(buildGuardianAngelKeyboard(lang, snapshot))).not.toContain(
        GUARDIAN_CB.safeCall,
      );
    },
  );

  it.each([
    ["ru", /не отвечайте.*безопасн.*102/isu],
    ["uz", /javob bermang.*xavfsiz.*102/isu],
    ["en", /do not reply.*safe.*102/isu],
  ] as const)(
    "prioritizes urgent physical safety for a violence threat in %s",
    (lang, expected) => {
      const snapshot = buildGuardianAngelSnapshot(
        highRiskResult({ reasons: ["threatens_physical_violence"] }),
      )!;
      const text = [
        buildGuardianAngelIntro(snapshot, lang),
        buildGuardianAngelText(GUARDIAN_CB.next, snapshot, lang),
        buildGuardianAngelText(GUARDIAN_CB.fullPlan, snapshot, lang),
      ].join("\n");

      expect(text).toMatch(expected);
      expect(text).not.toMatch(/банк|bank|замороз|freeze|перевод|transfer/iu);
      expect(JSON.stringify(buildGuardianAngelKeyboard(lang, snapshot))).not.toContain(
        GUARDIAN_CB.safeCall,
      );
    },
  );

  it("retains a late physical-safety reason in the bounded snapshot", () => {
    const snapshot = buildGuardianAngelSnapshot(
      highRiskResult({
        reasons: [
          "asks_for_sms_code",
          "impersonates_bank",
          "uses_urgency",
          "unknown_sender",
          "suspicious_short_link",
          "threatens_physical_violence",
        ],
      }),
    )!;

    expect(snapshot.reasons).toHaveLength(5);
    expect(snapshot.reasons[0]).toBe("threatens_physical_violence");
    expect(buildGuardianAngelIntro(snapshot, "ru")).toMatch(/безопасн.*102/isu);
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

  it("does not treat new natural-language messages as safe-call follow-ups", () => {
    const guardian = buildGuardianAngelSnapshot(highRiskResult(), new Date("2026-06-16T10:00Z"))!;
    const scenarioData: ReportDraft = { guardian };
    const now = new Date("2026-06-16T10:05Z");

    const safeAccountText =
      "\u0421\u043b\u0443\u0436\u0431\u0430 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438 \u0431\u0430\u043d\u043a\u0430: \u0441\u0440\u043e\u0447\u043d\u043e \u043f\u0435\u0440\u0435\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u0435\u043d\u044c\u0433\u0438 \u043d\u0430 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0441\u0447\u0435\u0442";
    const deliveryText =
      "\u0412\u0430\u0448 \u0437\u0430\u043a\u0430\u0437 \u0434\u043e\u0441\u0442\u0430\u0432\u044f\u0442 \u0437\u0430\u0432\u0442\u0440\u0430 \u043f\u043e\u0441\u043b\u0435 \u043e\u0431\u0435\u0434\u0430, \u043a\u0443\u0440\u044c\u0435\u0440 \u043f\u043e\u0437\u0432\u043e\u043d\u0438\u0442 \u0437\u0430\u0440\u0430\u043d\u0435\u0435";

    expect(classifyGuardianAngelFollowUp(safeAccountText, scenarioData, now)).toBeNull();
    expect(classifyGuardianAngelFollowUp(deliveryText, scenarioData, now)).toBeNull();
    expect(
      classifyGuardianAngelFollowUp(
        "\u043a\u0443\u0434\u0430 \u0437\u0432\u043e\u043d\u0438\u0442\u044c \u0432 \u0431\u0430\u043d\u043a?",
        scenarioData,
        now,
      ),
    ).toBe(GUARDIAN_CB.safeCall);
  });

  it("does not hijack a new artifact as a guardian follow-up", () => {
    const guardian = buildGuardianAngelSnapshot(highRiskResult())!;
    expect(
      classifyGuardianAngelFollowUp("что дальше с https://example.com", { guardian }),
    ).toBeNull();
  });
});
