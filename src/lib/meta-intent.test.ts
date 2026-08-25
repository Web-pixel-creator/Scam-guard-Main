import { describe, expect, it } from "vitest";
import {
  ALL_META_INTENTS,
  CANONICAL_META_PHRASES,
  classifyMetaIntent,
  getMetaIntentResponse,
  hasScamContextSignal,
  hasScamWordingPattern,
  type MetaIntent,
} from "./meta-intent";

describe("classifyMetaIntent", () => {
  it("classifies canonical RU/UZ/EN examples for every supported intent", () => {
    const seen = new Set<MetaIntent>();

    for (const { intent, text } of CANONICAL_META_PHRASES) {
      expect(classifyMetaIntent(`  ${text.toLocaleUpperCase("ru")}  `)).toBe(intent);
      seen.add(intent);
    }

    expect([...seen].sort()).toEqual([...ALL_META_INTENTS].sort());
  });

  it("handles the image-failure question that previously fell into risk-check", () => {
    expect(classifyMetaIntent("Почему ты не смог проанализировать картинку?")).toBe("why_failed");
  });

  it("classifies methodology and risk-explanation questions separately", () => {
    expect(classifyMetaIntent("как проверить номер?")).toBe("how_do_you_check");
    expect(classifyMetaIntent("почему это опасно?")).toBe("explain_risk");
  });

  it("answers Telegram account capability questions without running a risk check", () => {
    expect(classifyMetaIntent("ты видишь scam метку Telegram аккаунта?")).toBe(
      "telegram_account_limits",
    );
    expect(classifyMetaIntent("можешь узнать возраст аккаунта и сколько жалоб было?")).toBe(
      "telegram_account_limits",
    );
    expect(classifyMetaIntent("can you see Telegram scam labels or account age?")).toBe(
      "telegram_account_limits",
    );
  });

  it.each([
    ["а ты можешь проанализировать ссылку?", "can_check_link"],
    ["Вы можете проверить номер телефона?", "can_check_phone"],
    ["Can you check a Telegram account?", "can_check_account"],
    ["Could you review a screenshot before I continue?", "can_check_image"],
    ["havolani tahlil qila olasanmi?", "can_check_link"],
    ["Siz xabar matnini tekshira olasizmi?", "can_check_message"],
    ["QR-kodni yuborsam, tekshirib berasizmi?", "can_check_qr"],
  ] as const)("routes the capability question '%s' to %s", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    ["Проверяешь ссылки?", "can_check_link"],
    ["А ссылку проверить сможешь?", "can_check_link"],
    ["Можешь глянуть сайт?", "can_check_link"],
    ["Можно скинуть ссылку на проверку?", "can_check_link"],
    ["Ты умеешь проверять домены?", "can_check_link"],
    ["Проверишь номер?", "can_check_phone"],
    ["Ты номера проверяешь?", "can_check_phone"],
    ["Можно отправить скрин?", "can_check_image"],
    ["QR проверить можешь?", "can_check_qr"],
    ["Ты можешь проверить сайт?", "can_check_link"],
    ["Ты можешь проверить веб-страницу?", "can_check_link"],
    ["Можно проверить домен?", "can_check_link"],
    ["Could you check this link?", "can_check_link"],
    ["Do you check URLs?", "can_check_link"],
    ["Can you take a look at a website?", "can_check_link"],
    ["Can I send you a phone number?", "can_check_phone"],
    ["Can you look at a screenshot?", "can_check_image"],
    ["Can this bot scan QR codes?", "can_check_qr"],
    ["Can you check a website?", "can_check_link"],
    ["Can you check a web address?", "can_check_link"],
    ["Can you inspect a URL?", "can_check_link"],
    ["Havola tekshirasizmi?", "can_check_link"],
    ["Havolani ko'rib bera olasizmi?", "can_check_link"],
    ["Saytni tekshirib berasizmi?", "can_check_link"],
    ["Raqam tekshirasizmi?", "can_check_phone"],
    ["Saytni tekshira olasizmi?", "can_check_link"],
    ["А ссылку посмотришь?", "can_check_link"],
    ["Проверяете веб-адреса?", "can_check_link"],
    ["Домен проверить можно?", "can_check_link"],
    ["Номера телефонов анализируете?", "can_check_phone"],
    ["Скриншот посмотришь?", "can_check_image"],
    ["Можно загрузить изображение?", "can_check_image"],
    ["Оценишь телеграм-аккаунт?", "can_check_account"],
    ["Проанализируешь письмо?", "can_check_message"],
    ["QR-код сканируете?", "can_check_qr"],
    ["Could you take a look at a webpage?", "can_check_link"],
    ["Are websites something you can check?", "can_check_link"],
    ["May I send you a number?", "can_check_phone"],
    ["Do you accept numbers for checking?", "can_check_phone"],
    ["Could I give you a number to inspect?", "can_check_phone"],
    ["May I upload a screenshot?", "can_check_image"],
    ["Saytni ko'rib berasizmi?", "can_check_link"],
    ["Telefon raqamini baholaysizmi?", "can_check_phone"],
    ["Skrinshotni ko'rib berasizmi?", "can_check_image"],
    ["Profil yuborsam bo'ladimi?", "can_check_account"],
    ["Matnni tahlil qila olasizmi?", "can_check_message"],
    ["Принимаете картинки на проверку?", "can_check_image"],
    ["Я могу скинуть текст?", "can_check_message"],
    ["Оценишь куар-код?", "can_check_qr"],
    ["Адрес сайта скинуть можно?", "can_check_link"],
    ["Телефонный номер можно показать?", "can_check_phone"],
    ["Я могу загрузить скрин?", "can_check_image"],
    ["Картинку прикрепить можно?", "can_check_image"],
    ["Текст сюда вставить можно?", "can_check_message"],
    ["QR сюда прикрепить?", "can_check_qr"],
    ["Can I submit a web address?", "can_check_link"],
    ["Can I paste a link here?", "can_check_link"],
    ["May I attach a screenshot?", "can_check_image"],
    ["Can I submit a Telegram profile?", "can_check_account"],
    ["May I paste the email text?", "can_check_message"],
    ["Can I attach a QR code?", "can_check_qr"],
    ["Sayt manzilini yuborish mumkinmi?", "can_check_link"],
    ["Rasmni yuklasam bo'ladimi?", "can_check_image"],
    ["Skrinshotni biriktirsam bo'ladimi?", "can_check_image"],
    ["Telegram profilini yuborish mumkinmi?", "can_check_account"],
    ["Matnni shu yerga joylasam bo'ladimi?", "can_check_message"],
    ["QRni yuklasam bo'ladimi?", "can_check_qr"],
    ["Do you take websites for analysis?", "can_check_link"],
    ["Do you take messages for analysis?", "can_check_message"],
    ["Raqamni shu yerga yozsam bo'ladimi?", "can_check_phone"],
    ["Username yozsam bo'ladimi?", "can_check_account"],
  ] as const)("handles an adversarial natural capability variant '%s'", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    ["Можешь проверить ссылку от банка?", "can_check_link"],
    ["Can you check a payment link?", "can_check_link"],
    ["Telefon raqamini tekshira olasizmi, bankdan qo'ng'iroq qilishdi?", "can_check_phone"],
    ["Can you analyze an APK link?", "can_check_link"],
    ["Можно прислать ссылку из SMS банка?", "can_check_link"],
    ["Can I send a screenshot of a payment request?", "can_check_image"],
    ["Оплату по QR ты можешь проверить?", "can_check_qr"],
    ["Bankdan kelgan xabarni tekshirib bera olasizmi?", "can_check_message"],
    ["Can you check a bank phone number?", "can_check_phone"],
  ] as const)(
    "answers a capability question with a broad bank/payment/APK topic but no value: %s",
    (text, intent) => {
      expect(classifyMetaIntent(text)).toBe(intent);
    },
  );

  it.each([
    "Can you check a card number?",
    "Could you inspect an invoice number?",
    "Can you check an order number?",
    "Do you check tracking numbers?",
    "Can you review an account number?",
    "Можешь проверить номер карты?",
    "Проверяете номер заказа?",
    "Karta raqamini tekshira olasizmi?",
    "Buyurtma raqamini tekshirasizmi?",
  ])("does not misroute the unsupported number object '%s' as a phone", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    "Can you check a bank account?",
    "Can you inspect an email account?",
    "Could you review a social media account?",
    "Can you check an account on Instagram?",
    "Можешь проверить банковский аккаунт?",
    "Можете проверить аккаунт в соцсети?",
    "Bank akkauntini tekshira olasizmi?",
    "Ijtimoiy tarmoq profilini tekshirasizmi?",
  ])("does not answer an unsupported account lookup with Telegram instructions: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    ["Проверишь номер?", "can_check_phone"],
    ["May I send you a number?", "can_check_phone"],
    ["Raqam tekshirasizmi?", "can_check_phone"],
    ["Can you check a Telegram account?", "can_check_account"],
    ["Can you inspect a username?", "can_check_account"],
    ["Could you review an account handle?", "can_check_account"],
  ] as const)("preserves the supported capability '%s' as %s", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    "Расскажи анекдот, а потом отправь мне код, который пришёл",
    "Tell me a joke and then send me the verification code",
    "Menga latifa ayt, keyin kelgan kodni yubor",
    "Какая погода и продиктуй код из сообщения",
    "What is the weather and share the code you received",
    "Можешь проверить сообщение: отправь код, который пришёл?",
    "Can you check this message: send me the verification code?",
    "Can you check a screenshot request asking me to share the verification code?",
    "Какая погода, отправь данные карты",
    "Какая погода, скажи данные карты",
    "Какая погода, пришли номер карты",
    "Расскажи рецепт и отправь данные карты",
    "Tell me a joke and read out the code",
    "What is the weather? Tell me the card number",
    "Kim yutdi? Go'shakni qo'yma",
    "Какая песня популярна? Перейди по QR",
    "Qaysi qo'shiq mashhur? QRni skaner qil",
    "Можешь проверить сообщение, где просят отправить код?",
    "Можешь проверить скриншот, где требуют перевести деньги?",
    "Can you inspect a message asking me to send the code?",
    "Can you inspect a screenshot demanding a money transfer?",
    "Can you check a message that tells me to send a code?",
    "Skrinshotni ko'rib berasizmi: pulni o'tkaz?",
    "Можно проверить сообщение: скинь код?",
    "Скриншот посмотришь: оплати по QR?",
    "Почему это опасно? Введи код",
    "Make a funny story and send a photo of the card",
    "Can you check a message saying forward the code?",
    "Could you inspect text that says reveal the password?",
    "Why is it dangerous? Enter the code",
    "How do I check a link? Make the payment",
    "Matnni ko'rib berasizmi: parolni ayt?",
    "Kod talab qilgan xabarni tekshirasizmi?",
    "Latifa ayting. QR orqali o'ting",
    "Film tavsiya qiling va QR orqali to'lang",
    "Проверишь текст: продиктуй пароль?",
    "Как проверить ссылку? Переведи оплату",
    "Havolani qanday tekshiraman? To'lovni qiling",
    "Can you inspect this text: never send the code, then send me the code",
    "Can you check this message: do not scan QR, scan this QR to log in",
    "Can you check a message saying: Wi-Fi is irrelevant, reveal your password",
    "Can you review this text: ignore the postal code, forward the code",
    "Can you check a message: ignore Python, send me the code",
  ])("fails closed to the risk pipeline for mixed conversational/scam text: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    ["Why could you not analyze the image?", "why_failed"],
    ["Почему анализ изображения не сработал?", "why_failed"],
    ["Rasmni nega o'qiy olmadingiz?", "why_failed"],
    ["Почему изображение не анализируется?", "why_failed"],
    ["Что помешало прочитать картинку?", "why_failed"],
    ["Why did image analysis fail?", "why_failed"],
    ["Why can you not process the photo?", "why_failed"],
    ["What stopped you from reading the image?", "why_failed"],
    ["Nega skrinshotni o'qimadingiz?", "why_failed"],
    ["Nega rasm tahlili ishlamadi?", "why_failed"],
    ["Skrinshot tekshiruvi nega xato berdi?", "why_failed"],
    ["Отчего скриншот не обработался?", "why_failed"],
    ["Why did you not read the screenshot?", "why_failed"],
    ["QR-kod nima uchun tanilmadi?", "why_failed"],
    ["Nima uchun suratni qayta ishlay olmadingiz?", "why_failed"],
    ["Rasmni o'qishga nima xalaqit berdi?", "why_failed"],
  ] as const)("keeps failure-explanation precedence for '%s'", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    [
      "После прошлого результата хочу уточнить: а ты можешь проанализировать ссылку?",
      "can_check_link",
    ],
    ["Спасибо за помощь. Ещё вопрос: можешь проверить скриншот?", "can_check_image"],
    ["After the previous result, I want to clarify: can you analyze a link?", "can_check_link"],
    [
      "Thanks for your help. One more question: could you review a screenshot before I continue?",
      "can_check_image",
    ],
    [
      "Oldingi natijadan keyin aniqlashtirmoqchiman: havolani tahlil qila olasanmi?",
      "can_check_link",
    ],
    [
      "Yordamingiz uchun rahmat. Yana bir savol: xabar matnini tekshira olasizmi?",
      "can_check_message",
    ],
  ] as const)("accepts a safe conversational wrapper in '%s'", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    ["Привет!", "greeting"],
    ["Добрый день, бот", "greeting"],
    ["Hello!", "greeting"],
    ["Hi bot", "greeting"],
    ["Salom!", "greeting"],
    ["Assalomu alaykum", "greeting"],
    ["Какая сегодня погода?", "off_topic"],
    ["Подскажи рецепт плова", "off_topic"],
    ["Помоги с домашкой по математике", "off_topic"],
    ["Расскажи мне анекдот", "off_topic"],
    ["What's the weather today?", "off_topic"],
    ["Give me a recipe for soup", "off_topic"],
    ["Do my homework", "off_topic"],
    ["Tell me a joke", "off_topic"],
    ["Bugun ob-havo qanday?", "off_topic"],
    ["Menga palov retseptini ayt", "off_topic"],
    ["Uy vazifamni bajar", "off_topic"],
    ["Menga latifa ayt", "off_topic"],
    ["Хей, бот", "greeting"],
    ["Приветик", "greeting"],
    ["Hello there!", "greeting"],
    ["Greetings", "greeting"],
    ["Salom do'stim", "greeting"],
    ["Кто победил в матче?", "off_topic"],
    ["Какая музыка сейчас популярна?", "off_topic"],
    ["Расскажи смешную историю", "off_topic"],
    ["Сколько будет два плюс два?", "off_topic"],
    ["Переведи это на английский", "off_topic"],
    ["What music is popular today?", "off_topic"],
    ["Translate this into Uzbek", "off_topic"],
    ["Bugun qaysi musiqa mashhur?", "off_topic"],
    ["Ikki qo'shuv ikki nechchi?", "off_topic"],
    ["What is two plus two?", "off_topic"],
  ] as const)("routes greeting or ordinary off-topic text '%s' to %s", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it("does not intercept text that contains scam artifacts or forwarded content", () => {
    expect(classifyMetaIntent("помогите, мне прислали ссылку https://example.com")).toBeNull();
    expect(classifyMetaIntent("как пользоваться @unknown_manager")).toBeNull();
    expect(classifyMetaIntent("ты видишь scam метку @unknown_manager")).toBeNull();
    expect(
      classifyMetaIntent("на вашем Telegram аккаунте scam метка, оплатите проверку"),
    ).toBeNull();
    expect(classifyMetaIntent("почему это опасно +998 90 123 45 67")).toBeNull();
    expect(classifyMetaIntent("как проверить номер", { isForwarded: true })).toBeNull();
    expect(
      classifyMetaIntent("а ты можешь проанализировать ссылку?", { isForwarded: true }),
    ).toBeNull();
    expect(
      classifyMetaIntent("После прошлого результата хочу уточнить: проверь https://example.com"),
    ).toBeNull();
    expect(classifyMetaIntent("можешь проверить ссылку paypa1.uz?")).toBeNull();
    expect(classifyMetaIntent("можешь проверить домен пример.рф?")).toBeNull();
    expect(classifyMetaIntent("can you check @unknown_manager?")).toBeNull();
    expect(classifyMetaIntent("havolani tekshira olasanmi +998 90 123 45 67?")).toBeNull();
  });

  it("detects scam-context and scam-wording override signals", () => {
    expect(hasScamContextSignal("как пользоваться https://example.com")).toBe(true);
    expect(hasScamContextSignal("почему риск, если просят SMS-код")).toBe(true);
    expect(hasScamContextSignal("просят оплатить проверку аккаунта")).toBe(true);
    expect(hasScamContextSignal("проверь paypa1.uz")).toBe(true);
    expect(hasScamContextSignal("проверь пример.рф")).toBe(true);
    expect(hasScamWordingPattern("не кладите трубку, идет проверка")).toBe(true);
  });

  it.each([
    "Как ты проверяешь? Мне банк написал в Telegram.",
    "Как ты проверяешь? Мне в Telegram написал банк.",
    "Почему это опасно? Мне сейчас звонит полиция.",
    "Qanday tekshirasiz? Menga bank Telegram orqali yozdi.",
    "Qanday tekshirasiz? Menga Telegramda bank yozdi.",
    "Nega bu xavfli? Menga hozir politsiya qo'ng'iroq qilyapti.",
    "How do you check? My bank messaged me on Telegram.",
    "How do you check? On Telegram my bank messaged me.",
    "Why is this dangerous? The police are calling me right now.",
  ])("does not hide a concrete bank/police contact report behind methodology: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    ["Как ты проверяешь сообщения банков в Telegram?", "how_do_you_check"],
    ["Как ты проверяешь сообщения банка в Telegram при сомнении?", "how_do_you_check"],
    ["Banklarning Telegram xabarlarini qanday tekshirasiz?", "how_do_you_check"],
    ["Bank xabarlarini menimcha qanday tekshirasiz?", "how_do_you_check"],
    ["How do you check bank messages on Telegram?", "how_do_you_check"],
  ] as const)("keeps educational methodology available: %s", (text, expected) => {
    expect(classifyMetaIntent(text)).toBe(expected);
  });

  it.each([
    ["как ты проверяешь фразу «безопасный счёт»?", "how_do_you_check"],
    ["how do you check a message that mentions a safe account?", "how_do_you_check"],
    ["xavfsiz hisob haqidagi xabarni qanday tekshirasiz?", "how_do_you_check"],
  ] as const)("keeps a pure educational question in meta routing: %s", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    "что такое безопасный счёт?",
    "кто такая служба безопасности?",
    "what does the phrase safe account mean?",
    "xavfsiz hisob nima degani?",
  ])("does not treat a definition question as a live deterministic incident: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    "помощь, полиция заставляет поджечь машину и молчать",
    "help, the tax police told me to burn a gas station or face a criminal case",
    "yordam, soliq xodimi xavfli topshiriqni bajarishni buyuryapti",
    "помощь, предлагают за деньги удалить штрафные баллы",
    "help, an insider offers to erase my traffic penalty points for a fee",
    "помощь, я знаю твой адрес, приеду домой и убью тебя",
    "help, I know your address and I will come to your house and beat you",
  ])("does not let meta-help swallow a fresh high-risk incident: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it("does not find short payment markers inside ordinary words", () => {
    expect(hasScamContextSignal("Kulgili hikoya o'ylab toping")).toBe(false);
    expect(hasScamContextSignal("What song is popular now?")).toBe(false);
    expect(hasScamContextSignal("Pull the door and sit down")).toBe(false);
    expect(classifyMetaIntent("Kulgili hikoya o'ylab toping")).toBe("off_topic");
    expect(classifyMetaIntent("What song is popular now?")).toBe("off_topic");
  });

  it("returns null for empty and ordinary non-meta text", () => {
    expect(classifyMetaIntent("")).toBeNull();
    expect(classifyMetaIntent("обычный короткий текст без вопроса")).toBeNull();
  });

  it.each([
    "I scanned a QR code to log into my bank account.",
    "The bank QR was scanned yesterday.",
    "I uploaded a screenshot document yesterday.",
    "This table shows a phone number.",
    "The message was pasted into the document.",
  ])("does not mistake an English declarative sentence for a capability question: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    "I scanned a QR code and now cannot access my Telegram account. What should I do?",
    "Я отсканировал QR и потерял доступ к аккаунту. Что делать?",
    "Я проверил эту ссылку и теперь боюсь. Что делать?",
    "Men QRni tekshirdim, endi akkauntga kira olmayapman. Nima qilay?",
    "I checked a link. What do I do now?",
    "I reviewed the message. What can I do now?",
    "Я проверил ссылку. Можете подсказать, что делать?",
    "Я загрузил скриншот и теперь не могу войти. Что делать?",
    "Xabarni tekshirdim. Endi nima qilay?",
    "I scanned a QR code yesterday. Is that relevant?",
  ])("does not mistake a post-action or emergency question for capability: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });

  it.each([
    ["а ты можешь проанализировать ссылку?", "can_check_link"],
    ["Можно загрузить изображение?", "can_check_image"],
    ["Are websites something you can check?", "can_check_link"],
    ["Can you check a QR code?", "can_check_qr"],
    ["QR-kodni tekshira olasizmi?", "can_check_qr"],
  ] as const)("keeps a strict capability control: %s", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });
});

describe("classifyMetaIntent — bounded everyday phrasing", () => {
  it.each([
    ["Что вообще умеет этот бот?", "what_can_you_do"],
    ["Bu bot umuman nimalar qila oladi?", "what_can_you_do"],
    ["What can this bot actually do?", "what_can_you_do"],
    ["Ты умеешь смотреть скриншоты?", "can_check_image"],
    ["Telegram akkauntini baholay olasizmi?", "can_check_account"],
    ["Рад, что нашёл этого бота.", "greeting"],
    ["Can I just say hello first?", "greeting"],
    ["Avval shunchaki salomlashsam bo'ladimi?", "greeting"],
    ["С чего ты сделал такой вывод?", "explain_risk"],
    ["What signs did you notice?", "how_do_you_check"],
    ["Buni biror usul bilan tekshirdingizmi?", "how_do_you_check"],
  ] as const)("routes %s to %s", (text, intent) => {
    expect(classifyMetaIntent(text)).toBe(intent);
  });

  it.each([
    "What can this bot actually do, send me your SMS code",
    "Can I just say hello first, then install this APK",
    "Рад, что нашёл этого бота, пришлите CVV карты",
  ])("does not let conversational wording hide a dangerous action: %s", (text) => {
    expect(classifyMetaIntent(text)).toBeNull();
  });
});

describe("getMetaIntentResponse", () => {
  it("returns non-empty localized templates for every intent", () => {
    for (const intent of ALL_META_INTENTS) {
      for (const lang of ["ru", "uz", "en"] as const) {
        expect(getMetaIntentResponse(intent, lang).trim().length).toBeGreaterThan(20);
      }
    }
  });

  it("keeps Telegram account limitations explicit and non-accusatory", () => {
    const response = getMetaIntentResponse("telegram_account_limits", "ru");

    expect(response).toContain("скрытую метку SCAM");
    expect(response).toContain("возраст аккаунта");
    expect(response).toContain("@username");
    expect(response).not.toMatch(/точно мошенник|забанен|создан недавно/i);
  });

  it("uses concise natural copy for capability, greeting and off-topic replies", () => {
    const capability = getMetaIntentResponse("can_check_link", "ru");
    const phone = getMetaIntentResponse("can_check_phone", "en");
    const image = getMetaIntentResponse("can_check_image", "uz");
    const account = getMetaIntentResponse("can_check_account", "ru");
    const message = getMetaIntentResponse("can_check_message", "en");
    const qr = getMetaIntentResponse("can_check_qr", "uz");
    const greeting = getMetaIntentResponse("greeting", "uz");
    const offTopic = getMetaIntentResponse("off_topic", "en");

    expect(capability).toMatch(/^Да\./);
    expect(capability).toContain("открывать её не нужно");
    expect(phone).toContain("without guessing the owner");
    expect(image).toContain("Ishonch Guard bazasida saqlanmaydi");
    expect(account).toContain("только открытые признаки Telegram");
    expect(message).toContain("Remove any real SMS code");
    expect(qr).toContain("QR-kodning aniq skrinshotini");
    expect(greeting).toContain("Salom!");
    expect(offTopic).toContain("scams and digital safety");
    expect(
      `${capability}\n${phone}\n${image}\n${account}\n${message}\n${qr}\n${greeting}\n${offTopic}`,
    ).not.toMatch(
      /недостаточно данных|not enough data|artificial intelligence|нейросет|language model/i,
    );
  });
});
