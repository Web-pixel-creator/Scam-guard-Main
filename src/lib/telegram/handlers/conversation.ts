import { sendMessage, escapeMarkdownV2, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import type { HandlerCtx } from "@/lib/telegram/router";
import {
  saveSession,
  withSessionChatScope,
  type ConversationDraftSnapshot,
  type ReportDraft,
} from "@/lib/telegram/session.server";
import {
  appendConversationMessage,
  buildConversationCollectKeyboard,
  buildConversationLastCheckSnapshot,
  buildConversationResultKeyboard,
  buildConversationResultText,
  createConversationDraft,
  isConversationCancelPhrase,
  isConversationDonePhrase,
  isConversationDraftExpired,
  MAX_CONVERSATION_MESSAGES,
  removeConversationDraft,
} from "@/lib/telegram/conversation-check";

function draftFrom(ctx: HandlerCtx): ConversationDraftSnapshot {
  return ctx.session.scenarioData.conversation ?? createConversationDraft();
}

async function replyText(chatId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(text), keyboard });
}

function scopedData(ctx: HandlerCtx, data: ReportDraft): ReportDraft {
  return withSessionChatScope(data, ctx.chatId, ctx.chatType);
}

async function saveConversationDraft(
  ctx: HandlerCtx,
  draft: ConversationDraftSnapshot,
): Promise<void> {
  await saveSession(ctx.userId, {
    scenario: "conversation_check",
    scenarioStep: 0,
    scenarioData: scopedData(ctx, {
      ...removeConversationDraft(ctx.session.scenarioData),
      conversation: draft,
    }),
  });
}

export async function startConversationCheck(ctx: HandlerCtx): Promise<void> {
  const draft = createConversationDraft();
  await saveConversationDraft(ctx, draft);
  await replyText(
    ctx.chatId,
    bt("conversation_prompt", ctx.session.lang, { max: MAX_CONVERSATION_MESSAGES }),
    buildConversationCollectKeyboard(ctx.session.lang),
  );
}

export async function handleConversationCancel(ctx: HandlerCtx): Promise<void> {
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: scopedData(ctx, removeConversationDraft(ctx.session.scenarioData)),
  });
  await replyText(ctx.chatId, bt("conversation_cancelled", ctx.session.lang));
}

export async function handleConversationAnalyze(ctx: HandlerCtx): Promise<void> {
  const draft = ctx.session.scenarioData.conversation;
  if (!draft || isConversationDraftExpired(draft)) {
    await saveSession(ctx.userId, {
      scenario: "none",
      scenarioStep: 0,
      scenarioData: scopedData(ctx, removeConversationDraft(ctx.session.scenarioData)),
    });
    await replyText(ctx.chatId, bt("conversation_expired", ctx.session.lang));
    return;
  }

  if (draft.messageCount < 2) {
    await replyText(
      ctx.chatId,
      bt("conversation_not_enough", ctx.session.lang),
      buildConversationCollectKeyboard(ctx.session.lang),
    );
    return;
  }

  const nextData = {
    ...removeConversationDraft(ctx.session.scenarioData),
    lastCheck: buildConversationLastCheckSnapshot(draft),
  };
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: scopedData(ctx, nextData),
  });
  await sendMessage({
    chatId: ctx.chatId,
    text: escapeMarkdownV2(buildConversationResultText(draft, ctx.session.lang)),
    keyboard: buildConversationResultKeyboard(ctx.session.lang),
  });
}

export async function handleConversationScenarioStep(text: string, ctx: HandlerCtx): Promise<void> {
  if (isConversationCancelPhrase(text)) {
    await handleConversationCancel(ctx);
    return;
  }
  if (isConversationDonePhrase(text)) {
    await handleConversationAnalyze(ctx);
    return;
  }

  const draft = draftFrom(ctx);
  const appended = appendConversationMessage(draft, text);
  if (!appended.ok) {
    if (appended.reason === "expired") {
      await saveSession(ctx.userId, {
        scenario: "none",
        scenarioStep: 0,
        scenarioData: scopedData(ctx, removeConversationDraft(ctx.session.scenarioData)),
      });
      await replyText(ctx.chatId, bt("conversation_expired", ctx.session.lang));
      return;
    }

    const key =
      appended.reason === "too_long" || appended.reason === "too_much_text"
        ? "conversation_too_long"
        : appended.reason === "too_many"
          ? "conversation_too_many"
          : "conversation_empty";
    await replyText(
      ctx.chatId,
      bt(key, ctx.session.lang, { max: MAX_CONVERSATION_MESSAGES }),
      buildConversationCollectKeyboard(ctx.session.lang),
    );
    return;
  }

  await saveConversationDraft(ctx, appended.draft);
  await replyText(
    ctx.chatId,
    bt("conversation_added", ctx.session.lang, {
      count: appended.draft.messageCount,
      max: MAX_CONVERSATION_MESSAGES,
    }),
    buildConversationCollectKeyboard(ctx.session.lang),
  );
}
