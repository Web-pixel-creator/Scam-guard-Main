// Production smoke for Telegram Voice-out prerecorded OGG assets.
//
// Usage:
//   railway run npm run prod:telegram-voice-out-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-voice-out-smoke
//   railway run npx vite-node scripts/prod-telegram-voice-out-smoke.ts --skip-webhook
//
// Security: uses a synthetic Telegram user, never prints secrets or chat ids,
// sends only to TELEGRAM_QA_CHAT_ID, deletes direct Bot API test audio,
// and removes its own webhook/session DB rows. The app-generated voice-out
// audio may remain in the QA chat as live playback evidence.
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chatTypeForId,
  readTelegramSmokeChatId,
  type TelegramChatType,
} from "./telegram-smoke-chat";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const TELEGRAM_API_BASE = "https://api.telegram.org/bot";
const VOICE_OUT_DIR = path.join(process.cwd(), "public", "audio", "voice-out");
const LANGS = ["ru", "uz", "en"] as const;

type Lang = (typeof LANGS)[number];

interface TelegramApiEnvelope<T> {
  ok?: boolean;
  result?: T;
  error_code?: number;
  description?: string;
}

interface SendAudioResult {
  message_id: number;
  chat: {
    id: number;
    type?: TelegramChatType;
  };
  audio?: {
    file_id?: string;
    file_size?: number;
    mime_type?: string;
    duration?: number;
  };
}

interface Options {
  publicUrl: string | null;
  panicId: number;
  skipWebhook: boolean;
}

function fail(message: string): never {
  throw new Error(message);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

function parsePublicUrl(raw: string | undefined): string {
  if (!raw) {
    fail(
      "missing public URL. Pass it as the first argument or set PUBLIC_APP_URL. " +
        "Example: npm run prod:telegram-voice-out-smoke -- https://your-app.example.com",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid public URL: ${raw}`);
  }

  if (parsed.protocol !== "https:") {
    fail(`public URL must use https, got ${parsed.protocol}`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function parseOptions(): Options {
  const args = process.argv.slice(2);
  const publicUrlArg = args.find((value) => !value.startsWith("--"));
  const panicArg = args.find((value) => value.startsWith("--panic="));
  const skipWebhook = args.includes("--skip-webhook");
  const panicId = panicArg ? Number(panicArg.slice("--panic=".length)) : 6;
  if (!Number.isInteger(panicId) || panicId < 1 || panicId > 15) {
    fail(`--panic must be an integer from 1 to 15, got ${panicArg ?? "default"}`);
  }

  return {
    publicUrl: skipWebhook ? null : parsePublicUrl(publicUrlArg ?? process.env.PUBLIC_APP_URL),
    panicId,
    skipWebhook,
  };
}

function randomLetters(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function nextUpdateId(): number {
  return 1_784_000_000 + Math.floor(Math.random() * 1_000_000);
}

function syntheticTelegramUserId(): number {
  return 8_884_000_000_000 + Math.floor(Math.random() * 1_000_000);
}

function untypedSupabase(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

async function callTelegramJson<T>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) fail(`Telegram ${method} returned status=${res.status}`);

  const data = (await res.json()) as TelegramApiEnvelope<T>;
  if (data.ok !== true || data.result === undefined) {
    const code = data.error_code === undefined ? "unknown" : String(data.error_code);
    const description = data.description ? ` ${data.description}` : "";
    fail(`Telegram ${method} failed code=${code}${description}`);
  }
  return data.result;
}

async function callTelegramForm<T>(botToken: string, method: string, form: FormData): Promise<T> {
  const res = await fetch(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) fail(`Telegram ${method} returned status=${res.status}`);

  const data = (await res.json()) as TelegramApiEnvelope<T>;
  if (data.ok !== true || data.result === undefined) {
    const code = data.error_code === undefined ? "unknown" : String(data.error_code);
    const description = data.description ? ` ${data.description}` : "";
    fail(`Telegram ${method} failed code=${code}${description}`);
  }
  return data.result;
}

async function deleteTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
): Promise<void> {
  try {
    await callTelegramJson<boolean>(botToken, "deleteMessage", {
      chat_id: chatId,
      message_id: messageId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`WARN cleanup deleteMessage failed: ${message}`);
  }
}

async function sendDirectOggAcceptance(
  botToken: string,
  chatId: number,
  panicId: number,
  lang: Lang,
  marker: string,
): Promise<number> {
  const filename = `panic-${panicId}-${lang}.ogg`;
  const bytes = await readFile(path.join(VOICE_OUT_DIR, filename));
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("audio", new Blob([bytes], { type: "audio/ogg" }), filename);
  form.set("caption", `Ishonch Guard QA Voice-out OGG smoke ${marker} ${filename}.`);
  form.set("disable_notification", "true");

  const result = await callTelegramForm<SendAudioResult>(botToken, "sendAudio", form);
  if (!result.message_id) fail(`Telegram sendAudio did not return message_id for ${filename}`);
  return result.message_id;
}

async function postWebhook(
  publicUrl: string,
  webhookSecret: string,
  update: unknown,
): Promise<Response> {
  return fetch(`${publicUrl}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SECRET_HEADER]: webhookSecret,
    },
    body: JSON.stringify(update),
  });
}

function voiceOutCallbackUpdate(options: {
  updateId: number;
  callbackQueryId: string;
  userId: number;
  chatId: number;
  chatType: TelegramChatType;
  panicId: number;
  marker: string;
}) {
  return {
    update_id: options.updateId,
    callback_query: {
      id: options.callbackQueryId,
      from: { id: options.userId, is_bot: false, first_name: "QA" },
      message: {
        message_id: options.updateId,
        chat: { id: options.chatId, type: options.chatType },
        date: Math.floor(Date.now() / 1000),
        text: `Ishonch Guard QA Voice-out callback ${options.marker}`,
      },
      chat_instance: `qa-${options.marker}`,
      data: `voiceout:panic:${options.panicId}`,
    },
  };
}

async function cleanupDb(userId: number, updateId: number): Promise<void> {
  const updateCleanup = await untypedSupabase()
    .from("telegram_webhook_updates")
    .delete()
    .eq("update_id", updateId);
  if (updateCleanup.error) {
    console.error(`WARN cleanup telegram_webhook_updates failed: ${updateCleanup.error.message}`);
  }

  const sessionCleanup = await untypedSupabase()
    .from("telegram_sessions")
    .delete()
    .eq("telegram_user_id", userId);
  if (sessionCleanup.error) {
    console.error(`WARN cleanup telegram_sessions failed: ${sessionCleanup.error.message}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions();
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const webhookSecret = options.skipWebhook ? null : getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const chatId = readTelegramSmokeChatId();
  const chatType = chatTypeForId(chatId);
  const marker = `QAVOICEOUT${randomLetters(8)}`;
  const directMessageIds: number[] = [];
  const updateId = nextUpdateId();
  const userId = syntheticTelegramUserId();

  if (options.publicUrl) {
    console.log(`Production Telegram Voice-out smoke target: ${options.publicUrl}`);
  } else {
    console.log("Production Telegram Voice-out smoke target: skipped");
  }
  console.log(`QA marker: ${marker}`);
  console.log("Secret values, chat id, and synthetic Telegram id are not printed.");

  try {
    for (const lang of LANGS) {
      const messageId = await sendDirectOggAcceptance(
        botToken,
        chatId,
        options.panicId,
        lang,
        marker,
      );
      directMessageIds.push(messageId);
      console.log(`OK Telegram sendAudio accepted panic-${options.panicId}-${lang}.ogg`);
    }

    if (options.publicUrl && webhookSecret) {
      const res = await postWebhook(
        options.publicUrl,
        webhookSecret,
        voiceOutCallbackUpdate({
          updateId,
          callbackQueryId: `${marker}-${updateId}`,
          userId,
          chatId,
          chatType,
          panicId: options.panicId,
          marker,
        }),
      );
      if (res.status !== 200) fail(`voice-out callback webhook returned status=${res.status}`);
      console.log("OK production webhook accepted Voice-out panic callback");
    } else {
      console.log("OK production webhook callback skipped");
    }
  } finally {
    for (const messageId of directMessageIds) {
      await deleteTelegramMessage(botToken, chatId, messageId);
    }
    if (!options.skipWebhook) {
      await cleanupDb(userId, updateId);
    }
  }

  console.log("OK cleanup done");
  console.log(
    options.skipWebhook
      ? "OK Telegram Voice-out OGG acceptance smoke passed"
      : "OK production Telegram Voice-out smoke passed; app-generated audio may remain as live evidence",
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram Voice-out smoke: ${message}`);
  process.exitCode = 1;
});
