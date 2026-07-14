import type { Lang } from "@/lib/i18n";
import {
  MIXED_CLAUSE_ADVERSARIAL_CORPUS,
  type MixedClauseShape,
} from "@/lib/risk/mixed-clause-adversarial-corpus";
import type { ReasonCode } from "@/lib/risk/rules";
import type { MetaIntent } from "@/lib/meta-intent";
import {
  SYNTHETIC_MULTITURN_DIALOGUE_CORPUS,
  type SyntheticDialogueTurn,
} from "@/lib/telegram/synthetic-multiturn-dialogue-corpus";

/** Telegram Bot API limit for an inline query. */
export const INLINE_ADAPTED_QUERY_LIMIT = 256;

export const INLINE_ADAPTED_CASE_SOURCES = [
  "raw_turn",
  "contextual_followup",
  "mixed_clause",
  "credential_boundary",
] as const;

export type InlineAdaptedCaseSource = (typeof INLINE_ADAPTED_CASE_SOURCES)[number];

export type InlineAdaptedExpectedKind =
  | "risk"
  | "meta"
  | "stateless_followup"
  | "mixed_danger"
  | "mixed_safe_control"
  | "credential_boundary";

export interface InlineAdaptedDialogueCase {
  id: string;
  source: InlineAdaptedCaseSource;
  lang: Lang;
  query: string;
  expectedKind: InlineAdaptedExpectedKind;
  dialogueId?: string;
  turnIndex?: number;
  originalKind?: SyntheticDialogueTurn["kind"];
  expectedFollowUpAction?: Extract<SyntheticDialogueTurn, { kind: "followup" }>["expectedAction"];
  expectedMetaIntent?: MetaIntent;
  requiredReasons: readonly ReasonCode[];
  forbiddenReasons: readonly ReasonCode[];
  forbiddenOutput: readonly string[];
  forbiddenVisibleFragments: readonly string[];
  mixedClauseShape?: MixedClauseShape;
}

interface CredentialBoundarySeed {
  id: string;
  lang: Lang;
  query: string;
  forbiddenOutput: readonly string[];
  forbiddenVisibleFragments?: readonly string[];
}

/**
 * Synthetic placeholders only. They are deliberately fake and exist solely to
 * prove that the Inline preview and inserted card do not republish credentials.
 */
const CREDENTIAL_BOUNDARY_SEEDS: readonly CredentialBoundarySeed[] = [
  {
    id: "ru-otp",
    lang: "ru",
    query: "Незнакомец просит переслать код 483921 из SMS.",
    forbiddenOutput: ["483921"],
  },
  {
    id: "ru-card",
    lang: "ru",
    query: "В чате просят номер карты 8600123412345678 и CVV 917.",
    forbiddenOutput: ["8600123412345678", "917"],
  },
  {
    id: "ru-password",
    lang: "ru",
    query: "Поддержка просит отправить пароль Qwerty!2026 для проверки.",
    forbiddenOutput: ["Qwerty!2026"],
    forbiddenVisibleFragments: ["Qwerty"],
  },
  {
    id: "ru-email",
    lang: "ru",
    query: "Мне пишут на victim.qa@example.test и просят код из SMS.",
    forbiddenOutput: ["victim.qa@example.test"],
  },
  {
    id: "uz-otp",
    lang: "uz",
    query: "Notanish odam SMS orqali kelgan 572804 kodini yuborishni so'rayapti.",
    forbiddenOutput: ["572804"],
  },
  {
    id: "uz-card",
    lang: "uz",
    query: "Chatda 9860123412345678 karta raqami va 614 CVV so'raldi.",
    forbiddenOutput: ["9860123412345678", "614"],
  },
  {
    id: "uz-password",
    lang: "uz",
    query: "Soxta yordam xizmati Parol!2026 parolini yuborishni so'radi.",
    forbiddenOutput: ["Parol!2026"],
    forbiddenVisibleFragments: ["Parol!"],
  },
  {
    id: "uz-email",
    lang: "uz",
    query: "Menga victim.uz@example.test manziliga kod yuborib aytishimni so'rashyapti.",
    forbiddenOutput: ["victim.uz@example.test"],
  },
  {
    id: "en-otp",
    lang: "en",
    query: "A stranger asks me to send the SMS verification code 638205.",
    forbiddenOutput: ["638205"],
  },
  {
    id: "en-card",
    lang: "en",
    query: "The caller asks for card 4000123412345678 and CVV 825.",
    forbiddenOutput: ["4000123412345678", "825"],
  },
  {
    id: "en-password",
    lang: "en",
    query: "Fake support asks me to send password Example!2026 for verification.",
    forbiddenOutput: ["Example!2026"],
    forbiddenVisibleFragments: ["Example"],
  },
  {
    id: "en-email",
    lang: "en",
    query: "They contacted victim.en@example.test and asked for an SMS code.",
    forbiddenOutput: ["victim.en@example.test"],
  },
] as const;

function rawExpectedKind(turn: SyntheticDialogueTurn): InlineAdaptedExpectedKind {
  if (turn.kind === "risk_check") return "risk";
  if (turn.kind === "meta") return "meta";
  return "stateless_followup";
}

function buildRawTurnCases(): InlineAdaptedDialogueCase[] {
  return SYNTHETIC_MULTITURN_DIALOGUE_CORPUS.flatMap((dialogue) =>
    dialogue.turns.map((turn, turnIndex) => ({
      id: `raw:${dialogue.id}:${turnIndex + 1}`,
      source: "raw_turn" as const,
      lang: dialogue.lang,
      query: turn.utterance,
      expectedKind: rawExpectedKind(turn),
      dialogueId: dialogue.id,
      turnIndex,
      originalKind: turn.kind,
      expectedFollowUpAction: turn.kind === "followup" ? turn.expectedAction : undefined,
      expectedMetaIntent: turn.kind === "meta" ? turn.expectedIntent : undefined,
      requiredReasons: turn.kind === "risk_check" ? turn.expectedReasons : [],
      forbiddenReasons: [],
      forbiddenOutput: [],
      forbiddenVisibleFragments: [],
    })),
  );
}

function joinRiskAndFollowUp(riskText: string, followUpText: string, id: string): string {
  const query = `${riskText}\n${followUpText}`;
  if (query.length > INLINE_ADAPTED_QUERY_LIMIT) {
    throw new Error(
      `${id} needs a reviewed Inline adaptation (${query.length}/${INLINE_ADAPTED_QUERY_LIMIT})`,
    );
  }
  return query;
}

function buildContextualFollowUpCases(): InlineAdaptedDialogueCase[] {
  const rows: InlineAdaptedDialogueCase[] = [];

  for (const dialogue of SYNTHETIC_MULTITURN_DIALOGUE_CORPUS) {
    const riskTurn = dialogue.turns.find((turn) => turn.kind === "risk_check");
    if (!riskTurn || riskTurn.kind !== "risk_check") continue;

    for (const [turnIndex, turn] of dialogue.turns.entries()) {
      if (turn.kind !== "followup") continue;
      const id = `context:${dialogue.id}:${turnIndex + 1}`;
      rows.push({
        id,
        source: "contextual_followup",
        lang: dialogue.lang,
        query: joinRiskAndFollowUp(riskTurn.utterance, turn.utterance, id),
        expectedKind: "risk",
        dialogueId: dialogue.id,
        turnIndex,
        originalKind: turn.kind,
        expectedFollowUpAction: turn.expectedAction,
        requiredReasons: riskTurn.expectedReasons,
        forbiddenReasons: [],
        forbiddenOutput: [],
        forbiddenVisibleFragments: [],
      });
    }
  }

  return rows;
}

function buildMixedClauseCases(): InlineAdaptedDialogueCase[] {
  return MIXED_CLAUSE_ADVERSARIAL_CORPUS.map((testCase) => ({
    id: `mixed:${testCase.id}`,
    source: "mixed_clause" as const,
    lang: testCase.lang,
    query: testCase.text,
    expectedKind: testCase.shape === "safe_control" ? "mixed_safe_control" : "mixed_danger",
    requiredReasons: testCase.requiredReasons,
    forbiddenReasons: testCase.forbiddenReasons,
    forbiddenOutput: [],
    forbiddenVisibleFragments: [],
    mixedClauseShape: testCase.shape,
  }));
}

function buildCredentialBoundaryCases(): InlineAdaptedDialogueCase[] {
  return CREDENTIAL_BOUNDARY_SEEDS.map((seed) => ({
    id: `secret:${seed.id}`,
    source: "credential_boundary" as const,
    lang: seed.lang,
    query: seed.query,
    expectedKind: "credential_boundary" as const,
    requiredReasons: [],
    forbiddenReasons: [],
    forbiddenOutput: seed.forbiddenOutput,
    forbiddenVisibleFragments: seed.forbiddenVisibleFragments ?? [],
  }));
}

function buildInlineAdaptedDialogueCorpus(): InlineAdaptedDialogueCase[] {
  return [
    ...buildRawTurnCases(),
    ...buildContextualFollowUpCases(),
    ...buildMixedClauseCases(),
    ...buildCredentialBoundaryCases(),
  ];
}

export const INLINE_ADAPTED_DIALOGUE_CORPUS: readonly InlineAdaptedDialogueCase[] =
  buildInlineAdaptedDialogueCorpus();

export const INLINE_ADAPTED_DIALOGUE_STATS = {
  totalCases: INLINE_ADAPTED_DIALOGUE_CORPUS.length,
  uniqueQueries: new Set(INLINE_ADAPTED_DIALOGUE_CORPUS.map(({ query }) => query)).size,
  sourceCounts: Object.fromEntries(
    INLINE_ADAPTED_CASE_SOURCES.map((source) => [
      source,
      INLINE_ADAPTED_DIALOGUE_CORPUS.filter((testCase) => testCase.source === source).length,
    ]),
  ) as Readonly<Record<InlineAdaptedCaseSource, number>>,
  languageCounts: Object.fromEntries(
    (["ru", "uz", "en"] as const).map((lang) => [
      lang,
      INLINE_ADAPTED_DIALOGUE_CORPUS.filter((testCase) => testCase.lang === lang).length,
    ]),
  ) as Readonly<Record<Lang, number>>,
} as const;
