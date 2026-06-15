// Unit tests for `buildCommandPayloads` (task 1.2 of telegram-ux-polish spec).
//
// Verifies:
//   - Exactly 4 payloads are returned (ru, uz, en, default)
//   - Each payload contains the required commands
//   - `language_code` is set correctly per payload (absent for default)
//   - Descriptions are single-language (no multi-language combined strings)
//   - `/report` description uses "Сообщить о случае" (ru), not "мошеннике"
//   - Descriptions are within the Telegram 3–256 character limit
//
// _Requirements: 5.7_
//
// `buildCommandPayloads` is a pure function exported for testing. The script
// also calls `main()` at module scope, so we stub `fetch` to prevent real
// network calls. The config.server module resolves fine via vitest.setup.ts
// which seeds the env var.
import { describe, it, expect, vi } from "vitest";

// Stub fetch so the script's top-level main() does not hit the network.
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true }),
  }),
);

import { buildCommandPayloads, type CommandPayload } from "../../../scripts/set-bot-commands";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REQUIRED_COMMANDS = [
  "start",
  "check",
  "call",
  "report",
  "panic",
  "family",
  "digest",
  "safety",
  "lang",
] as const;

/** Characters that strongly signal a multi-language combined string (e.g. " / " separator). */
const MULTI_LANG_SEPARATOR_RE = /\s\/\s/;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildCommandPayloads — structure", () => {
  const payloads = buildCommandPayloads();

  it("returns exactly 4 payloads (ru, uz, en, default)", () => {
    expect(payloads).toHaveLength(4);
  });

  it("each payload contains exactly 9 commands", () => {
    for (const payload of payloads) {
      expect(payload.commands).toHaveLength(9);
    }
  });

  it("each payload contains the required command names", () => {
    for (const payload of payloads) {
      const names = payload.commands.map((c) => c.command);
      for (const cmd of REQUIRED_COMMANDS) {
        expect(names).toContain(cmd);
      }
    }
  });
});

describe("buildCommandPayloads — language_code", () => {
  const payloads = buildCommandPayloads();

  it("sets language_code to 'ru' for the Russian payload", () => {
    const ru = payloads.find((p) => p.language_code === "ru");
    expect(ru).toBeDefined();
  });

  it("sets language_code to 'uz' for the Uzbek payload", () => {
    const uz = payloads.find((p) => p.language_code === "uz");
    expect(uz).toBeDefined();
  });

  it("sets language_code to 'en' for the English payload", () => {
    const en = payloads.find((p) => p.language_code === "en");
    expect(en).toBeDefined();
  });

  it("has exactly one payload without language_code (default scope)", () => {
    const defaults = payloads.filter((p) => p.language_code === undefined);
    expect(defaults).toHaveLength(1);
  });
});

describe("buildCommandPayloads — descriptions are single-language", () => {
  const payloads = buildCommandPayloads();

  it("no description contains a multi-language separator ( / )", () => {
    for (const payload of payloads) {
      for (const cmd of payload.commands) {
        expect(cmd.description).not.toMatch(MULTI_LANG_SEPARATOR_RE);
      }
    }
  });
});

describe("buildCommandPayloads — /report description (ru)", () => {
  const payloads = buildCommandPayloads();
  const ru = payloads.find((p) => p.language_code === "ru")!;
  const reportCmd = ru.commands.find((c) => c.command === "report")!;

  it("uses 'Сообщить о случае' as the Russian /report description", () => {
    expect(reportCmd.description).toBe("Сообщить о случае");
  });

  it("does NOT contain 'мошеннике' in the Russian /report description", () => {
    expect(reportCmd.description).not.toContain("мошеннике");
  });
});

describe("buildCommandPayloads — Telegram description length (3–256 chars)", () => {
  const payloads = buildCommandPayloads();

  it("all descriptions are between 3 and 256 characters", () => {
    for (const payload of payloads) {
      for (const cmd of payload.commands) {
        expect(cmd.description.length).toBeGreaterThanOrEqual(3);
        expect(cmd.description.length).toBeLessThanOrEqual(256);
      }
    }
  });
});
