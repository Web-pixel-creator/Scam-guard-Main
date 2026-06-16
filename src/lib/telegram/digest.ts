import type { Lang } from "@/lib/i18n";
import { escapeMarkdownV2, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB } from "@/lib/telegram/format";

const DIGEST_MAX_CHARS = 1600;

const DIGEST_TEXT: Record<Lang, string> = {
  ru: [
    "📰 Схемы недели",
    "",
    "Правило 5 секунд: если после рекламы, QR, подарка или звонка просят код, карту, seed-фразу или Telegram-вход — остановитесь и пришлите это мне.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎰 1. Казино / фриспины",
    "Крючок: бонус, VIP-прогноз, «точный матч».",
    "Что хотят: депозит, платный доступ или карту.",
    "Безопасно: не пополняйте баланс; пришлите ссылку.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🎁 2. NFT / Stars / подарок",
    "Крючок: подарок за реакцию, капчу или голосование.",
    "Что хотят: Telegram-код, wallet connect или комиссию.",
    "Безопасно: ничего не подключайте и не вводите код.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🏦 3. Банк / код / APK",
    "Крючок: «служба безопасности», «защитное приложение», срочный звонок.",
    "Что хотят: SMS-код, карту или доступ к телефону.",
    "Безопасно: положите трубку и перезвоните сами.",
    "",
    "Что прислать: ссылку, username, номер, текст сообщения или следующий экран после QR.",
  ].join("\n"),
  uz: [
    "📰 Haftalik sxemalar",
    "",
    "5 soniya qoidasi: reklama, QR, sovg'a yoki qo'ng'iroqdan keyin kod, karta, seed phrase yoki Telegram-login so'ralsa — to'xtang va menga yuboring.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎰 1. Kazino / frispin",
    "Ilgak: bonus, VIP-prognoz, «aniq match».",
    "Nima olishmoqchi: depozit, pulli kirish yoki karta.",
    "Xavfsiz qadam: balans to'ldirmang; havolani yuboring.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🎁 2. NFT / Stars / sovg'a",
    "Ilgak: reaksiya, captcha yoki ovoz berish evaziga sovg'a.",
    "Nima olishmoqchi: Telegram-kod, wallet connect yoki komissiya.",
    "Xavfsiz qadam: hech narsa ulamang va kod kiritmang.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🏦 3. Bank / kod / APK",
    "Ilgak: «xavfsizlik xizmati», «himoya ilovasi», shoshilinch qo'ng'iroq.",
    "Nima olishmoqchi: SMS-kod, karta yoki telefonga ruxsat.",
    "Xavfsiz qadam: go'shakni qo'ying va o'zingiz qayta qo'ng'iroq qiling.",
    "",
    "Menga yuboring: havola, username, raqam, xabar matni yoki QRdan keyingi ekran.",
  ].join("\n"),
  en: [
    "📰 Weekly Scam Patterns",
    "",
    "5-second rule: if an ad, QR, gift, or call asks for a code, card, seed phrase, or Telegram login — stop and send it to me.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎰 1. Casino / free spins",
    "Hook: bonus, VIP prediction, “sure match”.",
    "They want: deposit, paid access, or card data.",
    "Safe step: do not top up; send me the link.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🎁 2. NFT / Stars / gift",
    "Hook: gift for a reaction, captcha, or vote.",
    "They want: Telegram code, wallet connect, or fee.",
    "Safe step: connect nothing and enter no code.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🏦 3. Bank / code / APK",
    "Hook: “security service”, “protective app”, urgent call.",
    "They want: SMS code, card, or phone access.",
    "Safe step: hang up and call back yourself.",
    "",
    "Send me: link, username, phone number, message text, or the next screen after QR.",
  ].join("\n"),
};

export function buildWeeklyScamDigestKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_quick_panic", lang), callback_data: CB.emergency },
    ],
    [{ text: bt("btn_report", lang), callback_data: CB.report }],
  ];
}

export function formatWeeklyScamDigest(lang: Lang): { text: string; keyboard: InlineKeyboard } {
  const raw = DIGEST_TEXT[lang];
  if (raw.length > DIGEST_MAX_CHARS) {
    throw new Error(`Weekly scam digest for ${lang} is too long: ${raw.length}`);
  }
  return {
    text: escapeMarkdownV2(raw),
    keyboard: buildWeeklyScamDigestKeyboard(lang),
  };
}
