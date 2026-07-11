import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DEFAULT_UPDATE_LEASE_SECONDS = 120;
const DEFAULT_LEADER_LEASE_SECONDS = 60;

export interface TelegramUpdateLeaderLease {
  leaseToken: string;
  fence: number;
  leaseExpiresAt: string;
}

export interface TelegramUpdateLeaderStatus {
  active: boolean;
  fence: number;
  leaseExpiresAt: string | null;
}

export interface TelegramUpdateLease {
  updateId: number;
  leaseToken: string;
  processingFence: number;
  leaseExpiresAt: string;
  leaderToken?: string;
  leaderFence?: number;
}

export type BeginTelegramUpdateResult =
  | { decision: "acquired"; lease: TelegramUpdateLease; attemptCount: number }
  | { decision: "completed" }
  | { decision: "busy" | "unavailable"; retryAfterSec: number };

export type TelegramUpdateFailureStage =
  | "dispatch"
  | "completion"
  | "heartbeat"
  | "session"
  | "leader_lost";

function lifecycleRpc(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function firstRow(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function retryDelay(value: unknown): number {
  return Math.min(600, Math.max(1, positiveInteger(value) ?? 1));
}

function leaderArgs(leader?: TelegramUpdateLeaderLease): Record<string, unknown> {
  return {
    p_leader_token: leader?.leaseToken ?? null,
    p_leader_fence: leader?.fence ?? null,
  };
}

function updateArgs(lease: TelegramUpdateLease): Record<string, unknown> {
  return {
    p_update_id: lease.updateId,
    p_lease_token: lease.leaseToken,
    p_processing_fence: lease.processingFence,
    p_leader_token: lease.leaderToken ?? null,
    p_leader_fence: lease.leaderFence ?? null,
  };
}

export async function acquireTelegramUpdateLeader(
  leaseSeconds = DEFAULT_LEADER_LEASE_SECONDS,
): Promise<TelegramUpdateLeaderLease | null> {
  const leaseToken = randomUUID();
  try {
    const { data, error } = await lifecycleRpc().rpc("acquire_telegram_update_leader", {
      p_lease_token: leaseToken,
      p_lease_seconds: leaseSeconds,
    });
    if (error) throw error;
    const row = firstRow(data);
    const fence = positiveInteger(row?.fence);
    const leaseExpiresAt = row?.lease_expires_at;
    if (row?.acquired !== true || fence === null || typeof leaseExpiresAt !== "string") return null;
    return { leaseToken, fence, leaseExpiresAt };
  } catch {
    console.error("telegram update lifecycle unavailable", "acquire_leader");
    return null;
  }
}

export async function renewTelegramUpdateLeader(
  leader: TelegramUpdateLeaderLease,
  leaseSeconds = DEFAULT_LEADER_LEASE_SECONDS,
): Promise<boolean> {
  try {
    const { data, error } = await lifecycleRpc().rpc("renew_telegram_update_leader", {
      p_lease_token: leader.leaseToken,
      p_fence: leader.fence,
      p_lease_seconds: leaseSeconds,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function releaseTelegramUpdateLeader(
  leader: TelegramUpdateLeaderLease,
): Promise<boolean> {
  try {
    const { data, error } = await lifecycleRpc().rpc("release_telegram_update_leader", {
      p_lease_token: leader.leaseToken,
      p_fence: leader.fence,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function getTelegramUpdateLeaderStatus(): Promise<TelegramUpdateLeaderStatus | null> {
  try {
    const { data, error } = await lifecycleRpc().rpc("telegram_update_leader_status");
    if (error) throw error;
    const row = firstRow(data);
    const fence = row?.fence;
    const leaseExpiresAt = row?.lease_expires_at;
    if (
      typeof row?.active !== "boolean" ||
      typeof fence !== "number" ||
      !Number.isSafeInteger(fence) ||
      fence < 0 ||
      (leaseExpiresAt !== null && typeof leaseExpiresAt !== "string")
    ) {
      throw new Error("invalid_leader_status");
    }
    return { active: row.active, fence, leaseExpiresAt };
  } catch {
    console.error("telegram update lifecycle unavailable", "leader_status");
    return null;
  }
}

export async function beginTelegramUpdate(
  updateId: number,
  leader?: TelegramUpdateLeaderLease,
  leaseSeconds = DEFAULT_UPDATE_LEASE_SECONDS,
): Promise<BeginTelegramUpdateResult> {
  if (!Number.isSafeInteger(updateId) || updateId < 0) {
    return { decision: "unavailable", retryAfterSec: 1 };
  }
  const leaseToken = randomUUID();
  try {
    const { data, error } = await lifecycleRpc().rpc("begin_telegram_update", {
      p_update_id: updateId,
      p_lease_token: leaseToken,
      p_lease_seconds: leaseSeconds,
      ...leaderArgs(leader),
    });
    if (error) throw error;
    const row = firstRow(data);
    if (row?.decision === "completed") return { decision: "completed" };
    if (row?.decision === "busy" || row?.decision === "unavailable") {
      return { decision: row.decision, retryAfterSec: retryDelay(row.retry_after_sec) };
    }
    const processingFence = positiveInteger(row?.processing_fence);
    const attemptCount = positiveInteger(row?.attempt_count);
    const leaseExpiresAt = row?.lease_expires_at;
    if (
      row?.decision !== "acquired" ||
      processingFence === null ||
      attemptCount === null ||
      typeof leaseExpiresAt !== "string"
    ) {
      throw new Error("invalid_begin_result");
    }
    return {
      decision: "acquired",
      attemptCount,
      lease: {
        updateId,
        leaseToken,
        processingFence,
        leaseExpiresAt,
        ...(leader ? { leaderToken: leader.leaseToken, leaderFence: leader.fence } : {}),
      },
    };
  } catch {
    console.error("telegram update lifecycle unavailable", "begin");
    return { decision: "unavailable", retryAfterSec: 1 };
  }
}

export async function renewTelegramUpdateLease(
  lease: TelegramUpdateLease,
  leaseSeconds = DEFAULT_UPDATE_LEASE_SECONDS,
): Promise<boolean> {
  try {
    const { data, error } = await lifecycleRpc().rpc("renew_telegram_update", {
      ...updateArgs(lease),
      p_lease_seconds: leaseSeconds,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function completeTelegramUpdate(lease: TelegramUpdateLease): Promise<boolean> {
  try {
    const { data, error } = await lifecycleRpc().rpc("complete_telegram_update", updateArgs(lease));
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function markTelegramUpdateFailure(
  lease: TelegramUpdateLease,
  stage: TelegramUpdateFailureStage,
): Promise<boolean> {
  try {
    const { data, error } = await lifecycleRpc().rpc("mark_telegram_update_failure", {
      ...updateArgs(lease),
      p_stage: stage,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function isTelegramUpdateLeaseCurrent(lease: TelegramUpdateLease): Promise<boolean> {
  try {
    const { data, error } = await lifecycleRpc().rpc(
      "telegram_update_lease_current",
      updateArgs(lease),
    );
    return !error && data === true;
  } catch {
    return false;
  }
}
