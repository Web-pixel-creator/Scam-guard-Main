import type { Lang } from "@/lib/i18n";
import type { GuardianAngelSnapshot } from "@/lib/telegram/guardian-angel";
import type {
  LastCheckContext,
  LastCheckEvidenceLimitation,
  LastCheckEvidenceMethod,
  LastCheckEvidenceSource,
  LastCheckSnapshot,
  ReportDraft,
} from "@/lib/telegram/session.server";

export const REPLY_CHECK_CONTEXT_WINDOW_MS = 20 * 60 * 1_000;
export const MAX_REPLY_CHECK_CONTEXTS = 8;

export interface ReplyCheckContext {
  messageId: number;
  snapshot: LastCheckSnapshot;
  guardian?: GuardianAngelSnapshot;
}

const LEVELS = new Set(["safe", "unknown", "suspicious", "high_risk"]);
const INPUT_TYPES = new Set(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]);
const CONTEXTS = new Set<LastCheckContext>([
  "image_unreadable",
  "qr_menu",
  "delivery",
  "crypto",
  "phone",
  "telegram_profile",
  "generic",
]);
const METHODS = new Set<LastCheckEvidenceMethod>([
  "text_pattern",
  "url_structure",
  "domain_comparison",
  "phone_format",
  "telegram_visible",
  "official_directory",
  "local_reports",
  "external_reputation",
  "context",
]);
const SOURCES = new Set<LastCheckEvidenceSource>([
  "visible_input",
  "official_directory",
  "moderated_reports",
  "external_reputation",
]);
const LIMITATIONS = new Set<LastCheckEvidenceLimitation>([
  "signal_not_proof",
  "format_only",
  "telegram_visible_only",
  "official_identifier_only",
  "report_scope",
  "external_scope",
  "context_only",
]);

function boundedEnumArray<T extends string>(value: unknown, allowed: ReadonlySet<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is T => typeof item === "string" && allowed.has(item as T))
    .slice(0, 12);
}

/**
 * Treat persisted JSON as untrusted input and rebuild only the bounded,
 * non-sensitive LastCheckSnapshot fields that follow-up copy can consume.
 */
function safeSnapshot(value: unknown): LastCheckSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.level !== "string" ||
    !LEVELS.has(candidate.level) ||
    typeof candidate.type !== "string" ||
    !INPUT_TYPES.has(candidate.type) ||
    typeof candidate.context !== "string" ||
    !CONTEXTS.has(candidate.context as LastCheckContext) ||
    typeof candidate.at !== "string" ||
    !Number.isFinite(Date.parse(candidate.at))
  ) {
    return null;
  }

  const snapshot: LastCheckSnapshot = {
    level: candidate.level as LastCheckSnapshot["level"],
    type: candidate.type as LastCheckSnapshot["type"],
    context: candidate.context as LastCheckContext,
    at: candidate.at,
  };

  if (Array.isArray(candidate.reasons)) {
    const reasons = candidate.reasons
      .filter(
        (reason): reason is string =>
          typeof reason === "string" && /^[a-z0-9_]{1,64}$/u.test(reason),
      )
      .slice(0, 16);
    if (reasons.length > 0) snapshot.reasons = reasons;
  }

  if (candidate.provenance && typeof candidate.provenance === "object") {
    const provenance = candidate.provenance as Record<string, unknown>;
    snapshot.provenance = {
      methods: boundedEnumArray(provenance.methods, METHODS),
      sources: boundedEnumArray(provenance.sources, SOURCES),
      limitations: boundedEnumArray(provenance.limitations, LIMITATIONS),
    };
  }

  return snapshot;
}

function safeGuardianSnapshot(value: unknown): GuardianAngelSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.level !== "high_risk" ||
    typeof candidate.type !== "string" ||
    !INPUT_TYPES.has(candidate.type) ||
    typeof candidate.at !== "string" ||
    !Number.isFinite(Date.parse(candidate.at)) ||
    !Array.isArray(candidate.reasons)
  ) {
    return null;
  }
  const reasons = candidate.reasons
    .filter(
      (reason): reason is string => typeof reason === "string" && /^[a-z0-9_]{1,64}$/u.test(reason),
    )
    .slice(0, 16) as GuardianAngelSnapshot["reasons"];
  return {
    level: "high_risk",
    type: candidate.type as GuardianAngelSnapshot["type"],
    reasons,
    at: candidate.at,
  };
}

function activeContexts(value: unknown, now: Date): ReplyCheckContext[] {
  if (!Array.isArray(value)) return [];
  const nowMs = now.getTime();
  const contexts: ReplyCheckContext[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.messageId !== "number" ||
      !Number.isSafeInteger(candidate.messageId) ||
      candidate.messageId <= 0
    ) {
      continue;
    }
    const snapshot = safeSnapshot(candidate.snapshot);
    if (!snapshot) continue;
    const ageMs = nowMs - Date.parse(snapshot.at);
    if (ageMs < 0 || ageMs > REPLY_CHECK_CONTEXT_WINDOW_MS) continue;
    const guardian = safeGuardianSnapshot(candidate.guardian);
    contexts.push({
      messageId: candidate.messageId,
      snapshot,
      ...(guardian ? { guardian } : {}),
    });
  }

  return contexts.slice(-MAX_REPLY_CHECK_CONTEXTS);
}

export function rememberReplyCheckContext(
  data: ReportDraft | undefined,
  messageId: number,
  snapshot: LastCheckSnapshot,
  now = new Date(),
  guardian?: GuardianAngelSnapshot,
): ReportDraft {
  if (!Number.isSafeInteger(messageId) || messageId <= 0) return { ...(data ?? {}) };
  const safe = safeSnapshot(snapshot);
  if (!safe) return { ...(data ?? {}) };
  const safeGuardian = guardian ? safeGuardianSnapshot(guardian) : null;

  const previous = activeContexts(data?.replyCheckContexts, now).filter(
    (entry) => entry.messageId !== messageId,
  );
  return {
    ...(data ?? {}),
    replyCheckContexts: [
      ...previous,
      { messageId, snapshot: safe, ...(safeGuardian ? { guardian: safeGuardian } : {}) },
    ].slice(-MAX_REPLY_CHECK_CONTEXTS),
  };
}

export function resolveReplyCheckContext(
  data: ReportDraft | undefined,
  messageId: number,
  now = new Date(),
): LastCheckSnapshot | null {
  if (!Number.isSafeInteger(messageId) || messageId <= 0) return null;
  const contexts = activeContexts(data?.replyCheckContexts, now);
  for (let index = contexts.length - 1; index >= 0; index -= 1) {
    if (contexts[index].messageId === messageId) return contexts[index].snapshot;
  }
  return null;
}

export function resolveReplyGuardianContext(
  data: ReportDraft | undefined,
  messageId: number,
  now = new Date(),
): GuardianAngelSnapshot | null {
  if (!Number.isSafeInteger(messageId) || messageId <= 0) return null;
  const contexts = activeContexts(data?.replyCheckContexts, now);
  for (let index = contexts.length - 1; index >= 0; index -= 1) {
    if (contexts[index].messageId === messageId) return contexts[index].guardian ?? null;
  }
  return null;
}

export function buildReplyContextExpiredText(lang: Lang): string {
  if (lang === "uz") {
    return "Bu amal qaysi eski tekshiruvga tegishli ekanini ishonchli aniqlay olmadim. Havola, raqam yoki xabarni qayta yuboring — men uni yangidan tekshiraman.";
  }
  if (lang === "en") {
    return "I can no longer link this action to a specific earlier check. Send the link, number, or message again and I will run a fresh check.";
  }
  return "Я уже не могу надёжно связать это действие с конкретной старой проверкой. Пришлите ссылку, номер или сообщение ещё раз — я проверю заново.";
}
