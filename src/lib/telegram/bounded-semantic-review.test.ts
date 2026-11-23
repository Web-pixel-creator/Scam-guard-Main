import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Lang } from "@/lib/i18n";

const review = vi.hoisted(() => ({
  externalAttempts: 0,
  answers: [] as Array<{
    results: Array<{ id: string; input_message_content: { message_text: string } }>;
  }>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("Unexpected database access in bounded semantic review");
      },
    },
  ),
}));
vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: async () => ({ ok: true, remaining: 9, retryAfterSec: 0 }),
}));
vi.mock("@/lib/telegram/api.server", () => ({
  answerInlineQuery: async (answer: (typeof review.answers)[number]) => {
    review.answers.push(answer);
    return { ok: true };
  },
  escapeMarkdownV2: (value: string) => value,
}));

import { runCheck } from "@/lib/risk/check-core";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";

// Independent bounded review corpus, fixed before inspecting implementation
// authors' expected outputs. These are synthetic controls, not user accuracy.
const documents: Array<{
  id: string;
  lang: Lang;
  input: string;
  expected: "aftercare" | "not-aftercare" | "official-only";
}> = [
  {
    id: "D01-refusal-ru",
    lang: "ru",
    input: "Я отправил незнакомцу отказ предоставить паспорт.",
    expected: "not-aftercare",
  },
  {
    id: "D02-refusal-en",
    lang: "en",
    input: "I sent them a refusal to share my passport.",
    expected: "not-aftercare",
  },
  {
    id: "D03-refusal-uz",
    lang: "uz",
    input: "Men pasport rasmini yuborishni rad etgan javobimni yubordim.",
    expected: "not-aftercare",
  },
  {
    id: "D04-indirect-ru",
    lang: "ru",
    input: "Незнакомец утверждает, что я отправил ему паспорт.",
    expected: "not-aftercare",
  },
  {
    id: "D05-indirect-en",
    lang: "en",
    input: "A stranger claims that I already sent my passport to him.",
    expected: "not-aftercare",
  },
  {
    id: "D06-indirect-uz",
    lang: "uz",
    input: "U men pasportimni yubordim deb aytyapti.",
    expected: "not-aftercare",
  },
  {
    id: "D07-official-only-ru",
    lang: "ru",
    input: "Я загрузил паспорт только через официальное приложение моего банка.",
    expected: "official-only",
  },
  {
    id: "D08-official-only-en",
    lang: "en",
    input: "I uploaded my passport only through my own bank's official app.",
    expected: "official-only",
  },
  {
    id: "D09-official-only-uz",
    lang: "uz",
    input: "Men pasportimni faqat o'z bankimning rasmiy ilovasi orqali yukladim.",
    expected: "official-only",
  },
  {
    id: "D10-refusal-then-disclosure",
    lang: "ru",
    input: "Я отправил отказ предоставить паспорт. Но потом я отправил паспорт незнакомцу.",
    expected: "aftercare",
  },
  {
    id: "D11-indirect-then-disclosure",
    lang: "en",
    input:
      "A stranger claims that I sent my passport. But I already sent my passport to a different stranger.",
    expected: "aftercare",
  },
  {
    id: "D12-official-then-disclosure",
    lang: "uz",
    input:
      "Men pasportimni bankning rasmiy ilovasiga yukladim. Keyin men pasport rasmini notanish odamga yubordim.",
    expected: "aftercare",
  },
];

const withdrawals: Array<{ id: string; lang: Lang; input: string; freshDemand: boolean }> = [
  {
    id: "T01-fresh-ru",
    lang: "ru",
    input:
      "Я выполнял задания за деньги. Сейчас требуют перевести 50000 сум со своей карты, чтобы вывести заработок.",
    freshDemand: true,
  },
  {
    id: "T02-fresh-en",
    lang: "en",
    input:
      "They paid me to like videos. Now they demand a deposit from my own card to withdraw the earnings.",
    freshDemand: true,
  },
  {
    id: "T03-fresh-uz",
    lang: "uz",
    input:
      "Layk bosib pul ishladim. Pulni yechish uchun o'z kartamdan yana pul o'tkazishimni talab qilishyapti.",
    freshDemand: true,
  },
  {
    id: "T04-withheld-ru",
    lang: "ru",
    input:
      "За задания заработал деньги. Комиссию за вывод удержат из моего заработка, отдельно пополнять ничего не надо.",
    freshDemand: false,
  },
  {
    id: "T05-withheld-en",
    lang: "en",
    input:
      "I earn rewards for liking posts. The withdrawal fee is deducted from these earnings; I do not have to send any new money.",
    freshDemand: false,
  },
  {
    id: "T06-withheld-uz",
    lang: "uz",
    input:
      "Layklar uchun pul va'da qilishdi. Pulni yechish komissiyasi ishlab topgan pulimdan ushlanadi, alohida pul to'lashim shart emas.",
    freshDemand: false,
  },
  {
    id: "T07-unrelated-bank-ru",
    lang: "ru",
    input:
      "Я ставлю лайки друзьям. Мой банк просит сначала пополнить мой собственный счёт, чтобы снять с него наличные.",
    freshDemand: false,
  },
  {
    id: "T08-unrelated-bank-en",
    lang: "en",
    input:
      "I like posts in my free time. My bank asks me to fund my own account before I can withdraw cash.",
    freshDemand: false,
  },
  {
    id: "T09-unrelated-bank-uz",
    lang: "uz",
    input:
      "Do'stlarimning videolariga layk bosaman. Bankim o'z hisobimdan naqd pul yechish uchun avval uni to'ldirishim kerakligini aytdi.",
    freshDemand: false,
  },
  {
    id: "T10-warning-then-live-demand",
    lang: "ru",
    input:
      "Не платите за вывод денег после заданий, это мошенничество. Но незнакомец сейчас требует внести депозит, чтобы вывести заработок за задания.",
    freshDemand: true,
  },
  {
    id: "T11-educational-example",
    lang: "en",
    input:
      "A guide says: scammers offer paid tasks and demand a new deposit to withdraw the earnings. Do not pay them.",
    freshDemand: false,
  },
  {
    id: "T12-denied-demand-uz",
    lang: "uz",
    input: "Topshiriqlar uchun ishlab topgan pulni yechish uchun yangi pul to'lash kerak emas.",
    freshDemand: false,
  },
];

beforeEach(() => {
  review.externalAttempts = 0;
  review.answers.length = 0;
  vi.stubGlobal("fetch", async () => {
    review.externalAttempts += 1;
    throw new Error("External network forbidden in bounded semantic review");
  });
});

afterEach(() => {
  expect(review.externalAttempts).toBe(0);
  vi.unstubAllGlobals();
});

describe("independent document actor and action review", () => {
  it.each(documents)("$id", async ({ id, lang, input, expected }) => {
    await handleInlineQuery(
      input,
      {
        userId: 42,
        session: {
          telegramUserId: 42,
          lang,
          scenario: "none",
          scenarioStep: 0,
          scenarioData: {},
          updatedAt: new Date(0).toISOString(),
        },
      },
      id,
    );
    expect(review.answers).toHaveLength(1);
    const article = review.answers[0].results[0];
    expect(article).toBeDefined();
    const semanticId = article.id.slice(0, -17);
    const evidence = JSON.stringify({
      id,
      semanticId,
      text: article.input_message_content.message_text,
    });
    if (expected === "aftercare") {
      expect(semanticId, evidence).toBe("check-unknown-personal-data-aftercare");
    } else {
      expect(semanticId, evidence).not.toBe("check-unknown-personal-data-aftercare");
      if (expected === "official-only") {
        expect(semanticId, evidence).not.toBe("check-unknown-personal-data");
      }
    }
  });
});

describe("independent fresh-money withdrawal review", () => {
  it.each(withdrawals)("$id", async ({ id, lang, input, freshDemand }) => {
    const result = await runCheck({
      input,
      lang,
      channel: "web",
      rateLimitKey: `bounded-review:${id}`,
      persist: false,
      skipAi: true,
      skipUrlReputation: true,
    });
    const evidence = JSON.stringify({ id, level: result.level, reasons: result.reasons });
    if (freshDemand) {
      expect(result.reasons, evidence).toContain("task_withdrawal_payment");
      expect(result.reasons, evidence).not.toContain("task_reward_engagement_bait");
      expect(result.level, evidence).toBe("high_risk");
    } else {
      expect(result.reasons, evidence).not.toContain("task_withdrawal_payment");
      // A withheld fee or unrelated banking action is not this high-risk rule.
      // This does not certify the service as genuine or require a safe verdict.
      expect(result.level, evidence).not.toBe("high_risk");
    }
    expect(result.explanation).toBeNull();
  });
});
