// Test: /start command sends the compact main menu with quick-action buttons.
//
// System Telegram command menu is intentionally simple; the richer menu lives
// inside the chat as inline buttons. The language picker is opened from the
// dedicated "show_lang" button, then shows ru/uz/en choices.
//
// _Requirements: 1.1_

import { describe, it, expect } from "vitest";
import { formatWelcome, CB } from "@/lib/telegram/format";
import type { Lang } from "@/lib/i18n";

const LANGS: Lang[] = ["ru", "uz", "en"];

describe("/start main menu inline buttons", () => {
  it.each(LANGS)("formatWelcome(%s) includes the main quick actions", (lang) => {
    const { keyboard } = formatWelcome(lang);

    expect(keyboard).toBeDefined();
    expect(keyboard).toHaveLength(6);
    expect(keyboard.map((row) => row.length)).toEqual([1, 2, 2, 2, 2, 2]);

    const callbackDataValues = keyboard.flat().map((btn) => btn.callback_data);
    expect(callbackDataValues).toEqual([
      CB.liveCall,
      CB.checkAnother,
      CB.conversationStart,
      CB.emergency,
      CB.report,
      CB.familyMenu,
      CB.trainer,
      CB.digest,
      CB.safety,
      CB.howItWorks,
      CB.showLang,
    ]);
  });

  it("puts the live-call copilot first for stressful situations", () => {
    const { keyboard } = formatWelcome("ru");

    expect(keyboard[0]).toHaveLength(1);
    expect(keyboard[0][0].callback_data).toBe(CB.liveCall);
    expect(keyboard[0][0].text).toContain("ЗВОНЯТ");
  });

  it.each(LANGS)("formatWelcome(%s) quick action buttons have non-empty labels", (lang) => {
    const { keyboard } = formatWelcome(lang);

    for (const btn of keyboard.flat()) {
      expect(btn.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("formatWelcome returns text content (welcome message is not empty)", () => {
    for (const lang of LANGS) {
      const { text } = formatWelcome(lang);
      expect(text.length).toBeGreaterThan(0);
    }
  });

  it("command menu localization does not affect /start main-menu structure", () => {
    // The /start handler delegates to formatWelcome, which is a pure function.
    // This test ensures the keyboard structure remains stable
    // regardless of which language the session is in.
    for (const lang of LANGS) {
      const { keyboard } = formatWelcome(lang);
      expect(keyboard.map((row) => row.length)).toEqual([1, 2, 2, 2, 2, 2]);
    }
  });
});
