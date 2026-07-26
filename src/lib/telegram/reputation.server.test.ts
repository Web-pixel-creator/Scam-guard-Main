import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";

const hoisted = vi.hoisted(() => ({
  upserts: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  rowsByHash: new Map<string, Record<string, unknown>>(),
  existingRow: null as null | Record<string, unknown>,
  reputationRow: null as null | Record<string, unknown>,
  confirmedCount: 0 as number | null,
  unverifiedCount: 0 as number | null,
  confirmedError: null as null | { message: string },
  unverifiedError: null as null | { message: string },
  upsertError: null as null | { message: string },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "telegram_reputation_targets") {
        return {
          insert: async (row: Record<string, unknown>) => {
            hoisted.inserts.push(row);
            return { data: null, error: null };
          },
          upsert: async (row: Record<string, unknown>) => {
            hoisted.upserts.push(row);
            return { data: null, error: hoisted.upsertError };
          },
          update: (row: Record<string, unknown>) => ({
            eq: async () => {
              hoisted.updates.push(row);
              return { data: null, error: null };
            },
          }),
          select: () => ({
            eq: (_column: string, hash: string) => ({
              maybeSingle: async () => ({
                data: hoisted.rowsByHash.get(hash) ?? hoisted.existingRow ?? hoisted.reputationRow,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "reports") {
        const chain = {
          eq: (_column: string, value: string) => {
            if (value === "confirmed") {
              return Promise.resolve({
                count: hoisted.confirmedCount,
                error: hoisted.confirmedError,
              });
            }
            return chain;
          },
          in: () =>
            Promise.resolve({ count: hoisted.unverifiedCount, error: hoisted.unverifiedError }),
        };
        return {
          select: () => chain,
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

import {
  buildTelegramReputationBrief,
  enrichTelegramReputation,
  getTelegramReputationForInput,
  registerTelegramReportCandidate,
  syncTelegramReputationAfterModeration,
} from "./reputation.server";
import { hashIdentifierCandidates } from "@/lib/risk/hash";

function baseResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "telegram",
    display: "@fa•••rt",
    level: "unknown",
    score: 5,
    reasons: ["unknown_sender"],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("HASH_PEPPER_SECRET", "stable-test-pepper");
  hoisted.upserts.length = 0;
  hoisted.inserts.length = 0;
  hoisted.updates.length = 0;
  hoisted.rowsByHash.clear();
  hoisted.existingRow = null;
  hoisted.reputationRow = null;
  hoisted.confirmedCount = 0;
  hoisted.unverifiedCount = 0;
  hoisted.confirmedError = null;
  hoisted.unverifiedError = null;
  hoisted.upsertError = null;
});

describe("telegram reputation", () => {
  it("does not render unmoderated report counts as public accusations", () => {
    const text = buildTelegramReputationBrief(
      {
        target_hash: "hash",
        target_type: "public_username",
        display_hint: "@fa•••rt",
        source_type: "user_submitted_unverified",
        confidence: "low",
        risk_level: "suspicious",
        moderation_status: "new",
        unverified_report_count: 3,
        moderated_report_count: 0,
        first_seen_at: new Date(0).toISOString(),
        last_seen_at: new Date(0).toISOString(),
      },
      "ru",
    );

    expect(text).toBeNull();
  });

  it("renders only moderated Ishonch Guard reports with source and confidence", () => {
    const text = buildTelegramReputationBrief(
      {
        target_hash: "hash",
        target_type: "public_username",
        display_hint: "@fa•••rt",
        source_type: "moderated_report",
        confidence: "medium",
        risk_level: "high_risk",
        moderation_status: "confirmed",
        unverified_report_count: 0,
        moderated_report_count: 1,
        first_seen_at: new Date(0).toISOString(),
        last_seen_at: new Date(0).toISOString(),
      },
      "ru",
    );

    expect(text).toContain("модерированные жалобы Ishonch Guard");
    expect(text).toContain("подтверждённых жалоб: 1");
    expect(text).toContain("Уверенность: средняя");
    expect(text).toContain("не скрытая метка SCAM от Telegram");
  });

  it("observes a checked Telegram target and prepends confirmed reputation", async () => {
    hoisted.reputationRow = {
      target_hash: "hash",
      target_type: "public_username",
      display_hint: "@fa•••rt",
      source_type: "moderated_report",
      confidence: "high",
      risk_level: "high_risk",
      moderation_status: "confirmed",
      unverified_report_count: 0,
      moderated_report_count: 2,
      first_seen_at: new Date(0).toISOString(),
      last_seen_at: new Date(0).toISOString(),
    };

    const result = await enrichTelegramReputation("@fake_support", baseResult(), "ru");

    expect(hoisted.updates[0]).toMatchObject({
      last_seen_at: expect.any(String),
      updated_at: expect.any(String),
    });
    expect(hoisted.updates[0]).not.toHaveProperty("source_type");
    expect(hoisted.updates[0]).not.toHaveProperty("moderation_status");
    expect(hoisted.updates[0]).not.toHaveProperty("metadata");
    expect(hoisted.inserts).toHaveLength(0);
    expect(hoisted.upserts).toHaveLength(0);
    expect(result.explanation).toContain("подтверждённых жалоб: 2");
    expect(result.explanation).toContain("не скрытая метка SCAM от Telegram");
  });

  it("observes a new checked Telegram target without storing the raw username", async () => {
    await enrichTelegramReputation("@fake_support", baseResult(), "ru");

    expect(hoisted.inserts[0]).toMatchObject({
      target_type: "public_username",
      display_hint: "@fa•••rt",
      source_type: "system_observed",
    });
    expect(JSON.stringify(hoisted.inserts[0])).not.toContain("fake_support");
  });

  it("keeps confirmed legacy reputation visible after the active pepper changes", async () => {
    vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", "v2");
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "telegram-reputation-active-v2-pepper");
    const [active, previous] = await hashIdentifierCandidates("@fake_support");
    expect(active?.version).toBe("v2");
    expect(previous?.version).toBe("legacy");
    if (!previous) throw new Error("expected previous Telegram reputation hash");

    hoisted.rowsByHash.set(previous.hash, {
      target_hash: previous.hash,
      target_hash_version: previous.version,
      target_type: "public_username",
      display_hint: "@faвЂўвЂўвЂўrt",
      source_type: "moderated_report",
      confidence: "high",
      risk_level: "high_risk",
      moderation_status: "confirmed",
      unverified_report_count: 0,
      moderated_report_count: 2,
      first_seen_at: new Date(0).toISOString(),
      last_seen_at: new Date(0).toISOString(),
    });

    await expect(getTelegramReputationForInput("@fake_support")).resolves.toMatchObject({
      target_hash: previous.hash,
      target_hash_version: "legacy",
      moderation_status: "confirmed",
    });
  });

  it("stores user-submitted Telegram reports as unverified candidates", async () => {
    await registerTelegramReportCandidate({
      entityHash: "hash-target",
      displayHint: "@fa•••rt",
    });

    expect(hoisted.inserts).toHaveLength(1);
    expect(hoisted.inserts[0]).toMatchObject({
      target_hash: "hash-target",
      target_type: "public_username",
      display_hint: "@fa•••rt",
      source_type: "user_submitted_unverified",
      confidence: "low",
      moderation_status: "new",
      unverified_report_count: 1,
    });
  });

  it("does not downgrade a confirmed reputation row when another unverified report arrives", async () => {
    hoisted.existingRow = {
      moderation_status: "confirmed",
      source_type: "moderated_report",
      unverified_report_count: 2,
    };

    await registerTelegramReportCandidate({
      entityHash: "hash-target",
      displayHint: "@fa•••rt",
    });

    expect(hoisted.inserts).toHaveLength(0);
    expect(hoisted.upserts).toHaveLength(0);
    expect(hoisted.updates[0]).toMatchObject({
      unverified_report_count: 3,
    });
    expect(hoisted.updates[0]).not.toHaveProperty("source_type");
    expect(hoisted.updates[0]).not.toHaveProperty("moderation_status");
    expect(hoisted.updates[0]).not.toHaveProperty("metadata");
  });

  it("recomputes moderated report counts after moderation", async () => {
    hoisted.confirmedCount = 2;
    hoisted.unverifiedCount = 1;

    await syncTelegramReputationAfterModeration({
      entityHash: "hash-target",
      displayHint: "@fa•••rt",
      riskLevel: "high_risk",
    });

    expect(hoisted.upserts).toHaveLength(1);
    expect(hoisted.upserts[0]).toMatchObject({
      target_hash: "hash-target",
      source_type: "moderated_report",
      confidence: "high",
      moderation_status: "confirmed",
      risk_level: "high_risk",
      moderated_report_count: 2,
      unverified_report_count: 1,
    });
  });

  it.each([
    ["confirmed count", "confirmedError"],
    ["unverified count", "unverifiedError"],
  ] as const)("fails closed when the %s query fails", async (_label, errorKey) => {
    hoisted[errorKey] = { message: "database unavailable" };

    await expect(
      syncTelegramReputationAfterModeration({
        entityHash: "hash-target",
        displayHint: "@fa•••rt",
        riskLevel: "high_risk",
      }),
    ).rejects.toThrow("Telegram reputation synchronization failed");

    expect(hoisted.upserts).toHaveLength(0);
  });

  it("rejects a missing exact count instead of treating it as zero", async () => {
    hoisted.confirmedCount = null;

    await expect(
      syncTelegramReputationAfterModeration({
        entityHash: "hash-target",
        displayHint: "@fa•••rt",
        riskLevel: "high_risk",
      }),
    ).rejects.toThrow("Telegram reputation synchronization failed");

    expect(hoisted.upserts).toHaveLength(0);
  });

  it("propagates the aggregate upsert failure instead of reporting success", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    hoisted.confirmedCount = 1;
    hoisted.upsertError = { message: "write unavailable for hash-target" };

    await expect(
      syncTelegramReputationAfterModeration({
        entityHash: "hash-target",
        displayHint: "@fa•••rt",
        riskLevel: "high_risk",
      }),
    ).rejects.toThrow("Telegram reputation synchronization failed");

    expect(errorLog).toHaveBeenCalledWith("telegram reputation moderation sync failed", "upsert");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("hash-target");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("write unavailable");
    errorLog.mockRestore();
  });
});
