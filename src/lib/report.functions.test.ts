import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  reportRows: [] as Array<Record<string, unknown>>,
  entityInserts: [] as Array<Record<string, unknown>>,
  entityUpdates: [] as Array<Record<string, unknown>>,
  reputationUpserts: [] as Array<Record<string, unknown>>,
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
          select: () => ({
            eq: () => ({
              gte: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
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

      if (table === "telegram_reputation_targets") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: async (row: Record<string, unknown>) => {
            hoisted.reputationUpserts.push(row);
            return { data: null, error: null };
          },
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              hoisted.reputationUpserts.push(row);
              return { data: null, error: null };
            },
          }),
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { INCIDENT_ONLY_REDACTED_VALUE } from "./report-boundary";
import { submitReport, submitReportCore, reportRateLimitKeyForTelegram } from "./report.functions";

const maxDigitRun = (s: string): number =>
  Math.max(0, ...(s.match(/\d+/g) ?? []).map((run) => run.length));

beforeEach(() => {
  hoisted.reportRows.length = 0;
  hoisted.entityInserts.length = 0;
  hoisted.entityUpdates.length = 0;
  hoisted.reputationUpserts.length = 0;
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

  it("stores situation-only reports without creating or updating public entities", async () => {
    const result = await submitReportCore(
      {
        value: INCIDENT_ONLY_REDACTED_VALUE,
        type: "text",
        description: "Victim reports pressure in chat, but has no phone, username, or link.",
        scamType: "social-engineering",
        lang: "ru",
        incidentOnly: true,
      },
      "report:test:incident-only",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.reportRows[0]).toMatchObject({
      entity_type: "text",
      redacted_value: INCIDENT_ONLY_REDACTED_VALUE,
      scam_type: "social-engineering",
    });
    expect(String(hoisted.reportRows[0].description)).toContain("Victim reports pressure");
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(0);
  });

  it("continues to create an entity candidate when a report names a target", async () => {
    const result = await submitReportCore(
      {
        value: "@fakebank_support_entity",
        type: "telegram",
        description: "Asked for an SMS code during a fake bank support chat.",
        lang: "ru",
      },
      "report:test:target-entity",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.entityInserts).toHaveLength(1);
    expect(hoisted.entityInserts[0]).toMatchObject({
      entity_type: "telegram",
      display_mask: "@fa•••ty",
      moderation_status: "new",
      report_count: 1,
    });
    expect(hoisted.reputationUpserts).toHaveLength(1);
    expect(hoisted.reputationUpserts[0]).toMatchObject({
      target_type: "public_username",
      source_type: "user_submitted_unverified",
      confidence: "low",
      moderation_status: "new",
      unverified_report_count: 1,
    });
  });

  it("rate-limits Telegram report submissions per user key", async () => {
    const base = {
      value: "@fakebank_support",
      type: "telegram" as const,
      description: "Asked for an SMS code during a fake bank support chat.",
      lang: "ru" as const,
    };
    const userAKey = reportRateLimitKeyForTelegram(881001);
    const userBKey = reportRateLimitKeyForTelegram(881002);

    expect(await submitReportCore({ ...base, value: "@fakebank_support_1" }, userAKey)).toEqual({
      ok: true,
    });
    expect(await submitReportCore({ ...base, value: "@fakebank_support_2" }, userAKey)).toEqual({
      ok: true,
    });
    expect(await submitReportCore({ ...base, value: "@fakebank_support_3" }, userAKey)).toEqual({
      ok: true,
    });

    const blocked = await submitReportCore({ ...base, value: "@fakebank_support_4" }, userAKey);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toBe("rate_limited");
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }

    expect(await submitReportCore({ ...base, value: "@another_fakebank" }, userBKey)).toEqual({
      ok: true,
    });
  });
});
