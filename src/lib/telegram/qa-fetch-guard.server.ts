type FetchLike = typeof globalThis.fetch;

export interface TelegramQaMessageRecord {
  method: "sendMessage";
  text: string;
  parseMode?: string;
  messageId?: number;
  responseOk?: boolean;
}

export interface TelegramQaFetchGuard {
  fetch: FetchLike;
  messages: TelegramQaMessageRecord[];
  violations: string[];
}

interface CreateTelegramQaFetchGuardOptions {
  botToken: string;
  qaChatId: number;
  originalFetch?: FetchLike;
}

interface TelegramEnvelope {
  ok?: boolean;
  result?: {
    message_id?: unknown;
  };
}

const TELEGRAM_ORIGIN = "https://api.telegram.org";
const ALLOWED_METHODS = new Set(["sendMessage", "sendChatAction"]);

function inputUrl(input: Parameters<FetchLike>[0]): URL | null {
  try {
    if (typeof input === "string") return new URL(input);
    if (input instanceof URL) return input;
    return new URL(input.url);
  } catch {
    return null;
  }
}

function blockedResponse(): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error_code: 403,
      description: "blocked by production Telegram QA transport guard",
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

function parseJsonBody(init: Parameters<FetchLike>[1]): Record<string, unknown> | null {
  if (typeof init?.body !== "string") return null;
  try {
    const parsed = JSON.parse(init.body) as unknown;
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function safeChatId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Restricts a production QA process to non-destructive Bot API effects in one
 * explicitly configured chat. It never records the bot token or chat id.
 */
export function createTelegramQaFetchGuard(
  options: CreateTelegramQaFetchGuardOptions,
): TelegramQaFetchGuard {
  const originalFetch = options.originalFetch ?? globalThis.fetch;
  const messages: TelegramQaMessageRecord[] = [];
  const violations: string[] = [];
  const expectedPrefix = `/bot${options.botToken}/`;

  const guardedFetch: FetchLike = async (input, init) => {
    const url = inputUrl(input);
    if (!url || url.origin !== TELEGRAM_ORIGIN) return originalFetch(input, init);

    if (!url.pathname.startsWith(expectedPrefix)) {
      violations.push("unexpected Telegram API credential or path");
      return blockedResponse();
    }

    const method = url.pathname.slice(expectedPrefix.length);
    if (!ALLOWED_METHODS.has(method)) {
      violations.push(`unexpected Telegram Bot API method: ${method || "missing"}`);
      return blockedResponse();
    }

    const body = parseJsonBody(init);
    if (!body) {
      violations.push(`${method} did not use a JSON request body`);
      return blockedResponse();
    }
    if (safeChatId(body.chat_id) !== options.qaChatId) {
      violations.push(`${method} targeted a chat other than TELEGRAM_QA_CHAT_ID`);
      return blockedResponse();
    }

    const record: TelegramQaMessageRecord | null =
      method === "sendMessage"
        ? {
            method: "sendMessage" as const,
            text: typeof body.text === "string" ? body.text : "",
            ...(typeof body.parse_mode === "string" ? { parseMode: body.parse_mode } : {}),
          }
        : null;
    if (record) messages.push(record);

    const response = await originalFetch(input, init);
    if (record) {
      try {
        const envelope = (await response.clone().json()) as TelegramEnvelope;
        record.responseOk = envelope.ok === true;
        const messageId = envelope.result?.message_id;
        if (typeof messageId === "number" && Number.isSafeInteger(messageId)) {
          record.messageId = messageId;
        }
      } catch {
        record.responseOk = false;
      }
    }
    return response;
  };

  return { fetch: guardedFetch, messages, violations };
}
