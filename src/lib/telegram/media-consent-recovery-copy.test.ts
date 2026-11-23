import { describe, expect, it } from "vitest";
import { bt } from "./bot-i18n";

describe("media consent recovery copy does not invent authorization state", () => {
  it.each([
    {
      lang: "ru" as const,
      required: [
        "не изменило согласие",
        "может ещё действовать",
        "очищенный текст",
        "только если по-прежнему согласны",
        "Если бот попросит согласие",
      ],
      forbidden: [
        "кнопка уже недействительна",
        "другому файлу",
        "чтобы получить новую кнопку",
        "согласие отменено",
      ],
    },
    {
      lang: "uz" as const,
      required: [
        "rozilikni o‘zgartirmadi",
        "hali amal qilishi mumkin",
        "tozalangan matn",
        "faqat tashqi tahlilga hali ham rozi bo‘lsangiz",
        "Bot rozilik so‘rasa",
      ],
      forbidden: [
        "tugma eskirgan",
        "boshqa faylga",
        "Yangi tugma olish uchun",
        "Rozilik bekor qilindi",
      ],
    },
    {
      lang: "en" as const,
      required: [
        "did not change consent",
        "may still be active",
        "redacted text",
        "only if you still agree",
        "If the bot asks for consent",
      ],
      forbidden: [
        "button has expired",
        "belongs to another file",
        "to get a new button",
        "consent is cancelled",
      ],
    },
  ])(
    "$lang: distinguishes rejected click from missing/revoked consent",
    ({ lang, required, forbidden }) => {
      const text = bt("media_provider_consent_invalid", lang);
      for (const meaning of required) expect(text).toContain(meaning);
      for (const falseClaim of forbidden) expect(text).not.toContain(falseClaim);
      expect(text.length).toBeLessThan(500);
    },
  );
});
