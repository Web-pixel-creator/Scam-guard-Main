// Telegram handler aggregator (Ishonch Guard bot) — task 9.1, PART C.
//
// Composes the four concrete handler modules (commands / check / report / misc)
// into the single `Handlers` object the router dispatches to, and registers it
// via `setHandlers(...)`. The router (router.ts) depends only on the `Handlers`
// abstraction and never imports these modules — this aggregator is the one
// place that wires them together (dependency inversion).
//
// Mapping (router `Handlers` → concrete module):
//   handleCommand          → commands.handleCommand
//   handleScenarioStep     → composite: await_check → check.handleCheck,
//                            report_* → report.handleScenarioStep
//   handleScenarioImage    → report.handleScenarioImage for screenshot evidence
//   handleCheck            → check.handleCheck
//   handleImage            → check.handleImage
//   handlePhoneFromContact → check.handlePhoneFromContact
//   handleCallback         → composite: REPORT_SKIP_CALLBACK on a report_* step
//                            → report.handleReportSkip; otherwise misc.handleCallback
//   handleOutOfScope       → misc.handleOutOfScope
//
// `installTelegramHandlers()` is idempotent and is called by the webhook core
// (webhook.server.ts) before any dispatch, so `setHandlers` always runs first.
// Importing this module for its side effect also installs the handlers.
//
// Server-only: transitively pulls in `*.server.ts` modules (Bot API + service
// -role core). Never import into the client bundle.
import { setHandlers, type Handlers, type HandlerCtx } from "@/lib/telegram/router";
import type { Scenario } from "@/lib/telegram/session.server";
import { resetScenario } from "@/lib/telegram/session.server";
import { answerCallbackQuery } from "@/lib/telegram/api.server";

import { handleCommand } from "@/lib/telegram/handlers/commands";
import {
  handleCheck,
  handleImage,
  handlePhoneFromContact,
  handleVoice,
} from "@/lib/telegram/handlers/check";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import { handleConversationScenarioStep } from "@/lib/telegram/handlers/conversation";
import {
  handleScenarioStep as handleReportScenarioStep,
  handleScenarioImage as handleReportScenarioImage,
  handleReportNoValue,
  handleReportRetry,
  handleReportSkip,
  REPORT_NO_VALUE_CALLBACK,
  REPORT_RETRY_CALLBACK,
  REPORT_SKIP_CALLBACK,
} from "@/lib/telegram/handlers/report";
import {
  handleCallback as miscHandleCallback,
  handleMetaIntent,
  handleOutOfScope,
} from "@/lib/telegram/handlers/misc";

/** True for any multi-step `/report` scenario state (`report_*`). */
function isReportScenario(scenario: Scenario): boolean {
  return scenario.startsWith("report_");
}

/**
 * Dispatch a scenario step to the right module. The router routes any message
 * with an active scenario here; we split by scenario family:
 *   • `await_check` (set by /check, R4.8) → run the Check_Pipeline on the
 *     content, then reset to a neutral state (R15.5) so the next message is no
 *     longer captured by the check prompt.
 *   • `report_*` → the multi-step /report state machine (report.ts).
 */
async function handleScenarioStep(text: string, ctx: HandlerCtx): Promise<void> {
  if (ctx.session.scenario === "await_check") {
    // Single-step "send me content" scenario — reset before running the check
    // so we leave a neutral session (R15.5).
    await resetScenario(ctx.userId);
    await handleCheck(text, {
      ...ctx,
      session: { ...ctx.session, scenario: "none", scenarioStep: 0 },
    });
    return;
  }
  if (ctx.session.scenario === "conversation_check") {
    await handleConversationScenarioStep(text, ctx);
    return;
  }
  await handleReportScenarioStep(text, ctx);
}

async function handleScenarioImage(
  fileId: string,
  ctx: HandlerCtx,
  mediaGroupId?: string,
): Promise<void> {
  if (ctx.session.scenario === "report_desc") {
    await handleReportScenarioImage(fileId, ctx, mediaGroupId);
  }
}

/**
 * Composite callback handler. The router's `Handlers.handleCallback(data, ctx)`
 * does not thread the raw `callback_query.id`; misc.handleCallback accepts an
 * optional third `callbackQueryId` to clear the spinner, so this wrapper keeps
 * that optional parameter and forwards it.
 *
 * Special case: the «Skip» button (`REPORT_SKIP_CALLBACK`) only means "skip the
 * current optional report step" while a `report_*` scenario is active — route
 * it to report.handleReportSkip. Every other callback (language / Report /
 * Check another / Emergency / unknown) goes to misc.handleCallback.
 */
async function handleCallback(
  data: string,
  ctx: HandlerCtx,
  callbackQueryId?: string,
): Promise<void> {
  if (data === REPORT_SKIP_CALLBACK && isReportScenario(ctx.session.scenario)) {
    if (callbackQueryId !== undefined) {
      await answerCallbackQuery(callbackQueryId);
    }
    await handleReportSkip(ctx);
    return;
  }
  if (data === REPORT_NO_VALUE_CALLBACK && ctx.session.scenario === "report_value") {
    if (callbackQueryId !== undefined) {
      await answerCallbackQuery(callbackQueryId);
    }
    await handleReportNoValue(ctx);
    return;
  }
  if (data === REPORT_RETRY_CALLBACK && isReportScenario(ctx.session.scenario)) {
    if (callbackQueryId !== undefined) {
      await answerCallbackQuery(callbackQueryId);
    }
    await handleReportRetry(ctx);
    return;
  }
  await miscHandleCallback(data, ctx, callbackQueryId);
}

/** The fully composed handler set wired into the router. */
export const telegramHandlers: Handlers = {
  handleCommand,
  handleScenarioStep,
  handleScenarioImage,
  handleCheck,
  handleMetaIntent,
  handleImage,
  handleVoice,
  handlePhoneFromContact,
  handleCallback,
  handleOutOfScope,
  handleInlineQuery,
};

let installed = false;

/**
 * Register the composed handlers with the router. Idempotent — safe to call on
 * every webhook request; only the first call has an effect. Called by
 * webhook.server.ts before any dispatch so `setHandlers` always runs first.
 */
export function installTelegramHandlers(): void {
  if (installed) return;
  setHandlers(telegramHandlers);
  installed = true;
}

// Side-effect install for `import "@/lib/telegram/handlers"`.
installTelegramHandlers();
