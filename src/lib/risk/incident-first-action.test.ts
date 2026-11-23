import { describe, expect, it } from "vitest";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import { classifyVictimGuidanceFollowUp, classifyVictimIntent } from "@/lib/telegram/victim-intent";
import { detectFirstAction, INCIDENT_ACTION } from "./incident-first-action";
import { evaluateText, scoreFromCodes } from "./rules";
import { reportedBankSms } from "./reported-bank-sms";
import { mixedIncidents } from "./first-advice-regression.fixtures";

describe("second review: advice visible even on a one-action card", () => {
  it.each(mixedIncidents)("%s: %s", (lang, text, expected) => {
    const reasons = evaluateText(text);
    const first = filterAdvice(scoreFromCodes(reasons).level, reasons, lang)[0] ?? "";
    for (const action of expected) expect.soft(first).toMatch(action);
  });
  it.each([
    "Если с моей карты списали деньги без моего разрешения, что делать?",
    "С моей карты не списали деньги без моего разрешения.",
    "Он написал: «С моей карты списали деньги без моего разрешения».",
    "Мне прислали пример для памятки: «Позвонил оператор. С моей банковской карты списали деньги без моего разрешения. Что делать?» У меня ничего не списали.",
    "Если с моей банковской карты списали 200 000 сумов без моего разрешения, как поступить?",
    "Kartamdan ruxsatsiz pul yechilmadi.",
  ])("does not assert a debit in a hypothetical, negation or quote: %s", (text) => {
    expect(evaluateText(text)).not.toContain("reported_unauthorized_debit");
  });
});

describe("same evidence for urgent family transfer requests across languages", () => {
  it.each([
    "Позвонила внучка и попросила срочно перевести ей деньги.",
    "My granddaughter called and asked me to send her money urgently.",
    "Nabiram qo‘ng‘iroq qildi va shoshilinch pul yuborishimni so‘radi.",
    "Набирам қўнғироқ қилди ва шошилинч пул юборишимни сўради.",
  ])("recognizes the call, pressure and explicit request to send money: %s", (text) => {
    const reasons = evaluateText(text);
    expect([...reasons].sort()).toEqual([
      "asks_for_money_transfer",
      "relative_in_distress",
      "uses_urgency",
    ]);
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Nabiram videoqo‘ng‘iroqda shoshilinch pul so‘radi.",
    "Nabiram videoqo‘ng‘iroqda shoshilinch pul so‘radi, ovozi ham o‘ziniki.",
    "Набирам қўнғироқ қилди, овози ўхшайди, зудлик билан пул сўраяпти.",
  ])("does not infer a transfer method when the caller just asked for money: %s", (text) => {
    const reasons = evaluateText(text);
    expect(reasons).toContain("uses_urgency");
    expect(reasons).not.toContain("asks_for_money_transfer");
  });

  it.each([
    "Nabiram qo‘ng‘iroq qildi va shoshilinch pul yuborishimni so‘ramadi.",
    "Nabiram qo‘ng‘iroq qildi. Men shoshilinch pul yubordim.",
    "Nabiram qo‘ng‘iroq qildi. Shoshilinch tibbiy yordam kerak.",
  ])("does not invent an urgent demand: %s", (text) => {
    const reasons = evaluateText(text);
    expect(reasons).not.toContain("uses_urgency");
    expect(reasons).not.toContain("asks_for_money_transfer");
  });
});

describe("does not attribute other people's or denied demands to the relative", () => {
  it.each([
    "My grandson called to say happy birthday. Nobody asked for money or a code.",
    "My grandson called. My bank asked me to send money urgently.",
    "My granddaughter video-called me and asked me not to send money urgently.",
    "What if my grandson calls asking me to send money urgently?",
    "My grandson is on a video call asking me to send him money. It is not urgent.",
    "Позвонила внучка. Банк попросил срочно отправить деньги.",
    "Внучка позвонила и просит не отправлять деньги.",
    "Если внучка звонит и просит срочно перевести деньги, как поступить?",
  ])("does not select the new callback route: %s", (text) =>
    expect(detectFirstAction(text)).not.toBe("relative_in_distress"),
  );
});

describe("everyday reports on the public checker", () => {
  it("shows one family callback, not a generic instruction to hang up on a text message", () => {
    const reasons = evaluateText(
      "Nabiram Telegramda yozib, zudlik bilan pul yuborishimni so‘radi.",
    );
    expect(filterAdvice("high_risk", reasons, "uz")).toEqual([
      INCIDENT_ACTION.relative_in_distress.uz,
    ]);
    expect(filterAdvice("high_risk", [...reasons, "asks_for_sms_code"], "uz").join(" ")).toMatch(
      /SMS-kod/iu,
    );
  });
  it.each([
    ["Банк прислал СМС: назовите код из сообщения.", "code"],
    ["Bankdan SMS keldi: SMS kodini ayting.", "code"],
    ["Bank nomidan xabar keldi. SMS kodimni aytishimni so‘rashdi.", "code"],
    ["Bankdan xabar keldi: SMS kodini aytmang.", null],
    ["Банк пишет: никому не сообщайте код из СМС.", null],
    ["Банк пишет: скажите код из СМС. Я уже его сообщил.", null],
    ["Банк пишет: скажите код из СМС. Вот мой код: 123456.", null],
    ["Оператор пишет: скажите код из СМС.", null],
    ["Bankdan xabar keldi. Do‘stim SMS kodimni so‘radi.", null],
  ] as const)(
    "binds disclosure to a bank message, not a warning, code value or later incident: %s",
    (input, hint) => {
      expect(reportedBankSms(input)).toBe(hint);
    },
  );
  it.each([
    ["Банкдан хабар келди: СМС кодини айтинг.", "asks_for_sms_code"],
    ["Оператор қўнғироқ қилиб, телефонда буйруқ теришимни сўради.", "operator_requests_dial_code"],
    ["Nabiram Telegramda yozib, zudlik bilan pul yuborishimni so‘radi.", "relative_in_distress"],
  ] as const)("retains the reason for %s", (input, reason) =>
    expect(evaluateText(input)).toContain(reason),
  );
  it.each([
    [
      "Оператор қўнғироқ қилиб, телефонда буйруқ теришимни сўрамади.",
      "operator_requests_dial_code",
    ],
    ["Nabiram Telegramda yozib, zudlik bilan pul yuborishimni so‘ramadi.", "relative_in_distress"],
    ["Внук написал в Telegram. Банк просит срочно перевести деньги.", "relative_in_distress"],
  ] as const)("does not infer the new incident in %s", (input, reason) =>
    expect(detectFirstAction(input)).not.toBe(reason),
  );
});

describe("review regression: evidence and applicable next action", () => {
  it.each([
    "Оператор предупредил: если попросят набрать команду на телефоне, откажитесь.",
    "В памятке оператора сказано: мошенники просят набрать команду на телефоне. Не делайте этого.",
    "Что делать, если оператор попросит набрать команду на телефоне?",
    "The carrier warned: if someone asks you to dial a service code, refuse.",
  ])("does not turn a safety notice into a carrier demand: %s", (text) => {
    expect(detectFirstAction(text)).toBeNull();
    expect(evaluateText(text)).not.toContain("operator_requests_dial_code");
  });

  it.each([
    "Nabiram telefon qildi, keyin bank zudlik bilan pul so‘radi.",
    "Набирам телефон қилди, кейин банк зудлик билан пул сўради.",
  ])("attributes money to its speaker: %s", (text) => {
    expect(detectFirstAction(text)).not.toBe("relative_in_distress");
    expect(evaluateText(text)).not.toContain("relative_in_distress");
  });

  it.each([
    [
      "ru",
      "Мне позвонил оператор и попросил набрать команду на телефоне. Я уже набрал её. Что делать?",
      /оператор/iu,
      /не набирайте команду/iu,
    ],
    [
      "uz",
      "Operator qo‘ng‘iroq qilib, telefonda buyruq terishimni so‘radi. Men uni allaqachon terdim.",
      /operator/iu,
      /(?:kodni|buyruqni) termang/iu,
    ],
    [
      "en",
      "The carrier asked me to dial a special code. I already dialed it.",
      /carrier/iu,
      /do not dial the code/iu,
    ],
  ] as const)("gives post-dial advice on the checker in %s", (lang, text, required, forbidden) => {
    const reasons = evaluateText(text);
    const first = filterAdvice(scoreFromCodes(reasons).level, reasons, lang)[0];
    expect.soft(first).toMatch(required);
    expect(first).not.toMatch(forbidden);
  });
});

describe("carrier safeguards around the completed-action boundary", () => {
  it("does not mistake an operator safety notice for someone borrowing the user's handset", () => {
    const text =
      "В памятке написано: если оператор попросит набрать команду на телефоне, завершите звонок.";
    expect(classifyVictimIntent(text)?.kind).not.toBe("phone_borrowing");
  });
  const now = new Date("2026-01-01T00:30:00Z");
  const context = {
    kind: "operator_call",
    askedContext: "call",
    scenario: "carrier_dial_request",
    at: now.toISOString(),
  };
  it.each([
    ["Я уже набрал её.", { ...context, scenario: undefined }],
    ["Я уже набрал её.", { ...context, kind: "code_request" }],
    ["Я уже набрал её.", { ...context, at: "2026-01-01T00:00:00Z" }],
    ["Я уже набрал её?", context],
    ["Я её не набрала.", context],
    ["Он уже набрал её.", context],
  ] as const)(
    "does not infer completion from another topic, stale context or ambiguous reply: %s",
    (text, previous) => {
      expect(classifyVictimGuidanceFollowUp(text, previous, now)?.action).not.toBe(
        "carrier_dialed",
      );
    },
  );
  it.each([
    "Оператор просит набрать код из SMS в приложении.",
    "Оператор попросил назвать код из SMS и не набирать команду на телефоне.",
    "В памятке написано: если оператор попросит набрать команду на телефоне, завершите звонок.",
    "Оператор попросил набрать команду из SMS в приложении банка.",
  ])("does not invent a separate dialing request: %s", (text) => {
    expect(evaluateText(text)).not.toContain("operator_requests_dial_code");
  });
  it("keeps a genuine debit outside a quoted example", () => {
    const text =
      "В памятке написано: «Позвонили из банка. У меня списали деньги без разрешения». С моей карты списали 50 000 сумов без моего согласия.";
    expect(evaluateText(text)).toContain("reported_unauthorized_debit");
  });
  it.each([
    "Я её не набрал.",
    "Я уже набрал её?",
    "Он уже набрал её.",
    "Я уже набрал номер банка.",
    "Я уже набрал её, да?",
    "Я уже набрал её, но это был номер банка.",
  ])("does not assume the user executed the command: %s", (suffix) => {
    expect(detectFirstAction("Оператор попросил набрать команду на телефоне. " + suffix)).toBe(
      "operator_requests_dial_code",
    );
  });
  it("still handles a real demand after a separate safety notice", () => {
    expect(
      detectFirstAction(
        "В памятке оператора советуют быть осторожным. Мне позвонил оператор и попросил набрать команду на телефоне.",
      ),
    ).toBe("operator_requests_dial_code");
  });
});

describe("dialing a carrier command vs disclosing a code", () => {
  it.each([
    ["Қизим телефон қилди. Зудлик билан пул юборишимни сўради.", "relative_in_distress"],
    ["The mobile operator asked me to dial *00000#.", "operator_requests_dial_code"],
    ["Operator *00000# ni terishimni so‘radi.", "operator_requests_dial_code"],
  ] as const)(
    "recognizes a short continuation or a synthetic dial string without echoing it",
    (text, reason) => {
      expect(detectFirstAction(text)).toBe(reason);
      expect(evaluateText(text)).toContain(reason);
      expect(INCIDENT_ACTION[reason].uz).not.toContain("*00000#");
    },
  );
  it.each([
    "The operator asked me to read out my SMS code.",
    "Оператор просит ввести код из SMS в форму.",
    "Оператор попросил ввести код на сайте.",
    "Я работаю оператором. В магазине просят набрать код.",
    "Operator SMS kodimni aytishimni so‘radi.",
    "The carrier asked me not to dial a special code.",
    "Оператор просит не набирать USSD-команду.",
    "Operator maxsus kodni terishimni so‘ramadi.",
    "Где самому посмотреть USSD-команды моего оператора?",
    "How can I dial a service code to check my balance?",
    "Мой оператор не просил набрать *00000#.",
    "My carrier plan lists a service code: *00000#.",
    "Qizim telefon qildi. Bank shoshilinch pul so‘radi.",
    "Набирам қўнғироқ қилди, овози ўхшайди. Пул сўрамади.",
    "Nabiram videoqo‘ng‘iroq qildi, shoshilinch pul so‘ramadi.",
  ])("does not give the new call instruction for %s", (text) => {
    expect(detectFirstAction(text)).toBeNull();
    expect(evaluateText(text)).not.toContain("operator_requests_dial_code");
  });
});
