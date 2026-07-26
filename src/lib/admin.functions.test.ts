import { beforeEach, describe, expect, it, vi } from "vitest";
import { INCIDENT_ONLY_REDACTED_VALUE } from "./report-boundary";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";

const hoisted = vi.hoisted(() => ({
  reportRow: null as null | {
    entity_hash: string;
    entity_hash_version?: string;
    entity_type: string;
    redacted_value: string;
  },
  existingEntity: null as null | { id: string },
  reportUpdates: [] as Array<Record<string, unknown>>,
  entityInserts: [] as Array<Record<string, unknown>>,
  entityUpdates: [] as Array<Record<string, unknown>>,
  auditInserts: [] as Array<Record<string, unknown>>,
  auditError: null as null | { message: string },
  reputationUpserts: [] as Array<Record<string, unknown>>,
  reputationUpsertError: null as null | { message: string },
  reputationUpdates: [] as Array<Record<string, unknown>>,
  appealRow: null as null | {
    target_hash: string;
    target_hash_version?: string;
    target_type: string;
    target_display: string;
  },
  appealUpdates: [] as Array<Record<string, unknown>>,
  confirmedReportCount: 1,
  unverifiedReportCount: 0,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware() {
        return builder;
      },
      inputValidator() {
        return builder;
      },
      handler(handler: unknown) {
        return handler;
      },
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: async () => undefined,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "reports") {
        const countChain = {
          eq: (_column: string, value: string) => {
            if (value === "confirmed") {
              return Promise.resolve({ count: hoisted.confirmedReportCount, error: null });
            }
            return countChain;
          },
          in: () => Promise.resolve({ count: hoisted.unverifiedReportCount, error: null }),
        };
        return {
          select: (_columns?: string, opts?: { count?: string; head?: boolean }) =>
            opts?.head
              ? countChain
              : {
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: hoisted.reportRow,
                      error: hoisted.reportRow ? null : { message: "not found" },
                    }),
                  }),
                },
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              hoisted.reportUpdates.push(row);
              return { data: null, error: null };
            },
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
          upsert: async (row: Record<string, unknown>) => {
            hoisted.reputationUpserts.push(row);
            return { data: null, error: hoisted.reputationUpsertError };
          },
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              hoisted.reputationUpdates.push(row);
              return { data: null, error: null };
            },
          }),
        };
      }

      if (table === "reputation_appeals") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: hoisted.appealRow,
                error: hoisted.appealRow ? null : { message: "not found" },
              }),
            }),
          }),
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              hoisted.appealUpdates.push(row);
              return { data: null, error: null };
            },
          }),
        };
      }

      if (table === "admin_actions") {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (hoisted.auditError) return { data: null, error: hoisted.auditError };
            hoisted.auditInserts.push(row);
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import {
  attachReportOperatorContext,
  moderateReportCore,
  resolveReputationAppealCore,
  summarizeReportSignals,
} from "./admin.functions";

beforeEach(() => {
  hoisted.reportRow = {
    entity_hash: "hash-target",
    entity_hash_version: "legacy",
    entity_type: "telegram",
    redacted_value: "@fake_support",
  };
  hoisted.existingEntity = null;
  hoisted.reportUpdates.length = 0;
  hoisted.entityInserts.length = 0;
  hoisted.entityUpdates.length = 0;
  hoisted.auditInserts.length = 0;
  hoisted.auditError = null;
  hoisted.reputationUpserts.length = 0;
  hoisted.reputationUpsertError = null;
  hoisted.reputationUpdates.length = 0;
  hoisted.appealRow = {
    target_hash: "hash-target",
    target_hash_version: "legacy",
    target_type: "telegram",
    target_display: "@fa***rt",
  };
  hoisted.appealUpdates.length = 0;
  hoisted.confirmedReportCount = 1;
  hoisted.unverifiedReportCount = 0;
});

describe("attachReportOperatorContext", () => {
  it("adds entity and latest-check context to report cards", () => {
    const [report] = attachReportOperatorContext(
      [{ id: "report-1", entity_hash: "hash-target", description: "Asked for SMS code." }],
      [
        {
          entity_hash: "hash-target",
          report_count: 3,
          last_seen_at: "2026-06-30T08:00:00.000Z",
          moderation_status: "new",
          risk_level: "suspicious",
        },
      ],
      [
        {
          input_hash: "hash-target",
          risk_level: "unknown",
          risk_score: 5,
          reason_codes: ["unknown_sender"],
          ai_explanation: null,
          created_at: "2026-06-29T08:00:00.000Z",
        },
        {
          input_hash: "hash-target",
          risk_level: "high_risk",
          risk_score: 75,
          reason_codes: ["asks_for_sms_code", "uses_urgency"],
          ai_explanation: "Asked for a one-time code with pressure.",
          created_at: "2026-06-30T09:00:00.000Z",
        },
      ],
      [
        {
          entity_hash: "hash-target",
          signal_count: 5,
          last_report_at: "2026-06-30T10:00:00.000Z",
        },
      ],
    );

    expect(report).toMatchObject({
      id: "report-1",
      target_report_count: 3,
      target_signal_count: 5,
      target_last_report_at: "2026-06-30T10:00:00.000Z",
      target_last_seen_at: "2026-06-30T08:00:00.000Z",
      target_moderation_status: "new",
      target_risk_level: "suspicious",
      target_check_risk_level: "high_risk",
      target_check_risk_score: 75,
      target_check_reason_codes: ["asks_for_sms_code", "uses_urgency"],
      target_check_has_ai_explanation: true,
      target_check_created_at: "2026-06-30T09:00:00.000Z",
    });
  });

  it("keeps safe defaults when a report has no target context", () => {
    const [report] = attachReportOperatorContext(
      [{ id: "report-2", entity_hash: "missing-hash" }],
      [],
      [],
    );

    expect(report).toMatchObject({
      target_report_count: 1,
      target_signal_count: 1,
      target_last_report_at: null,
      target_last_seen_at: null,
      target_moderation_status: null,
      target_risk_level: null,
      target_check_risk_level: null,
      target_check_risk_score: null,
      target_check_reason_codes: [],
      target_check_has_ai_explanation: false,
      target_check_created_at: null,
    });
  });
});

describe("summarizeReportSignals", () => {
  it("counts active report rows by target and keeps the latest report timestamp", () => {
    expect(
      summarizeReportSignals([
        { entity_hash: "hash-a", created_at: "2026-06-30T09:00:00.000Z" },
        { entity_hash: "hash-b", created_at: "2026-06-30T11:00:00.000Z" },
        { entity_hash: "hash-a", created_at: "2026-06-30T10:00:00.000Z" },
        { entity_hash: null, created_at: "2026-06-30T12:00:00.000Z" },
      ]),
    ).toEqual([
      {
        entity_hash: "hash-a",
        signal_count: 2,
        last_report_at: "2026-06-30T10:00:00.000Z",
      },
      {
        entity_hash: "hash-b",
        signal_count: 1,
        last_report_at: "2026-06-30T11:00:00.000Z",
      },
    ]);
  });
});

describe("moderateReportCore reputation boundary", () => {
  it("does not create an entity when an incident-only report is confirmed", async () => {
    hoisted.reportRow = {
      entity_hash: "hash-incident",
      entity_type: "text",
      redacted_value: INCIDENT_ONLY_REDACTED_VALUE,
    };

    await expect(
      moderateReportCore(
        { reportId: REPORT_ID, decision: "confirmed", riskLevel: "high_risk" },
        ADMIN_ID,
      ),
    ).resolves.toEqual({ ok: true });

    expect(hoisted.reportUpdates).toEqual([{ status: "confirmed" }]);
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.auditInserts).toHaveLength(1);
    expect(hoisted.reputationUpserts).toHaveLength(0);
  });

  it("still creates an entity moderation record when a report names a target", async () => {
    await expect(
      moderateReportCore(
        { reportId: REPORT_ID, decision: "confirmed", riskLevel: "high_risk" },
        ADMIN_ID,
      ),
    ).resolves.toEqual({ ok: true });

    expect(hoisted.reportUpdates).toEqual([{ status: "confirmed" }]);
    expect(hoisted.entityInserts).toEqual([
      {
        entity_type: "telegram",
        entity_hash: "hash-target",
        entity_hash_version: "legacy",
        display_mask: "@fake_support",
        moderation_status: "confirmed",
        risk_level: "high_risk",
        report_count: 1,
      },
    ]);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.reputationUpserts[0]).toMatchObject({
      target_hash: "hash-target",
      target_hash_version: "legacy",
      display_hint: "@fake_support",
      source_type: "moderated_report",
      confidence: "medium",
      moderation_status: "confirmed",
      risk_level: "high_risk",
      moderated_report_count: 1,
    });
    expect(hoisted.auditInserts).toHaveLength(1);
  });

  it("updates an existing entity instead of inserting a duplicate", async () => {
    hoisted.existingEntity = { id: "entity-1" };
    hoisted.confirmedReportCount = 0;
    hoisted.unverifiedReportCount = 0;

    await expect(
      moderateReportCore(
        { reportId: REPORT_ID, decision: "rejected", riskLevel: "suspicious" },
        ADMIN_ID,
      ),
    ).resolves.toEqual({ ok: true });

    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toEqual([
      {
        moderation_status: "rejected",
        risk_level: "unknown",
        report_count: 0,
      },
    ]);
    expect(hoisted.auditInserts[0]).toMatchObject({
      admin_user_id: ADMIN_ID,
      action: "reject_report",
      target_type: "report",
      target_id: REPORT_ID,
      reason: "risk_level: suspicious",
    });
    expect(hoisted.reputationUpserts[0]).toMatchObject({
      target_hash: "hash-target",
      source_type: "user_submitted_unverified",
      confidence: "low",
      moderation_status: "new",
      risk_level: "unknown",
      moderated_report_count: 0,
    });
  });

  it("keeps an existing target confirmed when another confirmed report remains", async () => {
    hoisted.existingEntity = { id: "entity-1" };
    hoisted.confirmedReportCount = 1;
    hoisted.unverifiedReportCount = 0;

    await expect(
      moderateReportCore(
        { reportId: REPORT_ID, decision: "rejected", riskLevel: "suspicious" },
        ADMIN_ID,
      ),
    ).resolves.toEqual({ ok: true });

    expect(hoisted.reportUpdates).toEqual([{ status: "rejected" }]);
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toEqual([
      {
        moderation_status: "confirmed",
        risk_level: "high_risk",
        report_count: 1,
      },
    ]);
    expect(hoisted.reputationUpserts[0]).toMatchObject({
      target_hash: "hash-target",
      source_type: "moderated_report",
      confidence: "medium",
      moderation_status: "confirmed",
      risk_level: "high_risk",
      moderated_report_count: 1,
    });
  });

  it("does not mutate report or entity state when audit logging fails", async () => {
    hoisted.auditError = { message: "audit down" };

    await expect(
      moderateReportCore(
        { reportId: REPORT_ID, decision: "confirmed", riskLevel: "high_risk" },
        ADMIN_ID,
      ),
    ).rejects.toThrow("audit down");

    expect(hoisted.auditInserts).toHaveLength(0);
    expect(hoisted.reportUpdates).toHaveLength(0);
    expect(hoisted.entityInserts).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.reputationUpserts).toHaveLength(0);
  });

  it("does not return admin success when Telegram reputation synchronization fails", async () => {
    hoisted.reputationUpsertError = { message: "write unavailable" };

    await expect(
      moderateReportCore(
        { reportId: REPORT_ID, decision: "confirmed", riskLevel: "high_risk" },
        ADMIN_ID,
      ),
    ).rejects.toThrow("Telegram reputation synchronization failed");

    expect(hoisted.reportUpdates).toEqual([{ status: "confirmed" }]);
    expect(hoisted.entityInserts).toHaveLength(1);
    expect(hoisted.reputationUpserts).toHaveLength(1);
  });
});

describe("resolveReputationAppealCore", () => {
  it("removes public reputation for a Telegram target and records an audit action", async () => {
    await expect(
      resolveReputationAppealCore(
        {
          appealId: "33333333-3333-4333-8333-333333333333",
          decision: "remove_reputation",
          note: "Owner verified; old report was not applicable.",
        },
        ADMIN_ID,
      ),
    ).resolves.toEqual({ ok: true });

    expect(hoisted.appealUpdates[0]).toMatchObject({
      status: "resolved",
      resolution: "Owner verified; old report was not applicable.",
    });
    expect(hoisted.entityUpdates[0]).toMatchObject({
      moderation_status: "rejected",
      risk_level: "unknown",
    });
    expect(hoisted.reputationUpdates[0]).toMatchObject({
      moderation_status: "rejected",
      risk_level: "unknown",
    });
    expect(hoisted.auditInserts[0]).toMatchObject({
      admin_user_id: ADMIN_ID,
      action: "remove_reputation",
      target_type: "reputation_appeal",
      target_id: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("keeps reputation without changing entity records", async () => {
    await expect(
      resolveReputationAppealCore(
        {
          appealId: "44444444-4444-4444-8444-444444444444",
          decision: "keep_reputation",
        },
        ADMIN_ID,
      ),
    ).resolves.toEqual({ ok: true });

    expect(hoisted.appealUpdates[0]).toMatchObject({
      status: "rejected",
    });
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.reputationUpdates).toHaveLength(0);
    expect(hoisted.auditInserts[0]).toMatchObject({
      action: "keep_reputation",
      target_type: "reputation_appeal",
      target_id: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("does not resolve an appeal when audit logging fails", async () => {
    hoisted.auditError = { message: "audit down" };

    await expect(
      resolveReputationAppealCore(
        {
          appealId: "55555555-5555-4555-8555-555555555555",
          decision: "remove_reputation",
          note: "Owner verified.",
        },
        ADMIN_ID,
      ),
    ).rejects.toThrow("audit down");

    expect(hoisted.auditInserts).toHaveLength(0);
    expect(hoisted.appealUpdates).toHaveLength(0);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.reputationUpdates).toHaveLength(0);
  });
});
