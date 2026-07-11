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

  it("answers an 'is this made by AI?' question instead of running a new check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ explanation: "Похоже на меню, акцию или информационный QR." }),
      now,
    );

    const action = classifyLastCheckFollowUp(
      "Похоже, меню сделано с помощью искусственного интеллекта?",
      scenarioWith(snapshot),
      now,
    );
    expect(action).toBe("ai_origin");

    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    // Honest: never claims it IS AI; redirects to the real risk + a safe action.
    expect(text).toContain("может быть шаблонный или AI");
    expect(text).toContain("не доказывает мошенничество");
    expect(text).toContain("какой адрес откроется по QR");
    expect(text).toContain("SMS-код");
  });

  it("treats a short 'Это AI?' as an ai-origin follow-up", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);
    expect(classifyLastCheckFollowUp("Это AI?", scenarioWith(snapshot), now)).toBe("ai_origin");
    expect(
      classifyLastCheckFollowUp("Похоже, меню сделано с помощью ИИ?", scenarioWith(snapshot), now),
    ).toBe("ai_origin");
  });

  it("does not treat an ai-origin question carrying a new payload as a follow-up", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);
    expect(
      classifyLastCheckFollowUp("Это AI? https://promo.example.com", scenarioWith(snapshot), now),
    ).toBeNull();
  });

  it("answers an ai-origin question even without a recent check (orphan)", () => {
    expect(classifyOrphanCheckFollowUp("Это сделано нейросетью?")).toBe("ai_origin");
    expect(buildOrphanCheckFollowUpText("ai_origin", "ru")).toContain("не главное");
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

  it("routes explain-like-grandmother phrases to a simpler last-check answer", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code", "asks_to_scan_qr"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("Объясни как бабушке", scenarioWith(snapshot), now);

    expect(action).toBe("simple_explain");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("Объясню совсем просто");
    expect(text).toContain("ключ от ваших денег");
    expect(text).toContain("просят код из SMS");
    expect(text).toContain("Безопасный шаг сейчас");
    expect(text).not.toMatch(/score|threshold|порог|коэффициент|вес\s*(?:риска|=|:)/i);
  });

  it("supports simple explain phrases in RU, UZ and EN", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);
    const context = scenarioWith(snapshot);

    expect(classifyLastCheckFollowUp("простыми словами", context, now)).toBe("simple_explain");
    expect(classifyLastCheckFollowUp("oddiy qilib tushuntir", context, now)).toBe("simple_explain");
    expect(classifyLastCheckFollowUp("explain in simple words", context, now)).toBe(
      "simple_explain",
    );
  });

  it("answers real Russian high-risk confidence follow-ups with action-first guidance", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");

    expect(action).toBe("confidence");
    expect(text).toContain("Я бы действовал как при реальном риске");
    expect(text).toContain("Не сообщайте SMS-код");
    expect(text).toContain("эти шаги вам не навредят");
    expect(text).not.toContain("Не могу гарантировать на 100%");
  });

  it("does not expose weak topic-only evidence in unknown explanations", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const phone = buildLastCheckSnapshot(
      baseResult({ type: "phone", level: "unknown", reasons: ["valid_uz_phone"] }),
      now,
    );
    const profile = buildLastCheckSnapshot(
      baseResult({ type: "telegram", level: "unknown", reasons: ["unknown_sender"] }),
      now,
    );

    const phoneText = buildLastCheckFollowUpText("explain", phone, "ru");
    const profileText = buildLastCheckFollowUpText("explain", profile, "ru");

    expect(phoneText).toContain("сам номер не доказательство");
    expect(phoneText).not.toContain("Что я увидел");
    expect(phoneText).not.toContain("Корректный узбекский номер");
    expect(profileText).toContain("Telegram не показывает мне скрытую SCAM-метку");
    expect(profileText).not.toContain("Что я увидел");
    expect(profileText).not.toContain("Отправитель неизвестен");
  });

  it("keeps simple unknown phone explanations from treating a valid number as evidence", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const phone = buildLastCheckSnapshot(
      baseResult({ type: "phone", level: "unknown", reasons: ["valid_uz_phone"] }),
      now,
    );

    const text = buildLastCheckFollowUpText("simple_explain", phone, "ru");

    expect(text).toContain("Номер сам по себе не доказывает");
    expect(text).not.toContain("Корректный узбекский номер");
    expect(text).not.toContain("Что я заметил");
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

  it("answers orphan simple-explain requests without a fake insufficient-data card", () => {
    const action = classifyOrphanCheckFollowUp("объясни простыми словами");

    expect(action).toBe("simple_explain");
    const text = buildOrphanCheckFollowUpText(action!, "ru");
    expect(text).toContain("Совсем просто");
    expect(text).toContain("конкретную проверку");
    expect(text).not.toContain("Недостаточно данных");
  });

  it("does not classify orphan follow-ups when the text contains a new artifact", () => {
    expect(classifyOrphanCheckFollowUp("Точно? https://kapitalbank.uz.evil.com")).toBeNull();
    expect(classifyOrphanCheckFollowUp("дай номер банка +998 90 123 45 67")).toBeNull();
    expect(classifyOrphanCheckFollowUp("check it again https://evil.example/login")).toBeNull();
    expect(classifyOrphanCheckFollowUp("call someone I trust +998 90 123 45 67")).toBeNull();
    expect(classifyOrphanCheckFollowUp("I disagree, transfer money now")).toBeNull();
    expect(classifyOrphanCheckFollowUp("Почему example.com подозрительный?")).toBeNull();
    expect(classifyOrphanCheckFollowUp("Почему paypa1.uz подозрительный?")).toBeNull();
  });

  it("keeps a safety question about codes as a follow-up when no actual code is supplied", () => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code"] }),
      now,
    );

    expect(
      classifyLastCheckFollowUp("Почему нельзя отправлять код?", scenarioWith(snapshot), now),
    ).toBe("explain");
    expect(
      classifyLastCheckFollowUp("Почему нельзя отправлять код 7391?", scenarioWith(snapshot), now),
    ).toBeNull();
  });

  it.each([
    ["ru", "ты точно в этом уверен?", "confidence"],
    ["uz", "siz bunga aniq ishonasizmi?", "confidence"],
    ["en", "are you really sure about that?", "confidence"],
    [
      "ru",
      "Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?",
      "methodology",
    ],
    ["uz", "bu domenni qanday tekshirdingiz?", "methodology"],
    ["en", "how did you check this domain?", "methodology"],
    ["ru", "я могу связаться с близким?", "trusted_person"],
    ["uz", "yaqin odamim bilan bog'lansam bo'ladimi?", "trusted_person"],
    ["en", "can I call someone I trust?", "trusted_person"],
    ["ru", "перепроверь ещё раз", "recheck"],
    ["uz", "yana bir marta tekshir", "recheck"],
    ["en", "check it again", "recheck"],
    ["ru", "я не согласен, ты ошибся", "disagreement"],
    ["uz", "men rozi emasman, xato qildingiz", "disagreement"],
    ["en", "I disagree, you may be wrong", "disagreement"],
    ["ru", "Можно связаться с мамой?", "trusted_person"],
    ["ru", "Можно показать близкому?", "trusted_person"],
    ["en", "Can I show this to my mother?", "trusted_person"],
    ["uz", "yaqin odamim bilan boglansam bo'ladimi?", "trusted_person"],
    ["uz", "ishonchli odamga qongiroq qilsam bo'ladimi?", "trusted_person"],
    ["ru", "А можешь перепроверить?", "recheck"],
    ["ru", "Проверь ещё", "recheck"],
    ["en", "Can you double-check?", "recheck"],
    ["ru", "Какие источники ты использовал?", "methodology"],
  ] as const)("routes %s phrase '%s' to %s", (_lang, phrase, expected) => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["weird_domain"] }),
      now,
    );

    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBe(expected);
  });

  it("stores only bounded methodology enums in the last-check snapshot", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        level: "high_risk",
        reasons: ["weird_domain", "external_phishing_url", "known_reported"],
      }),
    );

    expect(snapshot.provenance).toEqual({
      methods: ["external_reputation", "local_reports", "url_structure"],
      sources: ["external_reputation", "moderated_reports", "visible_input"],
      limitations: ["external_scope", "report_scope", "format_only"],
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:|@|\+998|test/i);
  });

  it("answers methodology, trusted-person, recheck and disagreement honestly", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["weird_domain"] }),
    );

    const methodology = buildLastCheckFollowUpText("methodology", snapshot, "ru");
    const trusted = buildLastCheckFollowUpText("trusted_person", snapshot, "ru");
    const recheck = buildLastCheckFollowUpText("recheck", snapshot, "ru");
    const disagreement = buildLastCheckFollowUpText("disagreement", snapshot, "ru");

    expect(methodology).toMatch(/необычное доменное окончание|IP-адрес|ошибку формата/i);
    expect(methodology).toContain("не доказывают владельца");
    expect(trusted).toMatch(/свяжитесь с близким сами/i);
    expect(trusted).not.toContain("я отправил");
    expect(recheck).toContain("не храню исходную ссылку или текст");
    expect(recheck).toMatch(/пришлите заново/i);
    expect(disagreement).toMatch(/можете не соглашаться/i);
    expect(disagreement).toContain("независимо");
  });

  it("keeps official-directory and moderated-report sources in post-check provenance", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        type: "phone",
        reasons: ["valid_uz_phone"],
        knownReports: 3,
        verifiedContact: {
          orgName: "Example Bank",
          orgType: "bank",
          source: "https://example.test",
          display: "1000",
          contactType: "short_code",
          verificationLevel: "high",
          description: "Test fixture",
        },
        phoneReputation: {
          source: "ishonch_guard_moderated_reports",
          confirmedReportCount: 3,
          confidence: "medium",
          riskLevel: "suspicious",
          publicScope: "confirmed_moderated_reports_only",
        },
      }),
    );

    expect(snapshot.reasons).toEqual(["known_reported", "verified_official", "valid_uz_phone"]);
    expect(snapshot.provenance?.methods).toEqual([
      "local_reports",
      "official_directory",
      "phone_format",
    ]);
    expect(buildLastCheckFollowUpText("methodology", snapshot, "ru")).toMatch(
      /подтвержд|официальн/i,
    );
  });

  it("uses reason-bound high-risk actions instead of always sending users to a bank", () => {
    const apk = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_to_install_apk"] }),
    );
    const telegram = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["telegram_account_takeover_phishing"] }),
    );
    const wallet = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["wallet_action_urgency"] }),
    );

    expect(buildLastCheckFollowUpText("next_steps", apk, "ru")).toContain("APK");
    expect(buildLastCheckFollowUpText("next_steps", telegram, "ru")).toContain(
      "Telegram → Устройства",
    );
    expect(buildLastCheckFollowUpText("next_steps", wallet, "ru")).toContain("кошелёк");
    for (const snapshot of [apk, telegram, wallet]) {
      expect(buildLastCheckFollowUpText("next_steps", snapshot, "ru")).not.toContain(
        "Перезвоните в банк",
      );
    }
  });
});
