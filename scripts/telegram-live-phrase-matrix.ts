import { LIVE_PHRASE_CASES } from "@/lib/telegram/live-phrase-cases";
import { classifyVictimIntent, buildVictimIntentText } from "@/lib/telegram/victim-intent";

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
  return singleLine.length <= max ? singleLine : `${singleLine.slice(0, max - 1)}...`;
}

function expectedRouteLabel(item: (typeof LIVE_PHRASE_CASES)[number]): string {
  const { expected } = item;
  if (expected.kind === "panic") return `panic:${expected.panicId}`;
  if (expected.kind === "risk_pipeline") return "risk_pipeline";
  if (expected.kind === "handler_reply") return `handler_reply:${expected.route}`;
  return `victim_intent:${expected.intent}`;
}

console.log(
  "| # | Area | Text | Expected full route | Victim classifier | Chat reply first line |",
);
console.log("|---:|---|---|---|---|---|");

LIVE_PHRASE_CASES.forEach((item, index) => {
  const lang = item.lang ?? "ru";
  const chatIntent = classifyVictimIntent(item.text);
  const chatReply = chatIntent ? buildVictimIntentText(chatIntent, lang) : "";
  const classifierLabel = chatIntent
    ? `${chatIntent.kind}${chatIntent.askedContext ? `/${chatIntent.askedContext}` : ""}`
    : "null";

  const cells = [
    String(index + 1),
    item.area,
    clip(item.text, 64),
    expectedRouteLabel(item),
    classifierLabel,
    chatReply ? clip(firstLine(chatReply)) : "n/a",
  ];
  console.log(`| ${cells.join(" | ")} |`);
});

console.log(
  "\nNote: panic and risk_pipeline rows are verified through handleCheck in check.followup-routing.test.ts.",
);
