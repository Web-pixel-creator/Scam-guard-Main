import { describe, expect, it } from "vitest";
import {
  ALL_META_INTENTS,
  CANONICAL_META_PHRASES,
  classifyMetaIntent,
  getMetaIntentResponse,
  hasScamContextSignal,
  hasScamWordingPattern,
  type MetaIntent,
} from "./meta-intent";

describe("classifyMetaIntent", () => {
  it("classifies canonical RU/UZ/EN examples for every supported intent", () => {
    const seen = new Set<MetaIntent>();

    for (const { intent, text } of CANONICAL_META_PHRASES) {
      expect(classifyMetaIntent(`  ${text.toLocaleUpperCase("ru")}  `)).toBe(intent);
      seen.add(intent);
    }

    expect([...seen].sort()).toEqual([...ALL_META_INTENTS].sort());
  });

  it("handles the image-failure question that previously fell into risk-check", () => {
    expect(classifyMetaIntent("Почему ты не смог проанализировать картинку?")).toBe("why_failed");
  });

  it("classifies methodology and risk-explanation questions separately", () => {
    expect(classifyMetaIntent("как проверить номер?")).toBe("how_do_you_check");
    expect(classifyMetaIntent("почему это опасно?")).toBe("explain_risk");
  });

  it("answers Telegram account capability questions without running a risk check", () => {
    expect(classifyMetaIntent("ты видишь scam метку Telegram аккаунта?")).toBe(
      "telegram_account_limits",
    );
    expect(classifyMetaIntent("можешь узнать возраст аккаунта и сколько жалоб было?")).toBe(
      "telegram_account_limits",
    );
    expect(classifyMetaIntent("can you see Telegram scam labels or account age?")).toBe(
      "telegram_account_limits",
    );
  });

  it("does not intercept text that contains scam artifacts or forwarded content", () => {
    expect(classifyMetaIntent("помогите, мне прислали ссылку https://example.com")).toBeNull();
    expect(classifyMetaIntent("как пользоваться @unknown_manager")).toBeNull();
    expect(classifyMetaIntent("ты видишь scam метку @unknown_manager")).toBeNull();
    expect(
      classifyMetaIntent("на вашем Telegram аккаунте scam метка, оплатите проверку"),
    ).toBeNull();
    expect(classifyMetaIntent("почему это опасно +998 90 123 45 67")).toBeNull();
    expect(classifyMetaIntent("как проверить номер", { isForwarded: true })).toBeNull();
  });

  it("detects scam-context and scam-wording override signals", () => {
    expect(hasScamContextSignal("как пользоваться https://example.com")).toBe(true);
    expect(hasScamContextSignal("почему риск, если просят SMS-код")).toBe(true);
    expect(hasScamContextSignal("просят оплатить проверку аккаунта")).toBe(true);
    expect(hasScamWordingPattern("не кладите трубку, идет проверка")).toBe(true);
  });

  it("returns null for empty and ordinary non-meta text", () => {
    expect(classifyMetaIntent("")).toBeNull();
    expect(classifyMetaIntent("обычный короткий текст без вопроса")).toBeNull();
  });
});

describe("getMetaIntentResponse", () => {
  it("returns non-empty localized templates for every intent", () => {
    for (const intent of ALL_META_INTENTS) {
      for (const lang of ["ru", "uz", "en"] as const) {
        expect(getMetaIntentResponse(intent, lang).trim().length).toBeGreaterThan(20);
      }
    }
  });

  it("keeps Telegram account limitations explicit and non-accusatory", () => {
    const response = getMetaIntentResponse("telegram_account_limits", "ru");

    expect(response).toContain("скрытую метку SCAM");
    expect(response).toContain("возраст аккаунта");
    expect(response).toContain("@username");
    expect(response).not.toMatch(/точно мошенник|забанен|создан недавно/i);
  });
});
