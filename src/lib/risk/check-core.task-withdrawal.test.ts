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
import { evaluateText, scoreFromCodes } from "./rules";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import { rankInlineReasonCodes } from "@/lib/telegram/inline-reason-presentation";
import { findMatchingPatterns } from "@/lib/scam-patterns";

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

describe("task earnings locked behind a new payment", () => {
  it.each(["ru", "uz", "en"] as const)(
    "keeps the stop-payment action under mixed signals in %s",
    (lang) => {
      const specific = filterAdvice("high_risk", ["task_withdrawal_payment"], lang)[0];
      const mixed = [
        "task_withdrawal_payment",
        "uses_urgency",
        "impersonates_bank",
        "suspicious_short_link",
        "payment_before_service",
      ];
      expect(filterAdvice("high_risk", mixed, lang)).toContain(specific);
      const secret = filterAdvice("high_risk", ["asks_for_otp"], lang)[0];
      const withSecret = filterAdvice("high_risk", [...mixed, "asks_for_otp"], lang);
      expect(withSecret[0]).toBe(secret);
      expect(withSecret).toContain(specific);
      expect(withSecret.length).toBeLessThanOrEqual(3);
    },
  );

  it("uses precise reason presentation and education instead of an NFT/casino pattern", () => {
    expect(
      rankInlineReasonCodes([
        "uses_urgency",
        "task_withdrawal_payment",
        "task_reward_engagement_bait",
      ])[0],
    ).toBe("task_withdrawal_payment");
    expect(rankInlineReasonCodes(["task_withdrawal_payment", "asks_for_otp"])[0]).toBe(
      "asks_for_otp",
    );
    const matches = findMatchingPatterns(["task_withdrawal_payment"]);
    expect(matches.map((pattern) => pattern.id)).toEqual(["task-withdrawal-payment"]);
    for (const lang of ["ru", "uz", "en"] as const) {
      expect(matches[0].whatToDo[lang][0]).toMatch(/вывода|yechish|withdraw/iu);
    }
  });
  it.each([
    [
      "ru",
      "За лайки обещают заработок, а для вывода денег требуют еще пополнить баланс и никому не говорить.",
      /не доплачивайте.{0,60}вывод/iu,
    ],
    [
      "uz",
      "Layklar uchun pul va'da qilishyapti, pulni yechish uchun yana balansni to'ldirishim kerak ekan.",
      /pulni yechish uchun.{0,60}to['’]?lamang/iu,
    ],
    [
      "uz",
      "Layk bosib pul ishlashni taklif qilishdi, pulni yechib olish uchun yana balansni to'ldirishimni talab qilishyapti.",
      /pulni yechish uchun.{0,60}to['’]?lamang/iu,
    ],
    [
      "en",
      "They promise earnings for liking posts, but to withdraw the money they want me to top up my balance again.",
      /do not pay.{0,60}withdraw/iu,
    ],
  ] as const)(
    "web %s has a precise warning and stop-action without AI",
    async (lang, input, stopAction) => {
      const result = await runCheck({
        input,
        lang,
        channel: "web",
        rateLimitKey: `task-withdrawal:${lang}`,
        persist: false,
        skipAi: true,
        skipUrlReputation: true,
      });
      expect(result.reasons).toContain("task_withdrawal_payment");
      expect(result.reasons).not.toContain("task_reward_engagement_bait");
      expect(result.level).toBe("high_risk");
      expect(result.score).toBe(50);
      expect(result.explanation).toBeNull();
      expect(filterAdvice(result.level, result.reasons, lang)[0]).toMatch(stopAction);
    },
  );

  it("does not invent prepayment from the exact browser withheld-fee case", async () => {
    const result = await runCheck({
      input:
        "I am withdrawing my wages from the work platform. The fee is deducted from existing earnings, with no new payment or deposit required.",
      lang: "en",
      channel: "web",
      rateLimitKey: "browser-withheld-fee",
      persist: false,
      skipAi: true,
      skipUrlReputation: true,
    });
    expect(result.reasons).toEqual([]);
    expect(result.level).toBe("unknown");
    expect(result.score).toBe(0);
    expect(result.explanation).toBeNull();
    expect(filterAdvice(result.level, result.reasons, "en")).toEqual([]);
  });

  it("keeps a separate advance-payment request after a denied withdrawal deposit", () => {
    const input =
      "I am withdrawing my wages from the work platform. The fee is deducted from existing earnings, with no new payment or deposit required. But a stranger now demands a deposit before providing the service.";
    expect(evaluateText(input)).toContain("payment_before_service");
  });

  it.each([
    "Ставьте лайки, для вывода пополните баланс",
    "За лайки начислили зарплату, но для получения требуют оплатить налог",
    "Layk bosing, pulni yechish uchun balansni to'ldiring",
    "Vazifalarni bajardim, ish haqini olish uchun komissiya to'lashni so'rashyapti",
    "Like videos and top up your balance to withdraw your earnings",
    "I posted reviews, but they demand a verification fee before cashing out",
    "За лайки обещают заработок, для вывода требуют пополнить баланс и не надо никому говорить.",
    "Layklar uchun pul va'da qilishadi, pulni yechish uchun balansni to'ldirishim kerak va hech kimga aytish kerak emas.",
  ])("recognizes a task-related advance payment: %s", (input) => {
    const reasons = evaluateText(input);
    expect(reasons).toContain("task_withdrawal_payment");
    expect(reasons).not.toContain("task_reward_engagement_bait");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Я сам пополнил свой банковский счёт и снял деньги в банкомате.",
    "Like videos if you want. I topped up my own bank account and withdrew cash at an ATM.",
    "Layk bosdim. O'z hisobimni to'ldirdim, keyin bankomatdan pul yechdim.",
    "Я ставлю лайки друзьям. Зарплату получил, комиссию банк удержал из суммы снятия.",
    "I enjoy liking posts. My employer paid my salary, the ATM fee was deducted from that balance.",
    "I like posts in my free time. My bank tells me to top up my own balance to withdraw cash.",
    "I do tasks at work. I top up my own bank account to withdraw cash at an ATM.",
    "За лайки обещают заработок, но для вывода не требуют пополнять баланс.",
    "They promise earnings for liking posts, but no top-up is required to withdraw.",
    "Like videos for rewards; you do not need to pay a deposit to withdraw earnings.",
    "Layklar uchun pul va'da qilishadi, pulni yechish uchun balansni to'ldirish shart emas.",
    "Layk bosib pul ishlashni taklif qilishdi, pulni yechib olish uchun balansni to'ldirish shart emas.",
    "They pay for reviews, and the withdrawal fee is deducted from my earnings, no new payment is required.",
    "I earn rewards for liking posts. The withdrawal fee is deducted from these earnings; I do not have to send any new money.",
    "За отзывы платят, комиссию за вывод удерживают из заработка, отдельно платить не нужно.",
    "Vazifalar uchun ish haqi bor, yechish komissiyasi daromaddan ushlab qolinadi, alohida to'lov kerak emas.",
    "Пример: за лайки обещают заработок, для вывода пополните баланс.",
    "For example: like videos and top up your balance to withdraw earnings.",
    "Misol: layk bosing, pulni yechish uchun balansni to'ldiring.",
    "За лайки обещают заработок. Это мошенничество. Не пополняйте баланс для вывода.",
    "They promise earnings for liking posts. This is a scam. Do not top up to withdraw.",
    "Layklar uchun pul va'da qilishadi. Bu firibgarlik, pulni yechish uchun balansni to'ldirmang.",
  ])("does not invent a live fresh-money requirement: %s", (input) => {
    const reasons = evaluateText(input);
    expect(reasons).not.toContain("task_withdrawal_payment");
    expect(scoreFromCodes(reasons).level, reasons.join(",")).not.toBe("high_risk");
  });

  it.each([
    "Не пополняйте баланс после заданий — это мошенничество. Но незнакомец пишет: ставьте лайки, для вывода пополните баланс.",
    "За лайки не обещают заработок у нас. Но незнакомец пишет: за лайки обещаю заработок, для вывода требуют пополнить баланс.",
    "No top-up is required for my salary. But a stranger now says: like videos and top up your balance to withdraw your earnings.",
    "I do not get money for liking posts, but the stranger now asks me to top up to withdraw.",
    "I do not have to send any new money for those tasks. But the stranger now asks me to send money from my card to withdraw the earnings.",
    "Balansni to'ldirmang, bu firibgarlik. Lekin notanish odam aytdi: layk bosing, pulni yechish uchun balansni to'ldiring.",
  ])("keeps a separate live payment demand: %s", (input) => {
    expect(evaluateText(input)).toContain("task_withdrawal_payment");
  });

  it.each([
    "За лайки обещают заработок",
    "They promise earnings for liking posts",
    "Layklar uchun pul va'da qilishadi",
  ])("does not raise a reward offer without a payment condition: %s", (input) => {
    const reasons = evaluateText(input);
    expect(reasons).toContain("task_reward_engagement_bait");
    expect(reasons).not.toContain("task_withdrawal_payment");
    expect(scoreFromCodes(reasons)).toEqual({ level: "suspicious", score: 20 });
  });
});
