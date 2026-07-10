import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  reportRows: [] as Array<Record<string, unknown>>,
  entityInserts: [] as Array<Record<string, unknown>>,
  entityUpdates: [] as Array<Record<string, unknown>>,
  reputationUpserts: [] as Array<Record<string, unknown>>,
  moderationNotices: [] as Array<Record<string, unknown>>,
  existingReportIds: [] as Array<string>,
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
                limit: () =>
                  Promise.resolve({
                    data: hoisted.existingReportIds.map((id) => ({ id })),
                    error: null,
                  }),
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

vi.mock("@/lib/telegram/moderation-notifier.server", () => ({
  notifyModeration: async (notice: Record<string, unknown>) => {
    hoisted.moderationNotices.push(notice);
    return { ok: true };
  },
}));

import { INCIDENT_ONLY_REDACTED_VALUE } from "./report-boundary";
import {
  prepareReportIdentifier,
  reportRateLimitKeyForTelegram,
  submitPreparedReportCore,
  submitReport,
  submitReportCore,
} from "./report.functions";

const maxDigitRun = (s: string): number =>
  Math.max(0, ...(s.match(/\d+/g) ?? []).map((run) => run.length));

beforeEach(() => {
  hoisted.reportRows.length = 0;
  hoisted.entityInserts.length = 0;
  hoisted.entityUpdates.length = 0;
  hoisted.reputationUpserts.length = 0;
  hoisted.moderationNotices.length = 0;
  hoisted.existingReportIds.length = 0;
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

  it("redacts narrative identifiers and metadata before persistence", async () => {
    const result = await submitReportCore(
      {
        value: "+998 90 123 45 67",
        type: "text",
        description:
          "Email victim@example.com, Telegram @FakeSupportBot, link https://evil.example/reset?token=secret.",
        scamType: "contact @FakeSupportBot",
        city: "https://city.example/private",
        lang: "ru",
      },
      "report:test:redaction-boundary",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.reportRows[0]).toMatchObject({
      entity_type: "phone",
    });

    const stored = JSON.stringify(hoisted.reportRows[0]);
    expect(stored).not.toContain("victim@example.com");
    expect(stored).not.toContain("@FakeSupportBot");
    expect(stored).not.toContain("https://evil.example/reset?token=secret");
    expect(stored).not.toContain("https://city.example/private");
    expect(stored).toContain("[telegram]");
    expect(stored).toContain("[link]");

    expect(hoisted.moderationNotices).toHaveLength(1);
    const alert = JSON.stringify(hoisted.moderationNotices[0]);
    expect(alert).not.toContain("@FakeSupportBot");
    expect(alert).not.toContain("https://city.example/private");
  });

  it("accepts a prepared Telegram target without receiving the raw report value", async () => {
    const target = await prepareReportIdentifier("@FakeSupportRaw");
    const result = await submitPreparedReportCore(
      {
        target,
        description: "Email victim@example.com and link https://evil.example/reset?token=secret.",
        scamType: "contact @FakeSupportRaw",
        lang: "ru",
      },
      "report:test:prepared-target",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.reportRows[0]).toMatchObject({
      entity_type: "telegram",
      entity_hash: target.hash,
      redacted_value: target.display,
    });

    const stored = JSON.stringify(hoisted.reportRows[0]);
    expect(stored).not.toContain("@FakeSupportRaw");
    expect(stored).not.toContain("victim@example.com");
    expect(stored).not.toContain("https://evil.example/reset?token=secret");
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

  it("treats placeholder-only targets as situation-only reports", async () => {
    const result = await submitReportCore(
      {
        value: "\u2014",
        description: "Victim describes a new scam pattern without a concrete target.",
        lang: "ru",
      },
      "report:test:placeholder-target",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.reportRows[0]).toMatchObject({
      entity_type: "text",
      redacted_value: INCIDENT_ONLY_REDACTED_VALUE,
    });
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.moderationNotices[0]).toMatchObject({
      incidentOnly: true,
    });
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
      report_count: 0,
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

  it("does not increment the public confirmed report count for an unmoderated follow-up report", async () => {
    hoisted.existingEntity = { id: "entity-confirmed", report_count: 3 };

    const result = await submitReportCore(
      {
        value: "@fakebank_support_entity",
        type: "telegram",
        description: "Another user submitted a new report that is not moderated yet.",
        lang: "ru",
      },
      "report:test:confirmed-entity-unmoderated",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(1);
    expect(hoisted.entityUpdates[0]).not.toHaveProperty("report_count");
    expect(hoisted.entityUpdates[0]).toHaveProperty("last_seen_at");
  });

  it("stores same-day duplicate report evidence without updating public entities", async () => {
    hoisted.existingReportIds.push("existing-report-id");

    const result = await submitReportCore(
      {
        value: "@fakebank_support_duplicate",
        type: "telegram",
        description: "Asked for an SMS code during a fake bank support chat.",
        scamType: "fake bank",
        city: "Tashkent",
        lang: "ru",
      },
      "report:test:duplicate-target",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.reportRows).toHaveLength(1);
    expect(hoisted.reportRows[0]).toMatchObject({
      entity_type: "telegram",
      status: "duplicate",
      scam_type: "fake bank",
      city: "Tashkent",
      language: "ru",
    });
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.moderationNotices).toHaveLength(1);
    expect(hoisted.moderationNotices[0]).toMatchObject({
      kind: "report",
      entityType: "telegram",
      scamType: "fake bank",
      city: "Tashkent",
      language: "ru",
      duplicateOfExisting: true,
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
