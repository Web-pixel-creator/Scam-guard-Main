// Check handlers for the Telegram bot (Ishonch Guard).
//
// Implements the three "проверка" entry points of the `Handlers` contract from
// `router.ts` (task 8.3). All of them funnel user content into the shared,
// transport-independent risk core (`check-core.ts`) using a Telegram-specific
// rate-limit key and channel, then render the reply via the formatter.
//
// Contract (design.md → Check_Pipeline / OCR sequence / Контакт-карта R21):
//   handleCheck            text + forwarded text → runCheck
//   handleImage            screenshot → download (in memory) → OCR → runCheck
//   handlePhoneFromContact contact card number → runCheck(type="phone")
//
// Fixed cross-cutting rules baked in here:
//  - rateLimitKey is ALWAYS "tg:"+userId — never IP-based (R10.1, R10.3).
//  - channel is ALWAYS "telegram" (analytics only; never affects scoring).
//  - language comes from the loaded Session (R2.x); replies use formatCheckResult.
//  - long waits show a "typing" indicator only after 3s (R18.2).
//  - RateLimitedError → a friendly, localized wait message (R10.2).
//  - images are processed ONLY in memory and never persisted (R5.3); oversize
//    (>6 MB) is rejected (R5.5) and a null OCR result is reported (R5.6).
//
// Server-only: pulls in `*.server.ts` modules (Bot API + service-role core).
// This module is wired into the router later (task 9.1) via `setHandlers`; it
// deliberately does NOT import sibling handler modules or touch the aggregator.
import { analyzeImageCore, runCheck, type RateLimitedError } from "@/lib/risk/check-core";
import {
  sendMessage,
  sendChatAction,
  getFile,
  downloadFileAsDataUrl,
  escapeMarkdownV2,
  type InlineKeyboard,
} from "@/lib/telegram/api.server";
import { formatCheckResult } from "@/lib/telegram/format";
import { bt } from "@/lib/telegram/bot-i18n";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { saveSession } from "@/lib/telegram/session.server";
import {
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  classifyEmergencyFollowUp,
} from "@/lib/telegram/emergency";
import {
  buildLastCheckFollowUpText,
  buildOrphanCheckFollowUpText,
  buildImageUnreadableSnapshot,
  buildLastCheckSnapshot,
  classifyOrphanCheckFollowUp,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import {
  buildImageCheckInput,
  fallbackImageIntelligence,
  buildImageUserExplanation,
  hasUsableImageEvidence,
  isBenignImageContext,
  mergeDecodedQrEvidence,
} from "@/lib/risk/image-intelligence";
import { decodeQrFromDataUrl } from "@/lib/risk/qr-decoder";
import { enrichTelegramPublicMetadata } from "@/lib/telegram/public-metadata.server";
import { enrichTelegramReputation } from "@/lib/telegram/reputation.server";
import {
  enrichForwardSourceContext,
  type TelegramForwardSourceContext,
} from "@/lib/telegram/forward-context";
import { buildImageTriageKeyboard } from "@/lib/telegram/image-fallback";

/** Канал бота — только для аналитики/логов, не влияет на scoring (design.md). */
const CHANNEL = "telegram" as const;

/** Максимальная длина текстового ввода Check_Pipeline (R4.10). */
const MAX_TEXT_LENGTH = 2000;

/** Верхний предел размера скачиваемого изображения: 6 МБ (R5.5). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Через сколько мс ожидания показывать индикатор «печатает…» (R18.2). */
const TYPING_DELAY_MS = 3000;

const MEDIA_GROUP_FALLBACK_TTL_MS = 30_000;
const IMAGE_OCR_REPEAT_TTL_MS = 45_000;
const mediaGroupOcrFallbacks = new Map<string, number>();
const recentImageOcrFallbacks = new Map<number, number>();

/** Ключ rate-limit бота ВСЕГДА основан на telegram_user_id (R10.1, R10.3). */
function rateLimitKeyFor(userId: number): string {
  return `tg:${userId}`;
}

function pruneOcrFallbackMemory(now = Date.now()): void {
  for (const [key, timestamp] of mediaGroupOcrFallbacks) {
    if (now - timestamp > MEDIA_GROUP_FALLBACK_TTL_MS) mediaGroupOcrFallbacks.delete(key);
  }
  for (const [userId, timestamp] of recentImageOcrFallbacks) {
    if (now - timestamp > IMAGE_OCR_REPEAT_TTL_MS) recentImageOcrFallbacks.delete(userId);
  }
}

type OcrFallbackReply = "long" | "short" | "suppress";

function nextOcrFallbackReply(userId: number, mediaGroupId?: string): OcrFallbackReply {
  const now = Date.now();
  pruneOcrFallbackMemory(now);

  if (mediaGroupId) {
    const key = `${userId}:${mediaGroupId}`;
    const previous = mediaGroupOcrFallbacks.get(key);
    mediaGroupOcrFallbacks.set(key, now);
    recentImageOcrFallbacks.set(userId, now);
    return previous !== undefined && now - previous <= MEDIA_GROUP_FALLBACK_TTL_MS
      ? "suppress"
      : "long";
  }

  const previous = recentImageOcrFallbacks.get(userId);
  recentImageOcrFallbacks.set(userId, now);
  return previous !== undefined && now - previous <= IMAGE_OCR_REPEAT_TTL_MS ? "short" : "long";
}

/** Узкий type-guard на `RateLimitedError` из ядра (status 429 + retryAfter). */
function isRateLimitedError(e: unknown): e is RateLimitedError {
  return e instanceof Error && (e as Partial<RateLimitedError>).status === 429;
}

/**
 * Отправить простой (не отформатированный) текст пользователю. Строки bot-i18n
 * — plain text, поэтому экранируем их под MarkdownV2 (parse_mode по умолчанию).
 */
async function replyText(chatId: number, plain: string, keyboard?: InlineKeyboard): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(plain), keyboard });
}

/** Отправить отформатированный результат проверки (текст + inline-кнопки). */
async function sendCheckResult(ctx: HandlerCtx, result: RunCheckResult): Promise<void> {
  const formatted = formatCheckResult(result, ctx.session.lang);
  await sendMessage({ chatId: ctx.chatId, text: formatted.text, keyboard: formatted.keyboard });
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {
      ...ctx.session.scenarioData,
      lastCheck: buildLastCheckSnapshot(result),
    },
  });
}

async function replyImageOcrFailed(ctx: HandlerCtx, mediaGroupId?: string): Promise<void> {
  const reply = nextOcrFallbackReply(ctx.userId, mediaGroupId);
  if (reply === "suppress") return;

  await replyText(
    ctx.chatId,
    bt(reply === "short" ? "ocr_failed_repeat" : "ocr_failed", ctx.session.lang),
    buildImageTriageKeyboard(ctx.session.lang),
  );
  await saveSession(ctx.userId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {
      ...ctx.session.scenarioData,
      lastCheck: buildImageUnreadableSnapshot(),
    },
  });
}

/**
 * Показать индикатор «печатает…» ТОЛЬКО если работа длится дольше 3 секунд
 * (R18.2): таймер ставится до старта, при завершении до порога — снимается, и
 * лишний `sendChatAction` не отправляется. `sendChatAction` — best-effort.
 */
async function withTypingIndicator<T>(chatId: number, work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timer = undefined;
    void sendChatAction(chatId, "typing");
  }, TYPING_DELAY_MS);
  try {
    return await work();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Общая обёртка обработки ошибок: rate-limit → дружелюбное сообщение о лимите
 * (R10.2), любая другая ошибка → лог без Sensitive_Data + общая подсказка
 * (R11.3). Никогда не оставляет запрос без ответа.
 */
async function guarded(ctx: HandlerCtx, label: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
  } catch (e) {
    if (isRateLimitedError(e)) {
      await replyText(ctx.chatId, bt("rate_limited", ctx.session.lang, { seconds: e.retryAfter }));
      return;
    }
    console.error(`telegram ${label} failed`, e instanceof Error ? e.message : "unknown");
    await replyText(ctx.chatId, bt("generic_error", ctx.session.lang));
  }
}

/**
 * Свободный текст / пересланный текст → Check_Pipeline (R4.1, R4.2, R4.7, R11.5).
 *
 * Идентичность исходного отправителя пересланного сообщения уже исключена
 * роутером (в `content` попадает только текст), поэтому здесь спец-обработки
 * forward не требуется. Ввод длиннее 2000 символов отклоняется с понятным
 * сообщением на текущем языке (R4.10); пустой ввод — подсказка о поддерживаемых
 * типах (R16.1).
 */
export async function handleCheck(
  content: string,
  ctx: HandlerCtx,
  source?: TelegramForwardSourceContext,
): Promise<void> {
  const lang = ctx.session.lang;
  const trimmed = content.trim();

  if (trimmed.length === 0) {
    await replyText(ctx.chatId, bt("unsupported_input", lang));
    return;
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    // R4.10 — отклоняем слишком длинный ввод вместо передачи невалидного запроса.
    await replyText(ctx.chatId, bt("text_too_long", lang));
    return;
  }

  const emergencyFollowUp = classifyEmergencyFollowUp(trimmed, ctx.session.scenarioData);
  if (emergencyFollowUp !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        buildEmergencyFollowUpText(emergencyFollowUp.action, emergencyFollowUp.panicId, lang),
      ),
      keyboard: buildEmergencyFollowUpKeyboard(lang),
    });
    return;
  }

  const lastCheckFollowUp = classifyLastCheckFollowUp(trimmed, ctx.session.scenarioData);
  if (lastCheckFollowUp !== null && ctx.session.scenarioData.lastCheck) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(
        buildLastCheckFollowUpText(lastCheckFollowUp, ctx.session.scenarioData.lastCheck, lang),
      ),
    });
    return;
  }

  const orphanFollowUp = classifyOrphanCheckFollowUp(trimmed);
  if (orphanFollowUp !== null) {
    await sendMessage({
      chatId: ctx.chatId,
      text: escapeMarkdownV2(buildOrphanCheckFollowUpText(orphanFollowUp, lang)),
    });
    return;
  }

  await guarded(ctx, "handleCheck", async () => {
    const result = await withTypingIndicator(ctx.chatId, () =>
      runCheck({
        input: trimmed,
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
      }),
    );
    const enrichedMetadata = await enrichTelegramPublicMetadata(trimmed, result, lang);
    const enriched = await enrichTelegramReputation(trimmed, enrichedMetadata, lang);
    await sendCheckResult(ctx, enrichForwardSourceContext(enriched, source, lang));
  });
}

/**
 * Фото / документ-изображение → OCR → Check_Pipeline (R5.1–R5.6).
 *
 * Поток: getFile (метаданные) → проверка лимита 6 МБ ДО скачивания (R5.5) →
 * downloadFileAsDataUrl (ТОЛЬКО в память, без записи на диск/в БД/storage, R5.3)
 * → analyzeImageCore → runCheck. При `null`/пустом результате анализа — подсказка
 * прислать текст (R5.6); каждый вызов обрабатывает ровно одно изображение, т.е.
 * несколько фото обрабатываются по одному за раз (R16.3).
 */
export async function handleImage(
  fileId: string,
  ctx: HandlerCtx,
  mediaGroupId?: string,
  source?: TelegramForwardSourceContext,
): Promise<void> {
  const lang = ctx.session.lang;

  await guarded(ctx, "handleImage", async () => {
    // 1) Метаданные файла — позволяют отклонить превышение лимита ДО скачивания.
    const meta = await getFile(fileId);
    if (!meta) {
      await replyImageOcrFailed(ctx, mediaGroupId);
      return;
    }
    if (meta.fileSize > MAX_IMAGE_BYTES) {
      await replyText(ctx.chatId, bt("image_too_large", lang)); // R5.5
      return;
    }

    // OCR + проверка могут быть медленными → общий индикатор «печатает…» (R18.2).
    const outcome = await withTypingIndicator(ctx.chatId, async () => {
      // 2) Скачивание строго в память (без сохранения изображения, R5.3).
      const dataUrl = await downloadFileAsDataUrl(meta.filePath);
      if (!dataUrl) return { kind: "ocr_failed" as const };

      // 3) Decode real QR pixels before AI evidence. This stays in memory and
      // never guesses QR contents when pixel decoding fails.
      const decodedQr = decodeQrFromDataUrl(dataUrl);

      // 4) Structured image evidence (OCR + visual category + QR purpose).
      const aiEvidence = await analyzeImageCore(dataUrl, lang, rateLimitKeyFor(ctx.userId));
      const evidence =
        decodedQr.values.length > 0
          ? mergeDecodedQrEvidence(aiEvidence ?? fallbackImageIntelligence(null), decodedQr)
          : aiEvidence;
      if (!evidence || !hasUsableImageEvidence(evidence)) return { kind: "ocr_failed" as const };

      const checkInput = buildImageCheckInput(evidence);
      if (checkInput.trim().length === 0) return { kind: "ocr_failed" as const };

      // 5) Тот же rules-first конвейер, что и для текста, но без второго AI:
      // explanation уже строится из структурированного image evidence.
      const result = await runCheck({
        input: checkInput,
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
        skipAi: true,
        safeIfNoReasons: isBenignImageContext(evidence),
      });
      return {
        kind: "ok" as const,
        result: {
          ...result,
          explanation: buildImageUserExplanation(evidence, result.level, lang),
        },
      };
    });

    if (outcome.kind === "ocr_failed") {
      await replyImageOcrFailed(ctx, mediaGroupId); // R5.6
      return;
    }
    await sendCheckResult(ctx, enrichForwardSourceContext(outcome.result, source, lang));
  });
}

/**
 * Карточка контакта → проверка номера как `phone` (R21.1–R21.4).
 *
 * В ядро передаётся только номер; имя и прочие поля карточки сюда роутером не
 * передаются и здесь не сохраняются/не логируются (R21.3). normalize/mask/hash
 * применяются внутри ядра как к обычному номеру (R21.2). Пустой номер → подсказка
 * прислать номер текстом (R21.4).
 */
export async function handlePhoneFromContact(phone: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;
  const trimmed = phone.trim();

  if (trimmed.length === 0) {
    await replyText(ctx.chatId, bt("contact_no_number", lang)); // R21.4
    return;
  }

  await guarded(ctx, "handlePhoneFromContact", async () => {
    const result = await withTypingIndicator(ctx.chatId, () =>
      runCheck({
        input: trimmed,
        type: "phone", // R21.1 — ввод типа phone
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
      }),
    );
    await sendCheckResult(ctx, result);
  });
}
