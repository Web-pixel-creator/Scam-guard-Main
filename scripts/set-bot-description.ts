// One-shot: set localized bot profile descriptions via Telegram API.
// Run: TELEGRAM_BOT_TOKEN=... npx vite-node scripts/set-bot-description.ts
import process from "node:process";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("\u2717 TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

const DESCRIPTION_MAX = 512;
const SHORT_DESCRIPTION_MAX = 120;

export interface DescriptionPayload {
  description: string;
  short_description: string;
  language_code?: "ru" | "uz" | "en";
}

export function buildDescriptionPayloads(): DescriptionPayload[] {
  const en: DescriptionPayload = {
    language_code: "en",
    description:
      "\u{1F6E1} Ishonch Guard \u2014 anti-scam bot for Uzbekistan.\n\nCheck phone numbers, links, Telegram usernames, screenshots and messages. Get instant risk assessment and safety advice.\n\nFree, open-source, private.",
    short_description:
      "Ishonch Guard: anti-scam checks for Uzbekistan. Send phone, link, username, text or screenshot.",
  };

  const ru: DescriptionPayload = {
    language_code: "ru",
    description:
      "\u{1F6E1} Ishonch Guard \u2014 антискам-бот для Узбекистана.\n\nПроверяйте номера, ссылки, Telegram-аккаунты, скриншоты и тексты сообщений. Бот подскажет уровень риска и безопасный следующий шаг.\n\nБесплатно, open-source, приватно.",
    short_description:
      "Ishonch Guard: проверка номеров, ссылок, Telegram-аккаунтов, текстов и скриншотов на скам.",
  };

  const uz: DescriptionPayload = {
    language_code: "uz",
    description:
      "\u{1F6E1} Ishonch Guard \u2014 O'zbekiston uchun anti-scam bot.\n\nTelefon raqami, havola, Telegram akkaunt, skrinshot va xabar matnini tekshiring. Bot xavf darajasini va xavfsiz keyingi qadamni aytadi.\n\nBepul, open-source, maxfiy.",
    short_description:
      "Ishonch Guard: raqam, havola, Telegram akkaunt, matn va skrinshotlarni scam belgilariga tekshiradi.",
  };

  const fallback: DescriptionPayload = {
    description: en.description,
    short_description: en.short_description,
  };

  return [ru, uz, en, fallback];
}

function assertTelegramLimit(label: string, value: string, max: number) {
  const length = [...value].length;
  if (length > max) {
    throw new Error(`${label} exceeds Telegram limit (${length}/${max})`);
  }
}

async function main() {
  const base = "https://api.telegram.org/bot" + token;

  for (const payload of buildDescriptionPayloads()) {
    const label = payload.language_code ?? "default";
    assertTelegramLimit(`[${label}] description`, payload.description, DESCRIPTION_MAX);
    assertTelegramLimit(
      `[${label}] short_description`,
      payload.short_description,
      SHORT_DESCRIPTION_MAX,
    );

    const language =
      payload.language_code === undefined ? {} : { language_code: payload.language_code };

    const r1 = await fetch(base + "/setMyDescription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: payload.description, ...language }),
    });
    const d1 = await r1.json();
    console.log(`[${label}] setMyDescription:`, d1.ok ? "\u2713" : "\u2717", d1.description || "");

    const r2 = await fetch(base + "/setMyShortDescription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ short_description: payload.short_description, ...language }),
    });
    const d2 = await r2.json();
    console.log(
      `[${label}] setMyShortDescription:`,
      d2.ok ? "\u2713" : "\u2717",
      d2.description || "",
    );
  }
}

main().catch((e) => {
  console.error("\u2717", e.message);
  process.exit(1);
});
