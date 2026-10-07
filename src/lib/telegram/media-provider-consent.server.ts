import {
  sendMessage,
  escapeMarkdownV2,
  type InlineKeyboard,
  type SendMessageResult,
} from "@/lib/telegram/api.server";
import { bt, type BotStringKey } from "@/lib/telegram/bot-i18n";
import type { HandlerCtx } from "@/lib/telegram/router";
import { currentTelegramUpdateLease } from "@/lib/telegram/update-execution.server";
import { isTelegramUpdateLeaseCurrent } from "@/lib/telegram/update-lifecycle.server";
import {
  claimMediaProviderConsent,
  grantMediaProviderConsent,
  isMediaProviderConsentSupported,
  registerMediaProviderConsent,
  revokeMediaProviderConsent,
} from "@/lib/telegram/media-provider-consent-store.server";
import {
  MEDIA_PROVIDER_CONSENT_CANCEL_CALLBACK,
  isMediaProviderReportFlowId,
  mediaProviderConsentCallback,
  type MediaProviderKind,
} from "@/lib/telegram/media-provider-consent";

const REQUEST_TEXT: Record<MediaProviderKind, BotStringKey> = {
  image: "media_image_provider_consent_required",
  voice: "media_voice_provider_consent_required",
  report_image: "media_report_image_provider_consent_required",
};

const ALLOW_TEXT: Record<MediaProviderKind, BotStringKey> = {
  image: "btn_media_provider_consent_image",
  voice: "btn_media_provider_consent_voice",
  report_image: "btn_media_provider_consent_report_image",
};

const GRANTED_TEXT: Record<MediaProviderKind, BotStringKey> = {
  image: "media_image_provider_consent_granted",
  voice: "media_voice_provider_consent_granted",
  report_image: "media_report_image_provider_consent_granted",
};

export class MediaProviderConsentStorageError extends Error {
  constructor() {
    super("media_provider_consent_storage");
    this.name = "MediaProviderConsentStorageError";
  }
}

export function isMediaProviderConsentStorageError(
  error: unknown,
): error is MediaProviderConsentStorageError {
  return error instanceof MediaProviderConsentStorageError;
}

function keepDefinitiveDeliveryFailureRetryable(delivery: SendMessageResult): void {
  if (!delivery.ok && delivery.certainty === "definitive" && delivery.retryable) {
    throw new MediaProviderConsentStorageError();
  }
}

/**
 * Fence the final raw-media handoff, not only the earlier consent claim. The
 * claim may be followed by admission, Telegram download and local decoding;
 * losing either lease during that gap must prevent the provider callback.
 */
export async function assertMediaProviderTransferAllowed(): Promise<void> {
  const lease = currentTelegramUpdateLease();
  if (
    !lease?.leaderToken ||
    lease.leaderFence === undefined ||
    !(await isTelegramUpdateLeaseCurrent(lease))
  ) {
    throw new MediaProviderConsentStorageError();
  }
}

function requestKeyboard(
  kind: MediaProviderKind,
  lang: HandlerCtx["session"]["lang"],
): InlineKeyboard {
  return [
    [{ text: bt(ALLOW_TEXT[kind], lang), callback_data: mediaProviderConsentCallback(kind) }],
    [
      {
        text: bt("btn_media_provider_consent_cancel", lang),
        callback_data: MEDIA_PROVIDER_CONSENT_CANCEL_CALLBACK,
      },
    ],
  ];
}

function scope(ctx: HandlerCtx) {
  return {
    userId: ctx.userId,
    chatId: ctx.chatId,
    chatType: ctx.chatType,
  } as const;
}

function scopeForKind(ctx: HandlerCtx, kind: MediaProviderKind) {
  if (kind !== "report_image") return { ...scope(ctx), kind } as const;
  const reportFlowId = ctx.session.scenarioData.reportFlowId;
  if (!isMediaProviderReportFlowId(reportFlowId)) return null;
  return { ...scope(ctx), kind, reportFlowId } as const;
}

export async function requestMediaProviderConsent(
  ctx: HandlerCtx,
  kind: MediaProviderKind,
): Promise<boolean> {
  const lang = ctx.session.lang;
  // Do not render an actionable approval keyboard in webhook mode: raw-media
  // provider transfer is intentionally available only behind polling's
  // durable single-leader update frontier.
  if (!isMediaProviderConsentSupported()) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("media_provider_consent_storage_failed", lang)),
    });
    return false;
  }
  const boundScope = scopeForKind(ctx, kind);
  if (!boundScope) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("media_provider_consent_storage_failed", lang)),
    });
    return false;
  }
  const delivery = await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt(REQUEST_TEXT[kind], lang)),
    keyboard: requestKeyboard(kind, lang),
  });
  if (!delivery.ok) {
    keepDefinitiveDeliveryFailureRetryable(delivery);
    return false;
  }
  if (delivery.messageId === undefined) return false;

  const registered = await registerMediaProviderConsent({
    ...boundScope,
    promptMessageId: delivery.messageId,
  });
  if (registered === "storage") throw new MediaProviderConsentStorageError();
  if (registered === "unsupported") {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt("media_provider_consent_storage_failed", lang)),
    });
    return false;
  }
  if (registered !== "applied") return false;
  return true;
}

export type ConsumeMediaProviderConsentResult = "consumed" | "missing" | "stale" | "storage";

export async function consumeMediaProviderConsent(
  ctx: HandlerCtx,
  kind: MediaProviderKind,
): Promise<ConsumeMediaProviderConsentResult> {
  const boundScope = scopeForKind(ctx, kind);
  if (!boundScope) return "storage";
  const claimed = await claimMediaProviderConsent(boundScope);
  if (claimed === "storage") throw new MediaProviderConsentStorageError();
  if (claimed === "unsupported") return "storage";
  if (claimed === "stale") return "stale";
  return claimed === "applied" ? "consumed" : "missing";
}

export type HandleMediaProviderConsentResult =
  | "granted"
  | "cancelled"
  | "invalid"
  | "stale"
  | "storage";

export async function handleMediaProviderConsentCallback(
  ctx: HandlerCtx,
  callback: { action: "allow"; kind: MediaProviderKind } | { action: "cancel" },
): Promise<HandleMediaProviderConsentResult> {
  if (ctx.messageId === undefined || !Number.isSafeInteger(ctx.messageId) || ctx.messageId <= 0) {
    return "invalid";
  }

  if (callback.action === "allow") {
    if (callback.kind === "report_image" && ctx.session.scenario !== "report_desc") {
      return "invalid";
    }
    const boundScope = scopeForKind(ctx, callback.kind);
    if (!boundScope) return "invalid";
    const granted = await grantMediaProviderConsent({
      ...boundScope,
      promptMessageId: ctx.messageId,
    });
    if (granted === "storage") throw new MediaProviderConsentStorageError();
    if (granted === "unsupported") return "invalid";
    if (granted === "stale") return "stale";
    if (granted !== "applied") return "invalid";
    const confirmation = await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(bt(GRANTED_TEXT[callback.kind], ctx.session.lang)),
    });
    keepDefinitiveDeliveryFailureRetryable(confirmation);
    return "granted";
  }

  const revoked = await revokeMediaProviderConsent({
    ...scope(ctx),
    promptMessageId: ctx.messageId,
  });
  if (revoked === "storage") throw new MediaProviderConsentStorageError();
  if (revoked === "unsupported") return "invalid";
  if (revoked === "stale") return "stale";
  if (revoked !== "applied") return "invalid";
  const confirmation = await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(bt("media_provider_consent_cancelled", ctx.session.lang)),
  });
  keepDefinitiveDeliveryFailureRetryable(confirmation);
  return "cancelled";
}

export async function sendMediaProviderConsentFailure(
  ctx: HandlerCtx,
  kind: "invalid" | "storage",
): Promise<void> {
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(
      bt(
        kind === "invalid"
          ? "media_provider_consent_invalid"
          : "media_provider_consent_storage_failed",
        ctx.session.lang,
      ),
    ),
  });
}
