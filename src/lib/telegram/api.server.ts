// Telegram Bot API helper — a thin, hand-rolled wrapper over the HTTP Bot API
// (no grammY/telegraf; see design.md → Open Decision 1). Server-only: the
// `.server.ts` suffix keeps it out of the client bundle, and the bot token is
// read INSIDE each function via `getTelegramBotToken()` (per-request server
// config read, CODING_RULES §6), never at module scope.
//
// Failure policy (R13.4, R10.3, R17.x): network errors, missing token and
// non-ok Bot API responses degrade gracefully — `sendMessage`/`setWebhook`
// return `{ ok: false }`, `getFile`/`downloadFileAsDataUrl` return `null`, and
// the void helpers swallow errors. Nothing throws out of this module.
import { getTelegramBotToken } from "@/lib/config.server";

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}
export type InlineKeyboard = InlineButton[][];

export interface TelegramChatFullInfo {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  active_usernames?: string[];
  bio?: string;
  description?: string;
  join_to_send_messages?: true;
  join_by_request?: true;
  has_private_forwards?: true;
  has_protected_content?: true;
  has_visible_history?: true;
  has_aggressive_anti_spam_enabled?: true;
  has_hidden_members?: true;
}

export type GetChatInfoResult =
  | { ok: true; chat: TelegramChatFullInfo }
  | { ok: false; errorCode?: number; description?: string };

export interface SendMessageOptions {
  chatId: number;
  text: string; // уже экранированный MarkdownV2
  keyboard?: InlineKeyboard;
  parseMode?: "MarkdownV2" | "HTML" | "None";
  disablePreview?: boolean;
}

export interface EditMessageOptions {
  chatId: number;
  messageId: number;
  text: string;
  keyboard?: InlineKeyboard;
  parseMode?: "MarkdownV2" | "HTML" | "None";
}

export interface InlineQueryResultArticle {
  type: "article";
  id: string;
  title: string;
  description?: string;
  input_message_content: {
    message_text: string;
    parse_mode?: "MarkdownV2" | "HTML";
    disable_web_page_preview?: boolean;
  };
  reply_markup?: {
    inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
  };
}

export interface AnswerInlineQueryOptions {
  inlineQueryId: string;
  results: InlineQueryResultArticle[];
  cacheTime?: number;
  isPersonal?: boolean;
  nextOffset?: string;
}

/** Telegram OCR_Pipeline upper bound on downloaded files: 6 MB (R5.5). */
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const BOT_API_TIMEOUT_MS = 8_000;
const FILE_DOWNLOAD_TIMEOUT_MS = 12_000;

const API_BASE = "https://api.telegram.org/bot";
const FILE_BASE = "https://api.telegram.org/file/bot";

/**
 * POST a JSON body to a Bot API method and return the parsed envelope.
 * Reads the token per-request; returns `null` when the token is missing, the
 * network call throws, or Telegram answers with a non-ok HTTP status. Never
 * throws (R13.4).
 */
async function callBotApi(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: unknown; description?: string; error_code?: number } | null> {
  const token = getTelegramBotToken();
  if (!token) {
    // R17.4 — not configured: fail closed, do not throw, do not log the value.
    console.error(`telegram ${method} skipped: bot token not configured`);
    return null;
  }
  try {
    const res = await fetchWithTimeout(
      `${API_BASE}${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      BOT_API_TIMEOUT_MS,
    );
    const envelope = await readBotApiEnvelope(res);
    if (!res.ok) {
      console.error(`telegram ${method} non-ok`, res.status);
      return envelope;
    }
    return envelope;
  } catch (e) {
    console.error(`telegram ${method} threw`, e instanceof Error ? e.message : "unknown");
    return null;
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBotApiEnvelope(
  res: Response,
): Promise<{ ok: boolean; result?: unknown; description?: string; error_code?: number } | null> {
  try {
    return (await res.json()) as {
      ok: boolean;
      result?: unknown;
      description?: string;
      error_code?: number;
    };
  } catch {
    return null;
  }
}

function isTelegramChatFullInfo(value: unknown): value is TelegramChatFullInfo {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<TelegramChatFullInfo>;
  return (
    typeof chat.id === "number" &&
    (chat.type === "private" ||
      chat.type === "group" ||
      chat.type === "supergroup" ||
      chat.type === "channel")
  );
}

/**
 * Отправка сообщения. Текст ДОЛЖЕН быть пропущен через `escapeMarkdownV2`
 * (parse_mode по умолчанию MarkdownV2). `keyboard` превращается в
 * `reply_markup.inline_keyboard`. Возвращает `{ ok }`; при отсутствии токена
 * или сетевой/не-ok ошибке — `{ ok: false }` (R13.4).
 */
export async function sendMessage(opts: SendMessageOptions): Promise<{ ok: boolean }> {
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
  };
  const parseMode = opts.parseMode ?? "MarkdownV2";
  if (parseMode !== "None") body.parse_mode = parseMode;
  if (opts.keyboard && opts.keyboard.length > 0) {
    body.reply_markup = { inline_keyboard: opts.keyboard };
  }
  if (opts.disablePreview) body.disable_web_page_preview = true;

  const res = await callBotApi("sendMessage", body);
  return { ok: res?.ok === true };
}

/**
 * Редактирование существующего сообщения (inline-клавиатура pagination и т.п.).
 * Следует той же конвенции, что и `sendMessage`: возвращает `{ ok: false }` при
 * ошибке или отсутствии токена, никогда не бросает (R13.4).
 */
export async function editMessageText(opts: EditMessageOptions): Promise<{ ok: boolean }> {
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    message_id: opts.messageId,
    text: opts.text,
  };
  const parseMode = opts.parseMode ?? "MarkdownV2";
  if (parseMode !== "None") body.parse_mode = parseMode;
  if (opts.keyboard && opts.keyboard.length > 0) {
    body.reply_markup = { inline_keyboard: opts.keyboard };
  }

  const res = await callBotApi("editMessageText", body);
  return { ok: res?.ok === true };
}

/**
 * Индикатор "печатает…" пока идёт долгая обработка (R18.2). Best-effort —
 * любые ошибки проглатываются, ничего не возвращает.
 */
export async function sendChatAction(chatId: number, action: "typing"): Promise<void> {
  await callBotApi("sendChatAction", { chat_id: chatId, action });
}

/**
 * Подтверждение нажатия inline-кнопки (убирает "часики" у пользователя).
 * Best-effort; ошибки не пробрасываются.
 */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const body: Record<string, unknown> = { callback_query_id: callbackQueryId };
  if (text !== undefined) body.text = text;
  await callBotApi("answerCallbackQuery", body);
}

/** Answer an inline-mode query with compact article results. Best-effort. */
export async function answerInlineQuery(opts: AnswerInlineQueryOptions): Promise<{ ok: boolean }> {
  const body: Record<string, unknown> = {
    inline_query_id: opts.inlineQueryId,
    results: opts.results,
  };
  if (opts.cacheTime !== undefined) body.cache_time = opts.cacheTime;
  if (opts.isPersonal !== undefined) body.is_personal = opts.isPersonal;
  if (opts.nextOffset !== undefined) body.next_offset = opts.nextOffset;

  const res = await callBotApi("answerInlineQuery", body);
  return { ok: res?.ok === true };
}

/**
 * Best-effort Bot API getChat wrapper for public Telegram metadata.
 * It returns a typed error envelope instead of throwing, so check processing can
 * explain platform limits without depending on Telegram availability.
 */
export async function getChatInfo(chatId: string): Promise<GetChatInfoResult> {
  const res = await callBotApi("getChat", { chat_id: chatId });
  if (!res) return { ok: false };
  if (res.ok !== true) {
    return { ok: false, errorCode: res.error_code, description: res.description };
  }
  if (!isTelegramChatFullInfo(res.result)) {
    return { ok: false, description: "invalid getChat result" };
  }
  return { ok: true, chat: res.result };
}

/**
 * Метаданные файла (для скриншотов): `file_path` + `file_size`. Возвращает
 * `null` при отсутствии токена, сетевой/не-ok ошибке или если ответ Telegram не
 * содержит `file_path`.
 */
export async function getFile(
  fileId: string,
): Promise<{ filePath: string; fileSize: number } | null> {
  const res = await callBotApi("getFile", { file_id: fileId });
  if (!res || res.ok !== true) return null;
  const result = res.result as { file_path?: unknown; file_size?: unknown } | undefined;
  const filePath = typeof result?.file_path === "string" ? result.file_path : null;
  if (!filePath) return null;
  const fileSize = typeof result?.file_size === "number" ? result.file_size : 0;
  return { filePath, fileSize };
}

/**
 * Скачивание файла ТОЛЬКО В ПАМЯТЬ (ArrayBuffer → base64 data URL). Никогда не
 * пишет на диск/в storage/БД (R5.3). Лимит 6 МБ (R5.5) проверяется ДО полной
 * буферизации: сначала по заголовку `Content-Length`, затем потоковым чтением с
 * обрывом при превышении. При превышении лимита, отсутствии токена или любой
 * ошибке возвращает `null` (R5.5, R13.4).
 */
export async function downloadFileAsDataUrl(filePath: string): Promise<string | null> {
  const token = getTelegramBotToken();
  if (!token) {
    console.error("telegram downloadFile skipped: bot token not configured");
    return null;
  }
  try {
    const res = await fetchWithTimeout(
      `${FILE_BASE}${token}/${filePath}`,
      undefined,
      FILE_DOWNLOAD_TIMEOUT_MS,
    );
    if (!res.ok) {
      console.error("telegram downloadFile non-ok", res.status);
      return null;
    }

    // R5.5 — reject oversize early via Content-Length, without buffering.
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_FILE_BYTES) {
      await res.body?.cancel();
      return null;
    }

    const bytes = await readCapped(res, MAX_FILE_BYTES);
    if (!bytes) return null; // exceeded the cap while streaming

    const mime = resolveMime(res.headers.get("content-type"), filePath);
    return `data:${mime};base64,${toBase64(bytes)}`;
  } catch (e) {
    console.error("telegram downloadFile threw", e instanceof Error ? e.message : "unknown");
    return null;
  }
}

/**
 * Одноразовая настройка webhook (вызывается админ-скриптом, не в рантайме).
 * Передаёт `secret_token` в Bot API `setWebhook`, чтобы Telegram присылал его в
 * заголовке `X-Telegram-Bot-Api-Secret-Token`. Возвращает `{ ok }`.
 */
export async function setWebhook(url: string, secretToken: string): Promise<{ ok: boolean }> {
  const res = await callBotApi("setWebhook", { url, secret_token: secretToken });
  return { ok: res?.ok === true };
}

const MARKDOWN_V2_SPECIALS = new Set([
  "_",
  "*",
  "[",
  "]",
  "(",
  ")",
  "~",
  "`",
  ">",
  "#",
  "+",
  "-",
  "=",
  "|",
  "{",
  "}",
  ".",
  "!",
]);

/**
 * Экранирование спецсимволов MarkdownV2: `_ * [ ] ( ) ~ \` > # + - = | { } . !`
 *
 * Семантика (для property-теста 5.2 / Property 8): результат ВСЕГДА валиден —
 * каждый спецсимвол предварён ровно одним обратным слешем. Реализация
 * идемпотентна относительно набора спецсимволов: спецсимвол НЕ экранируется
 * повторно, если он уже предварён нечётным числом слешей (т.е. уже экранирован).
 * Поэтому `escapeMarkdownV2(escapeMarkdownV2(s)) === escapeMarkdownV2(s)` и
 * двойного экранирования управляющих слешей не происходит.
 */
export function escapeMarkdownV2(s: string): string {
  let out = "";
  for (const ch of s) {
    if (MARKDOWN_V2_SPECIALS.has(ch)) {
      // Count backslashes already emitted immediately before this position.
      let backslashes = 0;
      for (let j = out.length - 1; j >= 0 && out[j] === "\\"; j--) backslashes++;
      // Even count → not yet escaped → add one. Odd → already escaped → skip.
      if (backslashes % 2 === 0) out += "\\";
    }
    out += ch;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read a response body into memory, aborting (and returning `null`) as soon as
 * the accumulated size exceeds `max`. Streams chunk-by-chunk so an oversize
 * file is never fully buffered (R5.5).
 */
async function readCapped(res: Response, max: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Runtime without a streaming body: buffer then post-check the size.
    const buf = await res.arrayBuffer();
    if (buf.byteLength > max) return null;
    return new Uint8Array(buf);
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    received += value.byteLength;
    if (received > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Encode raw bytes to base64 in chunks (avoids call-stack overflow). */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32 KB
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  heic: "image/heic",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  opus: "audio/ogg",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  webm: "audio/webm",
  mp4: "video/mp4",
};

/**
 * Resolve a MIME type for the data URL: prefer the response `Content-Type`
 * header, then infer from the file extension, finally fall back to a generic
 * binary type.
 */
function resolveMime(contentType: string | null, filePath: string): string {
  if (contentType) {
    const value = contentType.split(";")[0].trim();
    if (value && value !== "application/octet-stream") return value;
  }
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}
