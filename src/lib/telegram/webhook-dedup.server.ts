// Cross-instance Telegram webhook deduplication.
//
// Telegram may retry the same update_id. The webhook keeps a small in-memory
// fast path, but this module is the shared source of truth for multi-instance
// deployments: a service-role insert into telegram_webhook_updates with
// update_id as the primary key.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TABLE = "telegram_webhook_updates";
const DEFAULT_EXPIRES_IN_MS = 2 * 24 * 60 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";

export type WebhookUpdateClaimResult = "claimed" | "duplicate" | "unavailable";

interface ClaimRow {
  update_id: number;
  expires_at: string;
}

function webhookUpdates() {
  return (supabaseAdmin as unknown as SupabaseClient).from(TABLE);
}

export async function claimTelegramWebhookUpdate(
  updateId: number,
  nowMs = Date.now(),
  expiresInMs = DEFAULT_EXPIRES_IN_MS,
): Promise<WebhookUpdateClaimResult> {
  if (!Number.isSafeInteger(updateId) || updateId < 0) return "unavailable";

  const row: ClaimRow = {
    update_id: updateId,
    expires_at: new Date(nowMs + expiresInMs).toISOString(),
  };

  try {
    const { error } = await webhookUpdates().insert(row);
    if (!error) return "claimed";
    if (error.code === UNIQUE_VIOLATION) return "duplicate";

    console.error("telegram webhook dedup insert failed", error.message);
    return "unavailable";
  } catch (error) {
    console.error(
      "telegram webhook dedup unavailable",
      error instanceof Error ? error.message : "unknown",
    );
    return "unavailable";
  }
}
