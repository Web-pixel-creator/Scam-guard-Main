import { classifyVictimIntent, buildVictimIntentText } from "@/lib/telegram/victim-intent";
import type { Lang } from "@/lib/i18n";

type Case = {
  area: string;
  text: string;
  expected: string;
  lang?: Lang;
};

const cases: Case[] = [
  {
    area: "ordinary concern",
    text: "мне пишет незнакомый человек",
    expected: "unknown_contact",
  },
  {
    area: "ordinary concern",
    text: "мне пишет одноклассник, но я не уверен что это он",
    expected: "identity_uncertain",
  },
  {
    area: "earning channel",
    text: "меня приглашают в канал для заработка",
    expected: "job/earning channel",
  },
  {
    area: "link request",
    text: "у меня просят ссылку",
    expected: "link_request",
  },
  {
    area: "sent code",
    text: "Я только что передал код из СМС",
    expected: "panic sent code route",
  },
  {
    area: "bank contact",
    text: "как мне связаться с банком?",
    expected: "bank_contact_question",
  },
  {
    area: "general concern",
    text: "меня пытаются обмануть",
    expected: "general_scam_concern",
  },
  {
    area: "voting link",
    text: "меня просят проголосовать на канале и перейти по ссылке",
    expected: "link_request/voting",
  },
  {
    area: "follow-up combined",
    text: "мне пишет незнакомый человек. Он хочет смс код",
    expected: "code_request",
  },
  {
    area: "call concern",
    text: "звонил мошенник",
    expected: "general_scam_concern or unknown_call",
  },
  {
    area: "telegram context",
    text: "мне пишут в телеграмме",
    expected: "telegram_message",
  },
  {
    area: "unknown object",
    text: "мне что то прислали",
    expected: "telegram_message/context",
  },
  {
    area: "uzbek code",
    text: "menga kod so'rashyapti",
    expected: "code_request",
    lang: "uz",
  },
  {
    area: "uzbek scam concern",
    text: "meni aldayapti",
    expected: "general_scam_concern",
    lang: "uz",
  },
  {
    area: "english code",
    text: "someone asked me for a verification code",
    expected: "code_request",
    lang: "en",
  },
];

function firstLine(value: string): string {
  return (
    value
      .split(/\n/u)
      .find((line) => line.trim().length > 0)
      ?.trim() ?? ""
  );
}

function clip(value: string, max = 135): string {
  const singleLine = value.replace(/\s+/gu, " ").trim();
  return singleLine.length <= max ? singleLine : `${singleLine.slice(0, max - 1)}…`;
}

console.log("| # | Area | Text | Expected | Chat intent | Chat reply first line |");
console.log("|---:|---|---|---|---|---|");

cases.forEach((item, index) => {
  const lang = item.lang ?? "ru";
  const chatIntent = classifyVictimIntent(item.text);
  const chatReply = chatIntent ? buildVictimIntentText(chatIntent, lang) : "";
  console.log(
    [
      `| ${index + 1}`,
      item.area,
      clip(item.text, 60),
      item.expected,
      chatIntent
        ? `${chatIntent.kind}${chatIntent.askedContext ? `/${chatIntent.askedContext}` : ""}`
        : "risk-pipeline/null",
      chatReply ? clip(firstLine(chatReply)) : "n/a",
      "|",
    ].join(" | "),
  );
});
