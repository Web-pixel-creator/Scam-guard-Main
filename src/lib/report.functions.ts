import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INCIDENT_ONLY_HASH_PREFIX, INCIDENT_ONLY_REDACTED_VALUE } from "@/lib/report-boundary";
import { publicRateLimitKey } from "@/lib/request-ip.server";
import { logServerError } from "@/lib/safe-server-log.server";
import {
  detectInputType,
  normalize,
  maskForDisplay,
  redactText,
  type InputType,
} from "./risk/detect";
import { hashIdentifierCandidates, type IdentifierHash } from "./risk/hash";
import { checkRateLimit } from "./risk/rate-limit";
import { checkSharedRateLimit } from "./risk/shared-rate-limit.server";
import { registerTelegramReportCandidate } from "@/lib/telegram/reputation.server";
import { notifyModeration } from "@/lib/telegram/moderation-notifier.server";

const REPORT_INPUT_TYPES = [
  "phone",
  "telegram",
  "url",
  "text",
  "payment",
  "apk",
  "unknown",
] as const;

const reportSchema = z.object({
  value: z.string().min(1).max(500),
  type: z.enum(REPORT_INPUT_TYPES).optional(),
  description: z.string().min(5).max(5000),
  scamType: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  amountLostUzs: z.number().int().nonnegative().max(10_000_000_000).optional(),
  incidentOnly: z.boolean().default(false),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

type ReportInput = z.input<typeof reportSchema>;
type SubmitReportResult = { ok: true } | { ok: false; error: string; retryAfterSec?: number };

export interface PreparedReportTarget {
  type: InputType;
  hash: string;
  hashVersion?: string;
  hashCandidates?: IdentifierHash[];
  display: string;
  incidentOnly: boolean;
}

export interface PreparedReportInput {
  target: PreparedReportTarget;
  description: string;
  scamType?: string;
  city?: string;
  amountLostUzs?: number;
  lang: "ru" | "uz" | "en";
}

/** Rate limit: 3 reports / 10 minutes per IP. Prevents report spam/flooding. */
const REPORT_RATE_LIMIT = 3;
const REPORT_RATE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Rate-limit key for Telegram report submissions. Called by the bot handler
 * which passes the user ID directly (no HTTP context available).
 */
export function reportRateLimitKeyForTelegram(userId: number): string {
  return `report:tg:${userId}`;
}

export async function prepareReportIdentifier(value: string): Promise<PreparedReportTarget> {
  const detected = detectInputType(value);
  const normalized = normalize(value, detected);
  const hashCandidates = await hashIdentifierCandidates(normalized);
  const activeHash = hashCandidates[0];
  if (!activeHash) throw new Error("Active hash pepper configuration is unavailable");
  return {
    type: detected,
    hash: activeHash.hash,
    hashVersion: activeHash.version,
    hashCandidates,
    display: maskForDisplay(normalized, detected),
    incidentOnly: false,
  };
}

export async function prepareIncidentOnlyReportTarget(
  description: string,
): Promise<PreparedReportTarget> {
  const redactedDescription = redactText(description);
  const normalized = `${INCIDENT_ONLY_HASH_PREFIX}${redactedDescription}`;
  const hashCandidates = await hashIdentifierCandidates(normalized);
  const activeHash = hashCandidates[0];
  if (!activeHash) throw new Error("Active hash pepper configuration is unavailable");
  return {
    type: "text",
    hash: activeHash.hash,
    hashVersion: activeHash.version,
    hashCandidates,
    display: INCIDENT_ONLY_REDACTED_VALUE,
    incidentOnly: true,
  };
}

function reportTargetHashCandidates(target: PreparedReportTarget): IdentifierHash[] {
  const candidates =
    target.hashCandidates && target.hashCandidates.length > 0
      ? target.hashCandidates
      : [{ hash: target.hash, version: target.hashVersion ?? "legacy" }];
  const unique = new Map<string, IdentifierHash>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.hash)) unique.set(candidate.hash, candidate);
  }
  if (!unique.has(target.hash)) {
    unique.set(target.hash, { hash: target.hash, version: target.hashVersion ?? "legacy" });
  }
  return [...unique.values()];
}

function establishedHashReadOrder(candidates: IdentifierHash[]): IdentifierHash[] {
  return candidates.length > 1 ? [...candidates.slice(1), candidates[0]!] : candidates;
}

async function findExistingReportHash(
  candidates: IdentifierHash[],
  today: string,
): Promise<(IdentifierHash & { id: string }) | null> {
  for (const candidate of establishedHashReadOrder(candidates)) {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("id,entity_hash,entity_hash_version")
      .eq("entity_hash", candidate.hash)
      .gte("created_at", `${today}T00:00:00Z`)
      .limit(1);
    const row = data?.[0];
    if (!error && row) {
      return {
        id: row.id,
        hash: row.entity_hash ?? candidate.hash,
        version: row.entity_hash_version ?? candidate.version,
      };
    }
  }
  return null;
}

async function findExistingEntityHash(
  candidates: IdentifierHash[],
): Promise<(IdentifierHash & { id: string }) | null> {
  for (const candidate of establishedHashReadOrder(candidates)) {
    const { data, error } = await supabaseAdmin
      .from("entities")
      .select("id,entity_hash,entity_hash_version")
      .eq("entity_hash", candidate.hash)
      .maybeSingle();
    if (!error && data) {
      return {
        id: data.id,
        hash: data.entity_hash ?? candidate.hash,
        version: data.entity_hash_version ?? candidate.version,
      };
    }
  }
  return null;
}

function isIncidentOnlyReportValue(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length === 0 ||
    trimmed === INCIDENT_ONLY_REDACTED_VALUE ||
    /^[\u2012\u2013\u2014\u2015-]+$/.test(trimmed)
  );
}

async function enforceReportRateLimit(rateLimitKey: string): Promise<SubmitReportResult | null> {
  const rl = await checkSharedRateLimit(
    "report",
    rateLimitKey,
    REPORT_RATE_LIMIT,
    REPORT_RATE_WINDOW_MS,
  );
  if (!rl.ok) {
    return { ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec };
  }
  return null;
}

async function insertPreparedReport(report: PreparedReportInput): Promise<SubmitReportResult> {
  const description = redactText(report.description);
  const scamType = report.scamType ? redactText(report.scamType).slice(0, 80) : null;
  const city = report.city ? redactText(report.city).slice(0, 80) : null;
  const { target } = report;
  const hashCandidates = reportTargetHashCandidates(target);
  const activeHash = hashCandidates[0] ?? {
    hash: target.hash,
    version: target.hashVersion ?? "legacy",
  };

  // Report abuse protection: dedupe by hash + today. Same entity_hash on the
  // same day is kept as duplicate evidence for moderation, but it must not
  // refresh public entity state or inflate confirmed report counts.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const existingReport = await findExistingReportHash(hashCandidates, today);
  const existingEntity = target.incidentOnly ? null : await findExistingEntityHash(hashCandidates);
  const canonicalHash = existingReport ?? existingEntity ?? activeHash;

  if (existingReport) {
    const { error: duplicateError } = await supabaseAdmin.from("reports").insert({
      entity_type: target.type,
      entity_hash: canonicalHash.hash,
      entity_hash_version: canonicalHash.version,
      redacted_value: target.display,
      description,
      scam_type: scamType,
      city,
      amount_lost_uzs: report.amountLostUzs ?? null,
      status: "duplicate",
      language: report.lang,
    });

    if (duplicateError) {
      logServerError("reports.duplicate_evidence_insert_failed", duplicateError);
      return { ok: false, error: "submit_failed" };
    }

    // Silently accept (don't reveal dedup to potential abuser) and alert review.
    void notifyModeration({
      kind: "report",
      entityType: target.type,
      redactedValue: target.display,
      scamType,
      city,
      amountLostUzs: report.amountLostUzs ?? null,
      language: report.lang,
      incidentOnly: target.incidentOnly,
      duplicateOfExisting: true,
    });
    return { ok: true };
  }

  const { error } = await supabaseAdmin.from("reports").insert({
    entity_type: target.type,
    entity_hash: canonicalHash.hash,
    entity_hash_version: canonicalHash.version,
    redacted_value: target.display,
    description,
    scam_type: scamType,
    city,
    amount_lost_uzs: report.amountLostUzs ?? null,
    language: report.lang,
  });

  if (error) {
    logServerError("reports.insert_failed", error);
    return { ok: false, error: "submit_failed" };
  }

  void notifyModeration({
    kind: "report",
    entityType: target.type,
    redactedValue: target.display,
    scamType,
    city,
    amountLostUzs: report.amountLostUzs ?? null,
    language: report.lang,
    incidentOnly: target.incidentOnly,
  });

  if (target.incidentOnly) {
    return { ok: true };
  }

  if (target.type === "telegram") {
    await registerTelegramReportCandidate({
      entityHash: canonicalHash.hash,
      hashVersion: canonicalHash.version,
      displayHint: target.display,
    });
  }

  // Create or refresh a moderation candidate. Public report_count is updated
  // only after moderator confirmation in moderateReportCore.
  try {
    if (existingEntity) {
      await supabaseAdmin
        .from("entities")
        .update({
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existingEntity.id);
    } else {
      await supabaseAdmin.from("entities").insert({
        entity_type: target.type,
        entity_hash: canonicalHash.hash,
        entity_hash_version: canonicalHash.version,
        display_mask: target.display,
        risk_level: "suspicious",
        report_count: 0,
        moderation_status: "new",
      });
    }
  } catch (e) {
    logServerError("reports.entity_upsert_failed", e);
  }

  return { ok: true };
}

export async function submitPreparedReportCore(
  data: PreparedReportInput,
  rateLimitKey: string,
): Promise<SubmitReportResult> {
  const rateLimit = await enforceReportRateLimit(rateLimitKey);
  if (rateLimit) return rateLimit;
  return insertPreparedReport(data);
}

export async function submitReportCore(
  data: ReportInput,
  rateLimitKey: string,
): Promise<SubmitReportResult> {
  const report = reportSchema.parse(data);
  const rateLimit = await enforceReportRateLimit(rateLimitKey);
  if (rateLimit) return rateLimit;

  const description = redactText(report.description);
  const target =
    report.incidentOnly === true || isIncidentOnlyReportValue(report.value)
      ? await prepareIncidentOnlyReportTarget(description)
      : await prepareReportIdentifier(report.value);

  return insertPreparedReport({
    target,
    description,
    scamType: report.scamType,
    city: report.city,
    amountLostUzs: report.amountLostUzs,
    lang: report.lang,
  });
}

export const submitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data }) => {
    return submitReportCore(data, publicRateLimitKey("report"));
  });

/**
 * Check report rate limit for a Telegram user (called by the bot handler).
 * Returns { ok, retryAfterSec } — the handler shows a rate-limit message if !ok.
 */
export function checkReportRateLimit(userId: number): {
  ok: boolean;
  retryAfterSec: number;
} {
  const key = reportRateLimitKeyForTelegram(userId);
  const result = checkRateLimit(key, REPORT_RATE_LIMIT, REPORT_RATE_WINDOW_MS);
  return { ok: result.ok, retryAfterSec: result.retryAfterSec };
}
