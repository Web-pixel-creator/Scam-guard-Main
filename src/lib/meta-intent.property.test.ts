import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  ALL_META_INTENTS,
  CANONICAL_META_PHRASES,
  classifyMetaIntent,
  getMetaIntentResponse,
} from "./meta-intent";

const scamSignals = [
  "https://evil.example",
  "www.bad-site.com",
  "+998 90 123 45 67",
  "@fake_support",
  "t.me/fake_bank",
  "SMS-kod",
  "CVV",
  "APK",
  "безопасный счёт",
  "не кладите трубку",
  "xavfsiz hisob",
] as const;

const safeNoise = [
  "coffee",
  "alpha",
  "neutral",
  "ordinary",
  "weather",
  "table",
  "restaurant",
  "screen",
  "short",
  "hello",
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

  it("scam context signals always override meta-intent detection", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CANONICAL_META_PHRASES),
        fc.constantFrom(...scamSignals),
        fc.boolean(),
        ({ text }, signal, signalFirst) => {
          const mixed = signalFirst ? `${signal} ${text}` : `${text} ${signal}`;
          expect(classifyMetaIntent(mixed)).toBeNull();
        },
      ),
    );
  });

  it("forwarded messages always bypass meta-intent detection", () => {
    fc.assert(
      fc.property(fc.constantFrom(...CANONICAL_META_PHRASES), ({ text }) => {
        expect(classifyMetaIntent(text, { isForwarded: true })).toBeNull();
      }),
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
