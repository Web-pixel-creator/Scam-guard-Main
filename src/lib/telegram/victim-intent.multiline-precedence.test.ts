import { describe, expect, it } from "vitest";

import { classifyVictimIntent, type VictimIntentKind } from "@/lib/telegram/victim-intent";

const TRUST_AND_PRESSURE_TAIL = [
  "Bunga ishonish mumkinmi?",
  "Ular meni hozir shoshirib, yaqinlarimga qo'ng'iroq qilmaslikni aytishyapti",
].join("\n");

describe("multiline victim-intent precedence", () => {
  it.each([
    [
      "Politsiyadanman degan odam jinoiy ish bilan qo'rqitib pul talab qilyapti",
      "legal_impersonation",
    ],
    ["Yuborilgan havola orqali soliq to'lashga majburlashyapti", "official_impersonation"],
    ["Qo'ng'iroq qilgan odam pulni xavfsiz hisobga o'tkazishni talab qilyapti", "transfer_request"],
    ["Yangi tanishim chipta va viza uchun pul so'rayapti", "romance_money"],
    ["Suratlarim bilan shantaj qilib pul talab qilishyapti", "blackmail_threat"],
    ["Kuryer posilka uchun zudlik bilan boj to'lashni talab qilyapti", "transfer_request"],
    [
      "Notanish jamg'arma bosim qilib shaxsiy kartaga pul o'tkazishni so'rayapti",
      "transfer_request",
    ],
    ["Soxta yordam xizmati akkaunt himoyasini o'chirishni so'rayapti", "support_impersonation"],
  ] satisfies ReadonlyArray<readonly [string, VictimIntentKind]>)(
    "keeps $1 for a concrete first line plus a generic follow-up tail",
    (scenario, expected) => {
      expect(classifyVictimIntent(`${scenario}\n${TRUST_AND_PRESSURE_TAIL}`)?.kind).toBe(expected);
    },
  );

  it.each([
    [
      "Rahmat, men uydaman va shoshmayapman. Notanish jamg'arma bosim qilib shaxsiy kartaga pul o'tkazishni so'rayapti",
      "transfer_request",
    ],
    [
      "Rahmat, men uydaman va shoshmayapman\nNotanish jamg'arma bosim qilib shaxsiy kartaga pul o'tkazishni so'rayapti",
      "transfer_request",
    ],
    [
      "Soxta yordam xizmati akkaunt himoyasini o'chirishni so'rayapti\nhttps://example.invalid/check/29",
      "support_impersonation",
    ],
    [
      "Politsiyadanman degan odam jinoiy ish bilan qo'rqitib pul talab qilyapti\nhttps://example.invalid/check/9",
      "legal_impersonation",
    ],
    [
      "Notanish odam yozib ko'rsatmalarini bajarishni so'rayapti\n@qa_suspicious_28",
      "unknown_contact",
    ],
  ] satisfies ReadonlyArray<readonly [string, VictimIntentKind]>)(
    "does not let safe prefixes or artifacts replace $1",
    (query, expected) => {
      expect(classifyVictimIntent(query)?.kind).toBe(expected);
    },
  );
});
