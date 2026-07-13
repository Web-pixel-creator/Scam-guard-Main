import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ALL_META_INTENTS,
  CANONICAL_META_PHRASES,
  classifyMetaIntent,
  getMetaIntentResponse,
} from "./meta-intent";

const concreteOrActionableScamSignals = [
  "https://evil.example",
  "www.bad-site.com",
  "paypa1.uz",
  "пример.рф",
  "+998 90 123 45 67",
  "@fake_support",
  "t.me/fake_bank",
  "оплатите проверку",
  "безопасный счёт",
  "не кладите трубку",
  "xavfsiz hisob",
] as const;

const capabilityTopicWords = ["APK", "деньги", "payment"] as const;

const safeNoise = [
  "coffee",
  "alpha",
  "neutral",
  "ordinary",
  "table",
  "restaurant",
  "screen",
  "short",
  "window",
] as const;

const conversationalWrappers = [
  "После прошлого результата хочу уточнить: ",
  "Спасибо за помощь. Ещё вопрос: ",
  "After the previous result, I want to clarify: ",
  "Thanks for your help. One more question: ",
  "Oldingi natijadan keyin aniqlashtirmoqchiman: ",
  "Yordamingiz uchun rahmat. Yana bir savol: ",
] as const;

describe("meta-intent classifier properties", () => {
  it("known meta-intent phrases classify correctly despite casing and padding", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CANONICAL_META_PHRASES),
        fc.constantFrom<"lower" | "upper" | "as-is">("lower", "upper", "as-is"),
        fc.constantFrom("", " ", "\n", "\t"),
        fc.constantFrom("", " ", "\n", "\t"),
        ({ intent, text }, casing, leftPad, rightPad) => {
          const cased =
            casing === "upper"
              ? text.toLocaleUpperCase("ru")
              : casing === "lower"
                ? text.toLocaleLowerCase("ru")
                : text;
          expect(classifyMetaIntent(`${leftPad} ${cased} ${rightPad}`)).toBe(intent);
        },
      ),
    );
  });

  it("concrete artifacts and actionable scam instructions override meta-intent detection", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CANONICAL_META_PHRASES),
        fc.constantFrom(...concreteOrActionableScamSignals),
        fc.boolean(),
        ({ text }, signal, signalFirst) => {
          const mixed = signalFirst ? `${signal} ${text}` : `${text} ${signal}`;
          expect(classifyMetaIntent(mixed)).toBeNull();
        },
      ),
    );
  });

  it("keeps capability questions answerable when they only name a risky topic", () => {
    fc.assert(
      fc.property(fc.constantFrom(...capabilityTopicWords), (topic) => {
        expect(classifyMetaIntent(`Can you check a screenshot about ${topic}?`)).toBe(
          "can_check_image",
        );
      }),
    );
  });

  it("forwarded messages always bypass meta-intent detection", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CANONICAL_META_PHRASES), ({ text }) => {
        expect(classifyMetaIntent(text, { isForwarded: true })).toBeNull();
      }),
    );
  });

  it("known safe conversational wrappers preserve the inner meta intent", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CANONICAL_META_PHRASES),
        fc.constantFrom(...conversationalWrappers),
        ({ intent, text }, wrapper) => {
          expect(classifyMetaIntent(`${wrapper}${text}`)).toBe(intent);
        },
      ),
    );
  });

  it("ordinary non-matching text returns null", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...safeNoise), { minLength: 0, maxLength: 12 }),
        (xs) => {
          expect(classifyMetaIntent(xs.join(" "))).toBeNull();
        },
      ),
    );
  });

  it("response templates are present and stay compact for mobile", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_META_INTENTS),
        fc.constantFrom("ru", "uz", "en"),
        (intent, lang) => {
          const text = getMetaIntentResponse(intent, lang);
          expect(text.trim().length).toBeGreaterThan(20);
          expect(text.length).toBeLessThan(1000);
        },
      ),
    );
  });
});
