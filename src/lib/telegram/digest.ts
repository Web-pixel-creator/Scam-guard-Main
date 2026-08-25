import type { Lang } from "@/lib/i18n";
import { escapeMarkdownV2, type InlineKeyboard } from "@/lib/telegram/api.server";
import { bt } from "@/lib/telegram/bot-i18n";
import { CB } from "@/lib/telegram/format";

const DIGEST_MAX_CHARS = 1600;
const DIGEST_FRESHNESS_DAYS = 14;
const DIGEST_MIN_PUBLISHED_ENTRIES = 3;

type DigestEntryStatus = "draft" | "published" | "archived";
type DigestPublishMode = "manual";
type DigestSourceType = "curated_research" | "moderated_pattern" | "official_guidance";

type DigestSource = {
  type: DigestSourceType;
  label: string;
};

type DigestEntryCopy = {
  title: string;
  hook: string;
  wants: string;
  safe: string;
};

export type WeeklyScamDigestEntry = {
  id: string;
  rank: number;
  status: DigestEntryStatus;
  publishMode: DigestPublishMode;
  updatedAt: string;
  source: DigestSource;
  tags: readonly string[];
  copy: Record<Lang, DigestEntryCopy>;
};

type DigestSnapshot = {
  entries: readonly WeeklyScamDigestEntry[];
  isStaleFallback: boolean;
  text: string;
};

type FormatWeeklyScamDigestOptions = {
  now?: Date;
  entries?: readonly WeeklyScamDigestEntry[];
};

const DIGEST_INTRO: Record<Lang, string> = {
  ru: [
    "📰 Схемы недели",
    "",
    "Правило 5 секунд: если после рекламы, QR, подарка или звонка просят код, карту, seed-фразу или Telegram-вход — не выполняйте просьбу и пришлите её мне.",
  ].join("\n"),
  uz: [
    "📰 Haftalik sxemalar",
    "",
    "5 soniya qoidasi: reklama, QR, sovg'a yoki qo'ng'iroqdan keyin kod, karta, seed phrase yoki Telegram-login so'ralsa — to'xtang va menga yuboring.",
  ].join("\n"),
  en: [
    "📰 Weekly Scam Patterns",
    "",
    "5-second rule: if an ad, QR, gift, or call asks for a code, card, seed phrase, or Telegram login — do not comply; send the request to me.",
  ].join("\n"),
};

const DIGEST_SEND_HINT: Record<Lang, string> = {
  ru: "Что прислать: ссылку, username, номер, текст сообщения или следующий экран после QR.",
  uz: "Menga yuboring: havola, username, raqam, xabar matni yoki QRdan keyingi ekran.",
  en: "Send me: link, username, phone number, message text, or the next screen after QR.",
};

const DIGEST_STALE_FALLBACK: Record<Lang, string> = {
  ru: [
    DIGEST_INTRO.ru,
    "",
    "Дайджест обновляется вручную. Чтобы не выдавать старые тренды за новые, я покажу только базовое правило безопасности.",
    "",
    DIGEST_SEND_HINT.ru,
  ].join("\n"),
  uz: [
    DIGEST_INTRO.uz,
    "",
    "Digest qo'lda yangilanadi. Eski trendlarni yangi deb ko'rsatmaslik uchun hozir faqat asosiy xavfsizlik qoidasini ko'rsataman.",
    "",
    DIGEST_SEND_HINT.uz,
  ].join("\n"),
  en: [
    DIGEST_INTRO.en,
    "",
    "This digest is manually updated. To avoid presenting old trends as new, I will show the core safety rule for now.",
    "",
    DIGEST_SEND_HINT.en,
  ].join("\n"),
};

export const WEEKLY_SCAM_DIGEST_ENTRIES: readonly WeeklyScamDigestEntry[] = [
  {
    id: "casino-frispin-vip-forecast",
    rank: 1,
    status: "published",
    publishMode: "manual",
    updatedAt: "2026-07-02",
    source: {
      type: "curated_research",
      label: "Ishonch Guard public scam category review",
    },
    tags: ["casino", "frispin", "sports_prediction", "deposit"],
    copy: {
      ru: {
        title: "🎰 1. Казино / фриспины",
        hook: "Крючок: бонус, VIP-прогноз, «точный матч».",
        wants: "Что хотят: депозит, платный доступ или карту.",
        safe: "Безопасно: не пополняйте баланс; пришлите ссылку.",
      },
      uz: {
        title: "🎰 1. Kazino / frispin",
        hook: "Ilgak: bonus, VIP-prognoz, «aniq match».",
        wants: "Nima olishmoqchi: depozit, pulli kirish yoki karta.",
        safe: "Xavfsiz qadam: balans to'ldirmang; havolani yuboring.",
      },
      en: {
        title: "🎰 1. Casino / free spins",
        hook: "Hook: bonus, VIP prediction, “sure match”.",
        wants: "They want: deposit, paid access, or card data.",
        safe: "Safe step: do not top up; send me the link.",
      },
    },
  },
  {
    id: "nft-stars-gift-wallet",
    rank: 2,
    status: "published",
    publishMode: "manual",
    updatedAt: "2026-07-02",
    source: {
      type: "curated_research",
      label: "Ishonch Guard Telegram and wallet safety review",
    },
    tags: ["nft", "stars", "wallet_connect", "telegram_code"],
    copy: {
      ru: {
        title: "🎁 2. NFT / Stars / подарок",
        hook: "Крючок: подарок за реакцию, капчу или голосование.",
        wants: "Что хотят: Telegram-код, wallet connect или комиссию.",
        safe: "Безопасно: ничего не подключайте и не вводите код.",
      },
      uz: {
        title: "🎁 2. NFT / Stars / sovg'a",
        hook: "Ilgak: reaksiya, captcha yoki ovoz berish evaziga sovg'a.",
        wants: "Nima olishmoqchi: Telegram-kod, wallet connect yoki komissiya.",
        safe: "Xavfsiz qadam: hech narsa ulamang va kod kiritmang.",
      },
      en: {
        title: "🎁 2. NFT / Stars / gift",
        hook: "Hook: gift for a reaction, captcha, or vote.",
        wants: "They want: Telegram code, wallet connect, or fee.",
        safe: "Safe step: connect nothing and enter no code.",
      },
    },
  },
  {
    id: "bank-code-apk-pressure",
    rank: 3,
    status: "published",
    publishMode: "manual",
    updatedAt: "2026-07-02",
    source: {
      type: "moderated_pattern",
      label: "Ishonch Guard moderated bank-code pressure pattern",
    },
    tags: ["bank", "sms_code", "apk", "remote_access"],
    copy: {
      ru: {
        title: "🏦 3. Банк / код / APK",
        hook: "Крючок: «служба безопасности», «защитное приложение», срочный звонок.",
        wants: "Что хотят: SMS-код, карту или доступ к телефону.",
        safe: "Безопасно: положите трубку и перезвоните сами.",
      },
      uz: {
        title: "🏦 3. Bank / kod / APK",
        hook: "Ilgak: «xavfsizlik xizmati», «himoya ilovasi», shoshilinch qo'ng'iroq.",
        wants: "Nima olishmoqchi: SMS-kod, karta yoki telefonga ruxsat.",
        safe: "Xavfsiz qadam: go'shakni qo'ying va o'zingiz qayta qo'ng'iroq qiling.",
      },
      en: {
        title: "🏦 3. Bank / code / APK",
        hook: "Hook: “security service”, “protective app”, urgent call.",
        wants: "They want: SMS code, card, or phone access.",
        safe: "Safe step: hang up and call back yourself.",
      },
    },
  },
];

function parseDigestDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isDigestEntryFresh(entry: WeeklyScamDigestEntry, now: Date): boolean {
  const ageMs = now.getTime() - parseDigestDate(entry.updatedAt).getTime();
  return Math.max(0, ageMs) <= DIGEST_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
}

function getPublishedDigestEntries(
  entries: readonly WeeklyScamDigestEntry[],
  now: Date,
): readonly WeeklyScamDigestEntry[] {
  return entries
    .filter((entry) => entry.status === "published")
    .filter((entry) => entry.publishMode === "manual")
    .filter((entry) => isDigestEntryFresh(entry, now))
    .sort((a, b) => a.rank - b.rank);
}

function renderDigestEntries(lang: Lang, entries: readonly WeeklyScamDigestEntry[]): string {
  const blocks = entries.map((entry) => {
    const copy = entry.copy[lang];
    return [copy.title, copy.hook, copy.wants, copy.safe].join("\n");
  });

  return [
    DIGEST_INTRO[lang],
    "",
    "━━━━━━━━━━━━━━━━━━━━",
    blocks.join("\n\n┈┈┈┈┈┈┈┈┈┈\n"),
    "",
    DIGEST_SEND_HINT[lang],
  ].join("\n");
}

export function getWeeklyScamDigestSnapshot(
  lang: Lang,
  options: FormatWeeklyScamDigestOptions = {},
): DigestSnapshot {
  const now = options.now ?? new Date();
  const entries = getPublishedDigestEntries(options.entries ?? WEEKLY_SCAM_DIGEST_ENTRIES, now);

  if (entries.length < DIGEST_MIN_PUBLISHED_ENTRIES) {
    return {
      entries: [],
      isStaleFallback: true,
      text: DIGEST_STALE_FALLBACK[lang],
    };
  }

  return {
    entries,
    isStaleFallback: false,
    text: renderDigestEntries(lang, entries),
  };
}

export function buildWeeklyScamDigestKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_quick_panic", lang), callback_data: CB.emergency },
    ],
    [{ text: bt("btn_report", lang), callback_data: CB.report }],
  ];
}

export function formatWeeklyScamDigest(
  lang: Lang,
  options: FormatWeeklyScamDigestOptions = {},
): { text: string; keyboard: InlineKeyboard } {
  const raw = getWeeklyScamDigestSnapshot(lang, options).text;
  if (raw.length > DIGEST_MAX_CHARS) {
    throw new Error(`Weekly scam digest for ${lang} is too long: ${raw.length}`);
  }
  return {
    text: escapeMarkdownV2(raw),
    keyboard: buildWeeklyScamDigestKeyboard(lang),
  };
}
