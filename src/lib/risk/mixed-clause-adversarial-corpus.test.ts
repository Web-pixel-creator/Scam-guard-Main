import { describe, expect, it } from "vitest";
import { evaluateText } from "@/lib/risk/rules";
import {
  MIXED_CLAUSE_ADVERSARIAL_CORPUS,
  MIXED_CLAUSE_RISK_CATEGORIES,
  type MixedClauseAdversarialCase,
} from "@/lib/risk/mixed-clause-adversarial-corpus";

const riskCases = MIXED_CLAUSE_ADVERSARIAL_CORPUS.filter(
  (testCase) => testCase.shape !== "safe_control",
);
const safeControls = MIXED_CLAUSE_ADVERSARIAL_CORPUS.filter(
  (testCase) => testCase.shape === "safe_control",
);

describe("mixed-clause adversarial corpus invariants", () => {
  it("contains 363 unique messages balanced across RU, UZ, and EN", () => {
    expect(MIXED_CLAUSE_ADVERSARIAL_CORPUS).toHaveLength(363);
    expect(new Set(MIXED_CLAUSE_ADVERSARIAL_CORPUS.map(({ id }) => id)).size).toBe(363);
    expect(new Set(MIXED_CLAUSE_ADVERSARIAL_CORPUS.map(({ text }) => text)).size).toBe(363);

    for (const lang of ["ru", "uz", "en"] as const) {
      expect(MIXED_CLAUSE_ADVERSARIAL_CORPUS.filter((row) => row.lang === lang)).toHaveLength(121);
    }
  });

  it("covers every risk family, polarity order, and requested clause separator in every language", () => {
    for (const lang of ["ru", "uz", "en"] as const) {
      for (const category of MIXED_CLAUSE_RISK_CATEGORIES) {
        const rows = MIXED_CLAUSE_ADVERSARIAL_CORPUS.filter(
          (row) => row.lang === lang && row.category === category,
        );
        expect(new Set(rows.map(({ shape }) => shape))).toEqual(
          new Set(["neutral_then_danger", "danger_then_safety", "safe_control"]),
        );
        expect(
          new Set(
            rows.filter(({ separator }) => separator !== "none").map(({ separator }) => separator),
          ),
        ).toEqual(new Set(["comma", "colon", "dash", "semicolon", "contrast"]));
      }
    }
  });
});

describe("mixed-clause bypasses preserve the dangerous request", () => {
  it.each(riskCases)("$id: $text", (testCase: MixedClauseAdversarialCase) => {
    const reasons = evaluateText(testCase.text);
    for (const required of testCase.requiredReasons) {
      expect(reasons, `${testCase.id}: ${testCase.text}`).toContain(required);
    }
  });
});

describe("natural request forms exposed by the mixed-clause corpus", () => {
  it.each([
    ["он просит отправить номер банковской карты", "requests_card_digits"],
    ["он просит прислать фото паспорта", "requests_personal_data"],
    ["он просит показать экран телефона", "asks_to_share_screen"],
    ["u APK faylni yuklab o'rnatishni so'rayapti", "asks_to_install_apk"],
  ] as const)("detects %s", (text, reason) => {
    expect(evaluateText(text)).toContain(reason);
  });
});

describe("mixed-clause safe controls do not invent a direct-danger request", () => {
  it.each(safeControls)("$id: $text", (testCase: MixedClauseAdversarialCase) => {
    const reasons = evaluateText(testCase.text);
    for (const forbidden of testCase.forbiddenReasons) {
      expect(reasons, `${testCase.id}: ${testCase.text}`).not.toContain(forbidden);
    }
  });
});
