import { describe, expect, it } from "vitest";
import { classifyMetaIntent } from "@/lib/meta-intent";
import {
  classifyVictimIntent,
  hasCompletedPersonalDataDisclosure,
} from "@/lib/telegram/victim-intent";
import { resolveTelegramTextLanguage } from "@/lib/telegram/inline-query-language";
import { classifyOrphanCheckFollowUp } from "@/lib/telegram/check-followup";
import { stripScenarioLeadIns } from "@/lib/telegram/conversation-wrapper";
import { classifyTextPanicIntent } from "@/lib/telegram/text-panic-intent";
import { DOCUMENT_DISCLOSURE_CASES } from "@/lib/telegram/__qa__/document-disclosure-fixtures";

describe("document action, object and attribution boundaries", () => {
  it.each(DOCUMENT_DISCLOSURE_CASES)("$expected: $text", ({ text, expected }) => {
    const match = classifyVictimIntent(text);
    if (expected === "aftercare") {
      expect(hasCompletedPersonalDataDisclosure(text)).toBe(true);
      expect(match?.kind).toBe("personal_data_already_shared");
    } else {
      expect(hasCompletedPersonalDataDisclosure(text)).toBe(false);
      expect(match?.kind).not.toBe("personal_data_already_shared");
      if (expected === "official_only") expect(match).toBeNull();
    }
  });
});

describe("natural lead-ins preserve the concrete incident", () => {
  it.each([
    ["Я отправил ПИНФЛ незнакомцу", null],
    ["Men PINFL raqamimni yubordim", null],
    ["Мен ПИНФЛ рақамимни юбордим", null],
    ["I sent my shopping list", null],
    ["I sent my PIN to a stranger", 4],
    ["I sent my PINFL and my PIN to a stranger", 4],
    ["Men PINni notanish odamga yubordim", 4],
    ["Men PINimni notanish odamga yubordim", 4],
    ["Я уже отправил ПИНФЛ и код из SMS незнакомцу", 1],
    ["Men PINFL va SMS kodni yubordim", 1],
  ] as const)("separates identity-number labels from real credentials: %s", (input, panic) => {
    expect(classifyTextPanicIntent(input)).toBe(panic);
  });
  it.each([
    ["Посмотри: незнакомец просит прислать фото паспорта", "personal_data_request"],
    ["Посмотри: ... незнакомец просит прислать фото паспорта", "personal_data_request"],
    [
      "Nima qilishni bilmay qoldim. Notanish odam pasport rasmini yuborishni so'rayapti",
      "personal_data_request",
    ],
    [
      "Please help me understand. A stranger asks me to send a passport photo",
      "personal_data_request",
    ],
    ["They sent me this: a stranger asks me to send a passport photo", "personal_data_request"],
    ["They sent me this: ... a stranger asks me to send a passport photo", "personal_data_request"],
    ["Не понимаю, что делать. Лжесотрудник банка требует срочно подтвердить операцию", "bank_call"],
    [
      "I do not know what to do. They offer a job but ask me to pay for mandatory training",
      "job_offer",
    ],
    ["I do not know what to do. They invite me to a fast earning channel", "earning_channel"],
  ] as const)("keeps the situation in %s", (input, kind) => {
    expect(classifyMetaIntent(input)).toBeNull();
    expect(classifyOrphanCheckFollowUp(input)).toBeNull();
    expect(classifyVictimIntent(input)?.kind).toBe(kind);
  });

  it.each([
    "Посмотри: таксист говорит, что терминал сломан, и просит перевести оплату на личную карту",
    "При просмотре сообщения незнакомец просит прислать фото паспорта",
    "They sent me this: a stranger asks me to send a passport photo",
  ])("does not invent medical or completed-document evidence: %s", (input) => {
    expect(classifyVictimIntent(input)?.kind).not.toBe("medical_code");
    expect(classifyVictimIntent(input)?.kind).not.toBe("personal_data_already_shared");
  });

  it.each(["DMED просит SMS код для записи на осмотр", "Врач просит назвать SMS код для записи"])(
    "retains real medical-code requests: %s",
    (input) => {
      expect(classifyVictimIntent(input)?.kind).toBe("medical_code");
    },
  );

  it.each([
    "Can you check this: I already sent my passport photo to a stranger",
    "Я отправил фото паспорта незнакомцу",
    "Men notanish odamga pasport rasmini yubordim",
    "I already sent a photo of my passport",
    "Я уже отравил фото паспорта незнакомцу",
    "I aleady sent my passport photo to a stranger",
    "Я паспорт уже отправил незнакомцу",
    "Паспорт уже отправил незнакомцу",
    "Паспорт я отправил незнакомцу",
    "Незнакомец пишет: отправь паспорт. Я уже отправил фото паспорта незнакомцу",
    "Я уже отправил ПИНФЛ незнакомцу",
    "Я передал ИНН незнакомцу",
    "I already shared my tax ID with a stranger",
    "Men PINFL raqamimni notanish odamga yubordim",
    "Men STIR raqamimni notanish odamga berdim",
    "My passport I already sent to a stranger.",
    "My passport, I already sent to a stranger.",
  ])("retains completed self-disclosure: %s", (input) => {
    expect(classifyMetaIntent(input)).toBeNull();
    expect(classifyVictimIntent(input)?.kind).toBe("personal_data_already_shared");
  });

  it.each([
    "A stranger sent me a photo of their passport",
    "They wrote: I sent a passport photo to a stranger",
    "I have not sent my passport photo to a stranger",
    "Я не отправил фото паспорта незнакомцу",
    "Men notanish odamga pasport rasmini yubormadim",
    "I might have sent my passport photo to a stranger",
    "A stranger asked for my passport, I sent only a refusal",
    "Незнакомец просил мой паспорт, я отправил только отказ",
    "I sent a refusal, but a stranger still asks for my passport",
    "Я отправил отказ, а незнакомец просит фото паспорта",
    "Незнакомец паспорт уже отправил мне",
    "Паспорт я не отправил незнакомцу",
    "Он написал: я отправил паспорт незнакомцу",
    "Незнакомец пишет: я уже отправил паспорт",
    "Если я отправил паспорт незнакомцу, что произойдет?",
    "If I sent my passport photo to a stranger, what would happen?",
    "U yozdi: men pasport rasmini yubordim",
    "Он прислал мне свой ИНН",
    "Незнакомец пишет: я отправил ПИНФЛ",
    "They shared their tax ID with me",
    "I have not sent my tax ID to a stranger",
    "Men PINFL raqamimni notanish odamga yubormadim",
    "U yozdi: men STIR raqamimni berdim",
    "Their passport they already sent to a stranger.",
    "My passport, I have not sent to a stranger.",
    "My passport, they already sent to a stranger.",
  ])("requires affirmative first-person evidence for aftercare: %s", (input) => {
    expect(hasCompletedPersonalDataDisclosure(input)).toBe(false);
    expect(classifyVictimIntent(input)?.kind).not.toBe("personal_data_already_shared");
  });

  it.each([
    "Can you check this: they ask me to vote in a channel and open a link",
    "Can you check this: they force me to pay a tax through a link they sent",
    "Can you check this: they blackmail me with my photos and demand payment",
    "Can you check this: a stranger messages me and asks me to follow instructions",
    "Can you check this: fake support asks me to disable account protection",
    "Can you check this: they tell me to call the bank using a number from an SMS",
    "Can you check this: a friend sent a link to a cash gift from a bank and says they already claimed the prize",
  ])("does not answer a case description with capability help: %s", (input) => {
    expect(classifyMetaIntent(input)).toBeNull();
  });

  it.each([
    ["Can you check this photo?", "can_check_image"],
    ["Can you check a bank payment link?", "can_check_link"],
    ["Can you check this: can you analyze a message?", "can_check_message"],
    ["Please help me understand. How do you check a message?", "how_do_you_check"],
  ] as const)("retains actual capability/methodology questions: %s", (input, intent) => {
    expect(classifyMetaIntent(input)).toBe(intent);
  });

  it.each(["Iltimos maslahat bering. Salom", "Mana yuborgan xabari — salom"])(
    "uses Uzbek evidence with a mismatched saved language: %s",
    (input) => {
      expect(resolveTelegramTextLanguage(input, "en")).toBe("uz");
    },
  );

  it.each([
    "I uploaded my passport through my bank's official app for my application",
    "I uploaded my passport through the official government portal",
  ])("preserves an explicit official document-upload control: %s", (input) => {
    expect(classifyVictimIntent(input)).toBeNull();
  });

  it.each([
    "I do not know what to do.",
    "They sent me this: I have not sent my passport",
    "Can you check this photo?",
    "Can you check this but do not send a code: 000000",
  ])("does not remove an incomplete clause, sender, negation or value: %s", (input) => {
    expect(stripScenarioLeadIns(input)).toBe(input);
  });

  it("preserves a secret-bearing or negated remainder exactly", () => {
    expect(stripScenarioLeadIns("Can you check this: password: synthetic-value")).toBe(
      "password: synthetic-value",
    );
    expect(stripScenarioLeadIns("Please help me understand. I did not send a code")).toBe(
      "I did not send a code",
    );
  });
});
