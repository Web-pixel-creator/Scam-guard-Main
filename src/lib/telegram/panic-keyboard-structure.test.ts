// Unit tests for panic keyboard pagination structure (task 9.3 of telegram-ux-polish spec).
//
// Verifies:
//   - `buildPanicKeyboardPage1` returns 7 buttons (6 scenarios + "more") across 4 rows
//   - `buildPanicKeyboardPage2` returns 7 buttons (5 scenarios + "more" + "back")
//   - `buildPanicKeyboardPage3` returns 5 buttons (4 scenarios + "back")
//   - All callback_data strings are `panic:` prefixed
//   - Tested for all 3 langs (ru, uz, en)
//
// _Requirements: 4.1, 4.6_

import { describe, it, expect } from "vitest";
import {
  buildPanicKeyboardPage1,
  buildPanicKeyboardPage2,
  buildPanicKeyboardPage3,
  PANIC_CB_PREFIX,
} from "./emergency";
import type { Lang } from "@/lib/i18n";

const LANGS: Lang[] = ["ru", "uz", "en"];

// ---------------------------------------------------------------------------
// Page 1: 6 scenario buttons + 1 "more" button = 7 total across 4 rows
// ---------------------------------------------------------------------------

describe("buildPanicKeyboardPage1 — structure", () => {
  for (const lang of LANGS) {
    describe(`lang=${lang}`, () => {
      const keyboard = buildPanicKeyboardPage1(lang);

      it("returns 4 rows (3 rows of 2 + 1 row of 1)", () => {
        expect(keyboard).toHaveLength(4);
      });

      it("first 3 rows each contain 2 buttons", () => {
        for (let i = 0; i < 3; i++) {
          expect(keyboard[i]).toHaveLength(2);
        }
      });

      it("last row contains 1 button (the 'more' button)", () => {
        expect(keyboard[3]).toHaveLength(1);
      });

      it("contains 7 total buttons (6 scenarios + 1 more)", () => {
        const totalButtons = keyboard.reduce((sum, row) => sum + row.length, 0);
        expect(totalButtons).toBe(7);
      });

      it("all callback_data strings are panic: prefixed", () => {
        for (const row of keyboard) {
          for (const button of row) {
            expect(button.callback_data).toMatch(new RegExp(`^${PANIC_CB_PREFIX}`));
          }
        }
      });

      it("scenario buttons have callback_data panic:1 through panic:6", () => {
        const scenarioButtons = keyboard.slice(0, 3).flat();
        const callbackDatas = scenarioButtons.map((b) => b.callback_data);
        for (let i = 1; i <= 6; i++) {
          expect(callbackDatas).toContain(`${PANIC_CB_PREFIX}${i}`);
        }
      });

      it("'more' button has callback_data panic:more", () => {
        const moreButton = keyboard[3][0];
        expect(moreButton.callback_data).toBe(`${PANIC_CB_PREFIX}more`);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Page 2: 5 scenario buttons + 1 "more" + 1 "back" = 7 total across 5 rows
// ---------------------------------------------------------------------------

describe("buildPanicKeyboardPage2 — structure", () => {
  for (const lang of LANGS) {
    describe(`lang=${lang}`, () => {
      const keyboard = buildPanicKeyboardPage2(lang);

      it("returns 5 rows (2 rows of 2 + 3 rows of 1)", () => {
        expect(keyboard).toHaveLength(5);
      });

      it("first 2 rows each contain 2 buttons", () => {
        for (let i = 0; i < 2; i++) {
          expect(keyboard[i]).toHaveLength(2);
        }
      });

      it("third row contains 1 button (the voice-clone scenario)", () => {
        expect(keyboard[2]).toHaveLength(1);
      });

      it("fourth row contains 1 button (the 'more' button)", () => {
        expect(keyboard[3]).toHaveLength(1);
      });

      it("last row contains 1 button (the 'back' button)", () => {
        expect(keyboard[4]).toHaveLength(1);
      });

      it("contains 7 total buttons (5 scenarios + 1 more + 1 back)", () => {
        const totalButtons = keyboard.reduce((sum, row) => sum + row.length, 0);
        expect(totalButtons).toBe(7);
      });

      it("all callback_data strings are panic: prefixed", () => {
        for (const row of keyboard) {
          for (const button of row) {
            expect(button.callback_data).toMatch(new RegExp(`^${PANIC_CB_PREFIX}`));
          }
        }
      });

      it("scenario buttons have callback_data panic:7 through panic:11", () => {
        const scenarioButtons = keyboard.slice(0, 3).flat();
        const callbackDatas = scenarioButtons.map((b) => b.callback_data);
        for (let i = 7; i <= 11; i++) {
          expect(callbackDatas).toContain(`${PANIC_CB_PREFIX}${i}`);
        }
      });

      it("'back' button has callback_data panic:back", () => {
        const backButton = keyboard[4][0];
        expect(backButton.callback_data).toBe(`${PANIC_CB_PREFIX}back`);
      });

      it("'more' button has callback_data panic:more2", () => {
        const moreButton = keyboard[3][0];
        expect(moreButton.callback_data).toBe(`${PANIC_CB_PREFIX}more2`);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Page 3: 4 scenario buttons + 1 "back" button = 5 total across 3 rows
// ---------------------------------------------------------------------------

describe("buildPanicKeyboardPage3 — structure", () => {
  for (const lang of LANGS) {
    describe(`lang=${lang}`, () => {
      const keyboard = buildPanicKeyboardPage3(lang);

      it("returns 3 rows (2 rows of 2 + 1 row of 1)", () => {
        expect(keyboard).toHaveLength(3);
      });

      it("first 2 rows each contain 2 buttons", () => {
        for (let i = 0; i < 2; i++) {
          expect(keyboard[i]).toHaveLength(2);
        }
      });

      it("last row contains 1 button (the 'back' button)", () => {
        expect(keyboard[2]).toHaveLength(1);
      });

      it("contains 5 total buttons (4 scenarios + 1 back)", () => {
        const totalButtons = keyboard.reduce((sum, row) => sum + row.length, 0);
        expect(totalButtons).toBe(5);
      });

      it("all callback_data strings are panic: prefixed", () => {
        for (const row of keyboard) {
          for (const button of row) {
            expect(button.callback_data).toMatch(new RegExp(`^${PANIC_CB_PREFIX}`));
          }
        }
      });

      it("scenario buttons have callback_data panic:12 through panic:15", () => {
        const scenarioButtons = keyboard.slice(0, 2).flat();
        const callbackDatas = scenarioButtons.map((b) => b.callback_data);
        for (let i = 12; i <= 15; i++) {
          expect(callbackDatas).toContain(`${PANIC_CB_PREFIX}${i}`);
        }
      });

      it("'back' button has callback_data panic:back2", () => {
        const backButton = keyboard[2][0];
        expect(backButton.callback_data).toBe(`${PANIC_CB_PREFIX}back2`);
      });
    });
  }
});
