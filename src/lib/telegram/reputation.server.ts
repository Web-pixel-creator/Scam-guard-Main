import type { Lang } from "@/lib/i18n";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalize, maskForDisplay } from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";
import type { RiskLevel } from "@/lib/risk/rules";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { extractTelegramPublicTarget, type TelegramPublicTarget } from "./public-metadata.server";

export type TelegramReputationSource =
  | "system_observed"
  | "telegram_public"
  | "official"
  | "moderated_report"
  | "user_submitted_unverified";

export type TelegramReputationConfidence = "low" | "medium" | "high";

type TelegramReputationRow = {
  target_hash: string;
  target_type: string;
  display_hint: string;
  source_type: TelegramReputationSource;
  confidence: TelegramReputationConfidence;
  risk_level: RiskLevel;
  moderation_status: "new" | "reviewing" | "confirmed" | "rejected" | "duplicate";
  unverified_report_count: number;
  moderated_report_count: number;
  first_seen_at: string;
  last_seen_at: string;
};

type TelegramReportSyncInput = {
  entityHash: string;
  displayHint: string;
  riskLevel: RiskLevel;
};

export type TelegramReputationSyncStage =
  | "count_query"
  | "confirmed_count"
  | "unverified_count"
  | "upsert";

export class TelegramReputationSyncError extends Error {
  readonly code = "TELEGRAM_REPUTATION_SYNC_FAILED";

  constructor(readonly stage: TelegramReputationSyncStage) {
    super(`Telegram reputation synchronization failed at ${stage}`);
    this.name = "TelegramReputationSyncError";
  }
}

function reputationSyncFailure(stage: TelegramReputationSyncStage): TelegramReputationSyncError {
  console.error("telegram reputation moderation sync failed", stage);
  return new TelegramReputationSyncError(stage);
}

function exactReportCount(value: unknown, stage: TelegramReputationSyncStage): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw reputationSyncFailure(stage);
  }
  return value as number;
}

function normalizedTelegramTarget(input: string, target: TelegramPublicTarget): string | null {
  if (target.kind === "none") return null;
  if (target.kind === "private_invite") return `invite:${target.value.toLowerCase()}`;
  if (target.kind === "internal_or_private") return `internal:${target.value.toLowerCase()}`;
  return normalize(`@${target.username}`, "telegram").toLowerCase();
}

function targetTypeFromTarget(target: TelegramPublicTarget): string | null {
  if (target.kind === "public_username") return "public_username";
  if (target.kind === "private_invite") return "private_invite";
  if (target.kind === "internal_or_private") return "internal_or_private";
  return null;
}

function displayHintFromTarget(target: TelegramPublicTarget, normalized: string): string {
  if (target.kind === "public_username") return maskForDisplay(normalized, "telegram");
  if (target.kind === "private_invite") return "t.me/+****";
  if (target.kind === "internal_or_private") return "t.me/c/****";
  return "telegram target";
}

function sourceLabel(source: TelegramReputationSource, lang: Lang): string {
  const labels: Record<TelegramReputationSource, Record<Lang, string>> = {
    system_observed: {
      ru: "наблюдение Ishonch Guard",
      uz: "Ishonch Guard kuzatuvi",
      en: "Ishonch Guard observation",
    },
    telegram_public: {
      ru: "публичные данные Telegram",
      uz: "Telegram ochiq ma'lumoti",
      en: "Telegram public data",
    },
    official: {
      ru: "официальный источник",
      uz: "rasmiy manba",
      en: "official source",
    },
    moderated_report: {
      ru: "модерированные жалобы Ishonch Guard",
      uz: "Ishonch Guard tasdiqlangan shikoyatlari",
      en: "Ishonch Guard moderated reports",
    },
    user_submitted_unverified: {
      ru: "непроверенные пользовательские жалобы",
      uz: "tekshirilmagan foydalanuvchi shikoyatlari",
      en: "unverified user reports",
    },
  };
  return labels[source][lang];
}

function confidenceLabel(confidence: TelegramReputationConfidence, lang: Lang): string {
  const labels: Record<TelegramReputationConfidence, Record<Lang, string>> = {
    low: { ru: "низкая", uz: "past", en: "low" },
    medium: { ru: "средняя", uz: "o'rtacha", en: "medium" },
    high: { ru: "высокая", uz: "yuqori", en: "high" },
  };
  return labels[confidence][lang];
}

async function hashTarget(normalized: string): Promise<string> {
  return hashIdentifier(normalized);
}

async function getExistingReputation(targetHash: string): Promise<{
  moderation_status: TelegramReputationRow["moderation_status"];
  source_type: TelegramReputationSource;
  unverified_report_count: number;
} | null> {
  const { data, error } = await supabaseAdmin
    .from("telegram_reputation_targets")
    .select("moderation_status,source_type,unverified_report_count")
    .eq("target_hash", targetHash)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    moderation_status: TelegramReputationRow["moderation_status"];
    source_type: TelegramReputationSource;
    unverified_report_count: number;
  };
}

export async function observeTelegramReputationTarget(input: string): Promise<void> {
  const target = extractTelegramPublicTarget(input);
  const normalized = normalizedTelegramTarget(input, target);
  const targetType = targetTypeFromTarget(target);
  if (!normalized || !targetType) return;

  try {
    const targetHash = await hashTarget(normalized);
    const now = new Date().toISOString();
    const existing = await getExistingReputation(targetHash);
    if (existing) {
      await supabaseAdmin
        .from("telegram_reputation_targets")
        .update({
          last_seen_at: now,
          updated_at: now,
        })
        .eq("target_hash", targetHash);
      return;
    }

    await supabaseAdmin.from("telegram_reputation_targets").insert({
      target_hash: targetHash,
      target_type: targetType,
      display_hint: displayHintFromTarget(target, normalized),
      source_type: "system_observed",
      confidence: "low",
      last_seen_at: now,
      updated_at: now,
      metadata: {
        observed_by: "telegram_check",
        stores_raw_identifier: false,
      },
    });
  } catch {
    console.error("telegram reputation observation failed", "storage_exception");
  }
}

export async function registerTelegramReportCandidate(args: {
  entityHash: string;
  displayHint: string;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const existing = await getExistingReputation(args.entityHash);
    if (existing) {
      await supabaseAdmin
        .from("telegram_reputation_targets")
        .update({
          unverified_report_count: existing.unverified_report_count + 1,
          last_seen_at: now,
          updated_at: now,
        })
        .eq("target_hash", args.entityHash);
      return;
    }

    await supabaseAdmin.from("telegram_reputation_targets").insert({
      target_hash: args.entityHash,
      target_type: "public_username",
      display_hint: args.displayHint,
      source_type: "user_submitted_unverified",
      confidence: "low",
      moderation_status: "new",
      unverified_report_count: 1,
      last_seen_at: now,
      updated_at: now,
      metadata: {
        stores_raw_identifier: false,
        unverified_reports_affect_public_risk: false,
      },
    });
  } catch {
    console.error("telegram report reputation candidate failed", "storage_exception");
  }
}

export async function syncTelegramReputationAfterModeration(
  args: TelegramReportSyncInput,
): Promise<void> {
  let confirmed: { count: number | null; error: unknown };
  let unverified: { count: number | null; error: unknown };

  try {
    [confirmed, unverified] = await Promise.all([
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("entity_hash", args.entityHash)
        .eq("entity_type", "telegram")
        .eq("status", "confirmed"),
      supabaseAdmin
        .from("reports")
        .select("id", { count: "exact", head: true })
        .eq("entity_hash", args.entityHash)
        .eq("entity_type", "telegram")
        .in("status", ["new", "reviewing"]),
    ]);
  } catch {
    throw reputationSyncFailure("count_query");
  }

  if (confirmed.error) throw reputationSyncFailure("confirmed_count");
  if (unverified.error) throw reputationSyncFailure("unverified_count");

  const moderatedCount = exactReportCount(confirmed.count, "confirmed_count");
  const unverifiedCount = exactReportCount(unverified.count, "unverified_count");
  const hasModeratedReports = moderatedCount > 0;
  const now = new Date().toISOString();

  let upsertResult: { error: unknown };
  try {
    upsertResult = await supabaseAdmin.from("telegram_reputation_targets").upsert(
      {
        target_hash: args.entityHash,
        target_type: "public_username",
        display_hint: args.displayHint,
        source_type: hasModeratedReports ? "moderated_report" : "user_submitted_unverified",
        confidence: moderatedCount >= 2 ? "high" : hasModeratedReports ? "medium" : "low",
        moderation_status: hasModeratedReports ? "confirmed" : "new",
        risk_level: hasModeratedReports ? args.riskLevel : "unknown",
        moderated_report_count: moderatedCount,
        unverified_report_count: unverifiedCount,
        last_seen_at: now,
        updated_at: now,
        metadata: {
          stores_raw_identifier: false,
          source_counts_recomputed_at: now,
        },
      },
      { onConflict: "target_hash", ignoreDuplicates: false },
    );
  } catch {
    throw reputationSyncFailure("upsert");
  }

  if (upsertResult.error) throw reputationSyncFailure("upsert");
}

export async function getTelegramReputationForInput(
  input: string,
): Promise<TelegramReputationRow | null> {
  const target = extractTelegramPublicTarget(input);
  const normalized = normalizedTelegramTarget(input, target);
  if (!normalized) return null;

  try {
    const targetHash = await hashTarget(normalized);
    const { data, error } = await supabaseAdmin
      .from("telegram_reputation_targets")
      .select(
        "target_hash,target_type,display_hint,source_type,confidence,risk_level,moderation_status,unverified_report_count,moderated_report_count,first_seen_at,last_seen_at",
      )
      .eq("target_hash", targetHash)
      .maybeSingle();
    if (error || !data) return null;
    return data as TelegramReputationRow;
  } catch {
    console.error("telegram reputation lookup failed", "storage_exception");
    return null;
  }
}

export function buildTelegramReputationBrief(
  row: TelegramReputationRow | null,
  lang: Lang,
): string | null {
  if (!row) return null;
  if (row.moderation_status !== "confirmed" || row.moderated_report_count <= 0) return null;

  const source = sourceLabel(row.source_type, lang);
  const confidence = confidenceLabel(row.confidence, lang);

  if (lang === "uz") {
    return `Ishonch Guard manbasi: ${source}; ${row.moderated_report_count} ta tasdiqlangan shikoyat. Ishonch: ${confidence}. Bu Telegram ichki SCAM belgisi emas.`;
  }
  if (lang === "en") {
    return `Ishonch Guard source: ${source}; ${row.moderated_report_count} confirmed report(s). Confidence: ${confidence}. This is not a hidden Telegram SCAM label.`;
  }
  return `Источник Ishonch Guard: ${source}; подтверждённых жалоб: ${row.moderated_report_count}. Уверенность: ${confidence}. Это не скрытая метка SCAM от Telegram.`;
}

export async function enrichTelegramReputation(
  input: string,
  result: RunCheckResult,
  lang: Lang,
): Promise<RunCheckResult> {
  if (result.type !== "telegram") return result;

  await observeTelegramReputationTarget(input);
  const row = await getTelegramReputationForInput(input);
  const brief = buildTelegramReputationBrief(row, lang);
  if (!brief) return result;

  return {
    ...result,
    explanation: result.explanation ? `${brief}\n\n${result.explanation}` : brief,
  };
}
