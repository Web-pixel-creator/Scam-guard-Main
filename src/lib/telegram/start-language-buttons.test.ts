// Test: /start command still sends inline keyboard with language selection buttons (ru/uz/en).
//
// Verifies that the onboarding flow (inline language buttons on /start) is
// unaffected by command menu localization changes. The /start handler uses
// `formatWelcome(lang)` which includes a first row of language buttons with
// callback_data "lang:ru", "lang:uz", "lang:en".
//
// _Requirements: 1.1_

import { describe, it, expect } from "vitest";
import { formatWelcome, CB } from "@/lib/telegram/format";
import type { Lang } from "@/lib/i18n";

const LANGS: Lang[] = ["ru", "uz", "en"];

describe("/start inline language buttons", () => {
  it.each(LANGS)(
    "formatWelcome(%s) includes an inline keyboard row with ru/uz/en language buttons",
    (lang) => {
      const { keyboard } = formatWelcome(lang);

      // The keyboard must exist and have at least one row
      expect(keyboard).toBeDefined();
      expect(keyboard.length).toBeGreaterThanOrEqual(1);

      // Find the row containing language buttons (callback_data starts with "lang:")
      const langRow = keyboard.find((row) =>
        row.some((btn) => btn.callback_data.startsWith("lang:")),
      );
      expect(langRow).toBeDefined();

      // Extract callback_data values from the language row
      const callbackDataValues = langRow!.map((btn) => btn.callback_data);

      // Must contain all three language buttons
      expect(callbackDataValues).toContain(CB.lang("ru"));
      expect(callbackDataValues).toContain(CB.lang("uz"));
      expect(callbackDataValues).toContain(CB.lang("en"));
    },
  );

  it.each(LANGS)("formatWelcome(%s) language buttons have non-empty text labels", (lang) => {
    const { keyboard } = formatWelcome(lang);

    const langRow = keyboard.find((row) =>
      row.some((btn) => btn.callback_data.startsWith("lang:")),
    );
    expect(langRow).toBeDefined();

    // Every button in the language row must have non-empty text
    for (const btn of langRow!) {
      expect(btn.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("formatWelcome returns text content (welcome message is not empty)", () => {
    for (const lang of LANGS) {
      const { text } = formatWelcome(lang);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("command menu localization does not affect /start onboarding keyboard structure", () => {
    // The /start handler delegates to formatWelcome, which is a pure function.
    // This test ensures the keyboard structure (language row) remains stable
    // regardless of which language the session is in.
    for (const lang of LANGS) {
      const { keyboard } = formatWelcome(lang);

      // First row should be the language selection row
      const firstRow = keyboard[0];
      expect(firstRow.length).toBe(3); // exactly 3 language buttons
      expect(firstRow.map((btn) => btn.callback_data)).toEqual(["lang:ru", "lang:uz", "lang:en"]);
    }
  });
});
