import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publicRateLimitKey } from "@/lib/request-ip.server";
import {
  detectInputType,
  maskForDisplay,
  normalize,
  redactText,
  type InputType,
} from "@/lib/risk/detect";
import {
  hashIdentifierCandidates,
  hashIdentifierVersioned,
  type IdentifierHash,
} from "@/lib/risk/hash";
import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";
import { logServerError } from "@/lib/safe-server-log.server";
import { notifyModeration } from "@/lib/telegram/moderation-notifier.server";

const appealSchema = z.object({
  target: z.string().min(3).max(500),
  reason: z.string().min(10).max(2000),
  contact: z.string().max(160).optional(),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

type AppealInput = z.input<typeof appealSchema>;

type AppealResult =
  | { ok: true; duplicate?: boolean }
  | {
      ok: false;
      error: "unsupported_target" | "rate_limited" | "submit_failed";
      retryAfterSec?: number;
    };

const APPEAL_RATE_LIMIT = 3;
const APPEAL_RATE_WINDOW_MS = 10 * 60 * 1000;
const APPEAL_TARGET_TYPES = new Set<InputType>(["phone", "telegram", "url", "apk"]);
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function establishedHashReadOrder(candidates: IdentifierHash[]): IdentifierHash[] {
  return candidates.length > 1 ? [...candidates.slice(1), candidates[0]!] : candidates;
}

async function findStoredTargetHash(
  targetType: InputType,
  candidates: IdentifierHash[],
): Promise<IdentifierHash | null> {
  for (const candidate of establishedHashReadOrder(candidates)) {
    const { data, error } = await supabaseAdmin
      .from("entities")
      .select("entity_hash,entity_hash_version")
      .eq("entity_hash", candidate.hash)
      .maybeSingle();
    if (!error && data) {
      return {
        hash: data.entity_hash ?? candidate.hash,
        version: data.entity_hash_version ?? candidate.version,
      };
    }
  }

  if (targetType !== "telegram") return null;
  for (const candidate of establishedHashReadOrder(candidates)) {
    const { data, error } = await supabaseAdmin
      .from("telegram_reputation_targets")
      .select("target_hash,target_hash_version")
      .eq("target_hash", candidate.hash)
      .maybeSingle();
    if (!error && data) {
      return {
        hash: data.target_hash ?? candidate.hash,
        version: data.target_hash_version ?? candidate.version,
      };
    }
  }
  return null;
}

async function findOpenAppealHash(
  candidates: IdentifierHash[],
): Promise<(IdentifierHash & { id: string }) | null> {
  for (const candidate of establishedHashReadOrder(candidates)) {
    const { data, error } = await supabaseAdmin
      .from("reputation_appeals")
      .select("id,target_hash,target_hash_version")
      .eq("target_hash", candidate.hash)
      .in("status", ["new", "reviewing"])
      .limit(1);
    const row = data?.[0];
    if (!error && row) {
      return {
        id: row.id,
        hash: row.target_hash ?? candidate.hash,
        version: row.target_hash_version ?? candidate.version,
      };
    }
  }
  return null;
}

function maskEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split("@");
  if (!local || !domain) return "[email]";
  const prefix = local.slice(0, 1);
  return `${prefix}${"*".repeat(Math.min(5, Math.max(2, local.length - 1)))}@${domain}`;
}

function redactAppealText(value: string): string {
  return redactText(value).replace(EMAIL_RE, (email) => maskEmail(email));
}

function normalizeContact(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const type = detectInputType(trimmed);
  if (["phone", "telegram", "url", "apk"].includes(type)) {
    return normalize(trimmed, type).toLowerCase();
  }
  return trimmed;
}

function maskContact(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  EMAIL_RE.lastIndex = 0;
  if (EMAIL_RE.test(trimmed)) {
    EMAIL_RE.lastIndex = 0;
    return trimmed.replace(EMAIL_RE, (email) => maskEmail(email));
  }

  const type = detectInputType(trimmed);
  if (["phone", "telegram", "url", "apk"].includes(type)) {
    const normalized = normalize(trimmed, type);
    const display = maskForDisplay(normalized, type);
    return display === trimmed ? redactAppealText(trimmed).slice(0, 120) : display;
  }
  return redactAppealText(trimmed).slice(0, 120);
}

function detectAppealTargetType(raw: string): InputType {
  return detectInputType(raw.trim());
}

export async function submitReputationAppealCore(
  data: AppealInput,
  rateLimitKey: string,
): Promise<AppealResult> {
  const appeal = appealSchema.parse(data);
  const rl = await checkSharedRateLimit(
    "appeal",
    rateLimitKey,
    APPEAL_RATE_LIMIT,
    APPEAL_RATE_WINDOW_MS,
  );
  if (!rl.ok) return { ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec };

  const targetType = detectAppealTargetType(appeal.target);
  if (!APPEAL_TARGET_TYPES.has(targetType)) {
    return { ok: false, error: "unsupported_target" };
  }

  const normalizedTarget = normalize(appeal.target, targetType);
  const targetHashes = await hashIdentifierCandidates(normalizedTarget);
  const activeTargetHash = targetHashes[0];
  if (!activeTargetHash) return { ok: false, error: "submit_failed" };
  const targetDisplay = maskForDisplay(normalizedTarget, targetType);
  const reason = redactAppealText(appeal.reason.trim());
  const contact = appeal.contact?.trim();
  const contactHash = contact
    ? await hashIdentifierVersioned(`appeal-contact:${normalizeContact(contact)}`)
    : null;
  const contactDisplay = contact ? maskContact(contact) : null;

  const [storedTargetHash, existingAppeal] = await Promise.all([
    findStoredTargetHash(targetType, targetHashes),
    findOpenAppealHash(targetHashes),
  ]);
  const canonicalTargetHash = existingAppeal ?? storedTargetHash ?? activeTargetHash;
  const duplicate = existingAppeal !== null;

  const { error } = await supabaseAdmin.from("reputation_appeals").insert({
    target_type: targetType,
    target_hash: canonicalTargetHash.hash,
    target_hash_version: canonicalTargetHash.version,
    target_display: targetDisplay,
    reason,
    contact_hash: contactHash?.hash ?? null,
    contact_hash_version: contactHash?.version ?? null,
    contact_display: contactDisplay,
  });

  if (error) {
    logServerError("reputation_appeal.insert_failed", error);
    return { ok: false, error: "submit_failed" };
  }
  void notifyModeration({
    kind: "appeal",
    targetType,
    targetDisplay,
    language: appeal.lang,
  });
  return duplicate ? { ok: true, duplicate: true } : { ok: true };
}

export const submitReputationAppeal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => appealSchema.parse(d))
  .handler(async ({ data }) => submitReputationAppealCore(data, publicRateLimitKey("appeal")));
