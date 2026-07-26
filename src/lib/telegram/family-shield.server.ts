import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTelegramBotUsername } from "@/lib/config.server";
import type { Lang } from "@/lib/i18n";
import { hashIdentifierCandidates, type IdentifierHash } from "@/lib/risk/hash";
import { escapeMarkdownV2, sendMessage, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { currentTelegramUpdateId } from "@/lib/telegram/update-execution.server";

const TABLE = "telegram_family_shield";
const INVITE_PREFIX = "family_";
const NOTIFICATION_COOLDOWN_MS = 2 * 60 * 1000;
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const FAMILY_ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;

export const FAMILY_CB = {
  menu: "family:menu",
  invite: "family:invite",
  notify: "family:notify",
  codewordGuide: "family:codeword",
  revoke: "family:revoke",
  guardianAutoEnable: "family:guardian_auto_on",
  guardianAutoDisable: "family:guardian_auto_off",
  trustedAck: "family:trusted_ack",
  trustedOptOut: "family:trusted_opt_out",
  trustedAutoEnable: "family:trusted_auto_on",
  trustedAutoDisable: "family:trusted_auto_off",
} as const;

type StaticFamilyCallback = (typeof FAMILY_CB)[keyof typeof FAMILY_CB];
type ScopedFamilyCallback =
  | `${typeof FAMILY_CB.trustedOptOut}:${string}`
  | `${typeof FAMILY_CB.trustedAutoEnable}:${string}`
  | `${typeof FAMILY_CB.trustedAutoDisable}:${string}`;

export type FamilyCallback = StaticFamilyCallback | ScopedFamilyCallback;

type FamilyStatus = "pending" | "active" | "revoked";
export type FamilyNotificationMode = "manual" | "automatic";
export type FamilyConsentRole = "guardian" | "trusted";

interface FamilyRow {
  id: string;
  guardian_telegram_user_id: number;
  trusted_telegram_user_id: number | null;
  trusted_chat_id: number | null;
  invite_code_hash: string;
  invite_code_hash_version?: string;
  status: FamilyStatus;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  last_notified_at: string | null;
  guardian_auto_alerts_enabled: boolean;
  trusted_auto_alerts_enabled: boolean;
  updated_at: string;
}

export type FamilyInviteResult =
  | { ok: true; inviteUrl: string }
  | { ok: false; reason: "already_linked" | "storage_unavailable" | "hash_unavailable" };

export type FamilyAcceptResult =
  | { ok: true; guardianTelegramUserId: number; familyId: string }
  | {
      ok: false;
      reason: "expired" | "invalid" | "self_link" | "storage_unavailable" | "hash_unavailable";
    };

export type FamilyNotifyResult =
  | { ok: true; trustedChatId: number }
  | {
      ok: false;
      reason:
        | "not_linked"
        | "auto_alerts_disabled"
        | "cooldown"
        | "send_failed"
        | "storage_unavailable";
    };

export type FamilyRevokeResult =
  | { ok: true }
  | { ok: false; reason: "not_linked" | "storage_unavailable" };

export type FamilyConsentResult =
  | { ok: true; automaticActive: boolean }
  | { ok: false; reason: "not_linked" | "storage_unavailable" };

interface NotificationClaimRow {
  decision:
    | "claimed"
    | "not_linked"
    | "auto_alerts_disabled"
    | "duplicate"
    | "cooldown"
    | "unavailable";
  claim_id: string | null;
  family_id: string | null;
  trusted_chat_id: number | null;
}

function familyClient(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function familyTable() {
  return familyClient().from(TABLE);
}

function randomInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

function inviteHashInput(token: string): string {
  return `${INVITE_PREFIX}${token}`;
}

async function hashInviteTokenCandidates(token: string): Promise<IdentifierHash[] | null> {
  try {
    return await hashIdentifierCandidates(inviteHashInput(token));
  } catch {
    console.error("family shield invite hash failed", "crypto_exception");
    return null;
  }
}

function establishedHashReadOrder(candidates: IdentifierHash[]): IdentifierHash[] {
  return candidates.length > 1 ? [...candidates.slice(1), candidates[0]!] : candidates;
}

async function findPendingFamilyInvite(
  candidates: IdentifierHash[],
): Promise<{ row: FamilyRow | null; storageError: boolean }> {
  for (const candidate of establishedHashReadOrder(candidates)) {
    const { data, error } = await familyTable()
      .select("*")
      .eq("invite_code_hash", candidate.hash)
      .eq("status", "pending")
      .maybeSingle();
    if (error) return { row: null, storageError: true };
    if (data) return { row: data as FamilyRow, storageError: false };
  }
  return { row: null, storageError: false };
}

function buildInviteUrl(token: string): string {
  return `https://t.me/${getTelegramBotUsername()}?start=${INVITE_PREFIX}${token}`;
}

function buildInviteShareUrl(inviteUrl: string, lang: Lang): string {
  const text: Record<Lang, string> = {
    ru: "Прими приглашение в Семейный щит Ishonch Guard. После Start я смогу позвать тебя, если мне срочно понадобится помощь.",
    uz: "Ishonch Guard Oila qalqoni taklifini qabul qiling. Start bosgandan keyin menga shoshilinch yordam kerak bo'lsa, sizni chaqira olaman.",
    en: "Accept my Ishonch Guard Family Shield invite. After Start, I can notify you if I urgently need help.",
  };
  const params = new URLSearchParams({ url: inviteUrl, text: text[lang] });
  return `https://t.me/share/url?${params.toString()}`;
}

export function parseFamilyStartArg(arg: string): string | null {
  if (!arg.startsWith(INVITE_PREFIX)) return null;
  const token = arg.slice(INVITE_PREFIX.length).trim();
  return /^[A-Za-z0-9_-]{16,80}$/.test(token) ? token : null;
}

export function parseFamilyCallback(data: string): FamilyCallback | null {
  if (Object.values(FAMILY_CB).includes(data as StaticFamilyCallback)) {
    return data as StaticFamilyCallback;
  }

  for (const prefix of [
    FAMILY_CB.trustedOptOut,
    FAMILY_CB.trustedAutoEnable,
    FAMILY_CB.trustedAutoDisable,
  ]) {
    const familyId = familyIdFromCallback(data, prefix);
    if (familyId) return data as ScopedFamilyCallback;
  }

  return null;
}

export function familyIdFromCallback(data: string, prefix: string): string | null {
  if (!data.startsWith(`${prefix}:`)) return null;
  const familyId = data.slice(prefix.length + 1);
  return FAMILY_ID_PATTERN.test(familyId) ? familyId : null;
}

async function revokePendingInvites(guardianTelegramUserId: number): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await familyTable()
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("guardian_telegram_user_id", guardianTelegramUserId)
    .eq("status", "pending");
  if (error) {
    console.error("family shield revoke pending failed", "storage_error");
    return false;
  }
  return true;
}

async function revokeFamilyRow(rowId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await familyTable()
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("id", rowId)
    .eq("status", "pending");
  if (error) {
    console.error("family shield revoke row failed", "storage_error");
    return false;
  }
  return true;
}

function isInviteExpired(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const createdMs = Date.parse(createdAt);
  return Number.isFinite(createdMs) && Date.now() - createdMs > INVITE_TTL_MS;
}

export async function createFamilyInvite(
  guardianTelegramUserId: number,
): Promise<FamilyInviteResult> {
  const token = randomInviteToken();
  const inviteCodeHashes = await hashInviteTokenCandidates(token);
  const activeInviteCodeHash = inviteCodeHashes?.[0];
  if (!activeInviteCodeHash) return { ok: false, reason: "hash_unavailable" };

  try {
    const active = await getActiveFamilyRow(guardianTelegramUserId);
    if (active) return { ok: false, reason: "already_linked" };

    if (!(await revokePendingInvites(guardianTelegramUserId))) {
      return { ok: false, reason: "storage_unavailable" };
    }
    const now = new Date().toISOString();
    const { error } = await familyTable().insert({
      guardian_telegram_user_id: guardianTelegramUserId,
      invite_code_hash: activeInviteCodeHash.hash,
      invite_code_hash_version: activeInviteCodeHash.version,
      status: "pending",
      updated_at: now,
    });
    if (error) {
      console.error("family shield invite insert failed", "storage_error");
      return { ok: false, reason: "storage_unavailable" };
    }
    return { ok: true, inviteUrl: buildInviteUrl(token) };
  } catch {
    console.error("family shield invite threw", "storage_exception");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function acceptFamilyInvite(args: {
  token: string;
  trustedTelegramUserId: number;
  trustedChatId: number;
}): Promise<FamilyAcceptResult> {
  const inviteCodeHashes = await hashInviteTokenCandidates(args.token);
  if (!inviteCodeHashes?.length) return { ok: false, reason: "hash_unavailable" };

  try {
    const lookup = await findPendingFamilyInvite(inviteCodeHashes);
    if (lookup.storageError) {
      console.error("family shield invite lookup failed", "storage_error");
      return { ok: false, reason: "storage_unavailable" };
    }
    if (!lookup.row) return { ok: false, reason: "invalid" };

    const row = lookup.row;
    if (isInviteExpired(row.created_at)) {
      await revokeFamilyRow(row.id);
      return { ok: false, reason: "expired" };
    }

    if (row.guardian_telegram_user_id === args.trustedTelegramUserId) {
      return { ok: false, reason: "self_link" };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await familyTable()
      .update({
        trusted_telegram_user_id: args.trustedTelegramUserId,
        trusted_chat_id: args.trustedChatId,
        guardian_auto_alerts_enabled: false,
        trusted_auto_alerts_enabled: false,
        status: "active",
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("family shield invite accept failed", "storage_error");
      return { ok: false, reason: "storage_unavailable" };
    }

    return {
      ok: true,
      guardianTelegramUserId: row.guardian_telegram_user_id,
      familyId: row.id,
    };
  } catch {
    console.error("family shield invite accept threw", "storage_exception");
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
    console.error("family shield active lookup failed", "storage_error");
    return null;
  }
  return (data as FamilyRow | null) ?? null;
}

function safeGuardianLabel(label?: string): string | null {
  const normalized = label?.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 2) return null;
  if (/https?:\/\/|@|[+]\d{7,}/i.test(normalized)) return null;
  return normalized.slice(0, 40);
}

function guardianLine(lang: Lang, guardianLabel?: string): string {
  const label = safeGuardianLabel(guardianLabel);
  if (!label) {
    if (lang === "uz") return "Bu ogohlantirish sizni ishonchli kontakt qilib ulagan insondan.\n\n";
    if (lang === "en") return "This alert is from someone who linked you as a trusted contact.\n\n";
    return "Это сигнал от человека, который подключил вас как доверенный контакт.\n\n";
  }
  if (lang === "uz") return `Kimga yordam kerak: ${label}.\n\n`;
  if (lang === "en") return `Who needs help: ${label}.\n\n`;
  return `Кому нужна помощь: ${label}.\n\n`;
}

export function buildTrustedAlertText(lang: Lang, guardianLabel?: string): string {
  if (lang === "uz") {
    return (
      "🛡 Ishonch Guard: sizning yaqin insoningiz hozir yordamga muhtoj bo'lishi mumkin.\n\n" +
      guardianLine(lang, guardianLabel) +
      "Iltimos, unga hozir qo'ng'iroq qiling yoki yonida bo'ling.\n\n" +
      "Nima qilish kerak:\n" +
      "1. Uni shoshirmang va koyimang.\n" +
      "2. SMS-kod, PIN, CVV, parol, karta rasmi yoki ilova o'rnatishni so'ramang.\n" +
      "3. Agar ovoz yoki video shubhali bo'lsa, saqlangan raqamga qayta qo'ng'iroq qiling va oilaviy maxfiy so'z yoki shaxsiy savolni so'rang.\n" +
      "4. Bankka faqat rasmiy raqam orqali qayta qo'ng'iroq qilishga yordam bering."
    );
  }
  if (lang === "en") {
    return (
      "🛡 Ishonch Guard: your trusted person may need help right now.\n\n" +
      guardianLine(lang, guardianLabel) +
      "Please call them or stay with them for a few minutes.\n\n" +
      "What to do:\n" +
      "1. Do not rush or judge them.\n" +
      "2. Do not ask them to forward SMS codes, PIN, CVV, passwords, card photos, or install apps.\n" +
      "3. If a voice or video feels suspicious, call back using a saved number and ask the family code word or a private question.\n" +
      "4. Help them call the bank back using an official number."
    );
  }
  return (
    "🛡 Ishonch Guard: вашему близкому сейчас может быть нужна помощь.\n\n" +
    guardianLine(lang, guardianLabel) +
    "Пожалуйста, позвоните ему или побудьте рядом несколько минут.\n\n" +
    "Что сделать:\n" +
    "1. Не торопите и не ругайте его.\n" +
    "2. Не просите пересылать SMS-коды, PIN, CVV, пароли, фото карты или ставить приложения.\n" +
    "3. Если голос или видео вызывают сомнение, перезвоните по сохранённому номеру и спросите семейное кодовое слово или личный вопрос.\n" +
    "4. Помогите перезвонить в банк только по официальному номеру."
  );
}

export function buildFamilyCodewordGuideText(lang: Lang): string {
  return bt("family_codeword_guide", lang);
}

function buildNotificationIdempotencyKey(
  mode: FamilyNotificationMode,
  provided?: string,
): string | null {
  let source: string;
  if (provided !== undefined) {
    const normalized = provided.trim();
    if (!normalized || normalized.length > 512) return null;
    source = `provided:${normalized}`;
  } else {
    const updateId = currentTelegramUpdateId();
    source =
      updateId !== null
        ? `telegram-update:${updateId}:${mode}`
        : `family-request:${randomBytes(18).toString("base64url")}:${mode}`;
  }

  return `family-notification:${createHash("sha256").update(source).digest("hex")}`;
}

async function claimFamilyNotification(args: {
  guardianTelegramUserId: number;
  mode: FamilyNotificationMode;
  idempotencyKey: string;
  cooldownMs: number;
}): Promise<{ row: NotificationClaimRow | null; storageError: boolean }> {
  const cooldownSeconds = Math.max(1, Math.min(86_400, Math.ceil(args.cooldownMs / 1000)));
  const { data, error } = await familyClient().rpc("claim_telegram_family_notification", {
    p_guardian_telegram_user_id: args.guardianTelegramUserId,
    p_mode: args.mode,
    p_idempotency_key: args.idempotencyKey,
    p_cooldown_seconds: cooldownSeconds,
  });
  if (error) {
    console.error("family shield notification claim failed", "storage_error");
    return { row: null, storageError: true };
  }

  const raw = Array.isArray(data) ? data[0] : data;
  return {
    row: raw && typeof raw === "object" ? (raw as NotificationClaimRow) : null,
    storageError: false,
  };
}

async function completeFamilyNotificationClaim(claimId: string, delivered: boolean): Promise<void> {
  try {
    const { data, error } = await familyClient().rpc("complete_telegram_family_notification", {
      p_claim_id: claimId,
      p_delivered: delivered,
    });
    if (error || data !== true) {
      console.error("family shield notification completion failed", "storage_error");
    }
  } catch {
    // Delivery has already succeeded or failed at this point. The claim and
    // cooldown were committed before the network call, so never turn a
    // best-effort outcome write into a second delivery attempt.
    console.error("family shield notification completion threw", "storage_exception");
  }
}

export async function setFamilyAutoAlertsConsent(args: {
  role: FamilyConsentRole;
  telegramUserId: number;
  enabled: boolean;
  familyId?: string;
}): Promise<FamilyConsentResult> {
  try {
    const now = new Date().toISOString();
    const column =
      args.role === "guardian" ? "guardian_auto_alerts_enabled" : "trusted_auto_alerts_enabled";
    let query = familyTable()
      .update({ [column]: args.enabled, updated_at: now })
      .eq("status", "active");

    if (args.role === "guardian") {
      query = query.eq("guardian_telegram_user_id", args.telegramUserId);
    } else {
      if (!args.familyId || !FAMILY_ID_PATTERN.test(args.familyId)) {
        return { ok: false, reason: "not_linked" };
      }
      query = query.eq("id", args.familyId).eq("trusted_telegram_user_id", args.telegramUserId);
    }

    const { data, error } = await query.select(
      "guardian_auto_alerts_enabled,trusted_auto_alerts_enabled",
    );
    if (error) {
      console.error("family shield consent update failed", "storage_error");
      return { ok: false, reason: "storage_unavailable" };
    }

    const row = Array.isArray(data)
      ? (data[0] as
          | {
              guardian_auto_alerts_enabled?: boolean;
              trusted_auto_alerts_enabled?: boolean;
            }
          | undefined)
      : undefined;
    if (!row) return { ok: false, reason: "not_linked" };

    return {
      ok: true,
      automaticActive:
        row.guardian_auto_alerts_enabled === true && row.trusted_auto_alerts_enabled === true,
    };
  } catch {
    console.error("family shield consent update threw", "storage_exception");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function notifyTrustedContact(args: {
  guardianTelegramUserId: number;
  lang: Lang;
  guardianDisplayName?: string;
  cooldownMs?: number;
  mode?: FamilyNotificationMode;
  idempotencyKey?: string;
}): Promise<FamilyNotifyResult> {
  try {
    const mode = args.mode ?? "manual";
    const idempotencyKey = buildNotificationIdempotencyKey(mode, args.idempotencyKey);
    if (!idempotencyKey) return { ok: false, reason: "storage_unavailable" };

    const claim = await claimFamilyNotification({
      guardianTelegramUserId: args.guardianTelegramUserId,
      mode,
      idempotencyKey,
      cooldownMs: args.cooldownMs ?? NOTIFICATION_COOLDOWN_MS,
    });
    if (claim.storageError || !claim.row) {
      return { ok: false, reason: "storage_unavailable" };
    }
    if (claim.row.decision === "not_linked") return { ok: false, reason: "not_linked" };
    if (claim.row.decision === "auto_alerts_disabled") {
      return { ok: false, reason: "auto_alerts_disabled" };
    }
    if (claim.row.decision === "duplicate" || claim.row.decision === "cooldown") {
      return { ok: false, reason: "cooldown" };
    }
    if (
      claim.row.decision !== "claimed" ||
      !claim.row.claim_id ||
      !claim.row.family_id ||
      claim.row.trusted_chat_id === null
    ) {
      return { ok: false, reason: "storage_unavailable" };
    }

    const sent = await sendMessage({
      chatId: claim.row.trusted_chat_id,
      text: escapeMarkdownV2(buildTrustedAlertText(args.lang, args.guardianDisplayName)),
      keyboard: buildTrustedAlertKeyboard(args.lang, claim.row.family_id),
    });
    if (!sent.ok) {
      await completeFamilyNotificationClaim(claim.row.claim_id, false);
      return { ok: false, reason: "send_failed" };
    }

    await completeFamilyNotificationClaim(claim.row.claim_id, true);
    return { ok: true, trustedChatId: claim.row.trusted_chat_id };
  } catch {
    console.error("family shield notify threw", "delivery_exception");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export async function revokeFamilyShieldForTrusted(
  trustedTelegramUserId: number,
  familyId?: string,
): Promise<FamilyRevokeResult> {
  try {
    const now = new Date().toISOString();
    let query = familyTable()
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("trusted_telegram_user_id", trustedTelegramUserId)
      .eq("status", "active");
    if (familyId !== undefined) {
      if (!FAMILY_ID_PATTERN.test(familyId)) return { ok: false, reason: "not_linked" };
      query = query.eq("id", familyId);
    }
    const { data, error } = await query.select("id");
    if (error) {
      console.error("family shield trusted revoke failed", "storage_error");
      return { ok: false, reason: "storage_unavailable" };
    }
    return Array.isArray(data) && data.length > 0
      ? { ok: true }
      : { ok: false, reason: "not_linked" };
  } catch {
    console.error("family shield trusted revoke threw", "storage_exception");
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
      console.error("family shield revoke failed", "storage_error");
      return { ok: false, reason: "storage_unavailable" };
    }
    return Array.isArray(data) && data.length > 0
      ? { ok: true }
      : { ok: false, reason: "not_linked" };
  } catch {
    console.error("family shield revoke threw", "storage_exception");
    return { ok: false, reason: "storage_unavailable" };
  }
}

export function buildFamilyInviteKeyboard(inviteUrl: string, lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("family_btn_open_invite", lang), url: buildInviteShareUrl(inviteUrl, lang) }],
    [{ text: bt("family_btn_revoke", lang), callback_data: FAMILY_CB.revoke }],
  ];
}

export function buildFamilyAlreadyLinkedKeyboard(lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("family_btn_notify", lang), callback_data: FAMILY_CB.notify }],
    [
      {
        text: bt("family_btn_guardian_auto_enable", lang),
        callback_data: FAMILY_CB.guardianAutoEnable,
      },
    ],
    [
      {
        text: bt("family_btn_guardian_auto_disable", lang),
        callback_data: FAMILY_CB.guardianAutoDisable,
      },
    ],
    [{ text: bt("family_btn_codeword", lang), callback_data: FAMILY_CB.codewordGuide }],
    [{ text: bt("family_btn_revoke", lang), callback_data: FAMILY_CB.revoke }],
  ];
}

export function buildTrustedConsentKeyboard(lang: Lang, familyId: string): InlineKeyboard {
  return [
    [
      {
        text: bt("family_btn_trusted_auto_enable", lang),
        callback_data: `${FAMILY_CB.trustedAutoEnable}:${familyId}`,
      },
    ],
    [
      {
        text: bt("family_btn_trusted_auto_disable", lang),
        callback_data: `${FAMILY_CB.trustedAutoDisable}:${familyId}`,
      },
    ],
    [
      {
        text: bt("family_btn_trusted_stop_alerts", lang),
        callback_data: `${FAMILY_CB.trustedOptOut}:${familyId}`,
      },
    ],
  ];
}

export function buildTrustedAlertKeyboard(lang: Lang, familyId: string): InlineKeyboard {
  return [
    [{ text: bt("family_btn_trusted_ack", lang), callback_data: FAMILY_CB.trustedAck }],
    [
      {
        text: bt("family_btn_trusted_stop_alerts", lang),
        callback_data: `${FAMILY_CB.trustedOptOut}:${familyId}`,
      },
    ],
  ];
}

export function buildFamilySetupKeyboard(lang: Lang): InlineKeyboard {
  return [
    [{ text: bt("family_btn_create_invite", lang), callback_data: FAMILY_CB.invite }],
    [{ text: bt("family_btn_codeword", lang), callback_data: FAMILY_CB.codewordGuide }],
    [{ text: bt("family_btn_notify", lang), callback_data: FAMILY_CB.notify }],
  ];
}
