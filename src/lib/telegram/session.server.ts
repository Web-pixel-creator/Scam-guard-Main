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
import type { RiskLevel } from "@/lib/risk/rules";

export type Scenario =
  | "none" // нейтральное состояние
  | "await_check" // после /check ждём контент
  | "report_value" // ждём значение жалобы
  | "report_desc" // ждём описание
  | "report_scamType" // опционально
  | "report_city" // опционально
  | "report_amount"; // опционально

export interface ReportDraft {
  value?: string;
  noValue?: boolean;
  description?: string;
  scamType?: string;
  city?: string;
  amountLostUzs?: number;
  /**
   * Emergency Copilot v2 context. Stores only a scenario id + timestamp,
   * never raw user evidence, codes, phone numbers, links or card data.
   */
  lastPanicId?: number;
  lastPanicAt?: string;
  /**
   * Last check context for short follow-up questions like "точно?".
   * Stores only non-sensitive summary metadata: no raw input, OCR text,
   * phone numbers, URLs, card data, codes or image bytes.
   */
  lastCheck?: LastCheckSnapshot;
}

export type LastCheckContext =
  | "image_unreadable"
  | "qr_menu"
  | "delivery"
  | "crypto"
  | "phone"
  | "telegram_profile"
  | "generic";

export interface LastCheckSnapshot {
  level: RiskLevel;
  type: InputType;
  context: LastCheckContext;
  at: string;
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

function defaultSession(telegramUserId: number): Session {
  // R1.4 — отсутствует сохранённый язык → дефолт ru, нейтральный сценарий.
  return {
    telegramUserId,
    lang: "ru",
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

/**
 * Загрузка сессии по Telegram_User_Id. При отсутствии строки (или сбое чтения)
 * возвращает дефолт `{ lang:"ru", scenario:"none", scenarioStep:0, scenarioData:{} }`
 * (R1.4, R15.1).
 */
export async function loadSession(telegramUserId: number): Promise<Session> {
  try {
    const { data, error } = await sessions()
      .select("*")
      .eq("telegram_user_id", telegramUserId)
      .maybeSingle();

    if (error) {
      console.error("telegram loadSession failed", error.message);
      return defaultSession(telegramUserId);
    }
    if (!data) return defaultSession(telegramUserId);

    return rowToSession(data as TelegramSessionRow);
  } catch (e) {
    console.error("telegram loadSession threw", e instanceof Error ? e.message : "unknown");
    return defaultSession(telegramUserId);
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
): Promise<{ ok: boolean }> {
  // Map camelCase patch → snake_case columns; `updated_at` всегда ставит сервер.
  const row: Record<string, unknown> = {
    telegram_user_id: telegramUserId,
    updated_at: new Date().toISOString(),
  };
  if (patch.lang !== undefined) row.lang = patch.lang;
  if (patch.scenario !== undefined) row.scenario = patch.scenario;
  if (patch.scenarioStep !== undefined) row.scenario_step = patch.scenarioStep;
  if (patch.scenarioData !== undefined) row.scenario_data = patch.scenarioData;

  try {
    const { error } = await sessions().upsert(row, { onConflict: "telegram_user_id" });
    if (error) {
      console.error("telegram saveSession failed", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.error("telegram saveSession threw", e instanceof Error ? e.message : "unknown");
    return { ok: false };
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
