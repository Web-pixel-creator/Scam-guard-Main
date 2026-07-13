// Scam Patterns data — known schemes for Uzbekistan.
// Each pattern is linked to reason codes and provides trilingual content.

import type { ScamPattern } from "./types";

export const SCAM_PATTERNS: readonly ScamPattern[] = [
  {
    id: "otp-code-scam",
    severity: "critical",
    reasonCodes: ["asks_for_otp", "asks_for_sms_code"],
    title: {
      ru: "Просят SMS-код / OTP",
      uz: "SMS-kod / OTP so'rashmoqda",
      en: "SMS code / OTP request",
    },
    description: {
      ru: "Мошенник представляется банком или оператором и просит назвать код из SMS. Код даёт полный доступ к вашему счёту.",
      uz: "Firibgar o'zini bank yoki operator deb tanishtiradi va SMS-kodingizni so'raydi. Kod hisobingizga to'liq kirish imkonini beradi.",
      en: "Scammer poses as a bank or operator and asks for your SMS code. The code gives full access to your account.",
    },
    redFlags: {
      ru: [
        "Звонят 'из банка' и просят код",
        "Торопят: 'срочно, иначе заблокируем'",
        "Говорят 'не кладите трубку'",
      ],
      uz: [
        "'Bank'dan qo'ng'iroq qilib kod so'rashmoqda",
        "Shoshiltirish: 'tezroq, aks holda bloklaymiz'",
        "'Go'shakni qo'ymang' deyishmoqda",
      ],
      en: [
        "Call 'from the bank' asking for a code",
        "Rushing: 'urgent, or we'll block your account'",
        "Say 'don't hang up'",
      ],
    },
    whatToDo: {
      ru: ["Положите трубку", "Никому не называйте код", "Перезвоните в банк по номеру с карты"],
      uz: [
        "Go'shakni qo'ying",
        "Hech kimga kodni aytmang",
        "Bankka karta orqasidagi raqam orqali qo'ng'iroq qiling",
      ],
      en: ["Hang up", "Never share the code", "Call your bank using the number on your card"],
    },
    examples: {
      ru: [
        "«Это служба безопасности Капиталбанка. Назовите код из SMS для подтверждения блокировки»",
        "«Ваша карта под угрозой. Продиктуйте код, чтобы отменить перевод»",
      ],
      uz: [
        "«Bu Kapitalbank xavfsizlik xizmati. Blokirovkani tasdiqlash uchun SMS-kodni ayting»",
        "«Kartangiz xavf ostida. O'tkazmani bekor qilish uchun kodni ayting»",
      ],
      en: [
        "'This is Kapitalbank security. Tell us the SMS code to confirm the block'",
        "'Your card is at risk. Dictate the code to cancel the transfer'",
      ],
    },
  },
  {
    id: "apk-install-scam",
    severity: "critical",
    reasonCodes: ["asks_to_install_apk", "apk_download_link", "malicious_file_bait"],
    title: {
      ru: "Просят установить APK",
      uz: "APK o'rnatishni so'rashmoqda",
      en: "APK install request",
    },
    description: {
      ru: "Присылают файл или ссылку на 'обновление банка', 'безопасное приложение' или 'антивирус'. APK крадёт SMS и данные карт.",
      uz: "'Bank yangilanishi', 'xavfsiz ilova' yoki 'antivirus' deb fayl yoki havola yuborishmoqda. APK SMS va karta ma'lumotlarini o'g'irlaydi.",
      en: "They send a file or link to a 'bank update', 'security app' or 'antivirus'. The APK steals SMS and card data.",
    },
    redFlags: {
      ru: [
        "Присылают .apk файл в Telegram/SMS",
        "Просят установить 'обновление безопасности'",
        "Ссылка ведёт не на Play Store",
      ],
      uz: [
        "Telegram/SMS orqali .apk fayl yuborishmoqda",
        "'Xavfsizlik yangilanishi' o'rnatishni so'rashmoqda",
        "Havola Play Store'ga emas",
      ],
      en: [
        "Send .apk file via Telegram/SMS",
        "Ask to install 'security update'",
        "Link doesn't go to Play Store",
      ],
    },
    whatToDo: {
      ru: [
        "Не скачивайте и не устанавливайте",
        "Если установили — включите авиарежим, удалите APK, заблокируйте карты",
        "Обратитесь в банк и полицию: 102",
      ],
      uz: [
        "Yuklamang va o'rnatmang",
        "O'rnatgan bo'lsangiz — aviarezhimni yoqing, APK'ni o'chiring, kartalarni bloklang",
        "Bank va politsiyaga murojaat qiling: 102",
      ],
      en: [
        "Don't download or install",
        "If installed — airplane mode, delete APK, block cards",
        "Contact bank and police: 102",
      ],
    },
    examples: {
      ru: [
        "«Скачайте приложение безопасности банка по ссылке: t.me/...»",
        "«Ваше приложение устарело. Установите обновление: https://example.com/bank.apk»",
      ],
      uz: [
        "«Bank xavfsizlik ilovasini yuklab oling: t.me/...»",
        "«Ilovangiz eskirgan. Yangilanishni o'rnating: https://example.com/bank.apk»",
      ],
      en: [
        "'Download the bank security app: t.me/...'",
        "'Your app is outdated. Install the update: https://example.com/bank.apk'",
      ],
    },
  },
  {
    id: "fake-bank-telegram",
    severity: "high",
    reasonCodes: ["impersonates_official", "unknown_sender"],
    title: {
      ru: "Фейковый банк в Telegram",
      uz: "Telegram'da soxta bank",
      en: "Fake bank in Telegram",
    },
    description: {
      ru: "Создают аккаунт, похожий на банк (kapitalbank_support, nbu_security). Пишут первыми или отвечают в группах. Просят данные.",
      uz: "Bankka o'xshash akkaunt yaratadilar (kapitalbank_support, nbu_security). Birinchi bo'lib yozadilar yoki guruhlarda javob beradilar.",
      en: "They create an account mimicking a bank (kapitalbank_support, nbu_security). Message first or reply in groups. Ask for data.",
    },
    redFlags: {
      ru: [
        "Username содержит bank/support/security, но не verified",
        "Пишет первым в личные сообщения",
        "Просит данные карты или код",
      ],
      uz: [
        "Username'da bank/support/security bor, lekin verified emas",
        "Birinchi bo'lib shaxsiy xabar yozadi",
        "Karta ma'lumotlari yoki kodni so'raydi",
      ],
      en: [
        "Username contains bank/support/security but not verified",
        "Messages you first in DM",
        "Asks for card data or code",
      ],
    },
    whatToDo: {
      ru: [
        "Проверьте username через @scamguard_bot",
        "Банк никогда не пишет первым в Telegram",
        "Заблокируйте и пожалуйтесь через /report",
      ],
      uz: [
        "Username'ni @scamguard_bot orqali tekshiring",
        "Bank hech qachon Telegram'da birinchi yozmaydi",
        "Bloklang va /report orqali shikoyat qiling",
      ],
      en: [
        "Check the username via @scamguard_bot",
        "A bank never DMs you first on Telegram",
        "Block and report via /report",
      ],
    },
    examples: {
      ru: [
        "«Здравствуйте, это поддержка Капиталбанка. Ваш аккаунт заблокирован, подтвердите данные»",
      ],
      uz: [
        "«Assalomu alaykum, bu Kapitalbank qo'llab-quvvatlash. Hisobingiz bloklandi, ma'lumotlarni tasdiqlang»",
      ],
      en: [
        "'Hello, this is Kapitalbank support. Your account is blocked, please confirm your details'",
      ],
    },
  },
  {
    id: "safe-account-transfer",
    severity: "critical",
    reasonCodes: ["payment_before_service", "asks_to_transfer_to_safe_account"],
    title: {
      ru: "Перевод на 'безопасный счёт'",
      uz: "'Xavfsiz hisob'ga o'tkazish",
      en: "Transfer to a 'safe account'",
    },
    description: {
      ru: "Мошенник говорит, что ваши деньги в опасности, и просит перевести их на 'безопасный счёт'. Такого счёта не существует.",
      uz: "Firibgar pulingiz xavf ostida deydi va 'xavfsiz hisob'ga o'tkazishni so'raydi. Bunday hisob mavjud emas.",
      en: "Scammer says your money is at risk and asks to transfer to a 'safe account'. No such account exists.",
    },
    redFlags: {
      ru: [
        "'Переведите деньги на безопасный/резервный счёт'",
        "Торопят и не дают подумать",
        "'Не говорите никому, даже сотрудникам банка'",
      ],
      uz: [
        "'Pulni xavfsiz/zahira hisobga o'tkazing'",
        "Shoshiltiradi va o'ylashga bermaydi",
        "'Hech kimga, hatto bank xodimlariga ham aytmang'",
      ],
      en: [
        "'Transfer money to a safe/reserve account'",
        "Rush you without time to think",
        "'Don't tell anyone, even bank employees'",
      ],
    },
    whatToDo: {
      ru: [
        "Не переводите",
        "Безопасных счетов не существует",
        "Положите трубку, позвоните в банк сами",
      ],
      uz: [
        "O'tkazmang",
        "Xavfsiz hisoblar mavjud emas",
        "Go'shakni qo'ying, bankka o'zingiz qo'ng'iroq qiling",
      ],
      en: ["Don't transfer", "'Safe accounts' don't exist", "Hang up, call the bank yourself"],
    },
    examples: {
      ru: [
        "«На ваш счёт зафиксирована подозрительная активность. Переведите средства на защищённый счёт 8600...»",
      ],
      uz: [
        "«Hisobingizda shubhali faoliyat aniqlandi. Mablag'ni himoyalangan hisobga o'tkazing 8600...»",
      ],
      en: [
        "'Suspicious activity detected on your account. Transfer funds to protected account 8600...'",
      ],
    },
  },
  {
    id: "fake-loan-scam",
    severity: "high",
    reasonCodes: ["payment_before_service"],
    title: {
      ru: "Фейковый кредит / займ",
      uz: "Soxta kredit / qarz",
      en: "Fake loan scam",
    },
    description: {
      ru: "Обещают быстрый кредит без документов. Просят 'комиссию', 'страховку' или 'верификацию' перед выдачей. Деньги забирают, кредит не дают.",
      uz: "Hujjatsiz tez kredit va'da qilishadi. Berishdan oldin 'komissiya', 'sug'urta' yoki 'verifikatsiya' so'rashadi. Pulni olishadi, kredit bermaydi.",
      en: "Promise a quick loan without documents. Ask for 'commission', 'insurance' or 'verification' before payout. Take money, give no loan.",
    },
    redFlags: {
      ru: [
        "Просят заплатить ДО получения кредита",
        "Обещают 100% одобрение без проверки",
        "Нет офиса, только Telegram",
      ],
      uz: [
        "Kredit olishdan OLDIN to'lashni so'rashadi",
        "Tekshiruvsiz 100% tasdiqlash va'da qiladi",
        "Ofis yo'q, faqat Telegram",
      ],
      en: [
        "Ask for payment BEFORE the loan",
        "Promise 100% approval without checks",
        "No office, only Telegram",
      ],
    },
    whatToDo: {
      ru: [
        "Настоящие банки не берут комиссию заранее",
        "Не переводите 'для подтверждения'",
        "Проверьте лицензию на сайте ЦБ",
      ],
      uz: [
        "Haqiqiy banklar oldindan komissiya olmaydi",
        "'Tasdiqlash uchun' o'tkazmang",
        "Litsenziyani MB saytida tekshiring",
      ],
      en: [
        "Real banks don't charge upfront",
        "Don't transfer 'for confirmation'",
        "Check the license on the Central Bank website",
      ],
    },
    examples: {
      ru: ["«Кредит одобрен! Для получения переведите 200 000 сум на верификацию»"],
      uz: ["«Kredit tasdiqlandi! Olish uchun 200 000 so'm verifikatsiya to'lovini o'tkazing»"],
      en: ["'Loan approved! Transfer 200,000 soum for verification to receive it'"],
    },
  },
  {
    id: "fake-delivery-scam",
    severity: "high",
    reasonCodes: ["fake_delivery_payment"],
    title: {
      ru: "Фейковая доставка / посылка",
      uz: "Soxta yetkazib berish / pochta",
      en: "Fake delivery / package scam",
    },
    description: {
      ru: "Сообщают о 'посылке' или 'выигрыше', просят оплатить доставку или таможню. Никакой посылки нет.",
      uz: "'Pochta' yoki 'yutuq' haqida xabar berishadi, yetkazib berish yoki bojxona uchun to'lashni so'rashadi. Hech qanday pochta yo'q.",
      en: "Notify about a 'package' or 'prize', ask to pay delivery or customs. No package exists.",
    },
    redFlags: {
      ru: [
        "SMS/email о посылке, которую вы не ждёте",
        "Просят оплатить 'таможню' или 'доставку'",
        "Ссылка не на официальный сайт почты",
      ],
      uz: [
        "Kutmagan pochta haqida SMS/email",
        "'Bojxona' yoki 'yetkazib berish' uchun to'lashni so'rashadi",
        "Havola rasmiy pochta saytiga emas",
      ],
      en: [
        "SMS/email about a package you didn't expect",
        "Ask to pay 'customs' or 'delivery'",
        "Link isn't to the official postal service",
      ],
    },
    whatToDo: {
      ru: [
        "Не переходите по ссылке",
        "Проверьте трек-номер на официальном сайте",
        "Не платите за посылки, которые не заказывали",
      ],
      uz: [
        "Havolaga o'tmang",
        "Trek-raqamni rasmiy saytda tekshiring",
        "Buyurtma bermagan pochtalar uchun to'lamang",
      ],
      en: [
        "Don't click the link",
        "Check tracking on the official site",
        "Don't pay for packages you didn't order",
      ],
    },
    examples: {
      ru: [
        "«Вам посылка из Турции. Оплатите таможенный сбор 50 000 сум: https://fake-post.uz/pay»",
      ],
      uz: [
        "«Sizga Turkiyadan pochta. Bojxona yig'imini to'lang 50 000 so'm: https://fake-post.uz/pay»",
      ],
      en: ["'Package from Turkey. Pay customs fee 50,000 soum: https://fake-post.uz/pay'"],
    },
  },
  {
    id: "prize-winner-scam",
    severity: "high",
    reasonCodes: ["payment_before_service"],
    title: {
      ru: "Розыгрыш / вы выиграли",
      uz: "O'yin / siz yutdingiz",
      en: "Prize / you won scam",
    },
    description: {
      ru: "Сообщают о выигрыше в конкурсе, где вы не участвовали. Просят 'налог' или 'комиссию' для получения приза.",
      uz: "Qatnashmagan tanlovda yutganingiz haqida xabar berishadi. Sovrinni olish uchun 'soliq' yoki 'komissiya' so'rashadi.",
      en: "Tell you that you won a contest you didn't enter. Ask for 'tax' or 'commission' to receive the prize.",
    },
    redFlags: {
      ru: [
        "Вы 'выиграли' в розыгрыше, где не участвовали",
        "Просят заплатить для получения приза",
        "Торопят: 'приз сгорит через 24 часа'",
      ],
      uz: [
        "Qatnashmagan o'yinda 'yutdingiz'",
        "Sovrinni olish uchun to'lashni so'rashadi",
        "Shoshiltiradi: 'sovrin 24 soatda tugaydi'",
      ],
      en: [
        "You 'won' a contest you never entered",
        "Ask to pay to receive the prize",
        "Rush: 'prize expires in 24 hours'",
      ],
    },
    whatToDo: {
      ru: [
        "Не платите за 'выигрыш'",
        "Настоящие розыгрыши не требуют оплаты",
        "Заблокируйте отправителя",
      ],
      uz: [
        "'Yutuq' uchun to'lamang",
        "Haqiqiy o'yinlar to'lov talab qilmaydi",
        "Yuboruvchini bloklang",
      ],
      en: ["Don't pay for a 'prize'", "Real contests don't require payment", "Block the sender"],
    },
    examples: {
      ru: ["«Поздравляем! Вы выиграли iPhone 15! Для получения оплатите доставку: 100 000 сум»"],
      uz: [
        "«Tabriklaymiz! Siz iPhone 15 yutdingiz! Olish uchun yetkazib berishni to'lang: 100 000 so'm»",
      ],
      en: ["'Congratulations! You won an iPhone 15! Pay 100,000 soum delivery to receive it'"],
    },
  },
  {
    id: "telegram-account-takeover",
    severity: "critical",
    reasonCodes: ["telegram_account_takeover_phishing"],
    title: {
      ru: "Угон Telegram-аккаунта",
      uz: "Telegram akkauntini o'g'irlash",
      en: "Telegram account takeover",
    },
    description: {
      ru: "Просят отсканировать QR-код 'для входа' или 'подтверждения'. QR-код даёт мошеннику доступ к вашему Telegram.",
      uz: "'Kirish' yoki 'tasdiqlash' uchun QR-kod skanerlashtini so'rashadi. QR-kod firibgarga Telegram'ingizga kirishga imkon beradi.",
      en: "Ask to scan a QR code 'to log in' or 'confirm'. The QR gives the scammer access to your Telegram.",
    },
    redFlags: {
      ru: [
        "Просят сканировать QR-код по ссылке",
        "'Подтвердите аккаунт' через QR",
        "Присылают ссылку на сайт, похожий на Telegram",
      ],
      uz: [
        "Havoladagi QR-kodni skanerlashtini so'rashadi",
        "QR orqali 'akkauntni tasdiqlang'",
        "Telegram'ga o'xshash saytga havola yuborishadi",
      ],
      en: [
        "Ask to scan a QR code via a link",
        "'Confirm your account' via QR",
        "Send a link to a site mimicking Telegram",
      ],
    },
    whatToDo: {
      ru: [
        "Никогда не сканируйте чужой QR-код",
        "Telegram-вход только через официальное приложение",
        "Если уже сканировали — /panic → 'Потерял Telegram'",
      ],
      uz: [
        "Hech qachon begona QR-kodni skanerlamang",
        "Telegram'ga faqat rasmiy ilova orqali kiring",
        "Agar skanerlagan bo'lsangiz — /panic → 'Telegram'ni yo'qotdim'",
      ],
      en: [
        "Never scan someone else's QR code",
        "Only log into Telegram via the official app",
        "If already scanned — /panic → 'Lost Telegram'",
      ],
    },
    examples: {
      ru: [
        "«Для участия в розыгрыше отсканируйте QR: https://fake-tg.com/qr»",
        "«Подтвердите, что вы не бот: сканируйте QR»",
      ],
      uz: [
        "«O'yinda qatnashish uchun QR skanerlang: https://fake-tg.com/qr»",
        "«Bot emasligingizni tasdiqlang: QR skanerlang»",
      ],
      en: [
        "'To enter the contest scan QR: https://fake-tg.com/qr'",
        "'Confirm you're not a bot: scan the QR'",
      ],
    },
  },
  {
    id: "telegram-web3-promo-funnel",
    severity: "high",
    reasonCodes: [
      "crypto_casino_bonus_funnel",
      "fake_captcha_or_voting",
      "task_reward_engagement_bait",
      "wallet_action_urgency",
      "ton_referral_earning_scheme",
      "giveaway_engagement_bait",
      "gambling_prediction_promo",
    ],
    title: {
      ru: "Telegram/Web3 промо-ловушка",
      uz: "Telegram/Web3 promo tuzog'i",
      en: "Telegram/Web3 promo trap",
    },
    description: {
      ru: "Пост обещает бонус, NFT, Stars, TON, фриспины или приз за простое действие: пройти капчу, проголосовать, подписаться, пополнить баланс, подключить кошелёк или пригласить друзей.",
      uz: "Post bonus, NFT, Stars, TON, frispin yoki sovrinni oddiy harakat evaziga va'da qiladi: captcha, ovoz, obuna, balans to'ldirish, hamyon ulash yoki do'st taklif qilish.",
      en: "A post promises a bonus, NFT, Stars, TON, free spins, or a prize for a simple action: captcha, vote, subscribe, top up, connect a wallet, or invite friends.",
    },
    redFlags: {
      ru: [
        "Приз/бонус дают только после капчи, голосования, реакций или подписки",
        "Просят пополнить депозит, подключить кошелёк или открыть Mini App",
        "Есть срочность: 24 часа, 1 day left, reward pool, leaderboard",
      ],
      uz: [
        "Sovrin/bonus captcha, ovoz, reaksiya yoki obunadan keyin beriladi",
        "Depozit to'ldirish, hamyon ulash yoki Mini App ochishni so'raydi",
        "Shoshiltiradi: 24 soat, 1 day left, reward pool, leaderboard",
      ],
      en: [
        "Prize/bonus is gated by captcha, voting, reactions, or subscribing",
        "Asks to deposit, connect a wallet, or open a Mini App",
        "Uses urgency: 24 hours, 1 day left, reward pool, leaderboard",
      ],
    },
    whatToDo: {
      ru: [
        "Не вводите seed phrase, Telegram-код, SMS-код или данные карты",
        "Не пополняйте депозит ради бонуса или вывода приза",
        "Проверьте домен и пришлите скрин поста/ссылку для точной оценки",
      ],
      uz: [
        "Seed phrase, Telegram-kod, SMS-kod yoki karta ma'lumotini kiritmang",
        "Bonus yoki sovrinni chiqarish uchun depozit to'ldirmang",
        "Domenni tekshiring va aniq baho uchun post skrinini/havolani yuboring",
      ],
      en: [
        "Do not enter a seed phrase, Telegram code, SMS code, or card details",
        "Do not deposit money to unlock a bonus or withdraw a prize",
        "Check the domain and send the post screenshot/link for a more precise check",
      ],
    },
    examples: {
      ru: [
        "«100 фриспинов за первый депозит, ссылка на Mini App ниже»",
        "«Розыгрыш NFT: пройти капчу, поставить реакции и проголосовать»",
      ],
      uz: [
        "«Birinchi depozit uchun 100 frispin, Mini App havolasi pastda»",
        "«NFT yutuq: captcha, reaksiya va ovoz berish shart»",
      ],
      en: [
        "'100 free spins for the first deposit, Mini App link below'",
        "'NFT giveaway: complete captcha, react, and vote'",
      ],
    },
  },
];
