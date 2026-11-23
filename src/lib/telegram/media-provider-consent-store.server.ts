import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { MediaProviderKind } from "@/lib/telegram/media-provider-consent";
import type { TelegramChatType } from "@/lib/telegram/router";
import { currentTelegramUpdateLease } from "@/lib/telegram/update-execution.server";

export type MediaProviderConsentStoreResult =
  | "applied"
  | "missing"
  | "stale"
  | "unsupported"
  | "storage";

interface ConsentScope {
  userId: number;
  chatId: number;
  chatType?: TelegramChatType;
}

interface PromptBoundConsentScope extends ConsentScope {
  kind: MediaProviderKind;
  promptMessageId: number;
  reportFlowId?: string;
}

interface ClaimConsentScope extends ConsentScope {
  kind: MediaProviderKind;
  reportFlowId?: string;
}

type ConsentRpcName =
  | "register_telegram_media_provider_consent"
  | "grant_telegram_media_provider_consent"
  | "revoke_telegram_media_provider_consent"
  | "claim_telegram_media_provider_consent";

function consentRpc(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function firstRow(data: unknown): Record<string, unknown> | null {
  const value = Array.isArray(data) ? data[0] : data;
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function validScope(scope: ConsentScope): boolean {
  return (
    Number.isSafeInteger(scope.userId) &&
    scope.userId > 0 &&
    Number.isSafeInteger(scope.chatId) &&
    scope.chatId !== 0
  );
}

/** Raw-provider consent is supported only inside the ordered polling frontier. */
export function isMediaProviderConsentSupported(): boolean {
  const lease = currentTelegramUpdateLease();
  return Boolean(lease?.leaderToken && lease.leaderFence !== undefined);
}

async function runConsentRpc(
  operation: ConsentRpcName,
  scope: ConsentScope,
  args: Record<string, unknown>,
): Promise<MediaProviderConsentStoreResult> {
  const lease = currentTelegramUpdateLease();
  if (!lease || !validScope(scope)) {
    console.error("telegram media provider consent unavailable", operation);
    return "storage";
  }
  // Provider-backed media requires polling's durable global frontier. In
  // webhook mode a cancellation write could be uncertain while another
  // instance processes a later upload, so raw-media consent stays disabled.
  if (!isMediaProviderConsentSupported()) return "unsupported";

  try {
    const { data, error } = await consentRpc().rpc(operation, {
      p_telegram_user_id: scope.userId,
      p_chat_id: scope.chatId,
      p_chat_type: scope.chatType ?? "private",
      p_update_id: lease.updateId,
      p_lease_token: lease.leaseToken,
      p_processing_fence: lease.processingFence,
      p_leader_token: lease.leaderToken ?? null,
      p_leader_fence: lease.leaderFence ?? null,
      ...args,
    });
    if (error) throw error;
    const row = firstRow(data);
    if (typeof row?.lease_valid !== "boolean" || typeof row.applied !== "boolean") {
      throw new Error("invalid_consent_rpc_result");
    }
    if (!row.lease_valid) {
      if (row.applied) throw new Error("invalid_consent_rpc_result");
      return "stale";
    }
    return row.applied ? "applied" : "missing";
  } catch {
    console.error("telegram media provider consent unavailable", operation);
    return "storage";
  }
}

export function registerMediaProviderConsent(
  scope: PromptBoundConsentScope,
): Promise<MediaProviderConsentStoreResult> {
  return runConsentRpc("register_telegram_media_provider_consent", scope, {
    p_media_kind: scope.kind,
    p_prompt_message_id: scope.promptMessageId,
    p_report_flow_id: scope.reportFlowId ?? null,
  });
}

export function grantMediaProviderConsent(
  scope: PromptBoundConsentScope,
): Promise<MediaProviderConsentStoreResult> {
  return runConsentRpc("grant_telegram_media_provider_consent", scope, {
    p_media_kind: scope.kind,
    p_prompt_message_id: scope.promptMessageId,
    p_report_flow_id: scope.reportFlowId ?? null,
  });
}

export function revokeMediaProviderConsent(
  scope: ConsentScope & { promptMessageId: number },
): Promise<MediaProviderConsentStoreResult> {
  return runConsentRpc("revoke_telegram_media_provider_consent", scope, {
    p_prompt_message_id: scope.promptMessageId,
  });
}

export function claimMediaProviderConsent(
  scope: ClaimConsentScope,
): Promise<MediaProviderConsentStoreResult> {
  return runConsentRpc("claim_telegram_media_provider_consent", scope, {
    p_media_kind: scope.kind,
    p_report_flow_id: scope.reportFlowId ?? null,
  });
}
