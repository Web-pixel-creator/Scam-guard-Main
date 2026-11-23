import { createHash } from "node:crypto";
import { sendMessage, escapeMarkdownV2 } from "./api.server";
import { bt } from "./bot-i18n";
import type { HandlerCtx } from "./router";
import { saveSession, type ReportDraft } from "./session.server";
import { currentTelegramUpdateId, currentTelegramUpdateLease } from "./update-execution.server";
import {
  TelegramDirectResultDeliveryError,
  directDeliveryRetryMsFromSeconds,
} from "./direct-result-delivery-error";
import { isMediaProviderReportFlowId } from "./media-provider-consent";
import { reportSkipKeyboard, REPORT_SKIP_CALLBACK, withReportCallbackBinding } from "./report-flow";
import { redactText } from "@/lib/risk/detect";

const MAX_ATTEMPTS = 3;
const RETRY_WINDOW_MS = 10 * 60_000;

function draftDigest(ctx: HandlerCtx, draft: ReportDraft): string {
  return createHash("sha256")
    .update(JSON.stringify([ctx.userId, ctx.chatId, ctx.chatType, draft.description]))
    .digest("hex");
}

/** Save this sealed marker WITH the redacted draft, before the first send. */
export function prepareReportImageDelivery(ctx: HandlerCtx, draft: ReportDraft): ReportDraft {
  const lease = currentTelegramUpdateLease();
  const updateId = currentTelegramUpdateId();
  if (
    !lease?.leaderToken ||
    lease.leaderFence == null ||
    updateId === null ||
    !isMediaProviderReportFlowId(draft.reportFlowId)
  ) {
    // No new retry authority outside polling. The real media-consent boundary
    // already denies provider access there; legacy/unit callers remain one-shot.
    return draft;
  }
  return {
    ...draft,
    reportImageDelivery: {
      version: 1,
      updateId,
      flowId: draft.reportFlowId,
      lang: ctx.session.lang,
      draftDigest: draftDigest(ctx, draft),
      state: "sealed",
      attempts: 1,
      createdAt: Date.now(),
      retryAt: 0,
    },
  };
}

/** No provider, download, scoring or report submission lives on this path. */
export async function sendSavedReportImageDelivery(
  ctx: HandlerCtx,
  draft: ReportDraft,
): Promise<void> {
  const lang = draft.reportImageDelivery?.lang ?? ctx.session.lang;
  let result;
  try {
    result = await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        `${bt("report_image_added", lang, { summary: draft.description ?? "" })}\n\n${bt("report_ask_scam_type", lang)}`,
      ),
      keyboard: reportSkipKeyboard(lang),
    });
  } catch {
    // Unknown transport outcome: keep the pre-send seal and never send a
    // follow-on question/error or replay the primary message automatically.
    console.error("telegram_report.image_delivery", "ambiguous_exception");
    return;
  }
  const marker = draft.reportImageDelivery;
  if (
    marker &&
    !result.ok &&
    result.certainty === "definitive" &&
    result.retryable &&
    result.errorCode === 429
  ) {
    // Honor the full Telegram delay even though the poller's sleep is capped.
    const seconds = result.retryAfterSec;
    const delay = Number.isSafeInteger(seconds) && (seconds ?? 0) > 0 ? seconds! * 1_000 : 2_000;
    const retryAt = Date.now() + delay;
    if (marker.attempts >= MAX_ATTEMPTS || retryAt >= marker.createdAt + RETRY_WINDOW_MS) {
      console.error("telegram_report.image_delivery", "retry_budget_exhausted");
      return;
    }
    const saved = await saveSession(
      ctx.userId,
      {
        scenarioData: { ...draft, reportImageDelivery: { ...marker, state: "retryable", retryAt } },
      },
      { failureVisibility: "operator_only" },
    );
    // Only a confirmed write requests retry from this execution. If this write
    // committed but its receipt AND update completion are lost, a later replay
    // may still read the retryable marker: the definitive 429 makes that safe.
    if (saved.ok) {
      throw new TelegramDirectResultDeliveryError(directDeliveryRetryMsFromSeconds(seconds));
    }
    return;
  }
  if (result.ok && Number.isSafeInteger(result.messageId) && (result.messageId ?? 0) > 0) {
    await saveSession(
      ctx.userId,
      {
        scenario: "report_scamType",
        scenarioStep: 2,
        scenarioData: withReportCallbackBinding(
          draft,
          result.messageId!,
          REPORT_SKIP_CALLBACK,
          "report_scamType",
        ),
      },
      { failureVisibility: "operator_only" },
    );
  }
}

/** Exact-update recovery only. A seal also suppresses replay after a crash. */
export async function handleReportImageDeliveryRecovery(ctx: HandlerCtx): Promise<void> {
  const draft = ctx.session.scenarioData;
  const marker = draft.reportImageDelivery;
  const lease = currentTelegramUpdateLease();
  const now = Date.now();
  if (
    !marker ||
    marker.version !== 1 ||
    marker.state !== "retryable" ||
    !lease?.leaderToken ||
    lease.leaderFence == null ||
    marker.updateId !== currentTelegramUpdateId() ||
    !Number.isSafeInteger(marker.updateId) ||
    ctx.userId !== ctx.session.telegramUserId ||
    ctx.session.scenario !== "report_scamType" ||
    ctx.session.scenarioStep !== 2 ||
    !isMediaProviderReportFlowId(marker.flowId) ||
    marker.flowId !== draft.reportFlowId ||
    draft.chatScope?.chatId !== ctx.chatId ||
    draft.chatScope?.chatType !== ctx.chatType ||
    !(marker.lang === "ru" || marker.lang === "uz" || marker.lang === "en") ||
    marker.lang !== ctx.session.lang ||
    typeof draft.description !== "string" ||
    draft.description.length < 5 ||
    draft.description.length > 5_000 ||
    redactText(draft.description) !== draft.description ||
    marker.draftDigest !== draftDigest(ctx, draft) ||
    !Number.isSafeInteger(marker.attempts) ||
    marker.attempts < 1 ||
    marker.attempts >= MAX_ATTEMPTS ||
    !Number.isSafeInteger(marker.createdAt) ||
    !Number.isSafeInteger(marker.retryAt) ||
    marker.retryAt < marker.createdAt ||
    marker.retryAt >= marker.createdAt + RETRY_WINDOW_MS ||
    now < marker.createdAt ||
    now >= marker.createdAt + RETRY_WINDOW_MS
  ) {
    return;
  }
  if (now < marker.retryAt) {
    throw new TelegramDirectResultDeliveryError(marker.retryAt - now);
  }
  const sealed: ReportDraft = {
    ...draft,
    reportImageDelivery: { ...marker, state: "sealed", attempts: marker.attempts + 1 },
  };
  const saved = await saveSession(
    ctx.userId,
    { scenarioData: sealed },
    { failureVisibility: "operator_only" },
  );
  // Fenced, confirmed persistence is mandatory before each network effect.
  // Lost write receipt may leave a seal, so fail closed instead of resending.
  if (!saved.ok) return;
  await sendSavedReportImageDelivery(ctx, sealed);
}
