/**
 * Task 7.8: Write test that live-call first message tells user to end the call
 *
 * - Verify scenario 6 text starts with "Завершите звонок" (ru) / equivalents (uz, en)
 * - Verify button text is "Я положил трубку" or "Что делать после звонка", not "Положить трубку"
 *
 * _Requirements: 4.4_
 */

import { describe, it, expect } from "vitest";
import { buildPanicScenarioText } from "@/lib/telegram/emergency";
import { bot_dict } from "@/lib/telegram/bot-i18n";
import type { Lang } from "@/lib/i18n";

const LANGS: Lang[] = ["ru", "uz", "en"];

describe("live-call scenario 6 — first message tells user to end the call", () => {
  describe("scenario 6 text starts with instruction to end the call", () => {
    it("[ru] first step contains 'ЗАВЕРШИТЕ ЗВОНОК'", () => {
      const text = buildPanicScenarioText(6, "ru");
      // The first content line after the title is the uppercase action (may have ⚡ prefix)
      const lines = text.split("\n");
      const firstStep = lines[2];
      expect(firstStep).toMatch(/ЗАВЕРШИТЕ ЗВОНОК/);
    });

    it("[uz] first step contains 'QO'NG'IROQNI TUGATING'", () => {
      const text = buildPanicScenarioText(6, "uz");
      const lines = text.split("\n");
      const firstStep = lines[2];
      expect(firstStep).toMatch(/QO'NG'IROQNI TUGATING/);
    });

    it("[en] first step contains 'HANG UP'", () => {
      const text = buildPanicScenarioText(6, "en");
      const lines = text.split("\n");
      const firstStep = lines[2];
      expect(firstStep).toMatch(/HANG UP/);
    });
  });

  describe("button text is post-action (not imperative 'Положить трубку')", () => {
    it("[ru] btn_live_hangup is 'Я положил трубку', not 'Положить трубку'", () => {
      const btnText = bot_dict.btn_live_hangup.ru;
      // Must NOT be imperative "Положить трубку" — the bot cannot hang up for the user
      expect(btnText).not.toMatch(/Положить трубку/);
      // Should be past-tense confirmation or a post-call question
      expect(btnText).toMatch(/Я положил трубку|Что делать после звонка/);
    });

    it("[uz] btn_live_hangup does not use imperative form", () => {
      const btnText = bot_dict.btn_live_hangup.uz;
      // Uzbek imperative would be "Go'shakni qo'ying" (command form)
      // Correct is past-tense "Go'shakni qo'ydim" (I hung up)
      expect(btnText).not.toMatch(/Go'shakni qo'ying/i);
      expect(btnText).toMatch(/qo'ydim|tugating/i);
    });

    it("[en] btn_live_hangup does not use imperative 'Hang up'", () => {
      const btnText = bot_dict.btn_live_hangup.en;
      // Should be "I hung up" not imperative "Hang up"
      expect(btnText).not.toBe("Hang up");
      expect(btnText).toMatch(/I hung up|What to do after/i);
    });
  });
});
