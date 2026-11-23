import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const external = vi.hoisted(() => ({ attempts: 0 }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("Unexpected database access");
      },
    },
  ),
}));
vi.mock("./shared-rate-limit.server", () => ({
  checkSharedRateLimit: async () => ({ ok: true, remaining: 9, retryAfterSec: 0 }),
}));

import { runCheck } from "./check-core";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import { evaluateText, scoreFromCodes } from "./rules";

beforeEach(() => {
  external.attempts = 0;
  vi.stubGlobal("fetch", async () => {
    external.attempts += 1;
    throw new Error("Unexpected external request");
  });
});
afterEach(() => {
  expect(external.attempts).toBe(0);
  vi.unstubAllGlobals();
});

const taskCodes = (input: string) => evaluateText(input).filter((code) => code.startsWith("task_"));

describe("explicit adjacent task-reward references", () => {
  it.each([
    "Мне предложили ставить лайки. За это обещают заработок.",
    "Мне предложили ставить лайки. За это мне обещают деньги.",
    "I was asked to watch videos. They offer money for doing that.",
    "They asked me to watch videos. They promise rewards for each one.",
    "Menga vazifalar berishdi. Buning uchun pul va'da qilishdi.",
    "Topshiriqlarni bajaraman. Buning uchun menga pul to'lashadi.",
    "Менга вазифалар беришди. Бунинг учун пул ваъда қилишди.",
  ])("recognizes only an explicit reward link: %s", (input) => {
    expect(taskCodes(input)).toEqual(["task_reward_engagement_bait"]);
    expect(scoreFromCodes(taskCodes(input))).toEqual({ level: "suspicious", score: 20 });
  });

  it.each([
    "Мне предложили ставить лайки. За это не обещают заработок.",
    "Мне предложили ставить лайки. За это никто не платит деньги.",
    "I was asked to watch videos. They do not offer money for doing that.",
    "I was asked to watch videos. They promise no rewards for each one.",
    "I was asked to watch videos. Nobody offers money for doing that.",
    "Menga vazifalar berishdi. Buning uchun pul va'da qilishmaydi.",
    "Topshiriqlarni bajaraman. Buning uchun menga pul to'lashmaydi.",
    "Я ставлю лайки друзьям. Мне обещают заработок на официальной работе.",
    "I was asked to watch videos. My employer promised earnings from my normal work.",
    "Menga vazifalar berishdi. Bugun ish haqim uchun pul oldim.",
    "Мне предложили ставить лайки. Я починил велосипед. За это обещают заработок.",
    "They asked me to watch videos. I repaired a bike. They offer money for doing that.",
    "Menga vazifalar berishdi. Velosipedni tuzatdim. Buning uchun pul va'da qilishdi.",
    "Пример: предложили ставить лайки. За это обещают заработок.",
    "For example: they asked me to watch videos. They offer money for doing that.",
    "Misol: vazifalar berishdi. Buning uchun pul va'da qilishdi.",
    "Мне предложили ставить лайки. За это обещают заработок. Это мошенничество. Не пополняйте баланс.",
    "They asked me to watch videos. They offer money for doing that. This is a scam. Do not top up.",
    "Menga vazifalar berishdi. Buning uchun pul va'da qilishdi. Bu firibgarlik, balansni to'ldirmang.",
  ])("does not borrow unrelated, denied or educational benefits: %s", (input) => {
    expect(taskCodes(input)).toEqual([]);
  });
});

describe("withdrawal payment noun polarity", () => {
  it.each([
    "I earn money for liking posts. To withdraw my earnings they ask me to pay a tax.",
    "I earn money for liking posts. To withdraw my earnings they ask me to pay a tax, no deposit is required.",
    "I earn money for liking posts. To withdraw my earnings no deposit is required, they ask me to pay a tax.",
    "I earn money for liking posts. To withdraw my earnings they ask me to pay a deposit, no tax is required.",
    "I earn money for liking posts. To withdraw my earnings no tax is required, they ask me to pay a deposit.",
    "I earn money for liking posts. To withdraw my earnings they ask me to pay a tax and no deposit is required.",
    "I earn money for liking posts. To withdraw my earnings they ask me to pay a deposit and no tax is required.",
    "За лайки обещают заработок. Чтобы вывести деньги, нужно заплатить налог, пополнять баланс не надо.",
    "За лайки обещают заработок. Чтобы вывести деньги, пополнять баланс не надо, нужно заплатить налог.",
    "За лайки обещают заработок. Чтобы вывести деньги, нужно пополнить баланс, платить налог не надо.",
    "За лайки обещают заработок. Чтобы вывести деньги, платить налог не надо, нужно пополнить баланс.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun komissiya to'lashim shart, depozit kerak emas.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun depozit kerak emas, komissiya to'lashim shart.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun balansni to'ldirishim kerak, soliq to'lash shart emas.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun soliq to'lash shart emas, balansni to'ldirishim kerak.",
    "Мне предложили ставить лайки. За это обещают заработок. Чтобы вывести деньги, нужно заплатить налог, пополнять баланс не надо.",
    "I was asked to watch videos. They offer money for doing that. To withdraw my earnings they ask me to pay a tax, no deposit is required.",
    "Menga vazifalar berishdi. Buning uchun pul va'da qilishdi. Pulni yechish uchun komissiya to'lashim shart, depozit kerak emas.",
    "I completed tasks. To withdraw, they say no deposit is required but I must pay a tax.",
    "I completed tasks. No deposit is required, but to withdraw they require a tax payment.",
    "I completed tasks. To withdraw, they require a tax payment, no deposit is required.",
  ])("keeps the actual payment despite another payment's denial: %s", (input) => {
    expect(taskCodes(input)).toEqual(["task_withdrawal_payment"]);
    expect(scoreFromCodes(taskCodes(input))).toEqual({ level: "high_risk", score: 50 });
  });

  it.each([
    "I earn money for liking posts. To withdraw my earnings I do not need to pay a tax, no deposit is required.",
    "I earn money for liking posts. To withdraw my earnings I do not need to pay a deposit, no tax is required.",
    "I earn money for liking posts. To withdraw my earnings no tax or deposit is required.",
    "I earn money for liking posts. To withdraw my earnings the tax is deducted from my earnings, no deposit is required.",
    "I earn money for liking posts. To withdraw my earnings I do not need to pay a tax and a deposit.",
    "I earn money for liking posts. To withdraw my earnings I do not need to pay a tax and pay a deposit.",
    "За лайки обещают заработок. Чтобы вывести деньги, платить налог не надо, пополнять баланс не надо.",
    "За лайки обещают заработок. Чтобы вывести деньги, не нужно платить налог, не надо пополнять баланс.",
    "За лайки обещают заработок. Чтобы вывести деньги, налог удерживают из заработка, пополнять баланс не надо.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun komissiya to'lash shart emas, depozit kerak emas.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun soliq to'lash shart emas, balansni to'ldirish kerak emas.",
    "Layklar uchun pul va'da qilishdi. Pulni yechish uchun komissiya daromaddan ushlab qolinadi, depozit kerak emas.",
    "I enjoy liking posts. My bank tells me to top up my own balance to withdraw cash, no tax is required.",
    "For example: like videos. To withdraw, pay a tax, no deposit is required.",
    "I earn money for liking posts. To withdraw my earnings I do not need to pay tax, send money or top up my balance.",
    "За лайки обещают заработок. Чтобы вывести деньги, не нужно платить налог, пополнять баланс или вносить депозит.",
    "I earn money for liking posts. To withdraw no deposit is required. I must pay a tax on my car.",
    "I completed tasks. No deposit is required at the bike shop. To withdraw they require a tax payment.",
    "I was asked to watch videos. They offer money for doing that. This is a scam. Do not pay a tax to withdraw.",
    "I earn money for liking posts. To withdraw my earnings they require a tax, which is deducted from my earnings, no deposit is required.",
  ])("does not manufacture a payment from denied or withheld costs: %s", (input) => {
    expect(taskCodes(input)).not.toContain("task_withdrawal_payment");
  });
});

describe("actual offline check composition", () => {
  it.each([
    [
      "ru",
      "Мне предложили ставить лайки. За это обещают заработок.",
      "Чтобы вывести деньги, нужно заплатить налог, пополнять баланс не надо.",
      /не доплачивайте.{0,60}вывод/iu,
    ],
    [
      "uz",
      "Menga vazifalar berishdi. Buning uchun pul va'da qilishdi.",
      "Pulni yechish uchun komissiya to'lashim shart, depozit kerak emas.",
      /pulni yechish uchun.{0,60}to['’]?lamang/iu,
    ],
    [
      "en",
      "I was asked to watch videos. They offer money for doing that.",
      "To withdraw my earnings they ask me to pay a tax, no deposit is required.",
      /do not pay.{0,60}withdraw/iu,
    ],
  ] as const)(
    "preserves reward and stronger payment guidance in %s",
    async (lang, reward, payment, stopAction) => {
      for (const [input, expected, level, score] of [
        [reward, "task_reward_engagement_bait", "suspicious", 20],
        [`${reward} ${payment}`, "task_withdrawal_payment", "high_risk", 50],
      ] as const) {
        const result = await runCheck({
          input,
          lang,
          channel: "web",
          rateLimitKey: `task-polarity:${lang}`,
          persist: false,
          skipAi: true,
          skipUrlReputation: true,
        });
        expect(result.reasons).toContain(expected);
        expect(result.level).toBe(level);
        // Other independent reasons retain their own score contribution.
        expect(result.score).toBeGreaterThanOrEqual(score);
        expect(scoreFromCodes([expected])).toEqual({ level, score });
        expect(result.explanation).toBeNull();
        if (expected === "task_withdrawal_payment") {
          expect(result.reasons).not.toContain("task_reward_engagement_bait");
          expect(filterAdvice(result.level, result.reasons, lang)[0]).toMatch(stopAction);
        }
      }
    },
  );
});
