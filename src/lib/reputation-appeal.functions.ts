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
import { hashIdentifierCandidates } from "@/lib/risk/hash";
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
  | { ok: true }
  | {
      ok: false;
      error: "unsupported_target" | "rate_limited" | "submit_failed";
      retryAfterSec?: number;
    };

const APPEAL_RATE_LIMIT = 3;
const APPEAL_RATE_WINDOW_MS = 10 * 60 * 1000;
const APPEAL_TARGET_TYPES = new Set<InputType>(["phone", "telegram", "url", "apk"]);
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const appealSubmissionResult = z
  .array(z.object({ accepted: z.literal(true), notify_moderation: z.boolean() }).strict())
  .length(1);

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
    // A contact can mix an email with a password/OTP/link. Masking only the
    // email must not bypass the shared secret redaction for the rest.
    return redactAppealText(trimmed);
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
  const targetDisplay = maskForDisplay(normalizedTarget, targetType);
  const reason = redactAppealText(appeal.reason.trim());
  const contact = appeal.contact?.trim();
  // Email masking can expand a short local part. Only the display is clipped;
  // contact identity is hashed in full, before any display transformation.
  const contactDisplay = contact ? maskContact(contact).slice(0, 160) : null;

  let notify = false;
  try {
    const targetHashes = await hashIdentifierCandidates(normalizedTarget);
    const contactHashes = contact
      ? await hashIdentifierCandidates(`appeal-contact:${normalizeContact(contact)}`)
      : [];
    if (!targetHashes.length || (contact && !contactHashes.length)) {
      throw new Error("Appeal hash configuration unavailable");
    }
    // One fixed application round trip, regardless of stored target/appeal
    // state. The RPC serializes writers and preserves distinct evidence.
    // It is not a constant-time endpoint or a durable notification outbox.
    const { data: result, error } = await supabaseAdmin.rpc("submit_reputation_appeal", {
      p_target_type: targetType,
      p_target_hashes: targetHashes.map(({ hash, version }) => ({ hash, version })),
      p_target_display: targetDisplay,
      p_reason: reason,
      p_contact_hashes: contactHashes.map(({ hash, version }) => ({ hash, version })),
      p_contact_display: contactDisplay,
    });
    if (error) throw error;
    const validated = appealSubmissionResult.safeParse(result);
    if (!validated.success) throw new Error("Invalid appeal submission result");
    notify = validated.data[0]!.notify_moderation;
  } catch (error) {
    logServerError("reputation_appeal.submit_failed", error);
    return { ok: false, error: "submit_failed" };
  }
  if (notify) {
    // Best effort only: failure cannot reverse an accepted DB transaction.
    // A lost post-commit RPC response may leave a row without an alert; the
    // admin queue remains authoritative. Never retry the write on uncertainty.
    void Promise.resolve()
      .then(() =>
        notifyModeration({
          kind: "appeal",
          targetType,
          targetDisplay,
          language: appeal.lang,
        }),
      )
      .catch((error: unknown) => logServerError("reputation_appeal.notify_failed", error));
  }
  // Keep the public response indistinguishable for new and already-open
  // appeals. Revealing which targets are in the moderation queue would turn
  // this endpoint into a reputation-status oracle.
  return { ok: true };
}

export const submitReputationAppeal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => appealSchema.parse(d))
  .handler(async ({ data }) => submitReputationAppealCore(data, publicRateLimitKey("appeal")));
