import type { Lang } from "@/lib/i18n";
import { escapeMarkdownV2, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB } from "@/lib/telegram/format";

const DIGEST_MAX_CHARS = 1600;

const DIGEST_TEXT: Record<Lang, string> = {
  ru: [
    "📰 Что сейчас часто используют мошенники",
    "",
    "Главное правило недели: не вводите SMS-код, карту, seed-фразу и Telegram-код после рекламы, QR, подарка или звонка.",
    "",
    "1) 🎰 Казино, фриспины, VIP-прогнозы",
    "Крючок: бонус, “точный матч”, закрытый канал. Цель: депозит, платный доступ или карта. Безопасно: не пополняйте баланс, пришлите ссылку боту.",
    "",
    "2) 🎁 NFT, Stars, подарки",
    "Крючок: подарок за реакцию, капчу или голосование. Цель: Telegram-код, wallet connect или комиссия. Безопасно: ничего не подключайте.",
    "",
    "3) 🏦 Банк, код, APK",
    "Крючок: “служба безопасности”, “защитное приложение”, срочный звонок. Цель: SMS-код, карта или доступ к телефону. Безопасно: положите трубку и перезвоните сами.",
    "",
    "Что прислать мне: ссылку, username, номер, текст сообщения или следующий экран после QR.",
  ].join("\n"),
  uz: [
    "📰 Hozir ko'p uchrayotgan firibgarliklar",
    "",
    "Haftaning asosiy qoidasi: reklama, QR, sovg'a yoki qo'ng'iroqdan keyin SMS-kod, karta, seed-phrase yoki Telegram-kodni kiritmang.",
    "",
    "1) 🎰 Kazino, frispin, VIP-prognoz",
    "Ilgak: bonus, “aniq match”, yopiq kanal. Maqsad: depozit, pulli kirish yoki karta. Xavfsiz: balans to'ldirmang, havolani botga yuboring.",
    "",
    "2) 🎁 NFT, Stars, sovg'alar",
    "Ilgak: reaksiya, captcha yoki ovoz berish evaziga sovg'a. Maqsad: Telegram-kod, wallet connect yoki komissiya. Xavfsiz: hech narsa ulamang.",
    "",
    "3) 🏦 Bank, kod, APK",
    "Ilgak: “xavfsizlik xizmati”, “himoya ilovasi”, shoshilinch qo'ng'iroq. Maqsad: SMS-kod, karta yoki telefon ruxsati. Xavfsiz: go'shakni qo'ying va o'zingiz qayta qo'ng'iroq qiling.",
    "",
    "Menga yuboring: havola, username, raqam, xabar matni yoki QRdan keyingi ekran.",
  ].join("\n"),
  en: [
    "📰 Scam patterns to watch this week",
    "",
    "Rule of the week: do not enter an SMS code, card data, seed phrase, or Telegram code after an ad, QR, gift, or incoming call.",
    "",
    "1) 🎰 Casino, free spins, VIP forecasts",
    "Hook: bonus, “sure match”, closed channel. Goal: deposit, paid access, or card data. Safe move: do not top up; send the link to the bot.",
    "",
    "2) 🎁 NFT, Stars, gifts",
    "Hook: gift for a reaction, captcha, or vote. Goal: Telegram code, wallet connect, or fee. Safe move: connect nothing.",
    "",
    "3) 🏦 Bank, code, APK",
    "Hook: “security service”, “protective app”, urgent call. Goal: SMS code, card, or phone access. Safe move: hang up and call back yourself.",
    "",
    "Send me: link, username, phone number, message text, or the next screen after QR.",
  ].join("\n"),
};

export function buildWeeklyScamDigestKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_quick_check", lang), callback_data: CB.checkAnother },
      { text: bt("btn_quick_panic", lang), callback_data: CB.emergency },
    ],
    [{ text: bt("btn_quick_report", lang), callback_data: CB.report }],
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
