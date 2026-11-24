import { describe, expect, it } from "vitest";
import { evaluateText, REASON_LABELS, REASON_TRUST_IMPACT } from "./rules";
import { filterAdvice, REASON_PROTECTIVE_ACTION } from "@/lib/telegram/advice-filter";

describe("2026 Telegram threat detectors", () => {
  describe("telegram_mini_app_phishing", () => {
    it("flags Russian Mini App phishing with startapp link and login/wallet bait", () => {
      const reasons = evaluateText(
        "Откройте мини-приложение t.me/uz_subsidy_bot?startapp=claim и введите номер телефона и код входа Telegram, чтобы получить выплату.",
      );
      expect(reasons).toContain("telegram_mini_app_phishing");
      expect(REASON_TRUST_IMPACT.telegram_mini_app_phishing).toBe("risk");
      expect(REASON_PROTECTIVE_ACTION.telegram_mini_app_phishing).toBe("avoid_mini_app_phishing");
    });

    it("flags Uzbek Mini App wallet/subsidy bait", () => {
      const reasons = evaluateText(
        "Davlat subsidiyasi olish uchun mini ilova t.me/yordam_bot/app orqali kiring va hamyoningizni ulang yoki kodni kiriting.",
      );
      expect(reasons).toContain("telegram_mini_app_phishing");
    });

    it("flags English Mini App airdrop + connect wallet phishing", () => {
      const reasons = evaluateText(
        "Claim your Telegram Stars airdrop inside our Mini App t.me/stars_claim_bot?startapp=go — connect your wallet and enter your cloud password.",
      );
      expect(reasons).toContain("telegram_mini_app_phishing");
    });

    it("flags fake Telegram Support verification badge pressure", () => {
      const reasons = evaluateText(
        "Служба безопасности Telegram (с синей галочкой): ваш аккаунт ограничен, введите код входа в мини-приложении для проверки.",
      );
      expect(reasons).toContain("telegram_mini_app_phishing");
    });

    it("does not false-positive on benign Mini App mentions or safety warnings", () => {
      expect(
        evaluateText("В Telegram есть удобное мини-приложение для заказа такси и доставки еды."),
      ).not.toContain("telegram_mini_app_phishing");
      expect(
        evaluateText(
          "Никогда не вводите код входа Telegram и не подключайте кошелёк внутри неизвестного Mini App.",
        ),
      ).not.toContain("telegram_mini_app_phishing");
      expect(
        evaluateText("What is a Telegram Mini App and how does it work for shops?"),
      ).not.toContain("telegram_mini_app_phishing");
    });

    it("renders dedicated localized Mini App advice and labels in RU/UZ/EN", () => {
      for (const lang of ["ru", "uz", "en"] as const) {
        expect(REASON_LABELS.telegram_mini_app_phishing[lang].length).toBeGreaterThan(10);
        const advice = filterAdvice("high_risk", ["telegram_mini_app_phishing"], lang);
        expect(advice.length).toBeGreaterThan(0);
        expect(advice[0]?.toLowerCase()).toContain("mini app");
      }
    });
  });

  describe("deepfake_voice_video_impersonation", () => {
    it("flags Russian video-circle impersonation of a boss or relative asking urgently for money", () => {
      const reasons = evaluateText(
        "Начальник прислал видеокружок в Telegram и срочно просит перевести деньги на карту, говорит сейчас не могу говорить и не звони.",
      );
      expect(reasons).toContain("deepfake_voice_video_impersonation");
      expect(REASON_TRUST_IMPACT.deepfake_voice_video_impersonation).toBe("risk");
      expect(REASON_PROTECTIVE_ACTION.deepfake_voice_video_impersonation).toBe(
        "verify_voice_video_identity",
      );
    });

    it("flags Uzbek voice/video note from relative asking urgently for transfer", () => {
      const reasons = evaluateText(
        "Otam ovozli xabar yuborib zudlik bilan karta raqamiga pul o'tkazishni so'radi, qo'ng'iroq qilma dedi.",
      );
      expect(reasons).toContain("deepfake_voice_video_impersonation");
    });

    it("flags explicit English deepfake voice clone demand", () => {
      const reasons = evaluateText(
        "I think it is an AI voice clone or deepfake of my director asking for an urgent money transfer.",
      );
      expect(reasons).toContain("deepfake_voice_video_impersonation");
    });

    it("does not false-positive on harmless family video notes or educational deepfake questions", () => {
      expect(
        evaluateText("Мама прислала видеокружок из Самарканда, рассказывает как доехала."),
      ).not.toContain("deepfake_voice_video_impersonation");
      expect(evaluateText("Что такое дипфейк и как распознать поддельный голос?")).not.toContain(
        "deepfake_voice_video_impersonation",
      );
      expect(
        evaluateText("Do not transfer money after a suspicious voice note from your boss."),
      ).not.toContain("deepfake_voice_video_impersonation");
    });

    it("renders dedicated localized callback + code-word advice and labels in RU/UZ/EN", () => {
      for (const lang of ["ru", "uz", "en"] as const) {
        expect(REASON_LABELS.deepfake_voice_video_impersonation[lang].length).toBeGreaterThan(10);
        const advice = filterAdvice("high_risk", ["deepfake_voice_video_impersonation"], lang);
        expect(advice.length).toBeGreaterThan(0);
      }
    });
  });
});
