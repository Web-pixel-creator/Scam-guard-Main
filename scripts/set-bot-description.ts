// One-shot: set bot description and about text via Telegram API.
// Run: TELEGRAM_BOT_TOKEN=... npx vite-node scripts/set-bot-description.ts
import process from "node:process";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("\u2717 TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

const DESCRIPTION_MAX = 512;
const SHORT_DESCRIPTION_MAX = 120;

const description =
  "\u{1F6E1} Ishonch Guard \u2014 anti-scam bot for Uzbekistan.\n\nCheck phone numbers, links, Telegram usernames, screenshots and messages. Get instant risk assessment and safety advice.\n\nFree, open-source, private.";
const shortDescription =
  "Ishonch Guard: anti-scam checks for Uzbekistan. Send phone, link, username, text or screenshot.";

function assertTelegramLimit(label: string, value: string, max: number) {
  const length = [...value].length;
  if (length > max) {
    throw new Error(`${label} exceeds Telegram limit (${length}/${max})`);
  }
}

async function main() {
  assertTelegramLimit("description", description, DESCRIPTION_MAX);
  assertTelegramLimit("short_description", shortDescription, SHORT_DESCRIPTION_MAX);

  const base = "https://api.telegram.org/bot" + token;

  const r1 = await fetch(base + "/setMyDescription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  const d1 = await r1.json();
  console.log("setMyDescription:", d1.ok ? "\u2713" : "\u2717", d1.description || "");

  const r2 = await fetch(base + "/setMyShortDescription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ short_description: shortDescription }),
  });
  const d2 = await r2.json();
  console.log("setMyShortDescription:", d2.ok ? "\u2713" : "\u2717", d2.description || "");
}

main().catch((e) => {
  console.error("\u2717", e.message);
  process.exit(1);
});
