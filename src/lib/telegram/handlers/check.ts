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
import { runCheck, ocrExtractCore, type RateLimitedError } from "@/lib/risk/check-core";
import {
  sendMessage,
  sendChatAction,
  getFile,
  downloadFileAsDataUrl,
  escapeMarkdownV2,
} from "@/lib/telegram/api.server";
import { formatCheckResult } from "@/lib/telegram/format";
import { bt } from "@/lib/telegram/bot-i18n";
import type { HandlerCtx } from "@/lib/telegram/router";
import type { RunCheckResult } from "@/lib/risk/check-core";

/** Канал бота — только для аналитики/логов, не влияет на scoring (design.md). */
const CHANNEL = "telegram" as const;

/** Максимальная длина текстового ввода Check_Pipeline (R4.10). */
const MAX_TEXT_LENGTH = 2000;

/** Верхний предел размера скачиваемого изображения: 6 МБ (R5.5). */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Через сколько мс ожидания показывать индикатор «печатает…» (R18.2). */
const TYPING_DELAY_MS = 3000;

/** Ключ rate-limit бота ВСЕГДА основан на telegram_user_id (R10.1, R10.3). */
function rateLimitKeyFor(userId: number): string {
  return `tg:${userId}`;
}

/** Узкий type-guard на `RateLimitedError` из ядра (status 429 + retryAfter). */
function isRateLimitedError(e: unknown): e is RateLimitedError {
  return e instanceof Error && (e as Partial<RateLimitedError>).status === 429;
}

/**
 * Отправить простой (не отформатированный) текст пользователю. Строки bot-i18n
 * — plain text, поэтому экранируем их под MarkdownV2 (parse_mode по умолчанию).
 */
async function replyText(chatId: number, plain: string): Promise<void> {
  await sendMessage({ chatId, text: escapeMarkdownV2(plain) });
}

/** Отправить отформатированный результат проверки (текст + inline-кнопки). */
async function sendCheckResult(ctx: HandlerCtx, result: RunCheckResult): Promise<void> {
  const formatted = formatCheckResult(result, ctx.session.lang);
  await sendMessage({ chatId: ctx.chatId, text: formatted.text, keyboard: formatted.keyboard });
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
export async function handleCheck(content: string, ctx: HandlerCtx): Promise<void> {
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

  await guarded(ctx, "handleCheck", async () => {
    const result = await withTypingIndicator(ctx.chatId, () =>
      runCheck({
        input: trimmed,
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
      }),
    );
    await sendCheckResult(ctx, result);
  });
}

/**
 * Фото / документ-изображение → OCR → Check_Pipeline (R5.1–R5.6).
 *
 * Поток: getFile (метаданные) → проверка лимита 6 МБ ДО скачивания (R5.5) →
 * downloadFileAsDataUrl (ТОЛЬКО в память, без записи на диск/в БД/storage, R5.3)
 * → ocrExtractCore → runCheck. При `null`/пустом результате OCR — подсказка
 * прислать текст (R5.6); каждый вызов обрабатывает ровно одно изображение, т.е.
 * несколько фото обрабатываются по одному за раз (R16.3).
 */
export async function handleImage(fileId: string, ctx: HandlerCtx): Promise<void> {
  const lang = ctx.session.lang;

  await guarded(ctx, "handleImage", async () => {
    // 1) Метаданные файла — позволяют отклонить превышение лимита ДО скачивания.
    const meta = await getFile(fileId);
    if (!meta) {
      await replyText(ctx.chatId, bt("ocr_failed", lang));
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

      // 3) OCR (с редактированием Sensitive_Data внутри ядра).
      const { text } = await ocrExtractCore(dataUrl, lang, rateLimitKeyFor(ctx.userId));
      if (text === null || text.trim().length === 0) return { kind: "ocr_failed" as const };

      // 4) Тот же конвейер проверки, что и для текста (R5.2, R5.4).
      const result = await runCheck({
        input: text,
        lang,
        rateLimitKey: rateLimitKeyFor(ctx.userId),
        channel: CHANNEL,
      });
      return { kind: "ok" as const, result };
    });

    if (outcome.kind === "ocr_failed") {
      await replyText(ctx.chatId, bt("ocr_failed", lang)); // R5.6
      return;
    }
    await sendCheckResult(ctx, outcome.result);
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
