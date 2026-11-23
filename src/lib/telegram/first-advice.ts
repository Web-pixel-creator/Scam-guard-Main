import type { Lang } from "@/lib/i18n";
import {
  detectFirstAction,
  INCIDENT_ACTION,
  INCIDENT_LABEL,
} from "@/lib/risk/incident-first-action";
import { bankSmsAdvice, reportedBankSms } from "@/lib/risk/reported-bank-sms";
import { evaluateText } from "@/lib/risk/rules";
import { carrierAndCodeText } from "./advice-filter";
import { classifyVictimIntent, type VictimIntentMatch } from "./victim-intent";

type PhysicalKind = "violence_threat" | "authority_physical_coercion";
type Advice =
  | { kind: "physical"; topic: PhysicalKind }
  | { kind: "short"; id: string; title: string; text: string; context: VictimIntentMatch };

// Called only after secret/aftercare preflight. Never shorten away a physical threat.
export function firstAdvice(text: string, lang: Lang, liveCall = false): Advice | null {
  const incident = detectFirstAction(text);
  const bank = reportedBankSms(text);
  if (!incident && !bank) return null;
  const reasons = evaluateText(text);
  const victim = classifyVictimIntent(text);
  if (reasons.includes("threatens_physical_violence") || victim?.kind === "violence_threat")
    return { kind: "physical", topic: "violence_threat" };
  if (
    reasons.includes("authority_coerced_dangerous_act") ||
    victim?.kind === "authority_physical_coercion"
  )
    return { kind: "physical", topic: "authority_physical_coercion" };
  if (reasons.includes("reported_unauthorized_debit"))
    return {
      kind: "short",
      id: "reported-unauthorized-debit",
      title: INCIDENT_LABEL.reported_unauthorized_debit[lang],
      text: INCIDENT_ACTION.reported_unauthorized_debit[lang],
      context: { kind: "unauthorized_charge", askedContext: "card" },
    };
  const combined = carrierAndCodeText(incident, reasons, lang);
  if (liveCall && !combined) return null;
  if (bank)
    return {
      kind: "short",
      id: "check-unknown-code-request",
      title: { ru: "Не сообщайте код", uz: "Kodni aytmang", en: "Do not share the code" }[lang],
      text: bankSmsAdvice(bank, lang),
      context: { kind: "code_request", askedContext: "code" },
    };
  if (!incident) return null;
  return {
    kind: "short",
    id: incident,
    title: INCIDENT_LABEL[incident][lang],
    text: combined ?? INCIDENT_ACTION[incident][lang],
    context:
      incident === "relative_in_distress"
        ? { kind: "friend_money", askedContext: "transfer" }
        : {
            kind: "operator_call",
            askedContext: "call",
            ...(incident === "operator_requests_dial_code"
              ? { scenario: "carrier_dial_request" as const }
              : {}),
          },
  };
}
