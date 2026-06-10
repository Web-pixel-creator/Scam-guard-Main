import { describe, expect, it } from "vitest";
import { evaluateText, scoreFromCodes } from "./rules";
import {
  buildImageCheckInput,
  buildImageUserExplanation,
  fallbackImageIntelligence,
  hasUsableImageEvidence,
  sanitizeImageIntelligence,
  type ImageIntelligenceResult,
} from "./image-intelligence";

function scoreImageEvidence(evidence: ImageIntelligenceResult) {
  const input = buildImageCheckInput(evidence);
  const reasons = evaluateText(input);
  return { input, reasons, score: scoreFromCodes(reasons) };
}

describe("image intelligence evidence builder", () => {
  it("does not turn a restaurant QR/menu poster into a QR-login high risk", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Уважаемые гости! Посетите сайт chenson.uz. Узнайте больше о меню, акциях и онлайн-бронировании столов. Зарегистрируйтесь в Telegram-боте, отсканировав QR-код ниже.",
      visualCategory: "restaurant_menu_qr",
      confidence: "high",
      qr: { present: true, visibleUrl: "https://chenson.uz/loyalty", purpose: "menu" },
      riskHints: [],
      summary: "Похоже на ресторанное меню и QR программы лояльности.",
    });

    expect(evidence).not.toBeNull();
    const { input, reasons, score } = scoreImageEvidence(evidence!);

    expect(input).toContain("меню ресторана");
    expect(input).not.toContain("https://chenson.uz/loyalty");
    expect(reasons).not.toContain("asks_to_scan_qr");
    expect(score.level).not.toBe("high_risk");
  });

  it("treats a normal delivery pickup SMS as insufficient data, not high risk", () => {
    const evidence = fallbackImageIntelligence(
      "kutadi\nBuyurtma 106894935 sizni topshirish punktida kutmoqda. Uni 23.05.2026gacha olib keting",
    );

    expect(evidence.visualCategory).toBe("delivery_sms");
    const { reasons, score } = scoreImageEvidence(evidence);

    expect(reasons).not.toContain("fake_delivery_payment");
    expect(reasons).not.toContain("asks_for_sms_code");
    expect(score.level).not.toBe("high_risk");
  });

  it("keeps QR login evidence dangerous", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Отсканируйте QR-код, чтобы войти в личный кабинет и подтвердить операцию",
      visualCategory: "qr_login_or_payment",
      confidence: "high",
      qr: { present: true, visibleUrl: null, purpose: "login" },
      riskHints: [],
      summary: "QR используется для входа или подтверждения аккаунта.",
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.riskHints).toContain("qr_login");
    const { reasons, score } = scoreImageEvidence(evidence!);

    expect(reasons).toContain("asks_to_scan_qr");
    expect(score.level).toBe("high_risk");
  });

  it("keeps QR payment evidence dangerous", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Для брони отсканируйте QR-код и внесите предоплату",
      visualCategory: "qr_login_or_payment",
      confidence: "high",
      qr: { present: true, visibleUrl: null, purpose: "payment" },
      riskHints: ["qr_payment", "payment_request"],
      summary: "QR используется для оплаты до услуги.",
    });

    expect(evidence).not.toBeNull();
    const { reasons, score } = scoreImageEvidence(evidence!);

    expect(reasons).toContain("asks_to_scan_qr");
    expect(reasons).toContain("payment_before_service");
    expect(score.level).toBe("high_risk");
  });

  it("redacts sensitive digits in model output", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Назовите SMS-код 123456 и карту 4111 1111 1111 1111",
      visualCategory: "chat_screenshot",
      confidence: "high",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: ["otp_or_secret", "card_data"],
      summary: "Просят код 123456 и карту 4111 1111 1111 1111.",
    });

    expect(evidence?.text).not.toContain("123456");
    expect(evidence?.text).not.toContain("4111 1111 1111 1111");
    expect(evidence?.summary).not.toContain("123456");
    expect(evidence?.summary).not.toContain("4111 1111 1111 1111");
    expect(evidence?.text).toContain("••••");
    expect(evidence?.summary).toContain("••••");
  });

  it("falls back deterministically when model JSON is invalid", () => {
    const evidence = sanitizeImageIntelligence("This is not JSON");
    expect(evidence).toBeNull();

    const fallback = fallbackImageIntelligence(
      "QR kodni skanerlang va tizimga kiring, tasdiqlash kodini yuboring",
    );
    const { reasons } = scoreImageEvidence(fallback);
    expect(reasons).toContain("asks_to_scan_qr");
    expect(reasons).toContain("asks_for_sms_code");
  });

  it("does not treat a model refusal to read the image as usable evidence", () => {
    const evidence = sanitizeImageIntelligence({
      text: "I could not read or recognize the text in this blurry image.",
      visualCategory: "unknown",
      confidence: "low",
      qr: { present: true, visibleUrl: null, purpose: "unknown" },
      riskHints: [],
      summary: "The screenshot is too blurry to extract details.",
    });

    expect(evidence).not.toBeNull();
    expect(hasUsableImageEvidence(evidence!)).toBe(false);
  });

  it("keeps a visible QR URL usable even when the image text is weak", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Not readable",
      visualCategory: "unknown",
      confidence: "low",
      qr: { present: true, visibleUrl: "https://example.com/menu", purpose: "unknown" },
      riskHints: [],
      summary: null,
    });

    expect(evidence).not.toBeNull();
    expect(hasUsableImageEvidence(evidence!)).toBe(true);
  });

  it("builds a calm user explanation for benign QR menu images", () => {
    const evidence = fallbackImageIntelligence("Меню ресторана. QR-код для акций и бронирования.");
    const explanation = buildImageUserExplanation(evidence, "unknown", "ru");

    expect(explanation).toContain("Сам QR-код не является признаком скама");
    expect(explanation).toContain("код");
  });
});
