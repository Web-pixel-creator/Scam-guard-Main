import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const networkAttempts = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("Unexpected database access in task-scam regression");
      },
    },
  ),
}));
vi.mock("./shared-rate-limit.server", () => ({
  checkSharedRateLimit: async () => ({ ok: true, remaining: 9, retryAfterSec: 0 }),
}));

import { runCheck } from "./check-core";
import { evaluateText, scoreFromCodes } from "./rules";
import { filterAdvice } from "@/lib/telegram/advice-filter";

const liveCases = [
  {
    lang: "ru",
    input:
      "За лайки обещают заработок, а для вывода денег требуют еще пополнить баланс и никому не говорить.",
  },
  {
    lang: "uz",
    input:
      "Layklar uchun pul va'da qilishyapti, pulni yechish uchun yana balansni to'ldirishim kerak ekan.",
  },
  {
    lang: "en",
    input:
      "They promise earnings for liking posts, but to withdraw the money they want me to top up my balance again.",
  },
] as const;

beforeEach(() => {
  networkAttempts.count = 0;
  vi.stubGlobal("fetch", async () => {
    networkAttempts.count += 1;
    throw new Error("Unexpected external request in task-scam regression");
  });
});

afterEach(() => {
  expect(networkAttempts.count).toBe(0);
  vi.unstubAllGlobals();
});

describe("task earnings and withdrawal-fee website regression", () => {
  it.each(liveCases)(
    "classifies the actual web check pipeline in $lang",
    async ({ lang, input }) => {
      const result = await runCheck({
        input,
        lang,
        channel: "web",
        rateLimitKey: `task-web-regression:${lang}`,
        persist: false,
        skipAi: true,
        skipUrlReputation: true,
      });

      expect(result.type).toBe("text");
      expect(result.reasons).toContain("task_withdrawal_payment");
      expect(result.level).toBe("high_risk");
      expect(result.explanation).toBeNull();
      // RiskResultCard uses this same selector: the website must offer a
      // concrete stop-action even with its explanation provider disabled.
      const stopAction = {
        ru: /не доплачивайте для вывода/iu,
        uz: /pulni yechish uchun.+to'lamang/iu,
        en: /do not pay more to withdraw/iu,
      }[lang];
      expect(filterAdvice(result.level, result.reasons, lang).join(" ")).toMatch(stopAction);
    },
  );

  it.each([
    "За реакции обещали деньги, сейчас для вывода требуют пополнить баланс.",
    "За лайки обещают заработок. Для вывода денег просят внести депозит.",
    "Мне обещают заработок за лайки и просят пополнить баланс для вывода.",
    "Layk bosganim uchun pul beramiz deyishyapti. Pulni yechish uchun balansni to'ldiring deyishdi.",
    "I was promised money for likes. To withdraw, they ask me to add funds.",
    "I have been liking videos for money, now they demand a fee to release my earnings.",
    "За лайки начислили деньги, но их не дают вывести, пока не пополнишь баланс.",
    "They do not let me withdraw earnings from liking posts until I pay a deposit.",
  ])("keeps natural task/payment wording actionable: %s", (input) => {
    const reasons = evaluateText(input);
    expect(reasons).toContain("task_withdrawal_payment");
    expect(scoreFromCodes(reasons).level).not.toBe("unknown");
  });

  it.each([
    "Я ставлю лайки друзьям просто так, заработок мне не обещают.",
    "За лайки не обещают заработок, это обычный семейный чат.",
    "За лайки никто не платит, мы обсуждаем фотографии.",
    "Layklar uchun pul va'da qilishmaydi, bu oilaviy guruh.",
    "I enjoy liking posts, nobody promises money for it.",
    "No earnings are promised for liking posts in our family group.",
    "I enjoy liking posts about money and family budgets.",
    "I enjoy liking posts. I found money on the pavement today.",
    "I enjoy liking posts. My employer promised earnings from my normal work.",
    "Layklar uchun rahmat. Bugun ish haqim uchun pul oldim.",
    "They promise no earnings for liking posts.",
    "Layklar uchun pul va’da qilinmaydi.",
    "Спасибо за лайки и добрые слова, деньги на подарок собрали семьёй.",
    "I earn a salary as a teacher and enjoy liking posts in my free time.",
    "I do not get money for liking posts.",
    "За лайки обещают только дружбу, заработок мы обсуждали отдельно.",
    "Я ставлю реакции друзьям. Мне обещают заработок на официальной работе.",
    "Пример: за лайки обещают заработок, для вывода требуют пополнить баланс.",
    "Misol: layklar uchun pul va'da qilishyapti, pulni yechish uchun balansni to'ldiring.",
    "For example: they promise earnings for liking posts and demand a deposit to withdraw.",
    "За лайки обещают заработок, но это мошенничество, не пополняйте баланс для вывода.",
    "Layklar uchun pul va'da qilishadi. Bu firibgarlik, pulni yechish uchun balansni to'ldirmang.",
    "They promise earnings for liking posts. This is a scam, do not top up to withdraw.",
    "They promise earnings for liking posts. This is a scam. Do not top up to withdraw.",
    "За лайки обещают заработок. Это мошенничество. Не пополняйте баланс для вывода.",
  ])("does not turn local negation or educational context into a live offer: %s", (input) => {
    expect(evaluateText(input)).not.toContain("task_reward_engagement_bait");
    expect(evaluateText(input)).not.toContain("task_withdrawal_payment");
  });

  it.each([
    "Не пополняйте баланс после заданий — это мошенничество. Но незнакомец пишет: за лайки обещают заработок, для вывода пополните баланс.",
    "Не пополняйте баланс после заданий — это мошенничество; за лайки обещают заработок, для вывода пополните баланс.",
    "Balansni to'ldirmang, bu firibgarlik. Lekin notanish kontakt yozdi: layklar uchun pul va'da qilamiz, pulni yechish uchun balansni to'ldiring.",
    "Do not top up after tasks, this is a scam. However, a stranger promises earnings for liking posts and demands a deposit to withdraw.",
    "Пример: за лайки обещают заработок. Но незнакомец сейчас просит: ставьте лайки, для вывода пополните баланс.",
    "For example: people are promised money for likes. But a stranger now asks me to like videos and top up to withdraw earnings.",
    "За лайки не обещают заработок в нашей группе. Но незнакомец пишет: за лайки обещаю заработок, для вывода пополните баланс.",
    "Layklar uchun pul va'da qilishmaydi. Lekin notanish kontakt layklar uchun pul va'da qilib, pulni yechish uchun balansni to'ldirishni so'rayapti.",
    "No earnings are promised for liking posts here. But a stranger promises earnings for liking videos, then asks for a deposit to withdraw.",
    "За лайки обещают заработок, для вывода пополните баланс. Банк отдельно предупреждает: не пополняйте баланс, это мошенничество.",
    "They promise earnings for liking posts and ask for a deposit to withdraw. A bank separately warns: do not top up, this is a scam.",
    "I do not get money for liking posts. But a stranger now promises earnings for liking posts and asks for a deposit to withdraw.",
    "I do not get money for liking posts, but the stranger now asks me to top up to withdraw.",
    "За лайки обещают только дружбу, заработок мы обсуждали отдельно. Но незнакомец пишет: за лайки обещаю заработок, для вывода пополните баланс.",
  ])("a neighboring protective or example clause cannot hide a live request: %s", (input) => {
    expect(evaluateText(input)).toContain("task_withdrawal_payment");
  });
});
