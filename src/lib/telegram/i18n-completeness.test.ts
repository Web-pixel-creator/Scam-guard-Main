// i18n completeness tests — verify all user-facing strings exist for all 3 langs (ru, uz, en).
// Task 9.4: Telegram UX Polish — Requirements 1.2, 2.3, 5.1

import { describe, it, expect } from "vitest";

import { bot_dict } from "@/lib/telegram/bot-i18n";
import {
  PANIC_SCENARIO_IDS,
  PANIC_MENU_TITLES,
  buildPanicScenarioText,
  buildPanicMenuText,
} from "@/lib/telegram/emergency";
import { buildCommandPayloads } from "@/../scripts/set-bot-commands";

const LANGS = ["ru", "uz", "en"] as const;

// ─── 1. PANIC_MENU_TITLES: all scenarios have non-empty ru/uz/en titles ────

describe("PANIC_MENU_TITLES — all scenarios × 3 langs", () => {
  for (const id of PANIC_SCENARIO_IDS) {
    for (const lang of LANGS) {
      it(`scenario ${id} has a non-empty title for "${lang}"`, () => {
        const title = PANIC_MENU_TITLES[id][lang];
        expect(title).toBeDefined();
        expect(typeof title).toBe("string");
        expect(title.trim().length).toBeGreaterThan(0);
      });
    }
  }
});

// ─── 2. buildPanicScenarioText — non-empty for all scenarios × 3 combos ─────

describe("buildPanicScenarioText — all scenarios × 3 langs produce non-empty text", () => {
  for (const id of PANIC_SCENARIO_IDS) {
    for (const lang of LANGS) {
      it(`buildPanicScenarioText(${id}, "${lang}") returns non-empty text`, () => {
        const text = buildPanicScenarioText(id, lang);
        expect(text).toBeDefined();
        expect(typeof text).toBe("string");
        expect(text.trim().length).toBeGreaterThan(0);
      });
    }
  }
});

// ─── 3. buildPanicMenuText — non-empty for all 3 langs ─────────────────────

describe("buildPanicMenuText — non-empty for all 3 langs", () => {
  for (const lang of LANGS) {
    it(`buildPanicMenuText("${lang}") returns non-empty text`, () => {
      const text = buildPanicMenuText(lang);
      expect(text).toBeDefined();
      expect(typeof text).toBe("string");
      expect(text.trim().length).toBeGreaterThan(0);
    });
  }
});

// ─── 4. bot_dict — all keys have non-empty values for all 3 langs ───────────

describe("bot_dict — all user-facing keys have non-empty values for all 3 langs", () => {
  const keys = Object.keys(bot_dict) as (keyof typeof bot_dict)[];

  for (const key of keys) {
    for (const lang of LANGS) {
      it(`bot_dict["${key}"]["${lang}"] is a non-empty string`, () => {
        const entry = bot_dict[key];
        expect(entry).toBeDefined();
        const value = entry[lang];
        expect(value).toBeDefined();
        expect(typeof value).toBe("string");
        expect(value.trim().length).toBeGreaterThan(0);
      });
    }
  }

  it("no lang variant silently falls back to a different lang (values differ per lang)", () => {
    for (const key of keys) {
      const entry = bot_dict[key];
      // Language button labels (btn_lang_ru, btn_lang_uz, btn_lang_en) intentionally
      // show the same text in every locale (e.g., "Русский" everywhere). Skip those.
      if (key.startsWith("btn_lang_")) continue;

      // For all other keys, at least 2 of the 3 langs should differ
      // (proves no wholesale copy-paste fallback)
      const values = LANGS.map((l) => entry[l]);
      const unique = new Set(values);
      expect(
        unique.size,
        `bot_dict["${key}"] has identical values for all 3 langs — likely a fallback bug`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── 5. buildCommandPayloads — all commands have non-empty descriptions ─────

describe("buildCommandPayloads — all commands have non-empty descriptions for each payload", () => {
  const payloads = buildCommandPayloads();

  for (const payload of payloads) {
    const label = payload.language_code ?? "default";

    for (const cmd of payload.commands) {
      it(`[${label}] command "${cmd.command}" has a non-empty description`, () => {
        expect(cmd.description).toBeDefined();
        expect(typeof cmd.description).toBe("string");
        expect(cmd.description.trim().length).toBeGreaterThan(0);
      });
    }
  }

  it("payloads cover all 3 languages (ru, uz, en)", () => {
    const langCodes = payloads
      .map((p) => p.language_code)
      .filter((lc): lc is string => lc !== undefined);
    expect(langCodes).toContain("ru");
    expect(langCodes).toContain("uz");
    expect(langCodes).toContain("en");
  });
});
