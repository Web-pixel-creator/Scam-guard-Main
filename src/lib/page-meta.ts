import type { Lang } from "./i18n";

// One place for every public page's title and description in RU/UZ/EN. The
// root route's head renders them for the current path in the visitor's
// language (root loader, D-120) with absolute canonical/og:url links built
// from PUBLIC_APP_URL. Child heads would only see a pre-load snapshot of the
// root loader data, so pages do not set these themselves.
type Localized = Record<Lang, string>;
type PageMeta = {
  title: Localized;
  description: Localized;
  ogTitle?: Localized;
  ogDescription?: Localized;
  /** Pages that must stay out of search results. */
  robots?: "noindex" | "noindex, nofollow";
};

export const SITE_NAME = "Ishonch Guard";

export const PAGE_META = {
  "/": {
    title: {
      ru: "Ishonch Guard — проверьте номер, Telegram или ссылку до того, как вас обманут",
      uz: "Ishonch Guard — aldanishdan oldin raqam, Telegram yoki havolani tekshiring",
      en: "Ishonch Guard — check a number, Telegram or link before you get scammed",
    },
    description: {
      ru: "Бесплатный антискам-помощник для Узбекистана. Вставьте подозрительное сообщение, номер, ссылку или Telegram username — получите оценку риска и шаги, что делать.",
      uz: "O‘zbekiston uchun bepul antiskam-yordamchi. Shubhali xabar, raqam, havola yoki Telegram username’ni kiriting — xavf bahosi va nima qilish kerakligini bilib oling.",
      en: "A free anti-scam helper for Uzbekistan. Paste a suspicious message, number, link or Telegram username to get a risk assessment and clear next steps.",
    },
    ogTitle: {
      ru: "Ishonch Guard — антискам-помощник для Узбекистана",
      uz: "Ishonch Guard — O‘zbekiston uchun antiskam-yordamchi",
      en: "Ishonch Guard — anti-scam helper for Uzbekistan",
    },
    ogDescription: {
      ru: "Распознайте мошенников до того, как потеряете деньги. Бесплатно, на трёх языках.",
      uz: "Pulingizni yo‘qotishdan oldin firibgarni taniting. Bepul, uch tilda.",
      en: "Spot scammers before you lose money. Free, in three languages.",
    },
  },
  "/check": {
    title: {
      ru: "Проверка подозрительного — Ishonch Guard",
      uz: "Shubhali narsani tekshirish — Ishonch Guard",
      en: "Check something suspicious — Ishonch Guard",
    },
    description: {
      ru: "Вставьте номер, Telegram, ссылку или текст сообщения и получите оценку риска и понятные шаги.",
      uz: "Raqam, Telegram, havola yoki xabar matnini kiriting va xavf bahosi hamda aniq qadamlarni oling.",
      en: "Paste a number, Telegram, link or message text and get a risk assessment with clear steps.",
    },
  },
  "/emergency": {
    title: {
      ru: "Срочные шаги — Ishonch Guard",
      uz: "Shoshilinch qadamlar — Ishonch Guard",
      en: "Urgent steps — Ishonch Guard",
    },
    description: {
      ru: "Если вы уже отправили SMS-код, установили APK или перевели деньги — конкретные шаги, что делать прямо сейчас.",
      uz: "SMS-kodni yuborgan, APK o‘rnatgan yoki pul o‘tkazgan bo‘lsangiz — hozir nima qilish kerakligi bo‘yicha aniq qadamlar.",
      en: "Already sent an SMS code, installed an APK or transferred money? Concrete steps to take right now.",
    },
  },
  "/official-numbers": {
    title: {
      ru: "Официальные номера банков и служб Узбекистана — Ishonch Guard",
      uz: "O‘zbekiston bank va xizmatlarining rasmiy raqamlari — Ishonch Guard",
      en: "Official numbers of Uzbekistan banks and services — Ishonch Guard",
    },
    description: {
      ru: "Проверенный справочник официальных номеров банков, платёжных систем, операторов и госслужб Узбекистана. Перезванивайте сами и не доверяйте номеру на экране.",
      uz: "O‘zbekiston banklari, to‘lov tizimlari, operatorlar va davlat xizmatlarining tekshirilgan rasmiy raqamlari. O‘zingiz qayta qo‘ng‘iroq qiling, ekrandagi raqamga ishonmang.",
      en: "A verified directory of official numbers of banks, payment systems, operators and public services in Uzbekistan. Call back yourself; don't trust the number on screen.",
    },
    ogTitle: {
      ru: "Официальные номера — Ishonch Guard",
      uz: "Rasmiy raqamlar — Ishonch Guard",
      en: "Official numbers — Ishonch Guard",
    },
  },
  "/scam-trends": {
    title: {
      ru: "Активные схемы мошенничества в Узбекистане — Ishonch Guard",
      uz: "O‘zbekistondagi faol firibgarlik sxemalari — Ishonch Guard",
      en: "Active scam schemes in Uzbekistan — Ishonch Guard",
    },
    description: {
      ru: "Публичная карта актуальных тактик мошенников: SMS-коды, APK, Telegram, TON, казино, NFT, доставка и дропперство. Без персональных данных и обвинений.",
      uz: "Firibgarlarning dolzarb taktikalari ommaviy xaritasi: SMS-kodlar, APK, Telegram, TON, kazino, NFT, yetkazib berish va dropperlik. Shaxsiy ma’lumotlarsiz va ayblovlarsiz.",
      en: "A public map of current scam tactics: SMS codes, APKs, Telegram, TON, casinos, NFTs, deliveries and money mules. No personal data, no accusations.",
    },
  },
  "/scams": {
    title: {
      ru: "Схемы мошенничества — Ishonch Guard",
      uz: "Firibgarlik sxemalari — Ishonch Guard",
      en: "Scam schemes — Ishonch Guard",
    },
    description: {
      ru: "Типовые схемы мошенничества в Узбекистане: OTP-коды, APK, фейковые банки, «безопасный счёт», угон Telegram. Как их узнать и что делать.",
      uz: "O‘zbekistondagi odatiy firibgarlik sxemalari: OTP-kodlar, APK, soxta banklar, «xavfsiz hisob», Telegram’ni o‘g‘irlash. Ularni qanday tanish va nima qilish kerak.",
      en: "Common scam schemes in Uzbekistan: OTP codes, APKs, fake banks, the “safe account”, Telegram takeovers. How to spot them and what to do.",
    },
  },
  "/report": {
    title: {
      ru: "Сообщить о случае — Ishonch Guard",
      uz: "Holat haqida xabar berish — Ishonch Guard",
      en: "Report an incident — Ishonch Guard",
    },
    description: {
      ru: "Отправьте подозрительный номер, Telegram, ссылку или сообщение — после модерации мы добавим их в антискам-базу.",
      uz: "Shubhali raqam, Telegram, havola yoki xabarni yuboring — moderatsiyadan so‘ng ularni antiskam bazasiga qo‘shamiz.",
      en: "Send a suspicious number, Telegram, link or message — after moderation we add it to the anti-scam database.",
    },
  },
  "/appeal": {
    title: {
      ru: "Апелляция репутации — Ishonch Guard",
      uz: "Reputatsiya apellyatsiyasi — Ishonch Guard",
      en: "Reputation appeal — Ishonch Guard",
    },
    description: {
      ru: "Запросить проверку, исправление или снятие публичной репутационной метки Ishonch Guard.",
      uz: "Ishonch Guard’dagi ommaviy reputatsiya belgisini tekshirish, tuzatish yoki olib tashlashni so‘rash.",
      en: "Ask to review, correct or remove a public Ishonch Guard reputation label.",
    },
    robots: "noindex",
  },
  "/privacy": {
    title: {
      ru: "Приватность — Ishonch Guard",
      uz: "Maxfiylik — Ishonch Guard",
      en: "Privacy — Ishonch Guard",
    },
    description: {
      ru: "Как Ishonch Guard защищает ваши данные: маскирование, хеширование, никаких OTP, CVV и PIN.",
      uz: "Ishonch Guard ma’lumotlaringizni qanday himoya qiladi: niqoblash, xeshlash, hech qanday OTP, CVV va PIN yo‘q.",
      en: "How Ishonch Guard protects your data: masking, hashing, and never any OTP, CVV or PIN.",
    },
  },
  "/embed": {
    title: {
      ru: "Встраиваемый антискам-виджет — Ishonch Guard",
      uz: "Saytga joylanadigan antiskam-vidjet — Ishonch Guard",
      en: "Embeddable anti-scam widget — Ishonch Guard",
    },
    description: {
      ru: "Добавьте на сайт компактный виджет Ishonch Guard для проверки номеров, ссылок, Telegram username и подозрительных сообщений.",
      uz: "Saytingizga raqamlar, havolalar, Telegram username va shubhali xabarlarni tekshiradigan ixcham Ishonch Guard vidjetini qo‘shing.",
      en: "Add a compact Ishonch Guard widget to your site to check numbers, links, Telegram usernames and suspicious messages.",
    },
    ogDescription: {
      ru: "Виджет для СМИ, банков, сайтов махаллей и сообществ.",
      uz: "OAV, banklar, mahalla saytlari va hamjamiyatlar uchun vidjet.",
      en: "A widget for media, banks, community and mahalla sites.",
    },
  },
  "/embed/check": {
    title: {
      ru: "Проверка на мошенничество — Ishonch Guard",
      uz: "Firibgarlikni tekshirish — Ishonch Guard",
      en: "Ishonch Guard scam check",
    },
    description: {
      ru: "Компактный виджет проверки Ishonch Guard для сайтов партнёров.",
      uz: "Hamkor saytlar uchun ixcham Ishonch Guard tekshiruv vidjeti.",
      en: "Compact Ishonch Guard anti-scam check widget for partner sites.",
    },
    robots: "noindex, nofollow",
  },
  "/login": {
    title: {
      ru: "Вход — Ishonch Guard",
      uz: "Kirish — Ishonch Guard",
      en: "Sign in — Ishonch Guard",
    },
    description: {
      ru: "Вход для приглашённых администраторов Ishonch Guard.",
      uz: "Ishonch Guard’ning taklif qilingan administratorlari uchun kirish.",
      en: "Sign-in for invited Ishonch Guard administrators.",
    },
    robots: "noindex",
  },
} satisfies Record<string, PageMeta>;

export type PagePath = keyof typeof PAGE_META;

const OG_LOCALE: Record<Lang, string> = { ru: "ru_RU", uz: "uz_UZ", en: "en_US" };

export type RequestPageContext = { lang: Lang; origin: string };

/** The page entry for a URL path, if it has one ("/scams/" -> "/scams"). */
export function pageForPath(pathname: string): PagePath | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;
  return Object.hasOwn(PAGE_META, path) ? (path as PagePath) : null;
}

export function pageUrl(path: PagePath, origin: string): string {
  return `${origin}${path}`;
}

export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE_WIDTH = "1200";
export const OG_IMAGE_HEIGHT = "630";

export function pageHead(path: PagePath, { lang, origin }: RequestPageContext) {
  const page: PageMeta = PAGE_META[path];
  const title = page.title[lang];
  const description = page.description[lang];
  const ogTitle = page.ogTitle?.[lang] ?? title;
  const url = pageUrl(path, origin);
  const ogImageUrl = origin ? `${origin}${OG_IMAGE_PATH}` : OG_IMAGE_PATH;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: page.ogDescription?.[lang] ?? description },
      { property: "og:url", content: url },
      { property: "og:locale", content: OG_LOCALE[lang] },
      { property: "og:image", content: ogImageUrl },
      { property: "og:image:width", content: OG_IMAGE_WIDTH },
      { property: "og:image:height", content: OG_IMAGE_HEIGHT },
      { property: "og:image:alt", content: ogTitle },
      { name: "twitter:image", content: ogImageUrl },
      ...(page.robots ? [{ name: "robots", content: page.robots }] : []),
    ],
    // A noindex page gets no canonical: the two would contradict each other.
    links: page.robots ? [] : [{ rel: "canonical", href: url }],
  };
}

/** Indexable pages for sitemap.xml. */
export const SITEMAP_PATHS = (Object.keys(PAGE_META) as PagePath[]).filter(
  (path) => !(PAGE_META[path] as PageMeta).robots,
);
