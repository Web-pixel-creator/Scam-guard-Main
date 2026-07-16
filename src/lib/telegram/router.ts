// Telegram update router (Ishonch Guard bot).
//
// Decides which handler an incoming Telegram update belongs to and invokes it,
// after loading the user's Session. The routing PRIORITY is fixed by the
// requirements (design.md → "5. Роутер обновлений"):
//
//     callback_query  >  command  >  active scenario step  >  content
//
// Extra rules baked into the decision:
//  - A command (text starting with "/") interrupts an active scenario: the
//    scenario is reset and the command is handled (R15.4).
//  - A forwarded message carries text, so it is routed as ordinary check
//    content — no special-casing needed (R11.5).
//  - `parseCommand` understands the "@botusername" suffix, e.g.
//    "/check@IshonchGuardBot текст" → command "/check", arg "текст".
//
// ── Decoupling from the concrete handlers (tasks 8.2–8.5) ───────────────────
// This module owns ONLY the dispatch logic and the `Handlers` CONTRACT. The
// concrete command/check/report/callback handlers are implemented later (tasks
// 8.2–8.5) and pushed in via `setHandlers(...)` (dependency inversion), so the
// router never imports them. Until they are wired, `dispatchUpdate` falls back
// to harmless logging stubs. Tests inject their own `Handlers` through the
// optional `deps` argument, so the dispatch logic stays pure and observable.
//
// Server-only: pulls in `session.server.ts` (service-role Supabase) at runtime.
// Never import this module into the client bundle.
import { z } from "zod";
import { getTelegramBotUsername } from "@/lib/config.server";
import { classifyMetaIntent, type MetaIntent } from "@/lib/meta-intent";
import { classifyLastCheckFollowUp } from "@/lib/telegram/check-followup";
import type { GuardianAngelSnapshot } from "@/lib/telegram/guardian-angel";
import {
  resolveReplyCheckContext,
  resolveReplyGuardianContext,
} from "@/lib/telegram/reply-check-context";
import {
  isSessionStateScopedToChat,
  loadSession as loadSessionImpl,
  resetScenario as resetScenarioImpl,
  type LastCheckSnapshot,
  type Session,
} from "@/lib/telegram/session.server";
import {
  normalizeForwardSource,
  type TelegramForwardSourceContext,
} from "@/lib/telegram/forward-context";

// ---------------------------------------------------------------------------
// Telegram update schema (only the MVP-relevant fields; everything else is
// ignored via `.passthrough()`). Centralised here so the webhook route (task
// 9.1) and the router share a single source of truth for the update shape.
// ---------------------------------------------------------------------------

const messageEntitySchema = z
  .object({
    type: z.string(),
    offset: z.number(),
    length: z.number(),
    url: z.string().optional(),
  })
  .passthrough();

const inlineKeyboardButtonSchema = z
  .object({
    text: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough();

const photoSizeSchema = z
  .object({
    file_id: z.string(),
    file_size: z.number().optional(),
  })
  .passthrough();

const videoSchema = z
  .object({
    file_id: z.string().optional(),
    file_size: z.number().optional(),
    duration: z.number().optional(),
    thumbnail: photoSizeSchema.optional(),
    thumb: photoSizeSchema.optional(),
  })
  .passthrough();

const voiceSchema = z
  .object({
    file_id: z.string(),
    file_unique_id: z.string().optional(),
    file_size: z.number().optional(),
    duration: z.number().optional(),
    mime_type: z.string().optional(),
  })
  .passthrough();

const audioSchema = z
  .object({
    file_id: z.string(),
    file_unique_id: z.string().optional(),
    file_name: z.string().optional(),
    title: z.string().optional(),
    file_size: z.number().optional(),
    duration: z.number().optional(),
    mime_type: z.string().optional(),
  })
  .passthrough();

const forwardChatSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    username: z.string().optional(),
  })
  .passthrough();

const forwardOriginSchema = z
  .object({
    type: z.string(),
    chat: forwardChatSchema.optional(),
    sender_chat: forwardChatSchema.optional(),
  })
  .passthrough();

const chatSchema = z
  .object({
    id: z.number(),
    type: z.enum(["private", "group", "supergroup", "channel"]).optional(),
  })
  .passthrough();

// Only retain the metadata required to bind a Telegram Reply to a bot result.
// Quoted text/captions are intentionally stripped so credentials or evidence
// from the replied-to message never enter routing/session state.
const repliedMessageSchema = z.object({
  message_id: z.number(),
  from: z
    .object({
      id: z.number(),
      is_bot: z.boolean().optional(),
      username: z.string().optional(),
    })
    .optional(),
});

const messageSchema = z.object({
  message_id: z.number(),
  from: z
    .object({
      id: z.number(),
      first_name: z.string().optional(),
      language_code: z.string().optional(),
    })
    .optional(),
  chat: chatSchema,
  sender_chat: forwardChatSchema.optional(),
  text: z.string().optional(),
  caption: z.string().optional(),
  entities: z.array(messageEntitySchema).optional(),
  caption_entities: z.array(messageEntitySchema).optional(),
  media_group_id: z.string().optional(),
  photo: z.array(photoSizeSchema).optional(),
  document: z
    .object({
      file_id: z.string(),
      file_unique_id: z.string().optional(),
      file_name: z.string().optional(),
      mime_type: z.string().optional(),
      file_size: z.number().optional(),
    })
    .passthrough()
    .optional(),
  contact: z.object({ phone_number: z.string(), first_name: z.string().optional() }).optional(),
  voice: voiceSchema.optional(),
  audio: audioSchema.optional(),
  video: videoSchema.optional(),
  sticker: z.unknown().optional(),
  reply_markup: z
    .object({
      inline_keyboard: z.array(z.array(inlineKeyboardButtonSchema)).optional(),
    })
    .passthrough()
    .optional(),
  forward_origin: forwardOriginSchema.optional(), // public forward source is presentation-only context
  reply_to_message: repliedMessageSchema.optional(),
});

const inlineQuerySchema = z
  .object({
    id: z.string(),
    from: z.object({
      id: z.number(),
      first_name: z.string().optional(),
      language_code: z.string().optional(),
    }),
    query: z.string(),
    offset: z.string().optional(),
  })
  .passthrough();

export const telegramUpdateSchema = z
  .object({
    update_id: z.number(),
    message: messageSchema.optional(),
    inline_query: inlineQuerySchema.optional(),
    callback_query: z
      .object({
        id: z.string(),
        from: z.object({
          id: z.number(),
          first_name: z.string().optional(),
          language_code: z.string().optional(),
        }),
        message: z.object({ chat: chatSchema, message_id: z.number().optional() }).optional(),
        data: z.string(),
      })
      .optional(),
  })
  .passthrough();

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export type TelegramMessage = z.infer<typeof messageSchema>;
export type TelegramInlineQuery = z.infer<typeof inlineQuerySchema>;
export type TelegramChatType = z.infer<typeof chatSchema>["type"];

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/** Commands the bot understands. `command` keeps its leading slash (design.md). */
export type BotCommand =
  | "/start"
  | "/menu"
  | "/lang"
  | "/help"
  | "/chatid"
  | "/call"
  | "/conversation"
  | "/trainer"
  | "/digest"
  | "/appeal"
  | "/safety"
  | "/family"
  | "/check"
  | "/report"
  | "/emergency"
  | "/panic";

const KNOWN_COMMANDS: ReadonlySet<string> = new Set<BotCommand>([
  "/start",
  "/menu",
  "/lang",
  "/help",
  "/chatid",
  "/call",
  "/conversation",
  "/trainer",
  "/digest",
  "/appeal",
  "/safety",
  "/family",
  "/check",
  "/report",
  "/emergency",
  "/panic",
]);

/** Parsed command + the remaining argument on the same message (R4.9). */
export interface ParsedCommand {
  command: BotCommand;
  arg: string; // text after the command (and optional @botusername), trimmed
}

// `/cmd` , `/cmd@Bot` , `/cmd arg...` , `/cmd@Bot arg...` (arg may span newlines).
const COMMAND_RE = /^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]*))?$/;

/**
 * Parse a command from message text, honouring the "@botusername" suffix.
 * Returns `null` when the text is not a recognised command (including unknown
 * "/foo" commands and bare "/"). Command matching is case-insensitive; the
 * returned `command` is normalised to lowercase with its leading slash.
 *
 * Examples:
 *   "/check@IshonchGuardBot текст" → { command: "/check", arg: "текст" }
 *   "/report"                      → { command: "/report", arg: "" }
 *   "/unknown"                     → null
 */
export function parseCommand(text: string, _entities?: unknown[]): ParsedCommand | null {
  const trimmed = text.trimStart();
  const m = COMMAND_RE.exec(trimmed);
  if (!m) return null;
  const command = `/${m[1].toLowerCase()}`;
  if (!KNOWN_COMMANDS.has(command)) return null;
  return { command: command as BotCommand, arg: (m[2] ?? "").trim() };
}

// ---------------------------------------------------------------------------
// Handler contract (implemented by tasks 8.2–8.5) + per-update context
// ---------------------------------------------------------------------------

/** Content kinds the bot cannot act on; mapped to a localized hint/refusal. */
export type OutOfScopeKind =
  | "voice"
  | "audio"
  | "video"
  | "sticker"
  | "document"
  | "empty"
  | "unknown_command";

/** Context handed to every handler — Session is already loaded by the router. */
export interface HandlerCtx {
  chatId: number;
  userId: number;
  chatType?: TelegramChatType;
  session: Session;
  displayName?: string;
  /** Message ID of the message containing inline keyboard (from callback_query). */
  messageId?: number;
  /** Telegram message selected with Reply, if present. */
  replyToMessageId?: number;
  /** True only when the selected message is proven to be this bot's output. */
  replyToOwnBotMessage?: boolean;
  /** Exact bounded check snapshot shown in the selected bot message. */
  replyCheckSnapshot?: LastCheckSnapshot;
  /** Exact bounded Guardian context shown in the selected bot message. */
  replyGuardianSnapshot?: GuardianAngelSnapshot;
}

/** Context for Telegram inline mode. Inline queries have a user, but no chat. */
export interface InlineQueryCtx {
  userId: number;
  session: Session;
  languageCode?: string;
}

/**
 * The set of handlers the router dispatches to. Tasks 8.2–8.5 provide the
 * concrete implementation and register it via `setHandlers(...)`. The router
 * depends only on this abstraction, never on the concrete modules.
 */
export interface Handlers {
  /** Commands: /start, /call, /lang, /help, /safety, /check, /report, /emergency (8.2). */
  handleCommand(cmd: ParsedCommand, ctx: HandlerCtx): Promise<void>;
  /** One step of an active multi-step scenario, e.g. /report (8.4). */
  handleScenarioStep(text: string, ctx: HandlerCtx): Promise<void>;
  /** Image evidence sent while an active scenario explicitly accepts screenshots. */
  handleScenarioImage(fileId: string, ctx: HandlerCtx, mediaGroupId?: string): Promise<void>;
  /** Free text / forwarded text → Check_Pipeline (8.3). */
  handleCheck(
    content: string,
    ctx: HandlerCtx,
    source?: TelegramForwardSourceContext,
  ): Promise<void>;
  /** Plain questions about the bot itself → localized help response. */
  handleMetaIntent(intent: MetaIntent, ctx: HandlerCtx): Promise<void>;
  /** Photo / image-document → OCR → Check_Pipeline (8.3). */
  handleImage(
    fileId: string,
    ctx: HandlerCtx,
    mediaGroupId?: string,
    source?: TelegramForwardSourceContext,
    mediaKind?: ImageRouteMediaKind,
  ): Promise<void>;
  handleVoice(
    fileId: string,
    ctx: HandlerCtx,
    meta?: {
      fileSize?: number;
      duration?: number;
      mimeType?: string;
      fileUniqueId?: string;
      fileName?: string;
      caption?: string;
    },
  ): Promise<void>;
  /** Telegram contact card → phone check (8.3 / R21). */
  handlePhoneFromContact(phone: string, ctx: HandlerCtx): Promise<void>;
  /** Inline-button callbacks: language / Report / Check another / Emergency (8.5). */
  handleCallback(data: string, ctx: HandlerCtx, callbackQueryId?: string): Promise<void>;
  /** Empty / unsupported / out-of-scope input and unknown commands (8.5 / R16, R22). */
  handleOutOfScope(kind: OutOfScopeKind, ctx: HandlerCtx): Promise<void>;
  /** Telegram inline mode: @scamguard_bot <query> in any chat. */
  handleInlineQuery(query: string, ctx: InlineQueryCtx, inlineQueryId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Routing decision (PURE) — fully unit-testable without any I/O (task 8.8)
// ---------------------------------------------------------------------------

/** What the router decided to do with an update. Pure, side-effect free. */
export type ImageRouteMediaKind = "video_thumbnail";

export type RouteAction =
  | { kind: "callback"; data: string; callbackQueryId: string }
  | { kind: "command"; command: ParsedCommand }
  | { kind: "unknownCommand" }
  | { kind: "scenarioStep"; text: string }
  | { kind: "scenarioImage"; fileId: string; mediaGroupId?: string }
  | { kind: "check"; content: string; source?: TelegramForwardSourceContext }
  | {
      kind: "image";
      fileId: string;
      mediaGroupId?: string;
      source?: TelegramForwardSourceContext;
      mediaKind?: ImageRouteMediaKind;
    }
  | {
      kind: "voice";
      fileId: string;
      fileSize?: number;
      duration?: number;
      mimeType?: string;
      fileUniqueId?: string;
      fileName?: string;
      caption?: string;
    }
  | { kind: "contact"; phone: string }
  | { kind: "outOfScope"; reason: OutOfScopeKind }
  | { kind: "ignore" };

/** Who to reply to and on whose behalf. `null` when the update is not actionable. */
export interface RouteTarget {
  userId: number;
  chatId: number;
  chatType?: TelegramChatType;
  displayName?: string;
}

/**
 * Resolve the user + chat to act on. For callbacks the chat may be absent (old
 * messages); in a private chat the chat id equals the user id, so we fall back
 * to `from.id`. Returns `null` for updates we cannot answer (no message and no
 * callback, or a message without a sender such as a channel post).
 */
export function extractTarget(update: TelegramUpdate): RouteTarget | null {
  const cb = update.callback_query;
  if (cb) {
    const target: RouteTarget = { userId: cb.from.id, chatId: cb.message?.chat.id ?? cb.from.id };
    if (cb.message?.chat.type) target.chatType = cb.message.chat.type;
    if (cb.from.first_name) target.displayName = cb.from.first_name;
    return target;
  }
  const m = update.message;
  if (m?.from) {
    const target: RouteTarget = { userId: m.from.id, chatId: m.chat.id };
    if (m.chat.type) target.chatType = m.chat.type;
    if (m.from.first_name) target.displayName = m.from.first_name;
    return target;
  }
  return null;
}

/** Pick the highest-resolution photo's file_id from a Telegram photo array. */
function largestPhotoFileId(photo: NonNullable<TelegramMessage["photo"]>): string | null {
  if (photo.length === 0) return null;
  let best = photo[0];
  for (const p of photo) {
    if ((p.file_size ?? 0) >= (best.file_size ?? 0)) best = p;
  }
  return best.file_id;
}

function videoThumbnailFileId(video: NonNullable<TelegramMessage["video"]>): string | null {
  return video.thumbnail?.file_id ?? video.thumb?.file_id ?? null;
}

const AUDIO_DOCUMENT_EXT_RE = /\.(?:oga|ogg|opus|mp3|m4a|wav|webm)$/i;
const DANGEROUS_FILE_EXT_RE =
  /\.(?:apk|exe|bat|cmd|sh|scr|msi|jar|dll|com|pif|vbs|js|ps1|lnk)(?:[\s.]|$)/i;
const NULL_BYTE = String.fromCharCode(0);
const FILE_NAME_CONFUSABLES: Readonly<Record<string, string>> = {
  а: "a",
  е: "e",
  о: "o",
  р: "p",
  с: "c",
  х: "x",
  к: "k",
  м: "m",
};

function normalizeFileNameForExtensionCheck(fileName: string): string {
  return fileName
    .normalize("NFKC")
    .split(NULL_BYTE)
    .join(" ")
    .replace(/[аеорсхкм]/giu, (char) => FILE_NAME_CONFUSABLES[char.toLowerCase()] ?? char);
}

function isDangerousFileName(fileName?: string): boolean {
  if (!fileName) return false;
  return DANGEROUS_FILE_EXT_RE.test(normalizeFileNameForExtensionCheck(fileName.trim()));
}

function isAudioDocument(document: NonNullable<TelegramMessage["document"]>): boolean {
  const mimeType = document.mime_type?.trim().toLowerCase();
  if (mimeType?.startsWith("audio/")) return true;

  const fileName = document.file_name?.trim();
  return fileName ? AUDIO_DOCUMENT_EXT_RE.test(fileName) : false;
}

function messageCaption(m: TelegramMessage): string {
  return (m.caption ?? "").trim();
}

type MessageEntity = NonNullable<TelegramMessage["entities"]>[number];

function extractTextLinkUrls(entities: readonly MessageEntity[] | undefined): string[] {
  const urls: string[] = [];
  for (const entity of entities ?? []) {
    const url = entity.type === "text_link" ? entity.url?.trim() : "";
    if (url) urls.push(url);
  }
  return urls;
}

function extractInlineKeyboardUrls(m: TelegramMessage): string[] {
  const keyboard = m.reply_markup?.inline_keyboard ?? [];
  const urls: string[] = [];
  for (const row of keyboard) {
    for (const button of row) {
      const url = button.url?.trim();
      if (!url) continue;
      const label = button.text?.trim();
      urls.push(label ? `${label}: ${url}` : url);
    }
  }
  return urls;
}

function appendUniqueEvidence(base: string, extras: readonly string[]): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    parts.push(trimmed);
  };
  add(base);
  extras.forEach(add);
  return parts.join("\n");
}

function textEvidenceFromMessage(m: TelegramMessage): string {
  const base = (m.text ?? m.caption ?? "").trim();
  const entities = m.text != null ? m.entities : m.caption_entities;
  return appendUniqueEvidence(base, [
    ...extractTextLinkUrls(entities),
    ...extractInlineKeyboardUrls(m),
  ]);
}

function forwardSourceFromMessage(m: TelegramMessage): TelegramForwardSourceContext | undefined {
  const origin = m.forward_origin;
  const sourceChat =
    (origin?.type === "channel" ? origin.chat : undefined) ??
    (origin?.type === "chat" ? (origin.sender_chat ?? origin.chat) : undefined) ??
    m.sender_chat;

  if (!sourceChat) return undefined;

  const kind = origin?.type === "channel" || sourceChat.type === "channel" ? "channel" : "chat";
  return (
    normalizeForwardSource({
      kind,
      title: sourceChat.title,
      username: sourceChat.username,
    }) ?? undefined
  );
}

function checkRoute(content: string, source?: TelegramForwardSourceContext): RouteAction {
  return source ? { kind: "check", content, source } : { kind: "check", content };
}

function imageRoute(
  fileId: string,
  mediaGroupId?: string,
  source?: TelegramForwardSourceContext,
  mediaKind?: ImageRouteMediaKind,
): RouteAction {
  const action = mediaGroupId
    ? { kind: "image" as const, fileId, mediaGroupId }
    : { kind: "image" as const, fileId };
  const actionWithMediaKind = mediaKind ? { ...action, mediaKind } : action;
  return source ? { ...actionWithMediaKind, source } : actionWithMediaKind;
}

/**
 * Decide what to do with an update given the user's current Session. PURE:
 * no I/O, no session mutation. The PRIORITY ordering is:
 *   callback > command > active scenario step > content type.
 *
 * Note: a command is returned even while a scenario is active (command wins);
 * the actual scenario reset (R15.4) is performed by `dispatchUpdate`, which
 * owns side effects.
 */
export function decideRoute(update: TelegramUpdate, session: Session): RouteAction {
  // 1) Callback queries take top priority.
  if (update.callback_query) {
    return {
      kind: "callback",
      data: update.callback_query.data,
      callbackQueryId: update.callback_query.id,
    };
  }

  const m = update.message;
  if (!m) return { kind: "ignore" };
  const source = forwardSourceFromMessage(m);

  // 2) Commands (text starting with "/") — beat an active scenario (R15.4).
  const text = m.text;
  if (text && text.trimStart().startsWith("/")) {
    const parsed = parseCommand(text);
    return parsed ? { kind: "command", command: parsed } : { kind: "unknownCommand" };
  }

  // 3) Active scenario → the message is the answer to the current step (R15.3).
  if (session.scenario !== "none") {
    const content = textEvidenceFromMessage(m);
    if (content) return { kind: "scenarioStep", text: content };

    const imageFileId =
      m.photo && m.photo.length > 0
        ? largestPhotoFileId(m.photo)
        : m.document?.mime_type?.startsWith("image/") && !isDangerousFileName(m.document.file_name)
          ? m.document.file_id
          : null;

    if (m.document && isDangerousFileName(m.document.file_name)) {
      return { kind: "outOfScope", reason: "document" };
    }

    if (imageFileId && session.scenario === "report_desc") {
      return m.media_group_id
        ? { kind: "scenarioImage", fileId: imageFileId, mediaGroupId: m.media_group_id }
        : { kind: "scenarioImage", fileId: imageFileId };
    }

    if (imageFileId && session.scenario === "await_check") {
      return imageRoute(imageFileId, m.media_group_id, source);
    }

    return { kind: "scenarioStep", text: m.text ?? m.caption ?? "" };
  }

  // 4) Content type (only when no scenario is active).
  const content = textEvidenceFromMessage(m);
  if (content) return checkRoute(content, source);

  if (m.photo && m.photo.length > 0) {
    const fileId = largestPhotoFileId(m.photo);
    if (fileId) return imageRoute(fileId, m.media_group_id, source);
  }
  if (
    m.document &&
    typeof m.document.mime_type === "string" &&
    !isDangerousFileName(m.document.file_name) &&
    m.document.mime_type.startsWith("image/")
  ) {
    return imageRoute(m.document.file_id, m.media_group_id, source);
  }
  if (m.document && isDangerousFileName(m.document.file_name)) {
    return { kind: "outOfScope", reason: "document" };
  }
  if (m.document && isAudioDocument(m.document)) {
    const caption = messageCaption(m);
    return {
      kind: "voice",
      fileId: m.document.file_id,
      fileSize: m.document.file_size,
      mimeType: m.document.mime_type,
      fileUniqueId: m.document.file_unique_id,
      ...(m.document.file_name ? { fileName: m.document.file_name } : {}),
      ...(caption ? { caption } : {}),
    };
  }
  // Non-image documents (APK, PDF, etc.) — never downloaded, safety advice given.
  if (m.document) {
    return { kind: "outOfScope", reason: "document" };
  }
  if (m.contact) {
    return { kind: "contact", phone: m.contact.phone_number };
  }
  if (m.video != null) {
    const fileId = videoThumbnailFileId(m.video);
    if (fileId) return imageRoute(fileId, m.media_group_id, source, "video_thumbnail");
    return { kind: "outOfScope", reason: "video" };
  }
  if (m.voice != null) {
    return {
      kind: "voice",
      fileId: m.voice.file_id,
      fileSize: m.voice.file_size,
      duration: m.voice.duration,
      mimeType: m.voice.mime_type,
      fileUniqueId: m.voice.file_unique_id,
    };
  }
  if (m.audio != null) {
    const caption = messageCaption(m);
    const fileName = m.audio.file_name ?? m.audio.title;
    if (isDangerousFileName(fileName)) {
      return { kind: "outOfScope", reason: "document" };
    }
    return {
      kind: "voice",
      fileId: m.audio.file_id,
      fileSize: m.audio.file_size,
      duration: m.audio.duration,
      mimeType: m.audio.mime_type,
      fileUniqueId: m.audio.file_unique_id,
      ...(fileName ? { fileName } : {}),
      ...(caption ? { caption } : {}),
    };
  }
  if (m.sticker != null) return { kind: "outOfScope", reason: "sticker" };

  // Plain text (including forwarded text, R11.5) → Check_Pipeline.
  // Empty / anything else we can't act on → supported-input hint (R16.1).
  return { kind: "outOfScope", reason: "empty" };
}

// ---------------------------------------------------------------------------
// Handler registry — lets tasks 8.2–8.5 wire concrete handlers without the
// router importing them (dependency inversion). No module-load side effects.
// ---------------------------------------------------------------------------

/**
 * Placeholder handlers used until tasks 8.2–8.5 register the real ones. They
 * log a warning (no PII / no secrets) and resolve, so an un-wired bot degrades
 * quietly instead of throwing. In production `setHandlers(...)` is called at
 * startup, so these are never hit.
 */
const stubHandlers: Handlers = {
  async handleCommand(cmd) {
    console.warn(`telegram router: no handler wired for command ${cmd.command}`);
  },
  async handleScenarioStep() {
    console.warn("telegram router: no handler wired for scenario step");
  },
  async handleScenarioImage() {
    console.warn("telegram router: no handler wired for scenario image");
  },
  async handleCheck() {
    console.warn("telegram router: no handler wired for check");
  },
  async handleMetaIntent(intent) {
    console.warn(`telegram router: no handler wired for meta intent (${intent})`);
  },
  async handleImage() {
    console.warn("telegram router: no handler wired for image");
  },
  async handleVoice() {
    console.warn("telegram router: no handler wired for voice");
  },
  async handlePhoneFromContact() {
    console.warn("telegram router: no handler wired for contact");
  },
  async handleCallback() {
    console.warn("telegram router: no handler wired for callback");
  },
  async handleOutOfScope(kind) {
    console.warn(`telegram router: no handler wired for out-of-scope (${kind})`);
  },
  async handleInlineQuery() {
    console.warn("telegram router: no handler wired for inline query");
  },
};

let registeredHandlers: Handlers | null = null;

/** Register the concrete handler set (called once at startup by tasks 8.2–8.5). */
export function setHandlers(handlers: Handlers): void {
  registeredHandlers = handlers;
}

/** Current handler set: the registered one, or the logging stubs as fallback. */
export function getHandlers(): Handlers {
  return registeredHandlers ?? stubHandlers;
}

// ---------------------------------------------------------------------------
// Dispatch (EFFECTFUL) — loads the session, applies side effects, invokes the
// chosen handler. Dependencies are injectable for tests.
// ---------------------------------------------------------------------------

export interface DispatchDeps {
  handlers: Handlers;
  loadSession: (userId: number, langHint?: string) => Promise<Session>;
  resetScenario: (userId: number) => Promise<void>;
}

export type Dispatch = (update: TelegramUpdate) => Promise<void>;

/**
 * Dispatch an incoming Telegram update to the right handler.
 *
 *  1. Resolve the user/chat; ignore non-actionable updates.
 *  2. Load the Session (language + scenario step).
 *  3. Decide the route (callback > command > scenario > content).
 *  4. If a command interrupts an active scenario, reset the scenario first so
 *     the command handler sees a neutral Session (R15.4).
 *  5. Invoke the matching handler with the loaded `HandlerCtx`.
 *
 * Handler errors are NOT swallowed here — the webhook route (task 9.1) wraps
 * dispatch in try/catch, logs without Sensitive_Data and returns 200 so
 * Telegram does not retry (R12.5).
 */
export async function dispatchUpdate(
  update: TelegramUpdate,
  deps?: Partial<DispatchDeps>,
): Promise<void> {
  const handlers = deps?.handlers ?? getHandlers();
  const loadSession = deps?.loadSession ?? loadSessionImpl;
  const resetScenario = deps?.resetScenario ?? resetScenarioImpl;

  if (update.inline_query) {
    const query = update.inline_query;
    const userId = query.from.id;
    const session = await loadSession(userId, query.from.language_code);
    await handlers.handleInlineQuery(
      query.query,
      { userId, session, languageCode: query.from.language_code },
      query.id,
    );
    return;
  }

  const target = extractTarget(update);
  if (!target) return; // nothing/no-one to respond to

  const { userId, chatId, chatType, displayName } = target;
  // First contact before /start language pick: fall back to the Telegram
  // client language so an Uzbek speaker is not answered in Russian.
  const langHint =
    update.message?.from?.language_code ?? update.callback_query?.from?.language_code;
  let session = await loadSession(userId, langHint);
  if (!isSessionStateScopedToChat(session, chatId, chatType)) {
    await resetScenario(userId);
    session = { ...session, scenario: "none", scenarioStep: 0, scenarioData: {} };
  }
  const action = decideRoute(update, session);

  // R15.4 — a command aborts any active scenario before being handled.
  if (
    (action.kind === "command" || action.kind === "unknownCommand") &&
    session.scenario !== "none"
  ) {
    await resetScenario(userId);
    session = { ...session, scenario: "none", scenarioStep: 0, scenarioData: {} };
  }

  const ctx: HandlerCtx = { chatId, userId, chatType, session };
  if (displayName) ctx.displayName = displayName;

  const repliedMessage = update.message?.reply_to_message;
  if (repliedMessage) {
    ctx.replyToMessageId = repliedMessage.message_id;
    const replyCheckSnapshot = resolveReplyCheckContext(
      session.scenarioData,
      repliedMessage.message_id,
    );
    const replyGuardianSnapshot = resolveReplyGuardianContext(
      session.scenarioData,
      repliedMessage.message_id,
    );
    if (replyCheckSnapshot) {
      ctx.replyToOwnBotMessage = true;
      ctx.replyCheckSnapshot = replyCheckSnapshot;
      if (replyGuardianSnapshot) ctx.replyGuardianSnapshot = replyGuardianSnapshot;
    } else {
      const replyAuthor = repliedMessage.from;
      const configuredUsername = getTelegramBotUsername().toLowerCase();
      if (
        replyAuthor?.is_bot === true &&
        replyAuthor.username?.toLowerCase() === configuredUsername
      ) {
        ctx.replyToOwnBotMessage = true;
      }
    }
  }

  // Populate messageId from callback_query.message.message_id when available.
  if (update.callback_query?.message?.message_id != null) {
    ctx.messageId = update.callback_query.message.message_id;
  }

  switch (action.kind) {
    case "callback":
      await handlers.handleCallback(action.data, ctx, action.callbackQueryId);
      break;
    case "command":
      await handlers.handleCommand(action.command, ctx);
      break;
    case "unknownCommand":
      await handlers.handleOutOfScope("unknown_command", ctx);
      break;
    case "scenarioStep":
      await handlers.handleScenarioStep(action.text, ctx);
      break;
    case "scenarioImage":
      await handlers.handleScenarioImage(action.fileId, ctx, action.mediaGroupId);
      break;
    case "check": {
      // Questions about an immediately preceding result must keep that result's
      // bounded provenance.  Routing them through a generic meta answer first
      // loses the saved reason codes and produces circular explanations such as
      // "the domain is suspicious because it is suspicious".
      const intent = classifyMetaIntent(action.content, {
        isForwarded: update.message?.forward_origin != null,
      });
      const followUpData = ctx.replyCheckSnapshot
        ? { lastCheck: ctx.replyCheckSnapshot }
        : session.scenarioData;
      const recentFollowUp = classifyLastCheckFollowUp(action.content, followUpData);
      const needsRecentProvenance =
        recentFollowUp && (!intent || intent === "explain_risk" || intent === "how_do_you_check");
      if (needsRecentProvenance) {
        await handlers.handleCheck(action.content, ctx, action.source);
        break;
      }
      if (intent) {
        await handlers.handleMetaIntent(intent, ctx);
        break;
      }
      await handlers.handleCheck(action.content, ctx, action.source);
      break;
    }
    case "image":
      if (session.scenario === "await_check") {
        await resetScenario(userId);
        await handlers.handleImage(
          action.fileId,
          { ...ctx, session: { ...session, scenario: "none", scenarioStep: 0, scenarioData: {} } },
          action.mediaGroupId,
          action.source,
          action.mediaKind,
        );
        break;
      }
      await handlers.handleImage(
        action.fileId,
        ctx,
        action.mediaGroupId,
        action.source,
        action.mediaKind,
      );
      break;
    case "voice":
      await handlers.handleVoice(action.fileId, ctx, {
        fileSize: action.fileSize,
        duration: action.duration,
        mimeType: action.mimeType,
        fileUniqueId: action.fileUniqueId,
        fileName: action.fileName,
        caption: action.caption,
      });
      break;
    case "contact":
      await handlers.handlePhoneFromContact(action.phone, ctx);
      break;
    case "outOfScope":
      await handlers.handleOutOfScope(action.reason, ctx);
      break;
    case "ignore":
      break;
  }
}
