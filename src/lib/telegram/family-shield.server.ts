import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Lang } from "@/lib/i18n";
import { hashIdentifier } from "@/lib/risk/hash";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";

const TABLE = "telegram_family_shield";
const INVITE_PREFIX = "family_";
const BOT_USERNAME = "scamguard_bot";
const NOTIFICATION_COOLDOWN_MS = 2 * 60 * 1000;

export const FAMILY_CB = {
  menu: "family:menu",
  invite: "family:invite",
  notify: "family:notify",
  revoke: "family:revoke",
} as const;

export type FamilyCallback = (typeof FAMILY_CB)[keyof typeof FAMILY_CB];

type FamilyStatus = "pending" | "active" | "revoked";

interface FamilyRow {
  id: string;
  guardian_telegram_user_id: number;
  trusted_telegram_user_id: number | null;
  trusted_chat_id: number | null;
  invite_code_hash: string;
  status: FamilyStatus;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  last_notified_at: string | null;
  updated_at: string;
}

export type FamilyInviteResult =
  | { ok: true; inviteUrl: string }
  | { ok: false; reason: "storage_unavailable" | "hash_unavailable" };

export type FamilyAcceptResult =
  | { ok: true; guardianTelegramUserId: number }
  | { ok: false; reason: "invalid" | "self_link" | "storage_unavailable" | "hash_unavailable" };

export type FamilyNotifyResult =
  | { ok: true; trustedChatId: number }
  | { ok: false; reason: "not_linked" | "cooldown" | "send_failed" | "storage_unavailable" };

export type FamilyRevokeResult =
  | { ok: true }
  | { ok: false; reason: "not_linked" | "storage_unavailable" };

function familyTable() {
  return (supabaseAdmin as unknown as SupabaseClient).from(TABLE);
}

function randomInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

function inviteHashInput(token: string): string {
  return `${INVITE_PREFIX}${token}`;
}

async function hashInviteToken(token: string): Promise<string | null> {
  try {
    return await hashIdentifier(inviteHashInput(token));
  } catch (e) {
    console.error("family shield invite hash failed", e instanceof Error ? e.message : "");
    return null;
  }
}

function buildInviteUrl(token: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${INVITE_PREFIX}${token}`;
}

export function parseFamilyStartArg(arg: string): string | null {
  if (!arg.startsWith(INVITE_PREFIX)) return null;
  const token = arg.slice(INVITE_PREFIX.length).trim();
  return /^[A-Za-z0-9_-]{16,80}$/.test(token) ? token : null;
}

export function parseFamilyCallback(data: string): FamilyCallback | null {
  return Object.values(FAMILY_CB).includes(data as FamilyCallback)
    ? (data as FamilyCallback)
    : null;
}

async function revokePendingInvites(guardianTelegramUserId: number): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await familyTable()
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("guardian_telegram_user_id", guardianTelegramUserId)
    .eq("status", "pending");
  if (error) {
    console.error("family shield revoke pending failed", error.message);
    return false;
  }
  return true;
}

export async function createFamilyInvite(
  guardianTelegramUserId: number,
): Promise<FamilyInviteResult> {
  const token = randomInviteToken();
  const inviteCodeHash = await hashInviteToken(token);
  if (!inviteCodeHash) return { ok: false, reason: "hash_unavailable" };

  try {
    if (!(await revokePendingInvites(guardianTelegramUserId))) {
      return { ok: false, reason: "storage_unavailable" };
    }
    const now = new Date().toISOString();
    const { error } = await familyTable().insert({
      guardian_telegram_user_id: guardianTelegramUserId,
      invite_code_hash: inviteCodeHash,
      status: "pending",
      updated_at: now,
    });
    if (error) {
      console.error("family shield invite insert failed", error.message);
      return { ok: false, reason: "storage_unavailable" };
    }
    return { ok: true, inviteUrl: buildInviteUrl(token) };
  } catch (e) {
    console.error("family shield invite threw", e instanceof Error ? e.message : "");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function acceptFamilyInvite(args: {
  token: string;
  trustedTelegramUserId: number;
  trustedChatId: number;
}): Promise<FamilyAcceptResult> {
  const inviteCodeHash = await hashInviteToken(args.token);
  if (!inviteCodeHash) return { ok: false, reason: "hash_unavailable" };

  try {
    const { data, error } = await familyTable()
      .select("*")
      .eq("invite_code_hash", inviteCodeHash)
      .eq("status", "pending")
      .maybeSingle();
    if (error) {
      console.error("family shield invite lookup failed", error.message);
      return { ok: false, reason: "storage_unavailable" };
    }
    if (!data) return { ok: false, reason: "invalid" };

    const row = data as FamilyRow;
    if (row.guardian_telegram_user_id === args.trustedTelegramUserId) {
      return { ok: false, reason: "self_link" };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await familyTable()
      .update({
        trusted_telegram_user_id: args.trustedTelegramUserId,
        trusted_chat_id: args.trustedChatId,
        status: "active",
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("family shield invite accept failed", updateError.message);
      return { ok: false, reason: "storage_unavailable" };
    }

    return { ok: true, guardianTelegramUserId: row.guardian_telegram_user_id };
  } catch (e) {
    console.error("family shield invite accept threw", e instanceof Error ? e.message : "");
    return { ok: false, reason: "storage_unavailable" };
  }
}

async function getActiveFamilyRow(guardianTelegramUserId: number): Promise<FamilyRow | null> {
  const { data, error } = await familyTable()
    .select("*")
    .eq("guardian_telegram_user_id", guardianTelegramUserId)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    console.error("family shield active lookup failed", error.message);
    return null;
  }
  return (data as FamilyRow | null) ?? null;
}

function isCoolingDown(lastNotifiedAt: string | null, nowMs: number): boolean {
  if (!lastNotifiedAt) return false;
  const lastMs = Date.parse(lastNotifiedAt);
  return Number.isFinite(lastMs) && nowMs - lastMs < NOTIFICATION_COOLDOWN_MS;
}

export function buildTrustedAlertText(lang: Lang): string {
  if (lang === "uz") {
    return (
      "🛡 Ishonch Guard: sizning yaqin insoningiz hozir yordamga muhtoj bo'lishi mumkin.\n\n" +
      "Iltimos, unga hozir qo'ng'iroq qiling yoki yonida bo'ling.\n\n" +
      "Nima qilish kerak:\n" +
      "1. Uni shoshirmang va koyimang.\n" +
      "2. SMS-kod, PIN, CVV, parol, karta rasmi yoki ilova o'rnatishni so'ramang.\n" +
      "3. Bankka faqat rasmiy raqam orqali qayta qo'ng'iroq qilishga yordam bering."
    );
  }
  if (lang === "en") {
    return (
      "🛡 Ishonch Guard: your trusted person may need help right now.\n\n" +
      "Please call them or stay with them for a few minutes.\n\n" +
      "What to do:\n" +
      "1. Do not rush or judge them.\n" +
      "2. Do not ask them to forward SMS codes, PIN, CVV, passwords, card photos, or install apps.\n" +
      "3. Help them call the bank back using an official number."
    );
  }
  return (
    "🛡 Ishonch Guard: вашему близкому сейчас может быть нужна помощь.\n\n" +
    "Пожалуйста, позвоните ему или побудьте рядом несколько минут.\n\n" +
    "Что сделать:\n" +
    "1. Не торопите и не ругайте его.\n" +
    "2. Не просите пересылать SMS-коды, PIN, CVV, пароли, фото карты или ставить приложения.\n" +
    "3. Помогите перезвонить в банк только по официальному номеру."
  );
}

export async function notifyTrustedContact(args: {
  guardianTelegramUserId: number;
  lang: Lang;
}): Promise<FamilyNotifyResult> {
  try {
    const row = await getActiveFamilyRow(args.guardianTelegramUserId);
    if (!row || row.trusted_chat_id === null) return { ok: false, reason: "not_linked" };

    const nowMs = Date.now();
    if (isCoolingDown(row.last_notified_at, nowMs)) {
      return { ok: false, reason: "cooldown" };
    }

    const sent = await sendMessage({
      chatId: row.trusted_chat_id,
      text: escapeMarkdownV2(buildTrustedAlertText(args.lang)),
    });
    if (!sent.ok) return { ok: false, reason: "send_failed" };

    const now = new Date(nowMs).toISOString();
    const { error } = await familyTable()
      .update({ last_notified_at: now, updated_at: now })
      .eq("id", row.id);
    if (error) {
      console.error("family shield notification timestamp failed", error.message);
    }

    return { ok: true, trustedChatId: row.trusted_chat_id };
  } catch (e) {
    console.error("family shield notify threw", e instanceof Error ? e.message : "");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function revokeFamilyShield(
  guardianTelegramUserId: number,
): Promise<FamilyRevokeResult> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await familyTable()
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("guardian_telegram_user_id", guardianTelegramUserId)
      .in("status", ["pending", "active"])
      .select("id");
    if (error) {
      console.error("family shield revoke failed", error.message);
      return { ok: false, reason: "storage_unavailable" };
    }
    return Array.isArray(data) && data.length > 0
      ? { ok: true }
      : { ok: false, reason: "not_linked" };
  } catch (e) {
    console.error("family shield revoke threw", e instanceof Error ? e.message : "");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export function buildFamilyInviteKeyboard(inviteUrl: string, lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("family_btn_open_invite", lang), url: inviteUrl }],
    [{ text: bt("family_btn_revoke", lang), callback_data: FAMILY_CB.revoke }],
  ];
}

export function buildFamilySetupKeyboard(lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("family_btn_create_invite", lang), callback_data: FAMILY_CB.invite }],
    [{ text: bt("family_btn_notify", lang), callback_data: FAMILY_CB.notify }],
  ];
}
