import type { Lang } from "@/lib/i18n";
import type { MetaIntent } from "@/lib/meta-intent";

/**
 * This is a deterministic, curated QA corpus. It is not model training and the
 * generated context rows are not a claim that 1,008 independent live Telegram
 * conversations took place. The contexts below are explicit user-turn prefixes,
 * not simulated Telegram session state. Real-client RU/UZ/EN QA remains a
 * separate gate.
 */
export const HUMAN_DIALOGUE_CONTEXTS = ["fresh", "after_result", "after_help"] as const;

export type HumanDialogueContext = (typeof HUMAN_DIALOGUE_CONTEXTS)[number];

export const HUMAN_DIALOGUE_TOPICS = [
  "can_check_link",
  "can_check_phone",
  "can_check_image",
  "can_check_account",
  "can_check_message",
  "can_check_qr",
  "how_to_use",
  "how_do_you_check",
  "explain_risk",
  "telegram_account_limits",
  "greeting_basic",
  "off_topic_weather",
  "off_topic_fun",
  "off_topic_learning",
] as const;

export type HumanDialogueTopic = (typeof HUMAN_DIALOGUE_TOPICS)[number];

type EightNaturalVariants = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

interface HumanDialogueTopicSeed {
  topic: HumanDialogueTopic;
  expectedIntent: MetaIntent;
  variants: Readonly<Record<Lang, EightNaturalVariants>>;
}

export interface HumanDialogueCorpusCase {
  id: string;
  topic: HumanDialogueTopic;
  lang: Lang;
  context: HumanDialogueContext;
  variant: number;
  utterance: string;
  expectedIntent: MetaIntent;
}

interface CapabilityObject {
  topic: Extract<
    HumanDialogueTopic,
    | "can_check_link"
    | "can_check_phone"
    | "can_check_image"
    | "can_check_account"
    | "can_check_message"
    | "can_check_qr"
  >;
  intent: Extract<
    MetaIntent,
    | "can_check_link"
    | "can_check_phone"
    | "can_check_image"
    | "can_check_account"
    | "can_check_message"
    | "can_check_qr"
  >;
  object: Readonly<Record<Lang, string>>;
}

const CAPABILITY_OBJECTS: readonly CapabilityObject[] = [
  {
    topic: "can_check_link",
    intent: "can_check_link",
    object: { ru: "ссылку", uz: "havolani", en: "a link" },
  },
  {
    topic: "can_check_phone",
    intent: "can_check_phone",
    object: { ru: "номер телефона", uz: "telefon raqamini", en: "a phone number" },
  },
  {
    topic: "can_check_image",
    intent: "can_check_image",
    object: { ru: "скриншот", uz: "skrinshotni", en: "a screenshot" },
  },
  {
    topic: "can_check_account",
    intent: "can_check_account",
    object: { ru: "Telegram-аккаунт", uz: "Telegram akkauntini", en: "a Telegram account" },
  },
  {
    topic: "can_check_message",
    intent: "can_check_message",
    object: { ru: "текст сообщения", uz: "xabar matnini", en: "a message" },
  },
  {
    topic: "can_check_qr",
    intent: "can_check_qr",
    object: { ru: "QR-код", uz: "QR-kodni", en: "a QR code" },
  },
] as const;

function capabilityVariants(value: string, lang: Lang): EightNaturalVariants {
  if (lang === "uz") {
    return [
      `Siz ${value} tekshira olasizmi?`,
      `${value} tekshirasizmi?`,
      `Bot ${value} tahlil qila oladimi?`,
      `${value} yuborsam bo'ladimi?`,
      `${value} ko'rib bera olasizmi?`,
      `${value} baholab bera olasizmi?`,
      `${value} tekshirib berasizmi?`,
      `Tekshirish uchun ${value} yuborsam bo'ladimi?`,
    ];
  }

  if (lang === "en") {
    return [
      `Can you check ${value}?`,
      `Could you check ${value}?`,
      `Does this bot check ${value}?`,
      `Can I send you ${value}?`,
      `Can you take a look at ${value}?`,
      `Are you able to assess ${value}?`,
      `Do you check ${value}?`,
      `May I ask you to inspect ${value}?`,
    ];
  }

  return [
    `Ты можешь проверить ${value}?`,
    `${value} проверить сможешь?`,
    `Бот умеет анализировать ${value}?`,
    `Можно отправить ${value}?`,
    `Можешь глянуть ${value}?`,
    `Сможешь оценить ${value}?`,
    `Проверишь ${value}?`,
    `Принимаешь ${value} на проверку?`,
  ];
}

function capabilitySeed(spec: CapabilityObject): HumanDialogueTopicSeed {
  const ru = capabilityVariants(spec.object.ru, "ru");
  // Keep the observed real-client wording in the canonical link surface.
  const variants =
    spec.topic === "can_check_link"
      ? ({
          ru: [
            "А ты можешь проанализировать ссылку?",
            ru[1],
            ru[2],
            ru[3],
            ru[4],
            ru[5],
            ru[6],
            ru[7],
          ],
          uz: capabilityVariants(spec.object.uz, "uz"),
          en: capabilityVariants(spec.object.en, "en"),
        } as const)
      : ({
          ru,
          uz: capabilityVariants(spec.object.uz, "uz"),
          en: capabilityVariants(spec.object.en, "en"),
        } as const);

  return { topic: spec.topic, expectedIntent: spec.intent, variants };
}

const HUMAN_DIALOGUE_TOPIC_SEEDS: readonly HumanDialogueTopicSeed[] = [
  ...CAPABILITY_OBJECTS.map(capabilitySeed),
  {
    topic: "how_to_use",
    expectedIntent: "how_to_use",
    variants: {
      ru: [
        "Как пользоваться этим ботом?",
        "Как начать работу с ботом?",
        "Как использовать Ishonch Guard?",
        "Что мне отправить для проверки?",
        "Как отправить материал на проверку?",
        "Как работает этот сервис?",
        "Подскажи, как пользоваться ботом",
        "Объясни, как мне начать проверку",
      ],
      uz: [
        "Bu botdan qanday foydalanaman?",
        "Bot bilan ishlashni qanday boshlayman?",
        "Ishonch Guardni qanday ishlataman?",
        "Tekshirish uchun nima yuborish kerak?",
        "Materialni qanday yuboraman?",
        "Bu bot qanday ishlaydi?",
        "Botdan foydalanishni tushuntirib bering",
        "Tekshiruvni qanday boshlashni ayting",
      ],
      en: [
        "How do I use this bot?",
        "How do I start using the bot?",
        "How can I use Ishonch Guard?",
        "What should I send for a check?",
        "How do I send something for review?",
        "How does this bot work?",
        "Please show me how to use the bot",
        "Explain how I should start a check",
      ],
    },
  },
  {
    topic: "how_do_you_check",
    expectedIntent: "how_do_you_check",
    variants: {
      ru: [
        "Как ты проверяешь такие вещи?",
        "Как ты определяешь риск?",
        "Как ты анализируешь сообщение?",
        "По каким признакам ты решаешь?",
        "Как проверить номер с помощью бота?",
        "Как проверить ссылку здесь?",
        "Как ты решаешь, что это подозрительно?",
        "Расскажи, как ты анализируешь данные",
      ],
      uz: [
        "Bunday narsalarni qanday tekshirasiz?",
        "Xavfni qanday aniqlaysiz?",
        "Xabarni qanday tekshirasiz?",
        "Qanday belgilar asosida qaror qilasiz?",
        "Raqamni qanday tekshirish mumkin?",
        "Havolani qanday tekshirish mumkin?",
        "Nega shubhali ekanini qanday aniqlaysiz?",
        "Ma'lumotni qanday tahlil qilishingizni ayting",
      ],
      en: [
        "How do you check things like this?",
        "How do you determine the risk?",
        "How do you analyze a message?",
        "What signs do you use to decide?",
        "How do I check a number with the bot?",
        "How do I check a link here?",
        "How do you decide that something is suspicious?",
        "Tell me how you analyze the information",
      ],
    },
  },
  {
    topic: "explain_risk",
    expectedIntent: "explain_risk",
    variants: {
      ru: [
        "Почему это опасно?",
        "Почему это подозрительно?",
        "Почему такой высокий риск?",
        "Объясни риск простыми словами",
        "Объясни результат проверки",
        "Почему ты так решил?",
        "Почему ты так считаешь?",
        "Объясни эту оценку",
      ],
      uz: [
        "Nega bu xavfli?",
        "Nima uchun bu shubhali?",
        "Nima uchun xavf yuqori?",
        "Xavfni oddiy qilib tushuntiring",
        "Natijani tushuntirib bering",
        "Nega shunday qaror qildingiz?",
        "Nima uchun shunday deb o'ylaysiz?",
        "Bu bahoni izohlab bering",
      ],
      en: [
        "Why is this dangerous?",
        "Why is this suspicious?",
        "Why is the risk high?",
        "Explain the risk in simple words",
        "Explain the check result",
        "Why did you decide that?",
        "Why do you think so?",
        "Explain this verdict to me",
      ],
    },
  },
  {
    topic: "telegram_account_limits",
    expectedIntent: "telegram_account_limits",
    variants: {
      ru: [
        "Ты видишь SCAM-метку Telegram-аккаунта?",
        "Можешь узнать возраст Telegram-аккаунта?",
        "Ты видишь жалобы на Telegram-профиль?",
        "Можешь проверить историю спама аккаунта?",
        "Бот видит количество репортов Telegram-профиля?",
        "Можно узнать, давно ли создан Telegram-аккаунт?",
        "Покажешь дату создания Telegram-профиля?",
        "Ты проверяешь скрытую SCAM-метку Telegram?",
      ],
      uz: [
        "Telegram akkauntidagi SCAM belgisini ko'rasizmi?",
        "Telegram akkaunti yoshini bilasizmi?",
        "Telegram profilidagi shikoyatlarni ko'rasizmi?",
        "Akkauntning spam tarixini tekshira olasizmi?",
        "Telegram profilidagi reportlarni bilasizmi?",
        "Akkaunt qachon ochilganini bilasizmi?",
        "Telegram profili yoshini ko'rsata olasizmi?",
        "Telegramdagi yashirin SCAM belgisini tekshira olasizmi?",
      ],
      en: [
        "Can you see a Telegram SCAM label?",
        "Do you know the age of a Telegram account?",
        "Can you see reports on a Telegram profile?",
        "Can you check an account's spam history?",
        "Do you know the Telegram report count?",
        "Can you detect when a Telegram account was created?",
        "Is the account age visible to you?",
        "Can you check a hidden Telegram scam label?",
      ],
    },
  },
  {
    topic: "greeting_basic",
    expectedIntent: "greeting",
    variants: {
      ru: [
        "Привет!",
        "Здравствуйте",
        "Добрый день",
        "Привет, бот",
        "Здравствуй, Ishonch Guard",
        "Рад тебя видеть",
        "Добрый вечер, можно вопрос?",
        "Привет, как дела?",
      ],
      uz: [
        "Salom!",
        "Assalomu alaykum",
        "Xayrli kun",
        "Salom, bot",
        "Salom, Ishonch Guard",
        "Sizni ko'rganimdan xursandman",
        "Xayrli kech, savolim bor edi",
        "Salom, ishlaringiz yaxshimi?",
      ],
      en: [
        "Hello!",
        "Hi there",
        "Good afternoon",
        "Hello, bot",
        "Hi, Ishonch Guard",
        "Nice to see you",
        "Good evening, may I ask something?",
        "Hello, how are you?",
      ],
    },
  },
  {
    topic: "off_topic_weather",
    expectedIntent: "off_topic",
    variants: {
      ru: [
        "Какая сегодня погода?",
        "Будет ли завтра дождь?",
        "Сколько градусов сейчас на улице?",
        "Нужен ли сегодня зонт?",
        "Когда закончится жара?",
        "Какой прогноз на выходные?",
        "Сегодня холоднее, чем вчера?",
        "Расскажи прогноз погоды для Ташкента",
      ],
      uz: [
        "Bugun ob-havo qanday?",
        "Ertaga yomg'ir yog'adimi?",
        "Hozir tashqarida necha daraja?",
        "Bugun soyabon kerakmi?",
        "Issiq qachon tugaydi?",
        "Dam olish kunlari ob-havo qanday bo'ladi?",
        "Bugun kechagidan sovuqroqmi?",
        "Toshkent uchun ob-havo aytib bering",
      ],
      en: [
        "What is the weather today?",
        "Will it rain tomorrow?",
        "What is the temperature outside?",
        "Do I need an umbrella today?",
        "When will the heat end?",
        "What is the weekend forecast?",
        "Is it colder than yesterday?",
        "Tell me the weather forecast for Tashkent",
      ],
    },
  },
  {
    topic: "off_topic_fun",
    expectedIntent: "off_topic",
    variants: {
      ru: [
        "Расскажи анекдот",
        "Посоветуй фильм на вечер",
        "Какая песня сейчас популярна?",
        "Давай сыграем в слова",
        "Придумай смешную историю",
        "Кто выиграл вчерашний матч?",
        "Посоветуй интересную книгу",
        "Какую игру скачать на телефон?",
      ],
      uz: [
        "Bir latifa aytib bering",
        "Kechqurun ko'rishga film tavsiya qiling",
        "Hozir qaysi qo'shiq mashhur?",
        "Keling, so'z o'yini o'ynaymiz",
        "Kulgili hikoya o'ylab toping",
        "Kecha o'yinda kim yutdi?",
        "Qiziqarli kitob tavsiya qiling",
        "Telefonga qaysi o'yinni yuklasam bo'ladi?",
      ],
      en: [
        "Tell me a joke",
        "Recommend a movie for tonight",
        "What song is popular now?",
        "Let us play a word game",
        "Make up a funny story",
        "Who won yesterday's match?",
        "Recommend an interesting book",
        "What game should I install on my phone?",
      ],
    },
  },
  {
    topic: "off_topic_learning",
    expectedIntent: "off_topic",
    variants: {
      ru: [
        "Помоги решить уравнение",
        "Переведи этот текст на английский",
        "Объясни, как работает фотосинтез",
        "Когда началась Вторая мировая война?",
        "Напиши сочинение про лето",
        "Как выучить таблицу умножения?",
        "Покажи пример кода на Python",
        "Почему небо голубое?",
      ],
      uz: [
        "Tenglamani yechishga yordam bering",
        "Bu matnni ingliz tiliga tarjima qiling",
        "Fotosintez qanday ishlashini tushuntiring",
        "Ikkinchi jahon urushi qachon boshlangan?",
        "Yoz haqida insho yozib bering",
        "Ko'paytirish jadvalini qanday yodlayman?",
        "Python kodiga misol ko'rsating",
        "Osmon nega ko'k?",
      ],
      en: [
        "Help me solve an equation",
        "Translate this text into English",
        "Explain how photosynthesis works",
        "When did the Second World War begin?",
        "Write an essay about summer",
        "How can I learn the multiplication table?",
        "Show me an example of Python code",
        "Why is the sky blue?",
      ],
    },
  },
];

function contextualize(phrase: string, lang: Lang, context: HumanDialogueContext): string {
  if (context === "fresh") return phrase;

  if (context === "after_result") {
    if (lang === "uz") return `Oldingi natijadan keyin aniqlashtirmoqchiman: ${phrase}`;
    if (lang === "en") return `After the last result I want to clarify: ${phrase}`;
    return `После прошлого результата хочу уточнить: ${phrase}`;
  }

  if (lang === "uz") return `Yordam uchun rahmat. Yana bir savol: ${phrase}`;
  if (lang === "en") return `Thanks for the help. One more question: ${phrase}`;
  return `Спасибо за помощь. Ещё вопрос: ${phrase}`;
}

function buildHumanDialogueCorpus(): HumanDialogueCorpusCase[] {
  const rows: HumanDialogueCorpusCase[] = [];

  for (const seed of HUMAN_DIALOGUE_TOPIC_SEEDS) {
    for (const lang of ["ru", "uz", "en"] as const) {
      seed.variants[lang].forEach((phrase, index) => {
        for (const context of HUMAN_DIALOGUE_CONTEXTS) {
          rows.push({
            id: `${seed.topic}:${lang}:v${index + 1}:${context}`,
            topic: seed.topic,
            lang,
            context,
            variant: index + 1,
            utterance: contextualize(phrase, lang, context),
            expectedIntent: seed.expectedIntent,
          });
        }
      });
    }
  }

  return rows;
}

export const HUMAN_DIALOGUE_CORPUS: readonly HumanDialogueCorpusCase[] = buildHumanDialogueCorpus();
