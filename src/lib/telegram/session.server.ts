// Telegram bot session store — source of truth for the chosen language and the
// current scenario step of each Telegram user. Backed by the `telegram_sessions`
// Supabase table and accessed exclusively through the service-role client
// (`supabaseAdmin`), so this module is server-only (R17.3, CODING_RULES §2).
//
// State is NOT kept in-memory: Node instances do not share memory and restarts
// lose process-local state, so the dialog state lives in Postgres (R15.1).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Lang } from "@/lib/i18n";
import type { InputType } from "@/lib/risk/detect";
import type { GuardianAngelSnapshot } from "@/lib/telegram/guardian-angel";
import type { RiskLevel } from "@/lib/risk/rules";
import {
  currentTelegramSessionLanguage,
  currentTelegramUpdateId,
  currentTelegramUpdateLease,
  markTelegramSessionStorageFailure,
  rememberTelegramSessionLanguage,
} from "@/lib/telegram/update-execution.server";

export type SessionChatType = "private" | "group" | "supergroup" | "channel";

export interface SessionChatScope {
  chatId: number;
  chatType: SessionChatType;
}

export interface ReportDraftTarget {
  type: InputType;
  hash: string;
  display: string;
  incidentOnly: boolean;
}

export type Scenario =
  | "none" // нейтральное состояние
  | "await_check" // после /check ждём контент
  | "conversation_check" // ждём несколько текстовых сообщений для проверки диалога
  | "report_value" // ждём значение жалобы
  | "report_desc" // ждём описание
  | "report_scamType" // опционально
  | "report_city" // опционально
  | "report_amount"; // опционально

export interface ReportDraft {
  /**
   * Legacy pre-DSCAN-R2-004 raw target from existing rows only. New saves must
   * convert it into `target` and remove this field before persistence.
   */
  value?: string;
  target?: ReportDraftTarget;
  noValue?: boolean;
  /** Redacted report narrative only; never raw user evidence. */
  description?: string;
  scamType?: string;
  city?: string;
  amountLostUzs?: number;
  /**
   * Chat boundary for state that can influence a later bot response. This
   * prevents private context from being reused in group chats by the same user.
   */
  chatScope?: SessionChatScope;
  /**
   * Emergency Copilot v2 context. Stores only a scenario id + timestamp,
   * never raw user evidence, codes, phone numbers, links or card data.
   */
  lastPanicId?: number;
  lastPanicAt?: string;
  /**
   * Non-sensitive caller category for live-call SOS copy. Stores only a coarse
   * context label, never the caller text, number, URL, or account.
   */
  lastLiveCallContext?: "generic" | "bank" | "government" | "operator" | "relative";
  /**
   * Last check context for short follow-up questions like "точно?".
   * Stores only non-sensitive summary metadata: no raw input, OCR text,
   * phone numbers, URLs, card data, codes or image bytes.
   */
  lastCheck?: LastCheckSnapshot;
  /**
   * Guardian Angel v1 context for post-high-risk guidance.
   * Stores only summary metadata: no raw input, OCR text, URLs, phone numbers,
   * screenshots, codes, card data or files.
   */
  guardian?: GuardianAngelSnapshot;
  /**
   * Conversation Check v1 draft. Stores only derived metadata while collecting
   * a short user-supplied conversation. Never store raw chat text, OCR, links,
   * phone numbers, usernames, cards, codes, passwords, seed phrases or files.
   */
  conversation?: ConversationDraftSnapshot;
}

export type LastCheckContext =
  | "image_unreadable"
  | "qr_menu"
  | "delivery"
  | "crypto"
  | "phone"
  | "telegram_profile"
  | "generic";

export type LastCheckEvidenceMethod =
  | "text_pattern"
  | "url_structure"
  | "domain_comparison"
  | "phone_format"
  | "telegram_visible"
  | "official_directory"
  | "local_reports"
  | "external_reputation"
  | "context";

export type LastCheckEvidenceSource =
  | "visible_input"
  | "official_directory"
  | "moderated_reports"
  | "external_reputation";

export type LastCheckEvidenceLimitation =
  | "signal_not_proof"
  | "format_only"
  | "telegram_visible_only"
  | "official_identifier_only"
  | "report_scope"
  | "external_scope"
  | "context_only";

export interface LastCheckProvenance {
  methods: LastCheckEvidenceMethod[];
  sources: LastCheckEvidenceSource[];
  limitations: LastCheckEvidenceLimitation[];
}

export interface LastCheckSnapshot {
  level: RiskLevel;
  type: InputType;
  context: LastCheckContext;
  /** Non-sensitive reason codes only; no raw user text, links, numbers, OCR, or image bytes. */
  reasons?: string[];
  /** Bounded enum-only methodology snapshot; never raw evidence or provider payloads. */
  provenance?: LastCheckProvenance;
  at: string;
}

export type ConversationStage =
  | "opener"
  | "trust_building"
  | "authority_claim"
  | "urgency"
  | "verification_request"
  | "payment_request"
  | "apk_install"
  | "qr_login"
  | "investment_pitch"
  | "romance_pivot";

export type ConversationRequestedAction =
  | "say_code"
  | "send_card"
  | "transfer_money"
  | "install_app"
  | "scan_qr"
  | "connect_wallet"
  | "send_document"
  | "keep_call";

export type ConversationPressureFlag =
  | "urgent"
  | "secrecy"
  | "fear"
  | "promised_profit"
  | "relationship_trust"
  | "official_impersonation";

export interface ConversationDraftSnapshot {
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  totalChars: number;
  strongestLevel: RiskLevel;
  stageCounts: Partial<Record<ConversationStage, number>>;
  reasonCounts: Record<string, number>;
  requestedActions: ConversationRequestedAction[];
  pressureFlags: ConversationPressureFlag[];
}

export interface Session {
  telegramUserId: number;
  lang: Lang; // default "ru" если не задан (R1.4)
  scenario: Scenario;
  scenarioStep: number;
  scenarioData: ReportDraft; // jsonb
  updatedAt: string;
}

const TABLE = "telegram_sessions";

const VALID_LANGS: readonly Lang[] = ["ru", "uz", "en"];
const VALID_SCENARIOS: readonly Scenario[] = [
  "none",
  "await_check",
  "conversation_check",
  "report_value",
  "report_desc",
  "report_scamType",
  "report_city",
  "report_amount",
];

/** Shape of a `telegram_sessions` row as declared by the SQL migration. */
interface TelegramSessionRow {
  telegram_user_id: number;
  lang: string;
  scenario: string;
  scenario_step: number;
  scenario_data: ReportDraft | null;
  updated_at: string;
}

/**
 * CAST BOUNDARY — single, isolated escape hatch.
 *
 * `telegram_sessions` is created by migration `20260531090000_*.sql`, but the
 * generated Supabase types (`src/integrations/supabase/types.ts`) have NOT been
 * regenerated yet in this environment, so the typed `supabaseAdmin` client does
 * not know the table. We cast the client to an untyped `SupabaseClient` here and
 * nowhere else; every public function below is strictly typed (no `any` leaks).
 *
 * TODO: once `types.ts` is regenerated after applying the migration, delete this
 * helper and call `supabaseAdmin.from("telegram_sessions")` directly.
 */
function sessions() {
  return (supabaseAdmin as unknown as SupabaseClient).from(TABLE);
}

function sessionRpc() {
  return supabaseAdmin as unknown as SupabaseClient;
}

function asLang(value: unknown): Lang {
  return typeof value === "string" && (VALID_LANGS as readonly string[]).includes(value)
    ? (value as Lang)
    : "ru";
}

function asScenario(value: unknown): Scenario {
  return typeof value === "string" && (VALID_SCENARIOS as readonly string[]).includes(value)
    ? (value as Scenario)
    : "none";
}

/**
 * Первый контакт до выбора языка в /start: используем `language_code` из
 * Telegram как подсказку, чтобы узбекоязычный пользователь не получал русский
 * ответ. Подсказка не сохраняется — выбор языка в /start остаётся источником
 * истины, как только строка сессии существует.
 */
export function langFromTelegramCode(code: string | undefined): Lang | null {
  if (!code) return null;
  const lower = code.toLowerCase();
  if (lower === "uz" || lower.startsWith("uz-")) return "uz";
  if (lower === "en" || lower.startsWith("en-")) return "en";
  if (lower === "ru" || lower.startsWith("ru-")) return "ru";
  return null;
}

function defaultSession(telegramUserId: number, langHint?: string): Session {
  // R1.4 — отсутствует сохранённый язык → дефолт ru (или язык клиента Telegram),
  // нейтральный сценарий.
  return {
    telegramUserId,
    lang: langFromTelegramCode(langHint) ?? "ru",
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date().toISOString(),
  };
}

function rowToSession(row: TelegramSessionRow): Session {
  return {
    telegramUserId: Number(row.telegram_user_id),
    lang: asLang(row.lang),
    scenario: asScenario(row.scenario),
    scenarioStep: typeof row.scenario_step === "number" ? row.scenario_step : 0,
    scenarioData: row.scenario_data ?? {},
    updatedAt: row.updated_at,
  };
}

function normalizeChatType(chatType?: SessionChatType): SessionChatType {
  return chatType ?? "private";
}

function hasStatefulScenarioData(data: ReportDraft | undefined): boolean {
  if (!data) return false;
  return Boolean(
    data.lastPanicId ?? data.lastPanicAt ?? data.lastCheck ?? data.guardian ?? data.conversation,
  );
}

export function withSessionChatScope(
  data: ReportDraft | undefined,
  chatId: number,
  chatType?: SessionChatType,
): ReportDraft {
  return {
    ...(data ?? {}),
    chatScope: {
      chatId,
      chatType: normalizeChatType(chatType),
    },
  };
}

export function isSessionStateScopedToChat(
  session: Session,
  chatId: number,
  chatType?: SessionChatType,
): boolean {
  const affectsNextReply =
    session.scenario !== "none" || hasStatefulScenarioData(session.scenarioData);
  if (!affectsNextReply) return true;

  const scope = session.scenarioData.chatScope;
  if (!scope || typeof scope.chatId !== "number") return false;

  return scope.chatId === chatId && scope.chatType === normalizeChatType(chatType);
}

/**
 * Загрузка сессии по Telegram_User_Id. При отсутствии строки возвращает
 * безопасный дефолт с языком из Telegram hint. В webhook-контексте сбой чтения
 * fail-closed: помечает storage failure и бросает stage-only ошибку, чтобы
 * текущий шаг не обрабатывался поверх вымышленной пустой сессии. Вне webhook
 * сохраняется legacy/default fallback для локальных инструментов (R1.4, R15.1).
 */
export async function loadSession(telegramUserId: number, langHint?: string): Promise<Session> {
  try {
    const lease = currentTelegramUpdateLease();
    let data: unknown;
    let error: unknown;
    if (lease) {
      const result = await sessionRpc().rpc("load_telegram_session_fenced", {
        p_telegram_user_id: telegramUserId,
        p_update_id: lease.updateId,
        p_lease_token: lease.leaseToken,
        p_processing_fence: lease.processingFence,
        p_leader_token: lease.leaderToken ?? null,
        p_leader_fence: lease.leaderFence ?? null,
      });
      error = result.error;
      const envelope = result.data;
      if (
        !error &&
        envelope !== null &&
        typeof envelope === "object" &&
        !Array.isArray(envelope) &&
        (envelope as Record<string, unknown>).lease_valid === true
      ) {
        data = (envelope as Record<string, unknown>).session ?? null;
      } else if (!error) {
        error = new Error("invalid_or_stale_lease");
      }
    } else {
      const result = await sessions()
        .select("*")
        .eq("telegram_user_id", telegramUserId)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error("telegram loadSession failed", lease ? "fenced_rpc" : "select");
      if (currentTelegramUpdateId() !== null) {
        markTelegramSessionStorageFailure();
        throw new TelegramSessionLoadError();
      }
      return defaultSession(telegramUserId, langHint);
    }
    if (!data) {
      const session = defaultSession(telegramUserId, langHint);
      rememberTelegramSessionLanguage(session.lang);
      return session;
    }

    const session = rowToSession(data as TelegramSessionRow);
    rememberTelegramSessionLanguage(session.lang);
    return session;
  } catch (e) {
    if (e instanceof TelegramSessionLoadError) throw e;
    console.error("telegram loadSession failed", "exception");
    if (currentTelegramUpdateId() !== null) {
      markTelegramSessionStorageFailure();
      throw new TelegramSessionLoadError();
    }
    return defaultSession(telegramUserId, langHint);
  }
}

export class TelegramSessionLoadError extends Error {
  constructor() {
    super("telegram_session_load_failed");
    this.name = "TelegramSessionLoadError";
  }
}

/**
 * Частичное сохранение состояния сессии (upsert по `telegram_user_id`).
 * Возвращает `{ ok }`; при сбое записи возвращает `{ ok: false }` и не бросает,
 * чтобы вызывающий мог корректно деградировать (R2.3, R15.2).
 */
export async function saveSession(
  telegramUserId: number,
  patch: Partial<Omit<Session, "telegramUserId">>,
): Promise<{ ok: true } | { ok: false; reason: "storage" | "stale" }> {
  // Map camelCase patch → snake_case columns; `updated_at` всегда ставит сервер.
  const row: Record<string, unknown> = {
    telegram_user_id: telegramUserId,
    updated_at: new Date().toISOString(),
  };
  if (patch.lang !== undefined) row.lang = patch.lang;
  if (patch.scenario !== undefined) row.scenario = patch.scenario;
  if (patch.scenarioStep !== undefined) row.scenario_step = patch.scenarioStep;
  if (patch.scenarioData !== undefined) row.scenario_data = patch.scenarioData;

  const updateId = currentTelegramUpdateId();
  const lease = currentTelegramUpdateLease();

  try {
    if (updateId !== null) {
      const sequencedPatch = { ...row };
      delete sequencedPatch.telegram_user_id;
      delete sequencedPatch.updated_at;
      const sessionLanguage = currentTelegramSessionLanguage();
      if (sequencedPatch.lang === undefined && sessionLanguage !== null) {
        sequencedPatch.lang = sessionLanguage;
      }
      const rpcName = lease ? "save_telegram_session_fenced" : "save_telegram_session_sequenced";
      const { data, error } = await sessionRpc().rpc(rpcName, {
        p_telegram_user_id: telegramUserId,
        p_update_id: updateId,
        p_patch: sequencedPatch,
        ...(lease
          ? {
              p_lease_token: lease.leaseToken,
              p_processing_fence: lease.processingFence,
              p_leader_token: lease.leaderToken ?? null,
              p_leader_fence: lease.leaderFence ?? null,
            }
          : {}),
      });

      if (error) {
        markTelegramSessionStorageFailure();
        console.error("telegram saveSession failed", "sequenced_rpc");
        return { ok: false, reason: "storage" };
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (
        !result ||
        typeof result !== "object" ||
        typeof result.applied !== "boolean" ||
        (lease && result.lease_valid !== true)
      ) {
        markTelegramSessionStorageFailure();
        console.error("telegram saveSession failed", "invalid_rpc_result");
        return { ok: false, reason: "storage" };
      }
      return result.applied ? { ok: true } : { ok: false, reason: "stale" };
    }

    const { error } = await sessions().upsert(row, { onConflict: "telegram_user_id" });
    if (error) {
      markTelegramSessionStorageFailure();
      console.error("telegram saveSession failed", "legacy_upsert");
      return { ok: false, reason: "storage" };
    }
    return { ok: true };
  } catch (e) {
    markTelegramSessionStorageFailure();
    console.error("telegram saveSession threw", e instanceof Error ? "exception" : "unknown");
    return { ok: false, reason: "storage" };
  }
}

/**
 * Смена языка. Возвращает `{ ok }`; при сбое записи язык в БД не меняется
 * (upsert не применён), поэтому вызывающий продолжает отвечать на прежнем
 * языке (R2.2, R2.3).
 */
export async function setLanguage(telegramUserId: number, lang: Lang): Promise<{ ok: boolean }> {
  return saveSession(telegramUserId, { lang });
}

/**
 * Сброс активного сценария в нейтральное состояние по завершении многошагового
 * потока (R15.5). Язык не трогаем.
 */
export async function resetScenario(telegramUserId: number): Promise<void> {
  await saveSession(telegramUserId, {
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
  });
}
