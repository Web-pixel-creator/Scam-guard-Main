// One-shot script: register bot command menu with BotFather via setMyCommands.
// Run after deploy or when commands change.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=... npx vite-node scripts/set-bot-commands.ts
import process from "node:process";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("✗ TELEGRAM_BOT_TOKEN not set");
  process.exit(1);
}

// Commands with emoji descriptions (shown in Telegram command autocomplete).
// Telegram limits: command = 1-32 chars lowercase; description = 3-256 chars.
const commands = [
  { command: "start", description: "🚀 Начать работу / Boshlash / Get started" },
  { command: "check", description: "🔍 Проверить номер или ссылку / Tekshirish" },
  { command: "report", description: "📢 Сообщить о мошеннике / Xabar berish" },
  { command: "panic", description: "🆘 Экстренная помощь / Shoshilinch yordam" },
  { command: "emergency", description: "🚨 Срочные шаги / Shoshilinch qadamlar" },
  { command: "safety", description: "🛡️ Правила безопасности / Xavfsizlik" },
  { command: "help", description: "📋 Список команд / Buyruqlar ro'yxati" },
  { command: "lang", description: "🌐 Сменить язык / Tilni o'zgartirish" },
];

async function main() {
  const url = `https://api.telegram.org/bot${token}/setMyCommands`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  const data = await res.json();
  if (data.ok) {
    console.log("✓ Bot commands registered successfully.");
    console.log("  Commands:", commands.map((c) => `/${c.command}`).join(", "));
  } else {
    console.error("✗ Failed:", data.description);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("✗ Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
