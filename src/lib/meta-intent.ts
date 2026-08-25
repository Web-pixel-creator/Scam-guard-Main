import type { Lang } from "@/lib/i18n";
import { evaluateText, type ReasonCode } from "@/lib/risk/rules";
import { hasConcreteArtifact } from "@/lib/telegram/concrete-artifact";
import { stripConversationWrappers } from "@/lib/telegram/conversation-wrapper";
import { bt } from "@/lib/telegram/bot-i18n";

export const ALL_META_INTENTS = [
  "how_to_use",
  "what_can_you_do",
  "how_do_you_check",
  "why_failed",
  "explain_risk",
  "telegram_account_limits",
  "can_check_link",
  "can_check_phone",
  "can_check_image",
  "can_check_account",
  "can_check_message",
  "can_check_qr",
  "greeting",
  "off_topic",
  "help",
] as const;

export type MetaIntent = (typeof ALL_META_INTENTS)[number];

export interface ClassifyMetaIntentOptions {
  isForwarded?: boolean;
}

type IntentPattern = {
  intent: MetaIntent;
  patterns: RegExp[];
};

export const CANONICAL_META_PHRASES: ReadonlyArray<{ intent: MetaIntent; text: string }> = [
  { intent: "how_to_use", text: "как пользоваться ботом" },
  { intent: "how_to_use", text: "как отправить скриншот" },
  { intent: "how_to_use", text: "how to use this bot" },
  { intent: "how_to_use", text: "qanday foydalanaman" },
  { intent: "what_can_you_do", text: "что ты умеешь" },
  { intent: "what_can_you_do", text: "какие функции есть" },
  { intent: "what_can_you_do", text: "what can you do" },
  { intent: "what_can_you_do", text: "nima qila olasan" },
  { intent: "how_do_you_check", text: "как проверить номер" },
  { intent: "how_do_you_check", text: "как ты решаешь" },
  { intent: "how_do_you_check", text: "how do you check" },
  { intent: "how_do_you_check", text: "qanday tekshirasan" },
  { intent: "why_failed", text: "почему ты не смог проанализировать картинку" },
  { intent: "why_failed", text: "почему не распознал фото" },
  { intent: "why_failed", text: "why could not analyze the image" },
  { intent: "why_failed", text: "nega rasmni o'qiy olmading" },
  { intent: "explain_risk", text: "почему это опасно" },
  { intent: "explain_risk", text: "почему высокий риск" },
  { intent: "explain_risk", text: "why is it dangerous" },
  { intent: "explain_risk", text: "nega bu xavfli" },
  { intent: "telegram_account_limits", text: "ты видишь scam метку telegram аккаунта" },
  { intent: "telegram_account_limits", text: "можешь узнать возраст аккаунта" },
  { intent: "telegram_account_limits", text: "can you see telegram scam labels" },
  { intent: "telegram_account_limits", text: "telegram akkaunt yoshini bilasanmi" },
  { intent: "can_check_link", text: "а ты можешь проанализировать ссылку" },
  { intent: "can_check_link", text: "can you analyze a link" },
  { intent: "can_check_link", text: "havolani tahlil qila olasanmi" },
  { intent: "can_check_phone", text: "ты можешь проверить номер телефона" },
  { intent: "can_check_phone", text: "can you check a phone number" },
  { intent: "can_check_phone", text: "telefon raqamini tekshira olasizmi" },
  { intent: "can_check_image", text: "ты можешь проверить скриншот" },
  { intent: "can_check_image", text: "can you check a screenshot" },
  { intent: "can_check_image", text: "skrinshotni tekshira olasizmi" },
  { intent: "can_check_account", text: "ты можешь проверить telegram-аккаунт" },
  { intent: "can_check_account", text: "can you check a telegram account" },
  { intent: "can_check_account", text: "telegram akkauntini tekshira olasizmi" },
  { intent: "can_check_message", text: "ты можешь проверить текст сообщения" },
  { intent: "can_check_message", text: "can you check a message" },
  { intent: "can_check_message", text: "xabar matnini tekshira olasizmi" },
  { intent: "can_check_qr", text: "ты можешь проверить qr-код" },
  { intent: "can_check_qr", text: "can you check a qr code" },
  { intent: "can_check_qr", text: "qr-kodni tekshira olasizmi" },
  { intent: "greeting", text: "привет" },
  { intent: "greeting", text: "hello" },
  { intent: "greeting", text: "salom" },
  { intent: "off_topic", text: "какая сегодня погода" },
  { intent: "off_topic", text: "tell me a joke" },
  { intent: "off_topic", text: "menga palov retseptini ayt" },
  { intent: "help", text: "помощь" },
  { intent: "help", text: "help" },
  { intent: "help", text: "yordam" },
] as const;

const URL_RE =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:uz|com|net|org|ru|io|app|site|info|me|online|xyz|top|shop|click|bank)\b)/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;
const TELEGRAM_RE = /(?:t\.me\/|telegram\.me\/|@[a-zA-Z0-9_]{3,})/i;
const APK_RE = /(?:apk|android package|андроид\s*прилож|приложени[ея]|ilova|dastur)/i;
const BANK_PAYMENT_RE =
  /(?:банк|банка|bank|karta|карта|plastik|cvv|cvc|\bpin\b|пин|otp|sms[\s-]?(?:код|kod)|смс[\s-]?код|код\s+из\s+смс|парол[ья]|password|перевод|перевести|деньг|оплат|плат[её]ж|payment|\bpul(?:ni|ga|dan|im(?:ni)?|imiz(?:ni)?|ingiz(?:ni)?|i(?:ni)?|lar(?:ni|ga|dan)?)?\b|to'?lov|o'?tkazma|transfer|payme|click|uzcard|humo|kapitalbank|ipoteka|hamkorbank|xavfsizlik|безопасн)/i;
const LONG_TEXT_LIMIT = 200;

const SCAM_WORDING_PATTERNS: readonly RegExp[] = [
  /безопасн[а-яё]*\s+сч[её]т/i,
  /не\s+кладите\s+трубку/i,
  /не\s+отключайтесь/i,
  /служб[аы]\s+безопасности/i,
  /xavfsiz\s+hisob/i,
  /go['‘’`]?shakni\s+qo['‘’`]?ymang/i,
  /safe\s+account/i,
  /do\s+not\s+hang\s+up/i,
];

const INTENT_PATTERNS: readonly IntentPattern[] = [
  {
    intent: "why_failed",
    patterns: [
      /почему\s+(?:ты\s+)?не\s+смог/i,
      /(?:не\s+смог|не\s+смогла|не\s+получилось)\s+.*(?:проанализ|распозна|прочита|картин|фото|скрин|qr)/i,
      /почему\s+.*(?:картин|фото|скрин|qr)\s+.*(?:не\s+понял|не\s+прочитал|не\s+распознал)/i,
      /почему\s+.*(?:не\s+понял|не\s+прочитал|не\s+распознал)\s+.*(?:картин|фото|скрин|qr)/i,
      /почему\s+.*(?:анализ|распознаван|обработк).*(?:изображен|картин|фото|скрин|qr).*(?:не\s+сработал|не\s+работает|ошибк|сбой)/i,
      /(?:почему|отчего|что).*(?:изображен|картин|фото|скрин|qr).*(?:не\s+анализ|не\s+обработ|не\s+прочит|не\s+распоз|не\s+сработ|не\s+обработал|помешал|ошибк|сбой)/i,
      /(?:почему|что).*(?:помешал|не\s+получил|не\s+смог).*(?:прочита|обработ|проанализ|изображен|картин|фото|скрин|qr)/i,
      /why\s+(?:could(?:n'?t| not|\s+you\s+not)|did(?:n'?t| not))\s+.*(?:analy[sz]e|read|recognize|understand)/i,
      /why\s+(?:can|could)\s+you\s+not\s+.*(?:process|analy[sz]e|read|recognize|understand)/i,
      /why\s+did\s+you\s+not\s+.*(?:process|analy[sz]e|read|recognize|understand)/i,
      /(?:why|what).*(?:image|photo|screenshot|qr).*(?:analysis\s+fail|fail|not\s+(?:process|read|analy[sz]e|recognize)|stopp?ed|prevented|error)/i,
      /(?:why|what).*(?:stopp?ed|prevented).*(?:process|analy[sz]e|read|recognize).*(?:image|photo|screenshot|qr)/i,
      /(?:ocr|image|photo|screenshot|qr)\s+.*(?:failed|not\s+read|not\s+recognized)/i,
      /nega\s+.*(?:rasm[a-z']*|skrinshot[a-z']*|qr)\s+.*(?:o['‘’`]?qiy|tushun|aniqla).*olmad/i,
      /nega\s+.*(?:rasm[a-z']*|skrinshot[a-z']*|qr)\s+.*(?:o['‘’`]?qimad|tekshirmad|tahlil\s+qilmad)/i,
      /(?:rasm[a-z']*|skrinshot[a-z']*|qr)\s+nega\s+.*(?:o['‘’`]?qiy|tushun|aniqla).*olmad/i,
      /nega\s+.*(?:rasm|skrinshot|qr).*(?:tahlil|tekshir|o['‘’`]?qi).*(?:ishlama|xato|olmad)/i,
      /(?:rasm|skrinshot|qr).*(?:tahlil|tekshir).*(?:nega.*(?:ishlama|xato)|xato.*ber)/i,
      /(?:qr[-\s]?kod|rasm|skrinshot|surat).*(?:nima\s+uchun|nega).*(?:tanilmad|ishlamad|xato|olmad)/i,
      /nima\s+uchun.*(?:rasm|skrinshot|surat|qr).*(?:qayta\s+ishla|o['‘’`]?qi|tahlil|tekshir).*(?:olmad|ishlamad|xato)/i,
      /(?:rasm|skrinshot|surat|qr).*(?:o['‘’`]?qish|tahlil|tekshir).*(?:nima\s+)?xalaqit\s+ber/i,
    ],
  },
  {
    intent: "explain_risk",
    patterns: [
      /почему\s+(?:это\s+)?(?:опасно|риск|подозрительно)/i,
      /почему\s+(?:такой|высокий)\s+риск/i,
      /почему\s+(?:такой\s+)?высокий\s+риск/i,
      /объясни\s+(?:риск|результат|оценку)/i,
      /объясни\s+(?:эту\s+)?(?:оценку|результат)/i,
      /почему\s+ты\s+так\s+(?:решил|считаешь)/i,
      /why\s+(?:is\s+)?(?:it|this|the\s+risk)\s+(?:dangerous|risky|suspicious|high)/i,
      /why\s+(?:high\s+)?risk/i,
      /explain\s+(?:(?:the|this)\s+)?(?:risk|check\s+result|result|verdict)/i,
      /why\s+(?:did\s+you\s+decide\s+that|do\s+you\s+think\s+so)/i,
      /nega\s+(?:bu\s+)?xavfli/i,
      /nima\s+uchun\s+(?:xavf|shubha|yuqori)/i,
      /nima\s+uchun\s+(?:bu\s+)?(?:xavfli|shubhali|xavf\s+yuqori)/i,
      /(?:xavfni|natijani).*tushuntir/i,
      /nega.*qaror\s+qildingiz/i,
      /nima\s+uchun.*o'ylaysiz/i,
      /bahoni.*izohla/i,
      /с\s+чего\s+(?:ты|вы)\s+сделал(?:и|а)?\s+такой\s+вывод/i,
      /как\s+(?:ты|вы)\s+приш(?:е|ё)л(?:ли)?\s+к\s+(?:этой|такой)\s+оценке/i,
      /(?:what\s+made\s+you\s+reach|how\s+did\s+you\s+arrive\s+at)\s+(?:that|this|the)\s+(?:conclusion|rating|verdict)/i,
      /what\s+is\s+(?:this|the)\s+verdict\s+based\s+on/i,
      /bu\s+(?:xulosa|baho)ga\s+(?:nimaga\s+asoslanib|qanday)\s+keldingiz/i,
    ],
  },
  {
    intent: "how_do_you_check",
    patterns: [
      /как\s+(?:ты\s+)?(?:проверяешь|решаешь|определяешь|анализируешь)/i,
      /как\s+проверить\s+(?:номер|ссылку|сообщение|telegram|юзер|username)/i,
      /по\s+каким\s+признакам/i,
      /how\s+do\s+you\s+(?:check|determine|decide|detect|analy[sz]e)/i,
      /how\s+to\s+check\s+(?:a\s+)?(?:number|link|message|username)/i,
      /how\s+do\s+i\s+check\s+(?:a\s+)?(?:number|link|message|username)/i,
      /what\s+signs?\s+do\s+you\s+use\s+to\s+decide/i,
      /tell\s+me\s+how\s+you\s+analy[sz]e/i,
      /qanday\s+(?:tekshirasan|aniqlaysan|qaror)/i,
      /qanday\s+tekshirish/i,
      /qanday.{0,70}(?:tekshir|aniqla|qaror|tahlil)/i,
      /какие\s+признаки\s+(?:ты|вы)\s+увидел(?:и)?/i,
      /(?:ты|вы)\s+вообще\s+это\s+проверял(?:и|а)?\s+каким[-\s]+то\s+образом/i,
      /(?:what\s+signs?\s+did\s+you\s+notice|did\s+you\s+actually\s+check\s+it\s+in\s+some\s+way)/i,
      /qaysi\s+belgilarni\s+ko['’]?rdingiz/i,
      /buni\s+biror\s+usul\s+bilan\s+tekshirdingizmi/i,
    ],
  },
  {
    intent: "telegram_account_limits",
    patterns: [
      /(?:видишь|видно|можешь\s+(?:увидеть|узнать|проверить)|покажешь)\s+.*(?:scam|скам|метк[ауи]|жалоб[ыау]?|репорт[ыа]?|спам|возраст|дат[ау]\s+создани[яю])/i,
      /(?:ты|бот|можешь|можно|видно|проверяешь|умеешь)\s+.*(?:telegram|телеграм|аккаунт|акк|юзер|username|профил)\s+.*(?:scam|скам|метк[ауи]|жалоб[ыау]?|репорт[ыа]?|спам|возраст|дат[ау]\s+создани[яю])/i,
      /(?:ты|бот|можешь|можно|видно|проверяешь|умеешь)\s+.*(?:недавно|давно)\s+.*(?:создан|зарегистрирован)\s+.*(?:аккаунт|профил|telegram|телеграм)/i,
      /(?:can|do)\s+you\s+.*(?:see|check|know|detect)\s+.*(?:telegram\s+)?(?:scam\s+label|account\s+age|report\s+count|reports|spam\s+history)/i,
      /(?:telegram\s+)?(?:scam\s+label|account\s+age|report\s+count|spam\s+history)\s+.*(?:visible|available|known|check)/i,
      /(?:telegram|akkaunt|profil)\s+.*(?:scam\s+belgi\w*|yosh\w*|qachon\s+ochilgan|shikoyat\w*|spam)\s+.*(?:bilasanmi|ko['‘’`]?rasanmi|tekshira\s+olasanmi)/i,
      /(?:scam\s+belgi\w*|yosh\w*|shikoyat\w*|spam)\s+.*(?:telegram|akkaunt|profil)\s+.*(?:bilasanmi|ko['‘’`]?rasanmi|tekshira\s+olasanmi)/i,
      /(?=.*(?:telegram|телеграм|аккаунт|профил))(?=.*(?:scam|скам|репорт|жалоб|спам|возраст|создан))(?=.*(?:вид|провер|узна|покаж|количеств))/iu,
      /(?=.*(?:telegram|akkaunt|profil))(?=.*(?:scam|belgi|yosh|qachon|shikoyat|spam|report))(?=.*(?:bil|ko['‘’`]?r|tekshir|ko['‘’`]?rsat|ochilgan))/iu,
      /(?=.*(?:telegram\s+account|telegram\s+profile|account))(?=.*(?:scam\s+label|age|report|spam\s+history|created))(?=.*(?:can\s+you|do\s+you|visible|detect|know|check))/i,
    ],
  },
  {
    intent: "what_can_you_do",
    patterns: [
      /что\s+ты\s+умеешь/i,
      /что\s+(?:можешь|умеет\s+бот)/i,
      /какие\s+(?:функции|возможности)/i,
      /what\s+can\s+you\s+do/i,
      /what\s+do\s+you\s+do/i,
      /your\s+features/i,
      /nima\s+qila\s+olasan/i,
      /bot\s+nima\s+qiladi/i,
      /что\s+вообще\s+умеет\s+(?:этот\s+)?бот/i,
      /what\s+can\s+(?:this|the)\s+bot\s+actually\s+do/i,
      /bu\s+bot\s+umuman\s+nimalar\s+qila\s+oladi/i,
    ],
  },
  {
    intent: "greeting",
    patterns: [
      /^(?:(?:привет(?:ик|ствую)?|здравствуй(?:те)?|хей|доброе\s+утро|добрый\s+день|добрый\s+вечер|салам|ассаламу?\s+алейкум)(?:[!,\s]+(?:бот|ishonch\s+guard|как\s+дела|можно\s+вопрос))?|рад\s+тебя\s+видеть)[?!.]*$/iu,
      /^(?:(?:hello(?:\s+there)?|hi(?:\s+there)?|hey|greetings|good\s+(?:morning|afternoon|evening))(?:[!,\s]+(?:bot|ishonch\s+guard|how\s+are\s+you|may\s+i\s+ask\s+something))?|nice\s+to\s+see\s+you)[?!.]*$/i,
      /^(?:(?:salom|assalomu\s+alaykum|xayrli\s+(?:tong|kun|kech))(?:[!,\s]+(?:bot|do['’]?stim|ishonch\s+guard|qalaysiz|ishlaringiz\s+yaxshimi|savolim\s+bor\s+edi))?|sizni\s+ko'rganimdan\s+xursandman)[?!.]*$/iu,
      /^(?:рад(?:а)?[,.\s]+что\s+наш[её]л(?:а)?\s+(?:этого|этот)\s+бота?|можно\s+сначала\s+просто\s+поздороваться)[?!.]*$/iu,
      /^(?:i\s+am\s+glad\s+i\s+found\s+(?:this|the)\s+bot|can\s+i\s+just\s+say\s+hello\s+first)[?!.]*$/i,
      /^(?:bu\s+botni\s+topganimdan\s+xursandman|avval\s+shunchaki\s+salomlashsam\s+bo['’]?ladimi)[?!.]*$/iu,
    ],
  },
  {
    intent: "off_topic",
    patterns: [
      /^kulgili\s+hikoya\s+o'ylab\s+toping[?!.]*$/iu,
      /^what\s+song\s+is\s+popular\s+now[?!.]*$/i,
      /^(?:(?:какая.*погод|будет.*дожд|сколько.*градус|нужен.*зонт|когда.*жар|какой.*прогноз|сегодня.*холодн|расскажи.*прогноз)|(?:расскажи.*(?:анекдот|смешн.*истори)|посоветуй.*(?:фильм|книг)|какая.*(?:песн|музык).*популяр|давай.*сыграем.*слов|придумай.*смешн.*истори|кто.*(?:выиграл|победил).*матч|какую.*игру.*скачать.*телефон)|(?:помоги.*(?:решить.*уравнен|с\s+домашк)|сколько\s+будет.*(?:плюс|\+)|переведи.*(?:текст|это)|объясни.*фотосинтез|когда.*мировая.*война|напиши.*сочинени|как.*выучить.*таблиц.*умнож|покажи.*код.*python|почему.*небо.*голуб|(?:дай|напиши|подскажи|расскажи).*рецепт|как.*приготовить)).*[?!.]*$/iu,
      /^(?:(?:what(?:'s|\s+is).*weather|will.*rain|what.*temperature|do\s+i\s+need.*umbrella|when.*heat.*end|what.*forecast|is.*colder.*yesterday|tell.*weather.*forecast)|(?:tell.*joke|recommend.*(?:movie|book)|what.*(?:song|music).*popular|let.*play.*word\s+game|make.*funny\s+story|who.*won.*match|what.*game.*install.*phone)|(?:help.*solve.*equation|what\s+is\s+two\s+plus\s+two|translate.*(?:text|this)|explain.*photosynthesis|when.*second\s+world\s+war|write.*essay|how.*learn.*multiplication|show.*python\s+code|why.*sky.*blue|(?:give|tell|show).*recipe|how\s+do\s+i.*(?:cook|make)|do.*homework)).*[?!.]*$/i,
      /^(?:(?:bugun.*ob[-\s]?havo|ertaga.*yomg'ir|hozir.*necha\s+daraja|bugun.*soyabon|issiq.*qachon|dam\s+olish.*ob[-\s]?havo|bugun.*sovuqroq|toshkent.*ob[-\s]?havo)|(?:.*latifa.*ayt|.*film.*tavsiya|.*(?:qo'shiq|musiqa).*mashhur|.*so'z\s+o'yini.*o'yn|.*kulgili\s+hikoya|.*kim.*yutdi|.*kitob.*tavsiya|.*qaysi\s+o'yin.*yukla)|(?:.*tenglama.*yech|.*ikki.*(?:qo['’]?shuv|\+).*ikki|.*matn.*tarjima|.*fotosintez.*tushuntir|.*jahon\s+urushi.*qachon|.*insho.*yoz|.*ko'paytirish\s+jadvali|.*python.*misol|.*osmon.*nega\s+ko'k|.*retsept.*(?:ayt|ber)|.*qanday.*pishir|.*uy\s+vazifa.*bajar|.*masala.*yech)).*[?!.]*$/iu,
    ],
  },
  {
    intent: "how_to_use",
    patterns: [
      /как\s+(?:пользоваться|использовать|начать|отправить)/i,
      /как\s+работает\s+(?:этот\s+)?(?:бот|сервис)/i,
      /что\s+(?:мне\s+)?отправить/i,
      /объясни.*как\s+(?:мне\s+)?начать\s+проверк/i,
      /how\s+to\s+use/i,
      /how\s+do\s+i\s+use/i,
      /how\s+(?:do\s+i\s+start\s+using|can\s+i\s+use)/i,
      /how\s+to\s+send/i,
      /how\s+do\s+i\s+send.*(?:check|review)/i,
      /how\s+does\s+(?:(?:the|this)\s+)?bot\s+work/i,
      /what\s+should\s+i\s+send\s+for\s+a\s+check/i,
      /explain\s+how\s+i\s+should\s+start\s+a\s+check/i,
      /qanday\s+(?:foydalan|ishlat|boshl|yubor|ishla)/i,
      /botdan.*foydalan.*tushuntir/i,
      /nima\s+yuborish/i,
    ],
  },
  {
    intent: "help",
    patterns: [
      /^(?:помощь|help|yordam)$/i,
      /(?:нужна|нужен|нуждаюсь)\s+помощ/i,
      /(?:need|want)\s+help/i,
      /yordam\s+kerak/i,
    ],
  },
];

function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[’‘`]/g, "'")
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .toLocaleLowerCase("ru")
    .trim()
    .replace(/\s+/g, " ");
}

type CapabilityMetaIntent = Extract<
  MetaIntent,
  | "can_check_link"
  | "can_check_phone"
  | "can_check_image"
  | "can_check_account"
  | "can_check_message"
  | "can_check_qr"
>;

const CAPABILITY_FRAME_PATTERNS: readonly RegExp[] = [
  /^(?:(?:а\s+)?(?:ты|вы)\s+)?(?:можешь|можете|сможешь|сможете|умеешь|умеете)(?![\p{L}\p{N}_])\s+(?:[\p{L}\p{N}_-]+\s+){0,5}(?:проверить|проверять|проанализировать|анализировать|посмотреть|смотреть|глянуть|оценить|сканировать)(?![\p{L}\p{N}_])[\s\S]*[?!.]*$/iu,
  /^(?=.*(?:проверить|проверять|проанализировать|анализировать|посмотреть|глянуть|оценить|сканировать)(?![\p{L}\p{N}_]))(?=.*(?:можешь|можете|сможешь|сможете|умеешь|умеете|можно)(?![\p{L}\p{N}_])).+[?!.]*$/iu,
  /^(?=.*(?:проверяешь|проверяете|проверишь|проверите|посмотришь|посмотрите|анализируешь|анализируете|проанализируешь|проанализируете|оценишь|оцените|сканируешь|сканируете|принимаешь|принимаете)(?![\p{L}\p{N}_])).+[?!.]*$/iu,
  /^(?=.*бот\s+умеет(?![\p{L}\p{N}_]))(?=.*(?:проверять|анализировать|просматривать|оценивать|сканировать)(?![\p{L}\p{N}_])).+[?!.]*$/iu,
  /^(?=.*(?:(?:я\s+)?могу|можно)(?![\p{L}\p{N}_]))(?=.*(?:прислать|отправить|скинуть|показать|загрузить|прикрепить|вставить)(?![\p{L}\p{N}_])).+[?!.]*$/iu,
  /^(?=.*(?:прислать|отправить|скинуть|показать|загрузить|прикрепить|вставить)(?![\p{L}\p{N}_])).+\?[?!.]*$/iu,
  /^(?:проверь(?:те)?|проанализируй(?:те)?|посмотри(?:те)?|глянь(?:те)?|оцени(?:те)?)\s+.+[?!.]*$/iu,
  /^(?:can|could|will|would)\s+(?:you|this\s+bot|the\s+bot)\s+(?:check|analy[sz]e|review|inspect|scan|look\s+at|take(?:\s+a\s+look)?\s+at|assess|accept)\b[\s\S]*[?!.]*$/i,
  /^(?:do|does)\s+(?:you|this\s+bot|the\s+bot)\s+(?:check|analy[sz]e|review|inspect|scan|look\s+at|take|accept)\b[\s\S]*[?!.]*$/i,
  /^are\s+you\s+able\s+to\s+(?:check|analy[sz]e|review|inspect|scan|look\s+at|assess)\b[\s\S]*[?!.]*$/i,
  /^are\s+.+\s+something\s+you\s+can\s+(?:check|analy[sz]e|review|inspect|scan|assess)\b[\s\S]*[?!.]*$/i,
  /^(?:can|could|may)\s+i\s+(?:send|show|give|upload|submit|paste|attach)\s+(?:you\s+)?.+[?!.]*$/i,
  /^(?:can|could|may)\s+i\s+ask\s+you\s+to\s+(?:check|analy[sz]e|review|inspect|scan|look\s+at|assess)\s+.+[?!.]*$/i,
  /^(?:do|does)\s+(?:you|this\s+bot|the\s+bot)\s+take\s+.+\s+for\s+(?:analysis|checking|review)[?!.]*$/i,
  /^(?:check|analy[sz]e|review|inspect|scan|look\s+at)\s+.+[?!.]*$/i,
  /^(?=.*(?:tekshirasizmi|tekshirasanmi|tekshira\s+ol(?:asiz|asan)mi|tekshirib\s+(?:berasizmi|berasanmi|bera\s+ol(?:asiz|asan)mi)|tahlil\s+qila\s+ol(?:asiz|asan|adi)mi|ko['’]?rib\s+(?:berasizmi|berasanmi|bera\s+ol(?:asiz|asan)mi)|bahola(?:ysizmi|ysanmi|b\s+bera\s+ol(?:asiz|asan)mi)|(?:yubor|yukla|biriktir|joyla|yoz)sam\s+bo['’]?ladimi|(?:yuborish|yuklash|biriktirish|joylash|yozish)\s+mumkinmi|qabul\s+qilasizmi)).+[?!.]*$/iu,
  /^(?=.*baholay\s+ol(?:asiz|asan)mi).+[?!.]*$/iu,
  /^.+\s+yuborsam,?\s+bo['’]?ladimi[?!.]*$/iu,
  /^(?:.+\s+)?tekshir(?:ing|ib\s+bering)[?!.]*$/iu,
];

const CAPABILITY_OBJECT_PATTERNS: readonly {
  intent: CapabilityMetaIntent;
  patterns: readonly RegExp[];
}[] = [
  { intent: "can_check_qr", patterns: [/(?:qr|куар)(?:[-\s]?(?:код|kod|code))?/iu] },
  {
    intent: "can_check_phone",
    patterns: [
      /номер(?:а|у|ом)?(?:\s+телефона)?/iu,
      /телефонн(?:ый|ые|ого)\s+номер/iu,
      /telefon\s+raqam(?:i|ini)?/iu,
      /\braqam(?:i|ni)?\b/iu,
      /(?:phone\s+)?numbers?/i,
    ],
  },
  {
    intent: "can_check_image",
    patterns: [/скрин(?:шот)?|изображен|картин|фото|skrinshot|rasm|screenshot|image|photo/iu],
  },
  {
    intent: "can_check_account",
    patterns: [
      /telegram[-\s]?(?:аккаунт|профил|akkaunt|account|profile)/iu,
      /(?:аккаунт|профил|akkaunt|profil|account|profile|username|юзер)/iu,
    ],
  },
  {
    intent: "can_check_message",
    patterns: [
      /текст(?:\s+сообщени)?|сообщени|xabar\s+matn|xabar|matn(?:ni)?|message|text|письм/iu,
    ],
  },
  {
    intent: "can_check_link",
    patterns: [
      /ссылк|сайт|веб[-\s]?(?:страниц|адрес)|адрес\s+сайта|домен/iu,
      /havola|sayt(?:ni)?(?:\s+manzil(?:i|ini)?)?|domen/iu,
      /links?|urls?|web(?:site|page|\s+address|\s+page)|domains?/iu,
    ],
  },
];

// A bare "number" is intentionally treated as a phone number because that is
// established bot copy and a common Telegram shorthand.  Once the number is
// explicitly qualified as a card, invoice, order, tracking or account number,
// however, the bot has no matching checker and must not ask for a phone number.
const UNSUPPORTED_CAPABILITY_NUMBER_OBJECT_RE =
  /(?:\b(?:(?:credit|debit)\s+)?card\s+(?:no\.?|numbers?)\b|\b(?:invoice|order|tracking|account)\s+(?:no\.?|numbers?)\b|(?:номер\s+(?:карты|счета|заказа|накладной|отправления|посылки|платежа)|(?:карты|счета|заказа|накладной|отправления|посылки|платежа)\s+номер)|(?:karta|hisob|buyurtma|jo['’]?natma|kuzatuv|to['’]?lov)\s+raqam(?:i|ini)?)/iu;

// can_check_account currently means a Telegram username/profile, not an
// arbitrary account lookup.  Reject clearly different account types instead
// of returning Telegram-specific instructions for a bank, email or social
// account.  An explicit Telegram/username/handle qualifier still wins.
const SUPPORTED_TELEGRAM_ACCOUNT_OBJECT_RE =
  /(?:telegram|телеграм|\btg\b|username|user\s*name|юзер(?:нейм)?|foydalanuvchi\s+nomi|(?:account|profile|user)\s+handle|@\s*(?:username|handle))/iu;
const UNSUPPORTED_CAPABILITY_ACCOUNT_OBJECT_RE =
  /(?:\b(?:bank|email|e-mail|social(?:\s+media)?|facebook|instagram|tiktok|google|apple|microsoft)\s+(?:user\s+)?(?:account|profile)\b|\b(?:account|profile)\s+(?:on|for)\s+(?:facebook|instagram|tiktok|google|apple|microsoft)\b|(?:банковск\p{L}*|почтов\p{L}*|социальн\p{L}*|email|e-mail)\s+(?:аккаунт|профиль)|(?:аккаунт|профиль)\s+(?:банка|почты|email|e-mail|в\s+соцсети)|(?:bank|email|ijtimoiy\s+tarmoq)\s+(?:akkaunt|profil)(?:i|ini)?)/iu;

// These are direct victim-danger signals, not weak topic hints.  They must win
// before meta/off-topic routing so a pasted request for a verification code,
// money, remote access, etc. can never be swallowed by conversational copy.
const META_RISK_OVERRIDE_REASONS = new Set<ReasonCode>([
  "asks_for_otp",
  "asks_for_sms_code",
  "asks_for_card_cvv",
  "asks_for_pin",
  "asks_to_install_apk",
  "asks_to_share_screen",
  "asks_for_money_transfer",
  "asks_to_transfer_to_safe_account",
  "threatens_legal_action",
  "asks_not_to_hang_up",
  "fake_loan_offer",
  "payment_before_service",
  "requests_personal_data",
  "asks_to_scan_qr",
  "relative_in_distress",
  "requests_card_digits",
  "threatens_account_block",
  "fake_delivery_payment",
  "fake_boss_request",
  "malicious_file_bait",
  "fake_captcha_or_voting",
  "wallet_action_urgency",
  "ton_referral_earning_scheme",
  "investment_fast_profit_pitch",
  "romance_investment_pivot",
  "oneid_government_phishing",
  "sim_swap_or_number_transfer",
  "money_mule_recruitment",
  "advance_fee_prize_inheritance",
  "telegram_account_takeover_phishing",
  "dropper_recruitment",
  "authority_coerced_dangerous_act",
  "fake_penalty_points_erasure",
  "threatens_physical_violence",
]);

const META_DIRECT_ACTION_WORDING_PATTERNS: readonly RegExp[] = [
  /(?:оплатите|заплатите|переведите|установите|скачайте)/iu,
  /(?:сообщите|назовите|передайте|пришлите|отправьте).{0,45}(?:код|парол|cvv|cvc|pin|пин|данн|карт)/iu,
  /\b(?:pay|transfer)\b.{0,50}\b(?:money|fee|payment|account|card|verification)\b/iu,
  /\b(?:install|download)\b.{0,50}\b(?:apk|app|application|file|link)\b/iu,
  /\b(?:share|send)\b.{0,45}\b(?:verification\s+code|sms\s+code|otp|password|cvv|cvc|pin|money|card\s+(?:number|details))\b/iu,
  /(?:to['’]?lang|o['’]?tkazing).{0,50}(?:pul|to['’]?lov|hisob|karta)/iu,
  /(?:o['’]?rnating|yuklab\s+oling).{0,50}(?:apk|ilova|dastur|fayl|havola)/iu,
  /(?:yuboring|ayting).{0,45}(?:kod|parol|cvv|cvc|pin|pul|karta)/iu,
];

// A methodology question can contain words such as "bank", "police" and
// "Telegram" in a purely educational sense. Only a concrete first-person
// contact report is a live-risk override here. Each pattern is clause-bounded
// so an earlier educational sentence cannot accidentally supply the subject or
// action for an unrelated sentence.
const META_LIVE_AUTHORITY_CONTACT_PATTERNS: readonly RegExp[] = [
  // RU: first-person marker first, with authority and contact verb in either
  // order afterwards ("мне в Telegram написал банк", "мне звонит полиция").
  /(?<!\p{L})(?:мне|нам)(?!\p{L})(?!\s+(?:кажется|интересно|известно))(?=[^?!.]{0,140}(?:банк|банковск\p{L}*|полици\p{L}*|милици\p{L}*|мвд|рувд|прокуратур\p{L}*|следовател\p{L}*))(?=[^?!.]{0,140}(?:звон\p{L}*|позвон\p{L}*|пиш\p{L}*|напис\p{L}*|сообщени\p{L}*|связ\p{L}*|прислал\p{L}*|отправил\p{L}*))/iu,
  // RU: authority first ("полиция звонит мне", "банк мне написал").
  /(?:банк|банковск\p{L}*|полици\p{L}*|милици\p{L}*|мвд|рувд|прокуратур\p{L}*|следовател\p{L}*)[^?!.]{0,120}(?:(?<!\p{L})(?:мне|нам|меня)(?!\p{L})[^?!.]{0,70}(?:звон\p{L}*|позвон\p{L}*|пиш\p{L}*|напис\p{L}*|сообщени\p{L}*|связ\p{L}*|прислал\p{L}*|отправил\p{L}*)|(?:звон\p{L}*|позвон\p{L}*|пиш\p{L}*|напис\p{L}*|сообщени\p{L}*|связ\p{L}*|прислал\p{L}*|отправил\p{L}*)[^?!.]{0,70}(?<!\p{L})(?:мне|нам|меня)(?!\p{L}))/iu,
  // UZ Latin/Cyrillic: first-person marker first.
  /(?<!\p{L})(?:menga|bizga|meni|менга|бизга|мени)(?!\p{L})(?=[^?!.]{0,140}(?:bank|politsiya|militsiya|iib|iiv|soliq|prokuratur|банк|полици\p{L}*|милици\p{L}*|ииб|иив|солиқ|солик|прокуратур\p{L}*))(?=[^?!.]{0,140}(?:yoz\p{L}*|xabar\p{L}*|bog['’]?lan\p{L}*|qo['’]?ng['’]?iroq\p{L}*|qong['’]?iroq\p{L}*|telefon\p{L}*|ёз\p{L}*|хабар\p{L}*|боғлан\p{L}*|боглан\p{L}*|қўнғироқ\p{L}*|кунгирок\p{L}*|телефон\p{L}*))/iu,
  // UZ Latin/Cyrillic: authority first.
  /(?:bank|politsiya|militsiya|iib|iiv|soliq|prokuratur|банк|полици\p{L}*|милици\p{L}*|ииб|иив|солиқ|солик|прокуратур\p{L}*)[^?!.]{0,120}(?:(?<!\p{L})(?:menga|bizga|meni|менга|бизга|мени)(?!\p{L})[^?!.]{0,70}(?:yoz\p{L}*|xabar\p{L}*|bog['’]?lan\p{L}*|qo['’]?ng['’]?iroq\p{L}*|qong['’]?iroq\p{L}*|telefon\p{L}*|ёз\p{L}*|хабар\p{L}*|боғлан\p{L}*|боглан\p{L}*|қўнғироқ\p{L}*|кунгирок\p{L}*|телефон\p{L}*)|(?:yoz\p{L}*|xabar\p{L}*|bog['’]?lan\p{L}*|qo['’]?ng['’]?iroq\p{L}*|qong['’]?iroq\p{L}*|telefon\p{L}*|ёз\p{L}*|хабар\p{L}*|боғлан\p{L}*|боглан\p{L}*|қўнғироқ\p{L}*|кунгирок\p{L}*|телефон\p{L}*)[^?!.]{0,70}(?<!\p{L})(?:menga|bizga|meni|менга|бизга|мени)(?!\p{L}))/iu,
  // EN: authority first ("my bank messaged me", "the police are calling me").
  /\b(?:(?:my|the)\s+)?(?:bank|banking\s+team|police|law[\s-]?enforcement|prosecutor(?:'s)?\s+office)\b[^?!.]{0,100}(?:wrote|writing|messag\p{L}*|contact\p{L}*|call\p{L}*|text\p{L}*|sent)[^?!.]{0,60}\b(?:me|us)\b/iu,
  // EN: received-call wording ("I received a call from the bank").
  /\b(?:i|we)\s+(?:got|received|answered)[^?!.]{0,45}(?:call|message|text)[^?!.]{0,70}(?:from|claiming\s+to\s+be)[^?!.]{0,35}(?:bank|police|law[\s-]?enforcement|prosecutor)/iu,
];

// Quoted or explicitly referenced wording can be the object of an educational
// methodology question. This must stay narrow: merely appending “safe account”
// to a generic meta phrase is still treated as fresh scam content.
const META_EDUCATIONAL_SCAM_WORDING_RE =
  /(?:фраз\p{L}*.{0,45}безопасн\p{L}*\s+сч[её]т|message.{0,35}(?:mentions?|containing|about).{0,35}safe\s+account|xavfsiz\s+hisob.{0,35}haqidagi\s+xabar)/iu;

const PRIORITY_META_INTENTS = new Set<MetaIntent>([
  "why_failed",
  "explain_risk",
  "how_do_you_check",
  "telegram_account_limits",
]);

function classifyPatternIntent(
  text: string,
  include: (intent: MetaIntent) => boolean,
): MetaIntent | null {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (include(intent) && patterns.some((pattern) => pattern.test(text))) return intent;
  }
  return null;
}

function hasDeterministicRiskOverride(text: string): boolean {
  return (
    META_LIVE_AUTHORITY_CONTACT_PATTERNS.some((pattern) => pattern.test(text)) ||
    (hasScamWordingPattern(text) && !META_EDUCATIONAL_SCAM_WORDING_RE.test(text)) ||
    META_DIRECT_ACTION_WORDING_PATTERNS.some((pattern) => pattern.test(text)) ||
    evaluateText(text).some((reason) => META_RISK_OVERRIDE_REASONS.has(reason))
  );
}

function classifyCapabilityIntent(text: string): CapabilityMetaIntent | null {
  if (!CAPABILITY_FRAME_PATTERNS.some((pattern) => pattern.test(text))) return null;

  if (UNSUPPORTED_CAPABILITY_NUMBER_OBJECT_RE.test(text)) return null;
  if (
    UNSUPPORTED_CAPABILITY_ACCOUNT_OBJECT_RE.test(text) &&
    !SUPPORTED_TELEGRAM_ACCOUNT_OBJECT_RE.test(text)
  ) {
    return null;
  }

  for (const candidate of CAPABILITY_OBJECT_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(text))) return candidate.intent;
  }
  return null;
}

export function hasScamWordingPattern(text: string): boolean {
  return SCAM_WORDING_PATTERNS.some((pattern) => pattern.test(text));
}

export function hasScamContextSignal(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length > LONG_TEXT_LIMIT) return true;
  return (
    hasConcreteArtifact(normalized) ||
    URL_RE.test(normalized) ||
    PHONE_RE.test(normalized) ||
    TELEGRAM_RE.test(normalized) ||
    APK_RE.test(normalized) ||
    BANK_PAYMENT_RE.test(normalized) ||
    hasScamWordingPattern(normalized)
  );
}

export function classifyMetaIntent(
  text: string,
  options: ClassifyMetaIntentOptions = {},
): MetaIntent | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (options.isForwarded) return null;
  if (hasConcreteArtifact(normalized)) return null;
  const conversationalText = stripConversationWrappers(normalized);
  if (!conversationalText) return null;
  if (hasDeterministicRiskOverride(normalized)) return null;
  const hasBroadScamContext = hasScamContextSignal(normalized);

  // Methodology and Telegram-data-limit questions are more specific than a
  // generic capability frame ("How do you analyze a message?", "Can you see
  // an account's spam history?"). A concrete scam-context signal still wins,
  // so appending a phone, SMS code, payment demand, etc. cannot be hidden in a
  // methodology question.
  const priorityIntent = classifyPatternIntent(conversationalText, (intent) =>
    PRIORITY_META_INTENTS.has(intent),
  );
  if (priorityIntent) return priorityIntent;

  // A strict capability question without a concrete value is safe to answer
  // even when the object is described as a bank/payment/APK link.  Broad topic
  // words below must not turn it into an empty risk check.
  const capabilityIntent = classifyCapabilityIntent(conversationalText);
  if (capabilityIntent) return capabilityIntent;
  if (hasBroadScamContext) return null;

  return classifyPatternIntent(conversationalText, (intent) => !PRIORITY_META_INTENTS.has(intent));
}

export function getMetaIntentResponse(intent: MetaIntent, lang: Lang): string {
  return bt(`meta_${intent}`, lang);
}
