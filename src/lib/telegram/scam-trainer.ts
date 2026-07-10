import type { Lang } from "@/lib/i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";

export const TRAINER_CB_PREFIX = "trainer:";

const TRAINER_TOTAL = 5;

type TrainerCopy = Record<Lang, string>;

interface TrainerOption {
  text: TrainerCopy;
  correct: boolean;
}

interface TrainerQuestion {
  title: TrainerCopy;
  situation: TrainerCopy;
  options: [TrainerOption, TrainerOption, TrainerOption];
  safeStep: TrainerCopy;
  why: TrainerCopy;
}

const INTRO: Record<Lang, { title: string; body: string; start: string; safety: string }> = {
  ru: {
    title: "🎧 Тренажёр звонков",
    body:
      "Пять коротких ситуаций, чтобы спокойно потренироваться до настоящего звонка.\n\n" +
      "Выберите самый безопасный шаг. Я не буду показывать подробные сценарии обмана — только защитные решения.",
    start: "▶️ Начать мини-квиз",
    safety: "🛡 Правила безопасности",
  },
  uz: {
    title: "🎧 Qo'ng'iroq treneri",
    body:
      "Haqiqiy qo'ng'iroqdan oldin xotirjam mashq qilish uchun beshta qisqa vaziyat.\n\n" +
      "Eng xavfsiz qadamni tanlang. Men firibgarlik ssenariylarini batafsil ko'rsatmayman — faqat himoya qarorlarini beraman.",
    start: "▶️ Mini-testni boshlash",
    safety: "🛡 Xavfsizlik qoidalari",
  },
  en: {
    title: "🎧 Call trainer",
    body:
      "Five short situations to practice calmly before a real call.\n\n" +
      "Choose the safest next step. I will not show detailed scam scripts — only defensive decisions.",
    start: "▶️ Start mini-quiz",
    safety: "🛡 Safety rules",
  },
};

const QUESTION_COPY: Record<
  Lang,
  { question: string; right: string; wrong: string; score: string; next: string; restart: string }
> = {
  ru: {
    question: "Что безопаснее сделать?",
    right: "✅ Верно",
    wrong: "⚠️ Небезопасно",
    score: "Счёт",
    next: "Следующая ситуация",
    restart: "Пройти ещё раз",
  },
  uz: {
    question: "Qaysi qadam xavfsizroq?",
    right: "✅ To'g'ri",
    wrong: "⚠️ Xavfsiz emas",
    score: "Hisob",
    next: "Keyingi vaziyat",
    restart: "Yana o'tish",
  },
  en: {
    question: "What is the safest step?",
    right: "✅ Correct",
    wrong: "⚠️ Not safe",
    score: "Score",
    next: "Next situation",
    restart: "Try again",
  },
};

const DONE: Record<Lang, { title: string; good: string; practice: string; panic: string }> = {
  ru: {
    title: "🏁 Тренировка завершена",
    good: "Хорошая цель: в реальном звонке не спорить, а поставить паузу и проверить через другой канал.",
    practice:
      "Если хотите, пройдите ещё раз — ситуации перемешивать не нужно, важна мышечная память безопасного шага.",
    panic: "🆘 Помощь сейчас",
  },
  uz: {
    title: "🏁 Mashq tugadi",
    good: "Asosiy maqsad: haqiqiy qo'ng'iroqda bahslashmaslik, pauza qilish va boshqa kanal orqali tekshirish.",
    practice:
      "Xohlasangiz, yana o'ting — vaziyatlarni aralashtirish shart emas, xavfsiz qadam odatga aylanishi muhim.",
    panic: "🆘 Hozir yordam",
  },
  en: {
    title: "🏁 Training complete",
    good: "The key habit: in a real call, do not argue. Pause and verify through another channel.",
    practice: "You can repeat it. The point is to build muscle memory for the safe step.",
    panic: "🆘 Help now",
  },
};

const QUESTIONS: readonly TrainerQuestion[] = [
  {
    title: {
      ru: "Звонок «из банка»",
      uz: "«Bankdan» qo'ng'iroq",
      en: "A call “from the bank”",
    },
    situation: {
      ru: "Вам говорят, что с картой срочная проблема, и просят оставаться на линии.",
      uz: "Karta bilan shoshilinch muammo bor deyishadi va liniyada qolishni so'rashadi.",
      en: "You are told there is an urgent card problem and asked to stay on the line.",
    },
    options: [
      {
        text: {
          ru: "Положить трубку и самому набрать официальный номер банка",
          uz: "Go'shakni qo'yib, bankning rasmiy raqamiga o'zim qo'ng'iroq qilish",
          en: "Hang up and call the bank using an official number",
        },
        correct: true,
      },
      {
        text: {
          ru: "Остаться на линии, пока всё объяснят",
          uz: "Hammasini tushuntirishguncha liniyada qolish",
          en: "Stay on the line until they explain everything",
        },
        correct: false,
      },
      {
        text: {
          ru: "Перезвонить по номеру из входящего звонка",
          uz: "Kiruvchi qo'ng'iroqdagi raqamga qayta qo'ng'iroq qilish",
          en: "Call back the number from the incoming call",
        },
        correct: false,
      },
    ],
    safeStep: {
      ru: "Безопасный шаг: завершить звонок и набрать банк по номеру с карты или официального сайта.",
      uz: "Xavfsiz qadam: qo'ng'iroqni tugatib, kartadagi yoki rasmiy saytdagi raqamga qo'ng'iroq qilish.",
      en: "Safe step: end the call and use the number on your card or the official website.",
    },
    why: {
      ru: "Настоящий банк спокойно дождётся обратного звонка. Давление «не кладите трубку» — риск.",
      uz: "Haqiqiy bank sizning qayta qo'ng'irog'ingizni kutadi. «Go'shakni qo'ymang» bosimi — xavf.",
      en: "A real bank will wait for your callback. Pressure to stay on the line is a risk sign.",
    },
  },
  {
    title: {
      ru: "Знакомый голос просит деньги",
      uz: "Tanish ovoz pul so'raydi",
      en: "A familiar voice asks for money",
    },
    situation: {
      ru: "Голос похож на близкого человека, но просьба срочная и связана с деньгами.",
      uz: "Ovoz yaqin insonnikiga o'xshaydi, lekin iltimos shoshilinch va pul bilan bog'liq.",
      en: "The voice sounds like someone close to you, but the request is urgent and about money.",
    },
    options: [
      {
        text: {
          ru: "Перезвонить близкому по сохранённому номеру и спросить кодовое слово",
          uz: "Saqlangan raqamga qayta qo'ng'iroq qilib, maxfiy so'zni so'rash",
          en: "Call back using the saved number and ask the family code word",
        },
        correct: true,
      },
      {
        text: {
          ru: "Сразу перевести небольшую сумму",
          uz: "Darhol kichik summa o'tkazish",
          en: "Send a small amount right away",
        },
        correct: false,
      },
      {
        text: {
          ru: "Спросить в том же чате, куда перевести",
          uz: "O'sha chatda qayerga o'tkazishni so'rash",
          en: "Ask in the same chat where to send it",
        },
        correct: false,
      },
    ],
    safeStep: {
      ru: "Безопасный шаг: проверить человека другим каналом — сохранённый номер, личный вопрос или семейное кодовое слово.",
      uz: "Xavfsiz qadam: odamni boshqa kanal orqali tekshirish — saqlangan raqam, shaxsiy savol yoki oilaviy maxfiy so'z.",
      en: "Safe step: verify the person through another channel — saved number, private question, or family code word.",
    },
    why: {
      ru: "Голос и видео можно подделать. Проверяем не голос, а человека.",
      uz: "Ovoz va video soxtalashtirilishi mumkin. Ovozni emas, odamni tekshiramiz.",
      en: "Voice and video can be faked. Verify the person, not the voice.",
    },
  },
  {
    title: {
      ru: "Просят код подтверждения",
      uz: "Tasdiqlash kodi so'ralmoqda",
      en: "They ask for a confirmation code",
    },
    situation: {
      ru: "Во время звонка или переписки вам говорят, что нужен код из SMS, push или приложения.",
      uz: "Qo'ng'iroq yoki yozishmada SMS, push yoki ilovadagi kod kerak deyishadi.",
      en: "During a call or chat, you are told a code from SMS, push, or an app is needed.",
    },
    options: [
      {
        text: {
          ru: "Никому не называть код и завершить разговор",
          uz: "Kodni hech kimga aytmaslik va suhbatni tugatish",
          en: "Do not share the code and end the conversation",
        },
        correct: true,
      },
      {
        text: {
          ru: "Назвать только последние цифры",
          uz: "Faqat oxirgi raqamlarni aytish",
          en: "Share only the last digits",
        },
        correct: false,
      },
      {
        text: {
          ru: "Отправить код близкому, чтобы он проверил",
          uz: "Kodni yaqin insonga tekshirish uchun yuborish",
          en: "Forward the code to a trusted person for checking",
        },
        correct: false,
      },
    ],
    safeStep: {
      ru: "Безопасный шаг: код, PIN, CVV и пароль не пересылают никому — даже «для проверки».",
      uz: "Xavfsiz qadam: kod, PIN, CVV va parol hech kimga yuborilmaydi — «tekshirish uchun» ham.",
      en: "Safe step: never forward a code, PIN, CVV, or password to anyone, even “for checking.”",
    },
    why: {
      ru: "Код часто подтверждает вход, перевод или привязку устройства. Кто знает код — может получить доступ.",
      uz: "Kod ko'pincha kirish, pul o'tkazma yoki qurilma ulashni tasdiqlaydi. Kodni bilgan odam kirish olishi mumkin.",
      en: "A code often confirms a login, transfer, or device link. Whoever has it may gain access.",
    },
  },
  {
    title: {
      ru: "Просят установить приложение",
      uz: "Ilova o'rnatish so'ralmoqda",
      en: "They ask you to install an app",
    },
    situation: {
      ru: "Вам предлагают установить приложение или файл, чтобы «защитить» счёт или получить помощь.",
      uz: "Hisobni «himoya qilish» yoki yordam olish uchun ilova yoki fayl o'rnatishni taklif qilishadi.",
      en: "You are asked to install an app or file to “protect” an account or get help.",
    },
    options: [
      {
        text: {
          ru: "Ничего не устанавливать и открыть только официальный магазин/сайт",
          uz: "Hech narsa o'rnatmaslik va faqat rasmiy do'kon/saytni ochish",
          en: "Install nothing and use only the official store or website",
        },
        correct: true,
      },
      {
        text: {
          ru: "Установить, но потом удалить",
          uz: "O'rnatib, keyin o'chirib tashlash",
          en: "Install it, then delete it later",
        },
        correct: false,
      },
      {
        text: {
          ru: "Попросить прислать файл ещё раз",
          uz: "Faylni yana yuborishni so'rash",
          en: "Ask them to send the file again",
        },
        correct: false,
      },
    ],
    safeStep: {
      ru: "Безопасный шаг: не ставить APK/файлы из чата и не давать удалённый доступ.",
      uz: "Xavfsiz qadam: chatdan APK/fayllarni o'rnatmaslik va masofaviy kirish bermaslik.",
      en: "Safe step: do not install APKs/files from chats or grant remote access.",
    },
    why: {
      ru: "Файл или удалённый доступ может открыть SMS, уведомления, банк или кошелёк постороннему.",
      uz: "Fayl yoki masofaviy kirish SMS, bildirishnoma, bank yoki hamyonni begona odamga ochishi mumkin.",
      en: "A file or remote access can expose SMS, notifications, banking, or wallet access.",
    },
  },
  {
    title: {
      ru: "QR или ссылка «для отмены»",
      uz: "«Bekor qilish» uchun QR yoki havola",
      en: "QR or link “to cancel”",
    },
    situation: {
      ru: "Вас торопят открыть ссылку или QR, чтобы отменить операцию, вход или перевод.",
      uz: "Operatsiya, kirish yoki o'tkazmani bekor qilish uchun havola yoki QR ochishga shoshirishadi.",
      en: "You are rushed to open a link or QR to cancel an operation, login, or transfer.",
    },
    options: [
      {
        text: {
          ru: "Не открывать; самому зайти в официальный банк/сервис",
          uz: "Ochmaslik; rasmiy bank/servisga o'zim kirish",
          en: "Do not open it; go to the official bank/service yourself",
        },
        correct: true,
      },
      {
        text: {
          ru: "Открыть, но ничего не вводить",
          uz: "Ochib, hech narsa kiritmaslik",
          en: "Open it but type nothing",
        },
        correct: false,
      },
      {
        text: {
          ru: "Попросить прислать QR крупнее",
          uz: "QRni kattaroq yuborishni so'rash",
          en: "Ask them to send a larger QR",
        },
        correct: false,
      },
    ],
    safeStep: {
      ru: "Безопасный шаг: отмены и проверки делать только из официального приложения или сайта, открытого вручную.",
      uz: "Xavfsiz qadam: bekor qilish va tekshirishni faqat qo'lda ochilgan rasmiy ilova yoki sayt orqali qilish.",
      en: "Safe step: cancel or check only inside the official app or site you opened yourself.",
    },
    why: {
      ru: "Ссылка или QR может вести на вход, оплату, перевод или привязку устройства.",
      uz: "Havola yoki QR kirish, to'lov, o'tkazma yoki qurilma ulashga olib borishi mumkin.",
      en: "A link or QR can lead to login, payment, transfer, or device linking.",
    },
  },
];

export type TrainerCallback =
  | { kind: "start" }
  | { kind: "question"; questionId: number; score: number }
  | { kind: "answer"; questionId: number; optionIndex: number; score: number };

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(TRAINER_TOTAL, Math.trunc(score)));
}

function parseIntPart(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

export function trainerQuestionCallback(questionId: number, score = 0): string {
  return `${TRAINER_CB_PREFIX}q:${questionId}:${clampScore(score)}`;
}

export function trainerAnswerCallback(questionId: number, optionIndex: number, score = 0): string {
  return `${TRAINER_CB_PREFIX}a:${questionId}:${optionIndex}:${clampScore(score)}`;
}

export function parseTrainerCallback(data: string): TrainerCallback | null {
  if (data === `${TRAINER_CB_PREFIX}start`) return { kind: "start" };
  if (!data.startsWith(TRAINER_CB_PREFIX)) return null;

  const parts = data.slice(TRAINER_CB_PREFIX.length).split(":");
  if (parts[0] === "q") {
    const questionId = parseIntPart(parts[1]);
    const score = parseIntPart(parts[2]);
    if (questionId === null || score === null || questionId < 1 || questionId > TRAINER_TOTAL) {
      return null;
    }
    return { kind: "question", questionId, score: clampScore(score) };
  }

  if (parts[0] === "a") {
    const questionId = parseIntPart(parts[1]);
    const optionIndex = parseIntPart(parts[2]);
    const score = parseIntPart(parts[3]);
    if (
      questionId === null ||
      optionIndex === null ||
      score === null ||
      questionId < 1 ||
      questionId > TRAINER_TOTAL ||
      optionIndex < 0 ||
      optionIndex > 2
    ) {
      return null;
    }
    return { kind: "answer", questionId, optionIndex, score: clampScore(score) };
  }

  return null;
}

export function buildTrainerIntro(lang: Lang): { text: string; keyboard: InlineKeyboard } {
  const copy = INTRO[lang];
  return {
    text: `${copy.title}\n━━━━━━━━━━━━━━━━━━━━\n\n${copy.body}`,
    keyboard: [
      [{ text: copy.start, callback_data: trainerQuestionCallback(1, 0) }],
      [{ text: copy.safety, callback_data: "safety" }],
    ],
  };
}

export function buildTrainerQuestion(
  questionId: number,
  lang: Lang,
  score = 0,
): { text: string; keyboard: InlineKeyboard } {
  const question = QUESTIONS[questionId - 1] ?? QUESTIONS[0];
  const copy = QUESTION_COPY[lang];
  return {
    text:
      `🎧 ${copy.question} ${questionId}/${TRAINER_TOTAL}\n` +
      "━━━━━━━━━━━━━━━━━━━━\n\n" +
      `${question.title[lang]}\n\n${question.situation[lang]}\n\n${copy.question}`,
    keyboard: question.options.map((option, optionIndex) => [
      {
        text: option.text[lang],
        callback_data: trainerAnswerCallback(questionId, optionIndex, score),
      },
    ]),
  };
}

function buildCompletion(score: number, lang: Lang): { text: string; keyboard: InlineKeyboard } {
  const done = DONE[lang];
  const copy = QUESTION_COPY[lang];
  return {
    text:
      `${done.title}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${copy.score}: ${score}/${TRAINER_TOTAL}\n\n` +
      `${done.good}\n\n${done.practice}`,
    keyboard: [
      [{ text: copy.restart, callback_data: trainerQuestionCallback(1, 0) }],
      [{ text: done.panic, callback_data: "emergency" }],
    ],
  };
}

export function buildTrainerAnswer(
  questionId: number,
  optionIndex: number,
  lang: Lang,
  score = 0,
): { text: string; keyboard: InlineKeyboard } {
  const question = QUESTIONS[questionId - 1] ?? QUESTIONS[0];
  const selected = question.options[optionIndex] ?? question.options[0];
  const copy = QUESTION_COPY[lang];
  const newScore = clampScore(score + (selected.correct ? 1 : 0));
  const result = selected.correct ? copy.right : copy.wrong;
  const text =
    `${result}\n━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${question.safeStep[lang]}\n\n` +
    `${question.why[lang]}\n\n` +
    `${copy.score}: ${newScore}/${TRAINER_TOTAL}`;

  if (questionId >= TRAINER_TOTAL) {
    return {
      text: `${text}\n\n${DONE[lang].title}\n${DONE[lang].good}`,
      keyboard: buildCompletion(newScore, lang).keyboard,
    };
  }

  return {
    text,
    keyboard: [
      [{ text: copy.next, callback_data: trainerQuestionCallback(questionId + 1, newScore) }],
    ],
  };
}

export function buildTrainerCallbackResponse(
  data: string,
  lang: Lang,
): { text: string; keyboard: InlineKeyboard } | null {
  const parsed = parseTrainerCallback(data);
  if (!parsed) return null;
  if (parsed.kind === "start") return buildTrainerIntro(lang);
  if (parsed.kind === "question") {
    return buildTrainerQuestion(parsed.questionId, lang, parsed.score);
  }
  return buildTrainerAnswer(parsed.questionId, parsed.optionIndex, lang, parsed.score);
}
