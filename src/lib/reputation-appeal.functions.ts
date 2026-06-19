import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  detectInputType,
  maskForDisplay,
  normalize,
  redactText,
  type InputType,
} from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";
import { checkSharedRateLimit } from "@/lib/risk/shared-rate-limit.server";
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

function appealRateLimitKey(): string {
  try {
    const ip =
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-real-ip") ||
      getRequestIP({ xForwardedFor: true }) ||
      "unknown";
    return `appeal:${ip}`;
  } catch {
    return "appeal:unknown";
  }
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
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
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
    return maskForDisplay(normalize(trimmed, type), type);
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
  const targetHash = await hashIdentifier(normalizedTarget);
  const targetDisplay = maskForDisplay(normalizedTarget, targetType);
  const reason = redactAppealText(appeal.reason.trim());
  const contact = appeal.contact?.trim();
  const contactHash = contact
    ? await hashIdentifier(`appeal-contact:${normalizeContact(contact)}`)
    : null;
  const contactDisplay = contact ? maskContact(contact) : null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("reputation_appeals")
    .select("id")
    .eq("target_hash", targetHash)
    .in("status", ["new", "reviewing"])
    .limit(1);

  if (existingError) {
    console.error("appeal dedupe lookup failed", existingError.message);
  }
  if (existing && existing.length > 0) {
    return { ok: true, duplicate: true };
  }

  const { error } = await supabaseAdmin.from("reputation_appeals").insert({
    target_type: targetType,
    target_hash: targetHash,
    target_display: targetDisplay,
    reason,
    contact_hash: contactHash,
    contact_display: contactDisplay,
  });

  if (error) {
    console.error("submit reputation appeal failed", error.message);
    return { ok: false, error: "submit_failed" };
  }
  void notifyModeration({
    kind: "appeal",
    targetType,
    targetDisplay,
    language: appeal.lang,
  });
  return { ok: true };
}

export const submitReputationAppeal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => appealSchema.parse(d))
  .handler(async ({ data }) => submitReputationAppealCore(data, appealRateLimitKey()));
