import { beforeEach, describe, expect, it, vi } from "vitest";
import { INCIDENT_ONLY_REDACTED_VALUE } from "./report-boundary";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";

const hoisted = vi.hoisted(() => ({
  reportRow: null as null | {
    entity_hash: string;
    entity_type: string;
    redacted_value: string;
  },
  existingEntity: null as null | { id: string },
  reportUpdates: [] as Array<Record<string, unknown>>,
  entityInserts: [] as Array<Record<string, unknown>>,
  entityUpdates: [] as Array<Record<string, unknown>>,
  auditInserts: [] as Array<Record<string, unknown>>,
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
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: hoisted.reportRow,
                error: hoisted.reportRow ? null : { message: "not found" },
              }),
            }),
          }),
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

      if (table === "admin_actions") {
        return {
          insert: async (row: Record<string, unknown>) => {
            hoisted.auditInserts.push(row);
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import { moderateReportCore } from "./admin.functions";

beforeEach(() => {
  hoisted.reportRow = {
    entity_hash: "hash-target",
    entity_type: "telegram",
    redacted_value: "@fake_support",
  };
  hoisted.existingEntity = null;
  hoisted.reportUpdates.length = 0;
  hoisted.entityInserts.length = 0;
  hoisted.entityUpdates.length = 0;
  hoisted.auditInserts.length = 0;
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
        display_mask: "@fake_support",
        moderation_status: "confirmed",
        risk_level: "high_risk",
        report_count: 1,
      },
    ]);
    expect(hoisted.entityUpdates).toHaveLength(0);
    expect(hoisted.auditInserts).toHaveLength(1);
  });

  it("updates an existing entity instead of inserting a duplicate", async () => {
    hoisted.existingEntity = { id: "entity-1" };

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
      },
    ]);
    expect(hoisted.auditInserts[0]).toMatchObject({
      admin_user_id: ADMIN_ID,
      action: "reject_report",
      target_type: "report",
      target_id: REPORT_ID,
      reason: "risk_level: suspicious",
    });
  });
});
