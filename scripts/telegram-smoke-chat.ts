import process from "node:process";

export type TelegramChatType = "private" | "group" | "supergroup" | "channel";

const QA_CHAT_ENV = "TELEGRAM_QA_CHAT_ID";
const MODERATION_CHAT_ENV = "TELEGRAM_MODERATION_CHAT_ID";

function fail(message: string): never {
  throw new Error(message);
}

function parseChatId(raw: string, envName: string): number {
  const value = Number(raw.trim());
  if (!Number.isSafeInteger(value)) fail(`${envName} is not a safe integer`);
  return value;
}

export function readTelegramSmokeChatId(
  env: Pick<NodeJS.ProcessEnv, typeof QA_CHAT_ENV | typeof MODERATION_CHAT_ENV> = process.env,
): number {
  const rawQaChatId = env[QA_CHAT_ENV]?.trim();
  if (!rawQaChatId) {
    if (env[MODERATION_CHAT_ENV]?.trim()) {
      fail(
        `${QA_CHAT_ENV} is not set. Refusing to send user-facing production Telegram smoke ` +
          `messages to ${MODERATION_CHAT_ENV}. Set ${QA_CHAT_ENV} to the existing main/test chat, ` +
          `or another chat that is not the moderation chat.`,
      );
    }
    fail(`${QA_CHAT_ENV} is not set`);
  }

  const qaChatId = parseChatId(rawQaChatId, QA_CHAT_ENV);
  const rawModerationChatId = env[MODERATION_CHAT_ENV]?.trim();
  if (rawModerationChatId) {
    const moderationChatId = parseChatId(rawModerationChatId, MODERATION_CHAT_ENV);
    if (qaChatId === moderationChatId) {
      fail(`${QA_CHAT_ENV} must not equal ${MODERATION_CHAT_ENV}`);
    }
  }

  return qaChatId;
}

export function chatTypeForId(chatId: number): TelegramChatType {
  if (chatId > 0) return "private";
  return String(chatId).startsWith("-100") ? "supergroup" : "group";
}
