import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyMetaIntent, type MetaIntent } from "@/lib/meta-intent";
import { evaluateText, type ReasonCode } from "@/lib/risk/rules";
import {
  classifyLastCheckFollowUp,
  type LastCheckFollowUpAction,
} from "@/lib/telegram/check-followup";
import {
  EVERYDAY_DIALOGUE_CATEGORIES,
  EVERYDAY_DIALOGUE_CORPUS,
  EVERYDAY_DIALOGUE_FIXED_NOW,
  EVERYDAY_DIALOGUE_STATS,
  type EverydayDialogueCategory,
  type EverydayDialogueTurn,
} from "@/lib/telegram/everyday-dialogue-corpus";
import {
  enforceTelegramReplyContract,
  getTelegramIntentContract,
} from "@/lib/telegram/intent-contract";
import { classifyVictimIntent, type VictimIntentKind } from "@/lib/telegram/victim-intent";
import type { PanicScenarioId } from "@/lib/telegram/emergency";
import { classifyTextPanicIntent } from "@/lib/telegram/text-panic-intent";

interface CategoryAllowedFirstOutcomes {
  readonly families: readonly EverydayDialogueTurn["family"][];
  readonly victim?: readonly VictimIntentKind[];
  readonly meta?: readonly MetaIntent[];
  readonly followup?: readonly LastCheckFollowUpAction[];
  readonly panic?: readonly PanicScenarioId[];
  readonly riskMustIncludeOneOf?: readonly ReasonCode[];
}

/**
 * Human-authored release policy. These values are deliberately independent
 * from each seed's declared expectation and from the production classifiers:
 * a broken classifier cannot make its own result "correct" by regenerating
 * the expected value in the corpus builder.
 */
const CATEGORY_ALLOWED_FIRST_OUTCOMES = {
  scam_concern: {
    families: ["victim"],
    victim: ["general_scam_concern", "telegram_message"],
  },
  help_now: {
    families: ["victim", "meta"],
    victim: ["emotional_help"],
    meta: ["help"],
  },
  active_code_pressure: {
    families: ["victim", "panic", "risk"],
    victim: ["code_request"],
    panic: [6],
    riskMustIncludeOneOf: ["asks_for_sms_code", "asks_for_otp", "asks_for_pin"],
  },
  active_transfer_pressure: {
    families: ["victim", "panic", "risk"],
    victim: ["transfer_request", "money_mule"],
    panic: [6],
    riskMustIncludeOneOf: ["asks_to_transfer_to_safe_account"],
  },
  link_or_file_received: {
    families: ["victim", "panic"],
    victim: ["link_received", "file_received", "link_request", "telegram_takeover"],
    panic: [5],
  },
  unknown_call: {
    families: ["victim", "panic"],
    victim: ["unknown_call", "silent_call", "foreign_call"],
    panic: [6],
  },
  family_targeted: {
    families: ["victim"],
    victim: ["friend_money"],
  },
  already_happened: {
    families: ["victim", "panic"],
    victim: [
      "relative_already_paid",
      "unauthorized_charge",
      "account_hacked_other",
      "personal_data_already_shared",
    ],
    panic: [1, 2, 3, 4, 5],
  },
  what_to_do: {
    families: ["victim"],
    victim: ["advice_question"],
  },
  why_result: {
    families: ["followup"],
    followup: ["explain", "methodology"],
  },
  challenge_result: {
    families: ["followup"],
    followup: ["confidence", "disagreement", "recheck", "trusted_person", "next_steps"],
  },
  capabilities: {
    families: ["meta"],
    meta: [
      "can_check_link",
      "can_check_phone",
      "can_check_image",
      "can_check_account",
      "can_check_message",
      "can_check_qr",
      "what_can_you_do",
    ],
  },
  greetings_and_thanks: {
    families: ["meta", "victim"],
    meta: ["greeting"],
    victim: ["acknowledgement"],
  },
  mixed_clause_trap: {
    families: ["victim", "risk"],
    victim: ["code_request", "file_received", "apk_request"],
    riskMustIncludeOneOf: [
      "asks_for_sms_code",
      "asks_for_card_cvv",
      "requests_personal_data",
      "asks_to_share_screen",
      "asks_to_transfer_to_safe_account",
    ],
  },
  neutral_word_trap: {
    families: ["victim", "risk"],
    victim: ["code_request"],
    riskMustIncludeOneOf: [
      "asks_for_sms_code",
      "asks_for_card_cvv",
      "asks_for_pin",
      "asks_to_scan_qr",
      "asks_to_transfer_to_safe_account",
      "requests_card_digits",
      "requests_personal_data",
    ],
  },
} as const satisfies Readonly<Record<EverydayDialogueCategory, CategoryAllowedFirstOutcomes>>;

// Deterministic offline QA only: no model training, no Telegram calls and no
// provider/reputation requests. The global test guard also rejects all network.
describe("540 semantically distinct everyday two-turn Telegram dialogues", () => {
  let fetchGuard: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchGuard = vi.fn(() => {
      throw new Error("everyday dialogue corpus must not access the network or an API");
    });
    vi.stubGlobal("fetch", fetchGuard);
  });

  afterEach(() => {
    expect(fetchGuard).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("has exact balanced coverage, unique first phrases and two user turns per dialogue", () => {
    expect(EVERYDAY_DIALOGUE_CATEGORIES).toHaveLength(15);
    expect(EVERYDAY_DIALOGUE_CORPUS).toHaveLength(540);
    expect(EVERYDAY_DIALOGUE_STATS).toMatchObject({
      totalDialogues: 540,
      totalUserTurns: 1080,
      languageCounts: { ru: 180, uz: 180, en: 180 },
    });
    expect(
      Object.values(EVERYDAY_DIALOGUE_STATS.firstFamilyCounts).reduce(
        (total, count) => total + count,
        0,
      ),
    ).toBe(540);
    for (const count of Object.values(EVERYDAY_DIALOGUE_STATS.firstFamilyCounts)) {
      expect(count).toBeGreaterThan(0);
    }

    expect(new Set(EVERYDAY_DIALOGUE_CORPUS.map((dialogue) => dialogue.id)).size).toBe(540);
    expect(new Set(EVERYDAY_DIALOGUE_CORPUS.map((dialogue) => dialogue.first.utterance)).size).toBe(
      540,
    );
    expect(
      new Set(
        EVERYDAY_DIALOGUE_CORPUS.map(
          (dialogue) => `${dialogue.first.utterance}\u241e${dialogue.followUp.utterance}`,
        ),
      ).size,
    ).toBe(540);
    expect(
      new Set(EVERYDAY_DIALOGUE_CORPUS.map((dialogue) => dialogue.followUp.utterance)).size,
    ).toBeGreaterThanOrEqual(90);

    for (const category of EVERYDAY_DIALOGUE_CATEGORIES) {
      const rows = EVERYDAY_DIALOGUE_CORPUS.filter((dialogue) => dialogue.category === category);
      expect(rows, category).toHaveLength(36);
      for (const lang of ["ru", "uz", "en"] as const) {
        expect(
          rows.filter((dialogue) => dialogue.lang === lang),
          `${category}/${lang}`,
        ).toHaveLength(12);
      }
    }
  });

  it("keeps every first turn inside an independent category-level safety allowlist", () => {
    for (const dialogue of EVERYDAY_DIALOGUE_CORPUS) {
      const turn = dialogue.first;
      const allowed: CategoryAllowedFirstOutcomes =
        CATEGORY_ALLOWED_FIRST_OUTCOMES[dialogue.category];
      const label = `${dialogue.id}/${turn.utterance}`;

      expect(allowed.families, label).toContain(turn.family);

      if (turn.family === "victim") {
        expect(allowed.victim ?? [], label).toContain(turn.expectedIntent);
        continue;
      }

      if (turn.family === "meta") {
        expect(allowed.meta ?? [], label).toContain(turn.expectedIntent);
        continue;
      }

      if (turn.family === "followup") {
        expect(allowed.followup ?? [], label).toContain(turn.expectedAction);
        continue;
      }

      if (turn.family === "panic") {
        expect(allowed.panic ?? [], label).toContain(turn.expectedPanicId);
        continue;
      }

      const reasons = evaluateText(turn.utterance);
      expect(reasons.length, `${label}/risk-must-not-be-empty`).toBeGreaterThan(0);
      expect(
        reasons.some((reason) => (allowed.riskMustIncludeOneOf ?? []).includes(reason)),
        `${label}/risk-must-contain-direct-danger`,
      ).toBe(true);
      expect(turn.response, `${label}/risk-must-not-be-inconclusive`).not.toMatch(
        /(?:недостаточно\s+данных|not\s+enough\s+data|yetarli\s+ma['’]?lumot\s+yo['’]?q)/iu,
      );
    }
  });

  it("uses aftercare, not prevention copy, for every completed document-sharing seed", () => {
    const completedDocumentShares = EVERYDAY_DIALOGUE_CORPUS.filter(
      (dialogue) => dialogue.first.expectedIntent === "personal_data_already_shared",
    );
    expect(completedDocumentShares).toHaveLength(6);

    for (const dialogue of completedDocumentShares) {
      expect(dialogue.first.family, dialogue.id).toBe("victim");
      expect(dialogue.first.response, dialogue.id).toContain("102");
      expect(dialogue.first.response, dialogue.id).not.toMatch(
        /(?:не\s+отправляйте|do\s+not\s+send|yubormang)/iu,
      );
    }
  });

  it("keeps a completed unknown-call report outside the live-call panic route", () => {
    const dialogue = EVERYDAY_DIALOGUE_CORPUS.find(
      (candidate) =>
        candidate.first.utterance ===
        "Menga turli noma'lum raqamlardan qayta-qayta qo'ng'iroq qilishdi.",
    );
    expect(dialogue?.first).toMatchObject({
      family: "victim",
      route: "victim.unknown_call",
      expectedIntent: "unknown_call",
    });
    expect(dialogue?.first.response).not.toContain("QO'NG'IROQNI TUGATING");
  });

  it.each([
    {
      utterance: "В анкете всё заполнено, пришлите CVV банковской карты.",
      expected: {
        route: "input.risk_check",
        response:
          "🟠 *Требуется осторожность*\n━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Есть подозрительные признаки\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n📌 *Что заметил*\n• Просят CVV/CVC карты\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n✅ *Что делать*\n• Не сообщайте CVV/CVC, номер и другие данные карты",
        family: "risk",
        expectedReasons: ["asks_for_card_cvv"],
      },
    },
    {
      utterance: "This is a card game, however send the last four digits of your bank card.",
      expected: {
        route: "input.risk_check",
        response:
          "🟠 *Be cautious*\n━━━━━━━━━━━━━━━━━━━━\n\n⚠️ Suspicious signs found\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n📌 *What I noticed*\n• Asks you to reveal card digits\n┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n✅ *What to do*\n• Do not share CVV/CVC, card numbers, or other card details",
        family: "risk",
        expectedReasons: ["requests_card_digits"],
      },
    },
    {
      utterance: "Мне звонят и просят продиктовать код.",
      expected: {
        route: "panic.6",
        response:
          "📞 Звонят сейчас\n\n⚡ ЗАВЕРШИТЕ ЗВОНОК\n\nНе доказывайте ничего по телефону: настоящая организация спокойно дождётся вашей проверки через официальный канал.\n\nСкажите одну фразу:\n«Я сам перезвоню по официальному номеру».\n\nПотом нажмите «Я положил трубку». Не называйте SMS-код, PIN, CVV, пароль, паспортные данные или данные карты.",
        family: "panic",
        expectedPanicId: 6,
      },
    },
    {
      utterance: "Вы действительно уверены в этой оценке?",
      expected: {
        route: "followup.confidence",
        response:
          "Это не 100% гарантия: я проверяю только видимые признаки. По прошлой проверке есть подозрительные признаки.\n\nЕсли просят код, карту, APK, логин или оплату — остановитесь и пришлите это сообщение.",
        family: "followup",
        expectedAction: "confidence",
      },
    },
    {
      utterance: "Тогда можно позвонить маме?",
      expected: {
        route: "followup.trusted_person",
        response:
          "Да. Свяжитесь с близким сами: позвоните по сохранённому номеру и спокойно проверьте ситуацию вместе.\n\nНе пересылайте ему SMS-коды, PIN, CVV, пароли, фото карты или подозрительные файлы. Обычная фраза в чате никому автоматически сигнал не отправляет.",
        family: "followup",
        expectedAction: "trusted_person",
      },
    },
    {
      utterance: "Ты можешь проверить ссылку?",
      expected: {
        route: "meta.can_check_link",
        response:
          "Да. Пришлите ссылку целиком — открывать её не нужно. Я проверю адрес и видимые признаки риска, а потом коротко объясню результат. До проверки ничего на странице не вводите.",
        family: "meta",
        expectedIntent: "can_check_link",
      },
    },
    {
      utterance: "Men notanish odamga pasport rasmini yubordim.",
      expected: {
        route: "victim.personal_data_already_shared",
        response:
          "Hujjatlar allaqachon yuborilgan — endi xavfni kamaytirish kerak.\n\n1. Aloqani to'xtating, yozishma va profilni saqlang.\n2. Hujjat bilan login, parol yoki kod ham yuborilgan bo'lsa — darhol almashtiring va ikki bosqichli himoyani yoqing.\n3. Bank va hujjatni bergan idoraga faqat rasmiy kanal orqali murojaat qiling: hujjatni bloklash yoki almashtirish va kredit arizalarini nazorat qilishni aniqlashtiring.\nHujjat ishlatilayotgan bo'lsa yoki pul talab qilishsa — 102 ga xabar bering.",
        family: "victim",
        expectedIntent: "personal_data_already_shared",
      },
    },
  ] as const)("keeps a production-exact P1 golden for '$utterance'", ({ utterance, expected }) => {
    const dialogue = EVERYDAY_DIALOGUE_CORPUS.find(
      (candidate) => candidate.first.utterance === utterance,
    );
    expect(dialogue?.first).toEqual({ utterance, ...expected });
  });

  function validateTurn(
    turn: EverydayDialogueTurn,
    dialogue: (typeof EVERYDAY_DIALOGUE_CORPUS)[number],
  ): void {
    const label = `${dialogue.id}/${turn.utterance}`;
    const contract = getTelegramIntentContract(turn.route);
    const direct = contract.channels.direct;
    expect(direct, label).toBeDefined();

    if (turn.family === "victim") {
      expect(classifyMetaIntent(turn.utterance), label).toBeNull();
      expect(classifyVictimIntent(turn.utterance)?.kind, label).toBe(turn.expectedIntent);
      expect(contract).toMatchObject({
        family: "victim",
        action: "reply.victim_guidance",
        context: "none",
      });
      expect(direct, label).toEqual({ persistence: "forbidden", trustedContact: "forbidden" });
      expect(enforceTelegramReplyContract(turn.route, "direct", turn.response), label).toBe(
        turn.response,
      );
      return;
    }

    if (turn.family === "meta") {
      expect(classifyMetaIntent(turn.utterance), label).toBe(turn.expectedIntent);
      expect(contract).toMatchObject({ family: "meta", action: "reply.meta", context: "none" });
      expect(direct, label).toEqual({ persistence: "forbidden", trustedContact: "forbidden" });
      expect(enforceTelegramReplyContract(turn.route, "direct", turn.response), label).toBe(
        turn.response,
      );
      return;
    }

    if (turn.family === "followup") {
      expect(dialogue.lastCheck, label).toBeDefined();
      expect(
        classifyLastCheckFollowUp(
          turn.utterance,
          { lastCheck: dialogue.lastCheck },
          EVERYDAY_DIALOGUE_FIXED_NOW,
        ),
        label,
      ).toBe(turn.expectedAction);
      expect(contract).toMatchObject({
        family: "followup",
        action: "reply.followup",
        context: "recent_or_orphan_check",
      });
      expect(direct, label).toEqual({ persistence: "forbidden", trustedContact: "forbidden" });
      expect(enforceTelegramReplyContract(turn.route, "direct", turn.response), label).toBe(
        turn.response,
      );
      return;
    }

    if (turn.family === "panic") {
      expect(classifyTextPanicIntent(turn.utterance), label).toBe(turn.expectedPanicId);
      expect(contract).toMatchObject({
        family: "panic",
        action: "open.emergency",
        context: "emergency",
      });
      expect(direct, label).toEqual({
        persistence: "safe_metadata",
        trustedContact: "forbidden",
      });
      expect(turn.response.trim().length, label).toBeGreaterThan(20);
      return;
    }

    expect(classifyMetaIntent(turn.utterance), label).toBeNull();
    expect(classifyVictimIntent(turn.utterance), label).toBeNull();
    const reasons = evaluateText(turn.utterance);
    expect(reasons.length, label).toBeGreaterThan(0);
    for (const expectedReason of turn.expectedReasons ?? []) {
      expect(reasons, label).toContain(expectedReason);
    }
    expect(contract).toMatchObject({
      family: "risk_input",
      action: "run.risk_check",
      context: "fresh_artifact",
    });
    expect(direct, label).toEqual({
      persistence: "required_check_row",
      trustedContact: "high_risk_only",
    });
  }

  it.each(EVERYDAY_DIALOGUE_CORPUS)(
    "routes both user turns and enforces response/side-effect contracts in $id",
    (dialogue) => {
      validateTurn(dialogue.first, dialogue);
      validateTurn(dialogue.followUp, dialogue);
    },
  );

  it("keeps all generated answers readable, localized and free of implementation jargon", () => {
    const forbidden =
      /(?:\bintent(?:[_ -]?id)?\b|reason[_ -]?code|classifier|routing table|threshold|deterministic|детерминирован|детерминист|deterministik|\bundefined\b|\bTODO\b|\[object Object\]|\{[a-zA-Z0-9_]+\})/iu;

    for (const dialogue of EVERYDAY_DIALOGUE_CORPUS) {
      for (const turn of [dialogue.first, dialogue.followUp]) {
        expect(turn.response.trim().length, dialogue.id).toBeGreaterThan(20);
        expect(turn.response.length, dialogue.id).toBeLessThanOrEqual(4096);
        expect(turn.response, dialogue.id).not.toMatch(forbidden);
        expect(turn.response, dialogue.id).not.toMatch(/\?{3,}|!{4,}/u);
      }
    }

    for (const category of EVERYDAY_DIALOGUE_CATEGORIES) {
      const firstResponseByLanguage = (["ru", "uz", "en"] as const).map(
        (lang) =>
          EVERYDAY_DIALOGUE_CORPUS.find(
            (dialogue) => dialogue.category === category && dialogue.lang === lang,
          )!.first.response,
      );
      expect(new Set(firstResponseByLanguage).size, category).toBe(3);
    }
  });

  it("does not let safe lead-ins or neutral words suppress a dangerous clause", () => {
    const rows = EVERYDAY_DIALOGUE_CORPUS.filter(
      (dialogue) =>
        dialogue.category === "mixed_clause_trap" || dialogue.category === "neutral_word_trap",
    );
    expect(rows).toHaveLength(72);

    for (const dialogue of rows) {
      expect(dialogue.first.utterance, dialogue.id).toMatch(/[,;]/u);
      const reasons = evaluateText(dialogue.first.utterance);
      for (const expectedReason of dialogue.first.expectedReasons ?? []) {
        expect(reasons, `${dialogue.id}/${dialogue.first.utterance}`).toContain(expectedReason);
      }
      expect(["risk", "victim"], dialogue.id).toContain(dialogue.first.family);
      expect(dialogue.first.response, dialogue.id).not.toMatch(
        /(?:недостаточно данных|not enough data|yetarli ma['’]?lumot yo['’]?q)/iu,
      );
      expect(dialogue.first.response, dialogue.id).toMatch(
        /(?:(?:^|\s)не\s|нельзя|do\s+not|don['’]?t|never|(?:yubor|ayt|kirit|o['’]?rnat|o['’]?tkaz|to['’]?la|och|skaner|ber|ko['’]?rsat|qil)mang)/iu,
      );
    }
  });

  it("never stores or contacts anyone for conversational replies", () => {
    const replyTurns = EVERYDAY_DIALOGUE_CORPUS.flatMap((dialogue) => [
      dialogue.first,
      dialogue.followUp,
    ]).filter((turn) =>
      (["victim", "meta", "followup"] as const).includes(
        turn.family as "victim" | "meta" | "followup",
      ),
    );
    expect(replyTurns.length).toBeGreaterThan(900);

    for (const turn of replyTurns) {
      expect(getTelegramIntentContract(turn.route).channels.direct).toEqual({
        persistence: "forbidden",
        trustedContact: "forbidden",
      });
    }
  });
});
