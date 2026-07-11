import type { Lang } from "@/lib/i18n";
import {
  ALL_LAST_CHECK_FOLLOW_UP_ACTIONS,
  type LastCheckFollowUpAction,
} from "@/lib/telegram/check-followup";
import {
  canonicalFollowUpIntentId,
  type CanonicalFollowUpIntentId,
} from "@/lib/telegram/intent-contract";

export type DialogueContext =
  | "recent_safe"
  | "recent_unknown"
  | "recent_suspicious"
  | "recent_high_risk"
  | "recent_image_unreadable"
  | "orphan"
  | "stale"
  | "new_artifact";

export interface DialogueCorpusRow {
  id: string;
  lang: Lang;
  context: DialogueContext;
  utterance: string;
  action: LastCheckFollowUpAction;
  intentId: CanonicalFollowUpIntentId;
  surfaceVariant: "canonical" | "uppercase" | "padded" | "emphatic";
}

export const FOLLOW_UP_PHRASE_SEEDS: Readonly<
  Record<LastCheckFollowUpAction, Readonly<Record<Lang, string>>>
> = {
  confidence: {
    ru: "Ты точно в этом уверен?",
    uz: "Siz bunga aniq ishonasizmi?",
    en: "Are you really sure about that?",
  },
  methodology: {
    ru: "Каким образом ты это проверил?",
    uz: "Buni qanday tekshirdingiz?",
    en: "How did you check this?",
  },
  trusted_person: {
    ru: "Можно связаться с близким человеком?",
    uz: "Yaqin odamim bilan bog'lansam bo'ladimi?",
    en: "Can I call someone I trust?",
  },
  recheck: {
    ru: "Перепроверь ещё раз",
    uz: "Yana bir marta tekshir",
    en: "Check it again",
  },
  disagreement: {
    ru: "Я не согласен, ты ошибся",
    uz: "Men rozi emasman, xato qildingiz",
    en: "I disagree, you may be wrong",
  },
  next_steps: {
    ru: "Что мне делать дальше?",
    uz: "Keyin nima qilay?",
    en: "What should I do next?",
  },
  contacts: {
    ru: "Дай официальный номер банка",
    uz: "Bank raqamini bering",
    en: "Give me the official bank number",
  },
  explain: {
    ru: "Почему так?",
    uz: "Nega bunday?",
    en: "Why is that?",
  },
  simple_explain: {
    ru: "Объясни простыми словами",
    uz: "Oddiy qilib tushuntir",
    en: "Explain in simple words",
  },
  ai_origin: {
    ru: "Это сделано нейросетью?",
    uz: "Bu sun'iy intellektmi?",
    en: "Was this made by AI?",
  },
  confirmation_request: {
    ru: "Меня просят подтвердить операцию",
    uz: "Mendan tasdiqlash so'rashyapti",
    en: "They asked me to confirm the operation",
  },
  acknowledgement: {
    ru: "Хорошо, спасибо",
    uz: "Rahmat",
    en: "Thank you",
  },
  identity: {
    ru: "Кто вы?",
    uz: "Siz kimsiz?",
    en: "Who are you?",
  },
};

const DIALOGUE_CONTEXTS: readonly DialogueContext[] = [
  "recent_safe",
  "recent_unknown",
  "recent_suspicious",
  "recent_high_risk",
  "recent_image_unreadable",
  "orphan",
  "stale",
  "new_artifact",
];

function surfaceVariants(seed: string): ReadonlyArray<{
  name: DialogueCorpusRow["surfaceVariant"];
  text: string;
}> {
  const withoutTerminalPunctuation = seed.replace(/[.!?]+$/u, "");
  return [
    { name: "canonical", text: seed },
    { name: "uppercase", text: seed.toLocaleUpperCase("ru") },
    { name: "padded", text: `  ${seed}  ` },
    { name: "emphatic", text: `${withoutTerminalPunctuation}?!` },
  ];
}

function buildDialogueCorpus(): DialogueCorpusRow[] {
  const rows: DialogueCorpusRow[] = [];
  for (const action of ALL_LAST_CHECK_FOLLOW_UP_ACTIONS) {
    for (const lang of ["ru", "uz", "en"] as const) {
      for (const surface of surfaceVariants(FOLLOW_UP_PHRASE_SEEDS[action][lang])) {
        for (const context of DIALOGUE_CONTEXTS) {
          rows.push({
            id: `${action}:${lang}:${surface.name}:${context}`,
            lang,
            context,
            utterance:
              context === "new_artifact"
                ? `${surface.text} https://example.com/new-check`
                : surface.text,
            action,
            intentId: canonicalFollowUpIntentId(action),
            surfaceVariant: surface.name,
          });
        }
      }
    }
  }
  return rows;
}

export const TELEGRAM_DIALOGUE_CORPUS: readonly DialogueCorpusRow[] = buildDialogueCorpus();
