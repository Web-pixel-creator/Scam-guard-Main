import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { sanitizePartner } from "@/lib/embed-widget";
import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { logServerError } from "@/lib/safe-server-log.server";

export const embedTelemetryContextSchema = z
  .object({
    partner: z.string().max(96).nullable().optional(),
    referrer: z.string().max(512).nullable().optional(),
  })
  .strict();

export type EmbedTelemetryContext = z.infer<typeof embedTelemetryContextSchema>;

type EmbedOriginEventInsert = Database["public"]["Tables"]["embed_origin_events"]["Insert"];

type NormalizedEmbedTelemetryContext = {
  partner: string | null;
  referrerOrigin: string | null;
  referrerHost: string | null;
};

type RecordEmbedOriginEventInput = {
  context?: EmbedTelemetryContext | null;
  eventType: "check_result" | "meta_intent";
  lang: Lang;
  result?: Pick<RunCheckResult, "type" | "level" | "reasons"> | null;
};

export function normalizeEmbedTelemetryContext(
  context: EmbedTelemetryContext | null | undefined,
): NormalizedEmbedTelemetryContext | null {
  if (!context) return null;

  const partner = sanitizePartner(context.partner);
  const referrer = normalizeReferrer(context.referrer);

  if (!partner && !referrer.referrerOrigin && !referrer.referrerHost) {
    return null;
  }

  return {
    partner,
    referrerOrigin: referrer.referrerOrigin,
    referrerHost: referrer.referrerHost,
  };
}

export async function recordEmbedOriginEvent({
  context,
  eventType,
  lang,
  result,
}: RecordEmbedOriginEventInput): Promise<boolean> {
  const normalized = normalizeEmbedTelemetryContext(context);
  if (!normalized) return false;

  const row: EmbedOriginEventInsert = {
    event_type: eventType,
    partner: normalized.partner,
    referrer_origin: normalized.referrerOrigin,
    referrer_host: normalized.referrerHost,
    language: lang,
    input_type: result?.type ?? null,
    risk_level: result?.level ?? null,
    reason_count: clampReasonCount(result?.reasons.length ?? 0),
  };

  try {
    const { error } = await supabaseAdmin.from("embed_origin_events").insert(row);
    if (error) {
      logServerError("embed_origin.insert_failed", error);
      return false;
    }
    return true;
  } catch (error) {
    logServerError("embed_origin.insert_failed", error);
    return false;
  }
}

function normalizeReferrer(value: string | null | undefined): {
  referrerOrigin: string | null;
  referrerHost: string | null;
} {
  if (typeof value !== "string") {
    return { referrerOrigin: null, referrerHost: null };
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512) {
    return { referrerOrigin: null, referrerHost: null };
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { referrerOrigin: null, referrerHost: null };
    }
    if (url.username || url.password || !url.hostname) {
      return { referrerOrigin: null, referrerHost: null };
    }

    return {
      referrerOrigin: limitText(url.origin, 255),
      referrerHost: limitText(url.hostname.toLowerCase(), 253),
    };
  } catch {
    return { referrerOrigin: null, referrerHost: null };
  }
}

function clampReasonCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), 32);
}

function limitText(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
