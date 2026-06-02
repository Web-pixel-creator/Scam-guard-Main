import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  reportRows: [] as Array<Record<string, unknown>>,
  entityInserts: [] as Array<Record<string, unknown>>,
  entityUpdates: [] as Array<Record<string, unknown>>,
  existingEntity: null as null | { id: string; report_count: number },
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((d: unknown) => unknown) | undefined;
    const builder = {
      inputValidator(fn: (d: unknown) => unknown) {
        validator = fn;
        return builder;
      },
      handler(h: (opts: { data: unknown }) => unknown) {
        return async (opts: { data: unknown }) => {
          const data = validator ? validator(opts?.data) : opts?.data;
          return h({ data });
        };
      },
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "reports") {
        return {
          insert: async (row: Record<string, unknown>) => {
            hoisted.reportRows.push(row);
            return { data: null, error: null };
          },
        };
      }

      if (table === "entities") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: hoisted.existingEntity, error: null }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            hoisted.entityInserts.push(row);
            return { data: null, error: null };
          },
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              hoisted.entityUpdates.push(row);
              return { data: null, error: null };
            },
          }),
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { submitReport } from "./report.functions";

const maxDigitRun = (s: string): number =>
  Math.max(0, ...(s.match(/\d+/g) ?? []).map((run) => run.length));

beforeEach(() => {
  hoisted.reportRows.length = 0;
  hoisted.entityInserts.length = 0;
  hoisted.entityUpdates.length = 0;
  hoisted.existingEntity = null;
});

describe("submitReport privacy", () => {
  it("redacts sensitive data from the report description before persistence", async () => {
    const result = await submitReport({
      data: {
        value: "@fakebank_support",
        type: "telegram",
        description:
          "Menga kod 123456, karta 8600 1234 5678 9012 va telefon +998901234567 yuborildi.",
        scamType: "telegram-bank",
        lang: "ru",
      },
    });

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);

    const description = String(hoisted.reportRows[0].description);
    expect(description).not.toContain("123456");
    expect(description).not.toContain("8600 1234 5678 9012");
    expect(description).not.toContain("+998901234567");
    expect(maxDigitRun(description)).toBeLessThanOrEqual(3);
  });
});
