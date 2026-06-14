import type { Lang } from "@/lib/i18n";
import { escapeMarkdownV2, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB } from "@/lib/telegram/format";

const DIGEST_MAX_CHARS = 1600;

const DIGEST_TEXT: Record<Lang, string> = {
  ru: [
    "📰 Схемы недели",
    "",
    "Главное: не вводите SMS-код, карту, seed-фразу или Telegram-код после рекламы, QR, подарка или звонка.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎰 Казино / фриспины / VIP-прогноз",
    "Крючок: бонус, «точный матч», закрытый канал.",
    "Риск: депозит, платный доступ или карта.",
    "Шаг: не пополняйте баланс, пришлите ссылку боту.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🎁 NFT / Stars / подарок",
    "Крючок: подарок за реакцию, капчу или голосование.",
    "Риск: Telegram-код, wallet connect или комиссия.",
    "Шаг: ничего не подключайте и не вводите код.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🏦 Банк / код / APK",
    "Крючок: «служба безопасности», «защитное приложение», срочный звонок.",
    "Риск: SMS-код, карта или доступ к телефону.",
    "Шаг: положите трубку и перезвоните сами.",
    "",
    "Что прислать мне: ссылку, username, номер, текст сообщения или следующий экран после QR.",
  ].join("\n"),
  uz: [
    "📰 Haftalik sxemalar",
    "",
    "Asosiysi: reklama, QR, sovg'a yoki qo'ng'iroqdan keyin SMS-kod, karta, seed phrase yoki Telegram-kodni kiritmang.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎰 Kazino / frispin / VIP-prognoz",
    "Ilgak: bonus, «aniq match», yopiq kanal.",
    "Xavf: depozit, pulli kirish yoki karta.",
    "Qadam: balans to'ldirmang, havolani botga yuboring.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🎁 NFT / Stars / sovg'a",
    "Ilgak: reaksiya, captcha yoki ovoz berish evaziga sovg'a.",
    "Xavf: Telegram-kod, wallet connect yoki komissiya.",
    "Qadam: hech narsa ulamang va kod kiritmang.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🏦 Bank / kod / APK",
    "Ilgak: «xavfsizlik xizmati», «himoya ilovasi», shoshilinch qo'ng'iroq.",
    "Xavf: SMS-kod, karta yoki telefonga ruxsat.",
    "Qadam: go'shakni qo'ying va o'zingiz qayta qo'ng'iroq qiling.",
    "",
    "Menga yuboring: havola, username, raqam, xabar matni yoki QRdan keyingi ekran.",
  ].join("\n"),
  en: [
    "📰 Weekly Scam Patterns",
    "",
    "Main rule: do not enter an SMS code, card data, seed phrase, or Telegram code after an ad, QR, gift, or incoming call.",
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎰 Casino / free spins / VIP prediction",
    "Hook: bonus, “sure match”, closed channel.",
    "Risk: deposit, paid access, or card data.",
    "Step: do not top up; send the link to the bot.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🎁 NFT / Stars / gift",
    "Hook: gift for a reaction, captcha, or vote.",
    "Risk: Telegram code, wallet connect, or fee.",
    "Step: connect nothing and enter no code.",
    "",
    "┈┈┈┈┈┈┈┈┈┈",
    "🏦 Bank / code / APK",
    "Hook: “security service”, “protective app”, urgent call.",
    "Risk: SMS code, card, or phone access.",
    "Step: hang up and call back yourself.",
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
