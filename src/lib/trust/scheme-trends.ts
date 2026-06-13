import type { Lang } from "@/lib/i18n";
import type { ReasonCode } from "@/lib/risk/rules";

export type SchemeTrendCategory =
  | "banking"
  | "telegram"
  | "web3"
  | "gambling"
  | "marketplace"
  | "dropper";

export type SchemeTrendStatus = "active_watch" | "baseline";
export type SchemeTrendSource = "coverage" | "research_feed" | "moderated_aggregate";
export type SchemeTrendSeverity = "critical" | "high" | "medium";

type LocalizedText = Record<Lang, string>;

export interface PublicSchemeTrend {
  id: string;
  category: SchemeTrendCategory;
  status: SchemeTrendStatus;
  source: SchemeTrendSource;
  severity: SchemeTrendSeverity;
  reasonCodes: ReasonCode[];
  title: LocalizedText;
  hook: LocalizedText;
  goal: LocalizedText;
  safeStep: LocalizedText;
  sendToBot: LocalizedText;
  evidence: Record<Lang, string[]>;
}

export const SCHEME_TREND_CATEGORIES: readonly SchemeTrendCategory[] = [
  "banking",
  "telegram",
  "web3",
  "gambling",
  "marketplace",
  "dropper",
];

export const SCHEME_TREND_CATEGORY_LABELS: Record<SchemeTrendCategory, LocalizedText> = {
  banking: { ru: "Банк/карта", uz: "Bank/karta", en: "Bank/card" },
  telegram: { ru: "Telegram", uz: "Telegram", en: "Telegram" },
  web3: { ru: "TON/Web3", uz: "TON/Web3", en: "TON/Web3" },
  gambling: { ru: "Казино/VIP", uz: "Kazino/VIP", en: "Casino/VIP" },
  marketplace: { ru: "Доставка/оплата", uz: "Yetkazish/to'lov", en: "Delivery/payment" },
  dropper: { ru: "Дропперство", uz: "Dropperlik", en: "Dropper recruitment" },
};

export const SCHEME_TREND_STATUS_LABELS: Record<SchemeTrendStatus, LocalizedText> = {
  active_watch: {
    ru: "На контроле сейчас",
    uz: "Hozir kuzatuvda",
    en: "Currently watched",
  },
  baseline: {
    ru: "Постоянный риск",
    uz: "Doimiy xavf",
    en: "Baseline risk",
  },
};

export const SCHEME_TREND_SOURCE_LABELS: Record<SchemeTrendSource, LocalizedText> = {
  coverage: {
    ru: "Покрыто правилами Ishonch Guard",
    uz: "Ishonch Guard qoidalari qamrab olgan",
    en: "Covered by Ishonch Guard rules",
  },
  research_feed: {
    ru: "Research feed + покрытие правилами",
    uz: "Research feed + qoidalar",
    en: "Research feed + rules coverage",
  },
  moderated_aggregate: {
    ru: "Модерируемые агрегаты + правила",
    uz: "Moderatsiyalangan agregatlar + qoidalar",
    en: "Moderated aggregates + rules",
  },
};

export const PUBLIC_SCHEME_TRENDS: readonly PublicSchemeTrend[] = [
  {
    id: "bank-sms-code-call",
    category: "banking",
    status: "active_watch",
    source: "coverage",
    severity: "critical",
    reasonCodes: [
      "impersonates_bank",
      "asks_for_sms_code",
      "asks_for_otp",
      "asks_not_to_hang_up",
      "uses_urgency",
    ],
    title: {
      ru: "Звонок от имени банка и SMS-код",
      uz: "Bank nomidan qo'ng'iroq va SMS-kod",
      en: "Bank call asking for SMS code",
    },
    hook: {
      ru: "Говорят о подозрительной операции и просят не класть трубку.",
      uz: "Shubhali amaliyot haqida aytib, go'shakni qo'ymaslikni so'rashadi.",
      en: "They mention suspicious activity and tell you not to hang up.",
    },
    goal: {
      ru: "Получить SMS-код, PIN, CVV или доступ к онлайн-банку.",
      uz: "SMS-kod, PIN, CVV yoki onlayn-bankga kirish olish.",
      en: "Get your SMS code, PIN, CVV or online banking access.",
    },
    safeStep: {
      ru: "Положите трубку и перезвоните сами по номеру из приложения, карты или справочника.",
      uz: "Go'shakni qo'ying va ilova, karta yoki katalogdagi raqamga o'zingiz qo'ng'iroq qiling.",
      en: "Hang up and call back using the app, card or official directory.",
    },
    sendToBot: {
      ru: "Пришлите номер, текст SMS или запись того, что просили сделать.",
      uz: "Raqam, SMS matni yoki nima so'rashganini yuboring.",
      en: "Send the number, SMS text or what they asked you to do.",
    },
    evidence: {
      ru: ["SMS-код", "не кладите трубку", "служба безопасности банка"],
      uz: ["SMS-kod", "go'shakni qo'ymang", "bank xavfsizlik xizmati"],
      en: ["SMS code", "do not hang up", "bank security service"],
    },
  },
  {
    id: "fake-security-apk",
    category: "banking",
    status: "active_watch",
    source: "research_feed",
    severity: "critical",
    reasonCodes: ["asks_to_install_apk", "apk_download_link", "malicious_file_bait"],
    title: {
      ru: "APK или «защитное приложение»",
      uz: "APK yoki «himoya ilovasi»",
      en: "APK or security app request",
    },
    hook: {
      ru: "Присылают файл или ссылку на «обновление банка», «антивирус» или «защиту счёта».",
      uz: "«Bank yangilanishi», «antivirus» yoki «hisob himoyasi» deb fayl/havola yuborishadi.",
      en: "They send a file or link framed as a bank update, antivirus or account protection.",
    },
    goal: {
      ru: "Заставить установить приложение, которое может читать SMS и управлять устройством.",
      uz: "SMS o'qiydigan yoki qurilmani boshqaradigan ilovani o'rnatishga majbur qilish.",
      en: "Push an app that may read SMS or control the device.",
    },
    safeStep: {
      ru: "Не устанавливайте APK. Если уже установили — включите авиарежим и блокируйте карты.",
      uz: "APK o'rnatmang. O'rnatgan bo'lsangiz — aviarejimni yoqing va kartalarni bloklang.",
      en: "Do not install APKs. If installed, turn on airplane mode and block cards.",
    },
    sendToBot: {
      ru: "Пришлите ссылку на файл, название приложения или скрин просьбы.",
      uz: "Fayl havolasi, ilova nomi yoki so'rov skrinini yuboring.",
      en: "Send the file link, app name or screenshot of the request.",
    },
    evidence: {
      ru: ["APK", "обновление банка", "защитное приложение"],
      uz: ["APK", "bank yangilanishi", "himoya ilovasi"],
      en: ["APK", "bank update", "security app"],
    },
  },
  {
    id: "casino-free-spins-vip",
    category: "gambling",
    status: "active_watch",
    source: "research_feed",
    severity: "high",
    reasonCodes: [
      "crypto_casino_bonus_funnel",
      "gambling_prediction_promo",
      "suspicious_invite_link",
    ],
    title: {
      ru: "Казино, фриспины и VIP-прогнозы",
      uz: "Kazino, frispin va VIP-prognozlar",
      en: "Casino, free spins and VIP forecasts",
    },
    hook: {
      ru: "Обещают фриспины, закрытый прогноз, бонус или «матч без проигрыша».",
      uz: "Frispin, yopiq prognoz, bonus yoki «yutqazmaydigan match» va'da qilishadi.",
      en: "They promise free spins, a closed forecast, bonus or sure match.",
    },
    goal: {
      ru: "Довести до депозита, платного доступа, ввода карты или Telegram-кода.",
      uz: "Depozit, pulli kirish, karta yoki Telegram-kod kiritishga olib borish.",
      en: "Lead you to a deposit, paid access, card entry or Telegram code.",
    },
    safeStep: {
      ru: "Не пополняйте баланс и не входите через QR/Telegram Login после рекламы.",
      uz: "Reklamadan keyin balans to'ldirmang va QR/Telegram Login orqali kirmang.",
      en: "Do not top up or log in via QR/Telegram Login after an ad.",
    },
    sendToBot: {
      ru: "Пришлите ссылку, username канала или текст условий бонуса.",
      uz: "Havola, kanal username'i yoki bonus shartlarini yuboring.",
      en: "Send the link, channel username or bonus terms.",
    },
    evidence: {
      ru: ["фриспины", "VIP-прогноз", "депозит", "закрытый канал"],
      uz: ["frispin", "VIP-prognoz", "depozit", "yopiq kanal"],
      en: ["free spins", "VIP forecast", "deposit", "closed channel"],
    },
  },
  {
    id: "nft-stars-giveaway",
    category: "web3",
    status: "active_watch",
    source: "research_feed",
    severity: "high",
    reasonCodes: [
      "giveaway_engagement_bait",
      "fake_captcha_or_voting",
      "task_reward_engagement_bait",
    ],
    title: {
      ru: "NFT, Stars, подарки и капча",
      uz: "NFT, Stars, sovg'alar va captcha",
      en: "NFT, Stars, gifts and captcha",
    },
    hook: {
      ru: "Разыгрывают NFT/Stars за реакции, голосование, капчу или быстрые задания.",
      uz: "Reaksiya, ovoz, captcha yoki tez vazifalar evaziga NFT/Stars va'da qilishadi.",
      en: "They offer NFT/Stars for reactions, voting, captcha or quick tasks.",
    },
    goal: {
      ru: "Получить Telegram-код, подключение wallet или оплату «комиссии».",
      uz: "Telegram-kod, wallet ulash yoki «komissiya» to'lovini olish.",
      en: "Get a Telegram code, wallet connection or fee payment.",
    },
    safeStep: {
      ru: "Не вводите код, не подключайте wallet и не платите комиссию за подарок.",
      uz: "Kod kiritmang, wallet ulamang va sovg'a uchun komissiya to'lamang.",
      en: "Do not enter codes, connect wallets or pay fees for a gift.",
    },
    sendToBot: {
      ru: "Пришлите пост, ссылку или следующий экран после кнопки «участвовать».",
      uz: "Post, havola yoki «ishtirok etish»dan keyingi ekranni yuboring.",
      en: "Send the post, link or next screen after the participate button.",
    },
    evidence: {
      ru: ["капча", "реакции", "голосование", "NFT/Stars"],
      uz: ["captcha", "reaksiya", "ovoz berish", "NFT/Stars"],
      en: ["captcha", "reactions", "voting", "NFT/Stars"],
    },
  },
  {
    id: "ton-wallet-earning",
    category: "web3",
    status: "active_watch",
    source: "research_feed",
    severity: "high",
    reasonCodes: ["wallet_action_urgency", "ton_referral_earning_scheme"],
    title: {
      ru: "TON/wallet: срочно пополнить или заработать",
      uz: "TON/wallet: zudlik bilan to'ldirish yoki daromad",
      en: "TON/wallet urgent top-up or earning",
    },
    hook: {
      ru: "Пишут про 24 часа, ликвидацию, батарею кошелька, referral link или заработок TON.",
      uz: "24 soat, likvidatsiya, wallet battery, referral link yoki TON daromadi haqida yozishadi.",
      en: "They mention 24 hours, liquidation, wallet battery, referral link or TON earnings.",
    },
    goal: {
      ru: "Подтолкнуть к wallet connect, переводу токенов, оплате fee или seed-фразе.",
      uz: "Wallet connect, token o'tkazish, fee to'lash yoki seed phrase olishga undash.",
      en: "Push wallet connect, token transfer, fee payment or seed phrase entry.",
    },
    safeStep: {
      ru: "Открывайте кошелёк только сами из официального приложения; seed-фразу не вводите нигде.",
      uz: "Walletni faqat rasmiy ilovadan o'zingiz oching; seed phrase'ni hech qayerga kiritmang.",
      en: "Open your wallet only from the official app; never enter a seed phrase elsewhere.",
    },
    sendToBot: {
      ru: "Пришлите ссылку, текст поста или скрин экрана подключения wallet.",
      uz: "Havola, post matni yoki wallet ulash ekranini yuboring.",
      en: "Send the link, post text or wallet connection screen.",
    },
    evidence: {
      ru: ["24 часа", "wallet connect", "fee", "seed-фраза"],
      uz: ["24 soat", "wallet connect", "fee", "seed phrase"],
      en: ["24 hours", "wallet connect", "fee", "seed phrase"],
    },
  },
  {
    id: "telegram-cancel-delete",
    category: "telegram",
    status: "baseline",
    source: "coverage",
    severity: "critical",
    reasonCodes: ["telegram_account_takeover_phishing"],
    title: {
      ru: "Telegram: «аккаунт удалят, нажмите Cancel»",
      uz: "Telegram: «akkaunt o'chadi, Cancel bosing»",
      en: "Telegram deletion/cancel phishing",
    },
    hook: {
      ru: "Пугают удалением или блокировкой аккаунта и дают кнопку/ссылку «отменить».",
      uz: "Akkaunt o'chishi/bloklanishi bilan qo'rqitib, «bekor qilish» tugmasi/havolasini berishadi.",
      en: "They threaten deletion or blocking and show a cancel button/link.",
    },
    goal: {
      ru: "Заставить ввести Telegram-код или пароль 2FA на фейковой странице.",
      uz: "Soxta sahifada Telegram-kod yoki 2FA parolini kiritishga majbur qilish.",
      en: "Make you enter a Telegram code or 2FA password on a fake page.",
    },
    safeStep: {
      ru: "Не входите по ссылке из сообщения. Проверьте статус только внутри официального Telegram.",
      uz: "Xabardagi havola orqali kirmang. Holatni faqat rasmiy Telegram ichida tekshiring.",
      en: "Do not log in from the message link. Check only inside official Telegram.",
    },
    sendToBot: {
      ru: "Пришлите текст сообщения или ссылку, но не отправляйте код.",
      uz: "Xabar matni yoki havolani yuboring, lekin kodni yubormang.",
      en: "Send the message text or link, but never the code.",
    },
    evidence: {
      ru: ["удаление аккаунта", "Cancel", "Telegram-код"],
      uz: ["akkaunt o'chishi", "Cancel", "Telegram-kod"],
      en: ["account deletion", "Cancel", "Telegram code"],
    },
  },
  {
    id: "delivery-payment-link",
    category: "marketplace",
    status: "baseline",
    source: "coverage",
    severity: "high",
    reasonCodes: ["fake_delivery_payment", "payment_before_service", "weird_domain"],
    title: {
      ru: "Доставка, бронь или комиссия по ссылке",
      uz: "Yetkazish, bron yoki komissiya havolasi",
      en: "Delivery, booking or fee link",
    },
    hook: {
      ru: "Просят оплатить доставку, бронь, возврат или маленькую комиссию до услуги.",
      uz: "Xizmatdan oldin yetkazish, bron, qaytarish yoki kichik komissiya to'lashni so'rashadi.",
      en: "They ask for delivery, booking, refund or a small fee before service.",
    },
    goal: {
      ru: "Увести на фишинговую оплату и получить реквизиты карты.",
      uz: "Fishing to'lov sahifasiga olib borib, karta ma'lumotlarini olish.",
      en: "Send you to phishing payment and capture card details.",
    },
    safeStep: {
      ru: "Оплачивайте только через официальный сайт/приложение сервиса, не по ссылке из чата.",
      uz: "Faqat rasmiy sayt/ilova orqali to'lang, chatdagi havola orqali emas.",
      en: "Pay only via the official site/app, not a chat link.",
    },
    sendToBot: {
      ru: "Пришлите ссылку оплаты и текст, кто её отправил.",
      uz: "To'lov havolasi va kim yuborganini yuboring.",
      en: "Send the payment link and who sent it.",
    },
    evidence: {
      ru: ["предоплата", "доставка", "бронь", "комиссия"],
      uz: ["oldindan to'lov", "yetkazish", "bron", "komissiya"],
      en: ["prepayment", "delivery", "booking", "fee"],
    },
  },
  {
    id: "card-sim-dropper",
    category: "dropper",
    status: "active_watch",
    source: "research_feed",
    severity: "high",
    reasonCodes: ["dropper_recruitment", "requests_personal_data"],
    title: {
      ru: "Продажа карты, SIM или аккаунта",
      uz: "Karta, SIM yoki akkauntni sotish",
      en: "Selling card, SIM or account access",
    },
    hook: {
      ru: "Предлагают деньги за оформление карты/SIM/аккаунта «для работы» или «аренды».",
      uz: "«Ish» yoki «ijara» uchun karta/SIM/akkaunt ochib berishga pul taklif qilishadi.",
      en: "They offer money to open or rent out a card/SIM/account.",
    },
    goal: {
      ru: "Использовать ваши данные как прокладку для чужих переводов и уголовных рисков.",
      uz: "Ma'lumotlaringizni begona o'tkazmalar va jinoiy xavf uchun ishlatish.",
      en: "Use your identity as a mule for transfers and legal risk.",
    },
    safeStep: {
      ru: "Не передавайте карту, SIM, OneID, кошелёк или доступ к аккаунтам за деньги.",
      uz: "Pul evaziga karta, SIM, OneID, wallet yoki akkaunt kirishini bermang.",
      en: "Do not hand over card, SIM, OneID, wallet or account access for money.",
    },
    sendToBot: {
      ru: "Пришлите текст предложения без паспортных данных и кодов.",
      uz: "Taklif matnini pasport ma'lumoti va kodlarsiz yuboring.",
      en: "Send the offer text without passport data or codes.",
    },
    evidence: {
      ru: ["аренда карты", "SIM", "аккаунт", "вознаграждение"],
      uz: ["karta ijara", "SIM", "akkaunt", "mukofot"],
      en: ["card rental", "SIM", "account", "reward"],
    },
  },
] as const;

export interface SchemeTrendStats {
  total: number;
  activeWatch: number;
  critical: number;
  categories: number;
  reasonCodes: number;
}

export interface SchemeTrendFilter {
  category?: SchemeTrendCategory | "all";
  query?: string;
}

export function getSchemeTrendStats(): SchemeTrendStats {
  const categories = new Set<SchemeTrendCategory>();
  const reasonCodes = new Set<ReasonCode>();
  let activeWatch = 0;
  let critical = 0;

  for (const trend of PUBLIC_SCHEME_TRENDS) {
    categories.add(trend.category);
    for (const code of trend.reasonCodes) reasonCodes.add(code);
    if (trend.status === "active_watch") activeWatch += 1;
    if (trend.severity === "critical") critical += 1;
  }

  return {
    total: PUBLIC_SCHEME_TRENDS.length,
    activeWatch,
    critical,
    categories: categories.size,
    reasonCodes: reasonCodes.size,
  };
}

function trendText(trend: PublicSchemeTrend): string {
  return [
    trend.id,
    trend.category,
    trend.status,
    trend.source,
    ...Object.values(trend.title),
    ...Object.values(trend.hook),
    ...Object.values(trend.goal),
    ...Object.values(trend.safeStep),
    ...Object.values(trend.sendToBot),
    ...Object.values(trend.evidence).flat(),
    ...trend.reasonCodes,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterSchemeTrends(filter: SchemeTrendFilter = {}): PublicSchemeTrend[] {
  const category = filter.category ?? "all";
  const query = filter.query?.trim().toLowerCase() ?? "";

  return PUBLIC_SCHEME_TRENDS.filter((trend) => {
    if (category !== "all" && trend.category !== category) return false;
    if (!query) return true;
    return trendText(trend).includes(query);
  });
}

export function getTrendSeverityRank(severity: SchemeTrendSeverity): number {
  if (severity === "critical") return 3;
  if (severity === "high") return 2;
  return 1;
}

export function getTopSchemeTrends(limit = 3): PublicSchemeTrend[] {
  return [...PUBLIC_SCHEME_TRENDS]
    .sort((a, b) => getTrendSeverityRank(b.severity) - getTrendSeverityRank(a.severity))
    .slice(0, limit);
}
