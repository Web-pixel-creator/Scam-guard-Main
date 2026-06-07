import { describe, expect, it, vi } from "vitest";

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ok: true }),
  }),
);

import {
  buildDescriptionPayloads,
  type DescriptionPayload,
} from "../../../scripts/set-bot-description";

const DESCRIPTION_MAX = 512;
const SHORT_DESCRIPTION_MAX = 120;

function length(value: string): number {
  return [...value].length;
}

describe("buildDescriptionPayloads", () => {
  const payloads = buildDescriptionPayloads();

  it("returns ru, uz, en, and default scopes", () => {
    expect(payloads.map((payload) => payload.language_code ?? "default")).toEqual([
      "ru",
      "uz",
      "en",
      "default",
    ]);
  });

  it("keeps all Telegram profile text within API limits", () => {
    for (const payload of payloads) {
      expect(length(payload.description)).toBeGreaterThan(20);
      expect(length(payload.description)).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(length(payload.short_description)).toBeGreaterThan(20);
      expect(length(payload.short_description)).toBeLessThanOrEqual(SHORT_DESCRIPTION_MAX);
    }
  });

  it("keeps every scope focused on anti-scam checks and safe next steps", () => {
    for (const payload of payloads) {
      const combined = `${payload.description}\n${payload.short_description}`.toLowerCase();

      expect(combined).toContain("ishonch guard");
      expect(combined).toMatch(/scam|антискам|скам|xavf|tekshir/);
      expect(combined).not.toMatch(/мошенник|scammer|firibgar/i);
    }
  });

  it("uses a Russian profile description for the Russian Telegram locale", () => {
    const ru = payloads.find(
      (payload): payload is DescriptionPayload & { language_code: "ru" } =>
        payload.language_code === "ru",
    );

    expect(ru).toBeDefined();
    expect(ru!.description).toContain("антискам-бот");
    expect(ru!.short_description).toContain("проверка номеров");
  });
});
