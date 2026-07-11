import { ALL_META_INTENTS, type MetaIntent } from "@/lib/meta-intent";
import {
  ALL_LAST_CHECK_FOLLOW_UP_ACTIONS,
  type LastCheckFollowUpAction,
} from "@/lib/telegram/check-followup";
import { PANIC_SCENARIO_IDS, type PanicScenarioId } from "@/lib/telegram/emergency";
import { ALL_VICTIM_INTENTS, type VictimIntentKind } from "@/lib/telegram/victim-intent";

export type CanonicalMetaIntentId = `meta.${MetaIntent}`;
export type CanonicalVictimIntentId = `victim.${VictimIntentKind}`;
export type CanonicalFollowUpIntentId = `followup.${LastCheckFollowUpAction}`;
export type CanonicalPanicIntentId = `panic.${PanicScenarioId}`;

export type CanonicalTelegramIntentId =
  | CanonicalMetaIntentId
  | CanonicalVictimIntentId
  | CanonicalFollowUpIntentId
  | CanonicalPanicIntentId
  | "input.risk_check";

export type TelegramResponseAction =
  | "reply.meta"
  | "reply.victim_guidance"
  | "reply.followup"
  | "run.risk_check"
  | "open.emergency";

export type TelegramConversationChannel = "direct" | "inline";
export type PersistenceEffect = "forbidden" | "safe_metadata" | "required_check_row";
export type TrustedContactEffect = "forbidden" | "high_risk_only";

export interface TelegramChannelEffectContract {
  persistence: PersistenceEffect;
  trustedContact: TrustedContactEffect;
}

export interface TelegramResponsePolicy {
  localized: true;
  maxChars: 4096;
  nonAccusatory: true;
  rawEvidencePersistence: "forbidden";
  provenance: "not_applicable" | "visible_or_typed_sources_only";
  safeAction: "required" | "recommended";
}

export interface TelegramIntentContract {
  id: CanonicalTelegramIntentId;
  family: "meta" | "victim" | "followup" | "panic" | "risk_input";
  action: TelegramResponseAction;
  context: "none" | "recent_or_orphan_check" | "fresh_artifact" | "emergency";
  channels: Readonly<Partial<Record<TelegramConversationChannel, TelegramChannelEffectContract>>>;
  response: TelegramResponsePolicy;
}

const replyOnlyDirect: TelegramIntentContract["channels"] = {
  direct: { persistence: "forbidden", trustedContact: "forbidden" },
};

const baseResponse: Omit<TelegramResponsePolicy, "provenance" | "safeAction"> = {
  localized: true,
  maxChars: 4096,
  nonAccusatory: true,
  rawEvidencePersistence: "forbidden",
};

function metaContract(intent: MetaIntent): TelegramIntentContract {
  return {
    id: canonicalMetaIntentId(intent),
    family: "meta",
    action: "reply.meta",
    context: "none",
    channels: replyOnlyDirect,
    response: {
      ...baseResponse,
      provenance:
        intent === "how_do_you_check" ? "visible_or_typed_sources_only" : "not_applicable",
      safeAction: "recommended",
    },
  };
}

function victimContract(intent: VictimIntentKind): TelegramIntentContract {
  return {
    id: canonicalVictimIntentId(intent),
    family: "victim",
    action: "reply.victim_guidance",
    context: "none",
    channels: replyOnlyDirect,
    response: {
      ...baseResponse,
      provenance: "not_applicable",
      safeAction: "required",
    },
  };
}

function followUpContract(action: LastCheckFollowUpAction): TelegramIntentContract {
  return {
    id: canonicalFollowUpIntentId(action),
    family: "followup",
    action: "reply.followup",
    context: "recent_or_orphan_check",
    channels: replyOnlyDirect,
    response: {
      ...baseResponse,
      provenance:
        action === "methodology" || action === "explain" || action === "confidence"
          ? "visible_or_typed_sources_only"
          : "not_applicable",
      safeAction: "required",
    },
  };
}

function panicContract(panicId: PanicScenarioId): TelegramIntentContract {
  return {
    id: canonicalPanicIntentId(panicId),
    family: "panic",
    action: "open.emergency",
    context: "emergency",
    channels: {
      direct: { persistence: "safe_metadata", trustedContact: "forbidden" },
    },
    response: {
      ...baseResponse,
      provenance: "not_applicable",
      safeAction: "required",
    },
  };
}

const riskInputContract: TelegramIntentContract = {
  id: "input.risk_check",
  family: "risk_input",
  action: "run.risk_check",
  context: "fresh_artifact",
  channels: {
    direct: { persistence: "required_check_row", trustedContact: "high_risk_only" },
    inline: { persistence: "forbidden", trustedContact: "forbidden" },
  },
  response: {
    ...baseResponse,
    provenance: "visible_or_typed_sources_only",
    safeAction: "required",
  },
};

export const TELEGRAM_INTENT_CONTRACTS: readonly TelegramIntentContract[] = [
  ...ALL_META_INTENTS.map(metaContract),
  ...ALL_VICTIM_INTENTS.map(victimContract),
  ...ALL_LAST_CHECK_FOLLOW_UP_ACTIONS.map(followUpContract),
  ...PANIC_SCENARIO_IDS.map(panicContract),
  riskInputContract,
];

const CONTRACT_BY_ID = new Map(
  TELEGRAM_INTENT_CONTRACTS.map((contract) => [contract.id, contract] as const),
);

if (CONTRACT_BY_ID.size !== TELEGRAM_INTENT_CONTRACTS.length) {
  throw new Error("duplicate canonical Telegram intent contract id");
}

export function canonicalMetaIntentId(intent: MetaIntent): CanonicalMetaIntentId {
  return `meta.${intent}`;
}

export function canonicalVictimIntentId(intent: VictimIntentKind): CanonicalVictimIntentId {
  return `victim.${intent}`;
}

export function canonicalFollowUpIntentId(
  action: LastCheckFollowUpAction,
): CanonicalFollowUpIntentId {
  return `followup.${action}`;
}

export function canonicalPanicIntentId(panicId: PanicScenarioId): CanonicalPanicIntentId {
  return `panic.${panicId}`;
}

export function getTelegramIntentContract(id: CanonicalTelegramIntentId): TelegramIntentContract {
  const contract = CONTRACT_BY_ID.get(id);
  if (!contract) throw new Error(`missing Telegram intent contract: ${id}`);
  return contract;
}

export function enforceTelegramReplyContract(
  id: CanonicalTelegramIntentId,
  channel: TelegramConversationChannel,
  text: string,
): string {
  const contract = getTelegramIntentContract(id);
  if (!contract.action.startsWith("reply.")) {
    throw new Error(`Telegram intent is not reply-only: ${id}`);
  }
  if (!contract.channels[channel]) {
    throw new Error(`Telegram intent ${id} does not support ${channel}`);
  }
  if (text.length > contract.response.maxChars) {
    throw new Error(`Telegram reply exceeds contract limit: ${id}`);
  }
  return text;
}
