// Permanent offline-only discovery gate for emerging scam phrasing.
//
// These probes are intentionally independent from the generated adversarial
// corpus. They exercise novel wording, action stages, one-edit typos,
// cross-script confusables, zero-width characters, and multiline forwarding in
// Russian, Uzbek Latin, Uzbek Cyrillic, and English. All external boundaries
// are mocked: this file must never call Telegram, Supabase, AI, or the network.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  answers: [] as Array<{ inlineQueryId: string; results: unknown[] }>,
  sent: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  runCheckInputs: [] as Array<Record<string, unknown>>,
  sessionWrites: [] as Array<{ userId: number; patch: unknown }>,
  dbMutations: [] as Array<{ table: string; operation: string }>,
  localRunChecks: 0,
  networkAttempts: 0,
}));

vi.mock("@/lib/telegram/api.server", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    answerInlineQuery: async (options: { inlineQueryId: string; results: unknown[] }) => {
      h.answers.push(options);
      return { ok: true as const };
    },
    sendMessage: async (options: { chatId: number; text: string; keyboard?: unknown }) => {
      h.sent.push(options);
      return { ok: true as const };
    },
    sendChatAction: async () => ({ ok: true as const }),
    getFile: async () => null,
    downloadFileAsDataUrl: async () => null,
  };
});

vi.mock("@/lib/risk/check-core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/risk/check-core")>();
  return {
    ...actual,
    runCheck: async (options: Record<string, unknown>) => {
      h.runCheckInputs.push(options);
      h.localRunChecks += 1;
      return actual.runCheck({
        ...(options as unknown as Parameters<typeof actual.runCheck>[0]),
        skipAi: true,
        skipUrlReputation: true,
        persist: false,
      });
    },
  };
});

vi.mock("@/integrations/supabase/client.server", () => {
  type Builder = Record<string, (...args: unknown[]) => unknown>;
  function builder(table: string): Builder {
    const value: Builder = {};
    for (const method of ["select", "eq", "gte", "gt", "in", "limit", "order", "not", "is"]) {
      value[method] = () => value;
    }
    value.maybeSingle = async () => ({ data: null, error: null });
    value.single = async () => ({ data: null, error: null });
    value.insert = async () => {
      h.dbMutations.push({ table, operation: "insert" });
      return { data: null, error: null };
    };
    value.upsert = async () => {
      h.dbMutations.push({ table, operation: "upsert" });
      return { data: null, error: null };
    };
    value.update = () => {
      h.dbMutations.push({ table, operation: "update" });
      return value;
    };
    value.delete = () => {
      h.dbMutations.push({ table, operation: "delete" });
      return value;
    };
    return value;
  }

  return {
    supabaseAdmin: {
      from: (table: string) => builder(table),
      rpc: async (name: string) => {
        if (name === "claim_rate_limit") {
          return {
            data: [{ allowed: true, remaining: 99, retry_after_sec: 0, current_count: 1 }],
            error: null,
          };
        }
        return { data: null, error: null };
      },
    },
  };
});

vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: async (userId: number, patch: unknown) => {
    h.sessionWrites.push({ userId, patch });
    return { ok: true as const };
  },
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...(data ?? {}), chatScope: { chatId, chatType } }),
}));

vi.mock("@/lib/telegram/family-shield.server", () => ({
  notifyTrustedContact: async () => ({ ok: false as const, reason: "not_linked" as const }),
}));
vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: async () => null,
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));
vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: async (_input: string, result: unknown) => result,
}));
vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: async (_input: string, result: unknown) => result,
}));

import type { Lang } from "@/lib/i18n";
import type { ReasonCode } from "@/lib/risk/rules";
import type { Session } from "@/lib/telegram/session.server";
import type {
  VictimIntentKind,
  VictimIntentMatch,
  VictimScenario,
} from "@/lib/telegram/victim-intent";

let evaluateText: typeof import("@/lib/risk/rules").evaluateText;
let scoreFromCodes: typeof import("@/lib/risk/rules").scoreFromCodes;
let reasonTrustImpact: typeof import("@/lib/risk/rules").REASON_TRUST_IMPACT;
let handleCheck: typeof import("@/lib/telegram/handlers/check").handleCheck;
let handleInlineQuery: typeof import("@/lib/telegram/handlers/inline").handleInlineQuery;
let resolveInlineQueryLanguage: typeof import("@/lib/telegram/inline-query-language").resolveInlineQueryLanguage;
let classifyVictimIntent: typeof import("@/lib/telegram/victim-intent").classifyVictimIntent;
let corpusQueries: Set<string>;

beforeAll(async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      h.networkAttempts += 1;
      throw new Error("Novel probe harness blocks every network request");
    }),
  );

  const [riskModule, corpusModule, directModule, inlineModule, languageModule, victimModule] =
    await Promise.all([
      import("@/lib/risk/rules"),
      import("@/lib/telegram/adversarial-human-scenario-corpus"),
      import("@/lib/telegram/handlers/check"),
      import("@/lib/telegram/handlers/inline"),
      import("@/lib/telegram/inline-query-language"),
      import("@/lib/telegram/victim-intent"),
    ]);
  evaluateText = riskModule.evaluateText;
  scoreFromCodes = riskModule.scoreFromCodes;
  reasonTrustImpact = riskModule.REASON_TRUST_IMPACT;
  handleCheck = directModule.handleCheck;
  handleInlineQuery = inlineModule.handleInlineQuery;
  resolveInlineQueryLanguage = languageModule.resolveInlineQueryLanguage;
  classifyVictimIntent = victimModule.classifyVictimIntent;
  corpusQueries = new Set(corpusModule.ADVERSARIAL_HUMAN_SCENARIO_CORPUS.map(({ query }) => query));
});

afterAll(() => {
  expect(h.networkAttempts, "offline-only probe boundary").toBe(0);
  vi.unstubAllGlobals();
});

type ProbeLanguage = "ru" | "uzl" | "uzc" | "en";
type ProbeStage = "pre" | "live" | "after" | "typo" | "confusable" | "zero-multiline";
type ProbeFamily = "mistaken" | "authority" | "neighbor" | "fineapk" | "penalty" | "prize";

interface FamilyContract {
  kind?: VictimIntentKind;
  scenario?: VictimScenario;
  reasons: readonly ReasonCode[];
  afterReasonAlternatives?: readonly ReasonCode[];
  inline: string;
  afterInlineAlternatives?: readonly string[];
  afterDirectAlternatives?: readonly {
    kind: VictimIntentKind;
    scenario?: VictimScenario;
  }[];
}

const CONTRACTS: Record<ProbeFamily, FamilyContract> = {
  mistaken: {
    kind: "accidental_transfer_outgoing",
    reasons: [],
    inline: "check-unknown-mistaken-transfer",
    // A completed-payment rescue route may outrank neutral recall guidance,
    // but only for the explicit after-action probe.
    afterDirectAlternatives: [{ kind: "transfer_request", scenario: "money_already_sent" }],
    afterInlineAlternatives: ["check-unknown-sent-money"],
  },
  authority: {
    scenario: "authority_physical_coercion",
    reasons: ["authority_coerced_dangerous_act"],
    inline: "check-unknown-dangerous-task",
  },
  neighbor: {
    scenario: "neighbor_video_malware",
    reasons: ["malicious_file_bait"],
    inline: "check-unknown-neighbor-video",
    afterDirectAlternatives: [{ kind: "apk_request", scenario: "apk_already_installed" }],
    afterInlineAlternatives: ["check-unknown-malicious-file"],
  },
  fineapk: {
    scenario: "fake_fine_cashback_app",
    reasons: ["asks_to_install_apk", "malicious_file_bait"],
    afterReasonAlternatives: ["asks_to_install_apk", "malicious_file_bait"],
    inline: "check-unknown-fake-fine-apk",
    afterDirectAlternatives: [{ kind: "apk_request", scenario: "apk_already_installed" }],
    afterInlineAlternatives: ["check-unknown-malicious-file", "check-unknown-app-request"],
  },
  penalty: {
    scenario: "penalty_points_cancellation",
    reasons: ["fake_penalty_points_erasure"],
    inline: "check-unknown-penalty-points-fee",
    afterDirectAlternatives: [{ kind: "transfer_request", scenario: "money_already_sent" }],
    afterInlineAlternatives: ["check-unknown-sent-money"],
  },
  prize: {
    scenario: "known_contact_prize_link",
    reasons: ["giveaway_engagement_bait"],
    inline: "check-unknown-known-contact-prize",
  },
};

// This oracle is intentionally scheme-specific. A generic red badge or the
// words "risk / опасно / xavf" cannot satisfy it by themselves.
const DIRECT_TOPIC: Readonly<Record<ProbeFamily, RegExp>> = Object.freeze({
  mistaken:
    /(?:ошиб\p{L}*\s+(?:перевод|получател|адресат)|не\s+тому\s+(?:получател|человек)|xato\s+(?:o['’]?tkaz|oluv|hisob)|adash\p{L}*\s+(?:oluv|odam|karta)|noto['’]?g['’]?ri\s+(?:hisob|oluv)|wrong\s+(?:recipient|account|person)|mistaken\s+transfer|bank\s+(?:recall|dispute))/iu,
  authority:
    /(?:опасн\p{L}*\s+(?:задан|действ|требован)|подж|повред|перерез|рюкзак|коробк|102|xavfli\s+(?:topshiriq|harakat)|kabel|paket|quti|102|dangerous\s+(?:task|act|demand)|cut\s+(?:a\s+)?(?:security[- ]?)?camera|backpack|box|emergency)/iu,
  neighbor:
    /(?:видео\s+от\s+сосед|сосед\p{L}*.{0,50}(?:видео|архив|файл)|камер\p{L}*.{0,50}(?:архив|файл|просмотр)|qo['’]?shni\p{L}*.{0,50}(?:video|arxiv|fayl)|kamera\p{L}*.{0,50}(?:arxiv|fayl|ilova)|neighbor.{0,50}(?:video|archive|file|viewer)|camera.{0,50}(?:archive|file|viewer))/iu,
  fineapk:
    /(?=[\s\S]*(?:штраф|jarima|fine))(?=[\s\S]*(?:road24|apk|вредонос|zararli|malicious|прилож|ilova|app))/iu,
  penalty:
    /(?:штрафн\p{L}*\s+балл|балл\p{L}*\s+(?:обнул|аннулир|удал|спис)|jarima\s+ball|ball\p{L}*\s+(?:nol|bekor|o['’]?chir)|penalty\s+point|points?\s+(?:erase|clear|delete|cancel|remove|reset))/iu,
  prize:
    /(?=[\s\S]*(?:знаком|друг|приятел|аккаунт|tanish|do['’]?st|akkaunt|friend|contact|account))(?=[\s\S]*(?:банк|bank|подар|приз|совг|sovg['’]?a|yutuq|mukofot|gift|prize|reward))/iu,
});

const DIRECT_SAFETY: Readonly<Record<Lang, RegExp>> = Object.freeze({
  ru: /(?:не\s+(?:звон|откры|устанав|плат|перевод|выполня|идите|несите)|останов|позвон|обратит|заблок|проверь|102)/iu,
  uz: /(?:qilmang|ochmang|o['’]?rnatmang|to['’]?lamang|o['’]?tkazmang|bajarmang|bormang|to['’]?xtang|qo['’]?ng['’]?iroq|murojaat\s+qiling|saqlang|bloklang|tekshiring|102)/iu,
  en: /(?:do not|don['’]?t|stop|call|contact|block|verify|report|emergency)/iu,
});

const COMPLETED_PAYMENT_AFTERCARE_TOPIC: Readonly<Record<Lang, RegExp>> = Object.freeze({
  ru: /(?=[\s\S]*(?:банк|плат[её]ж|перевод))(?=[\s\S]*(?:замороз|останов|чек|доказател|не\s+перевод|не\s+отправ))/iu,
  uz: /(?=[\s\S]*(?:bank|to['’]?lov|o['’]?tkaz))(?=[\s\S]*(?:muzlat|to['’]?xtat|chek|dalil|qayta\s+pul\s+yubormang))/iu,
  en: /(?=[\s\S]*(?:bank|payment|transfer))(?=[\s\S]*(?:freeze|stop|receipt|evidence|do\s+not\s+send|don['’]?t\s+send))/iu,
});

interface ProbeSeed {
  family: ProbeFamily;
  language: ProbeLanguage;
  profileLang: Lang;
  anchor: string;
  pre: string;
  live: string;
  after: string;
  safe: string;
}

const SEEDS: readonly ProbeSeed[] = [
  {
    family: "mistaken",
    language: "ru",
    profileLang: "uz",
    anchor: "перевёл",
    pre: "Я сам перевёл оплату на чужую карту, перепутав адресата. Можно отозвать операцию через мой банк?",
    live: "Только сейчас увидел: я отправил деньги другому получателю по ошибке. Куда звонить, пока перевод обрабатывается?",
    after:
      "Платёж уже исполнился, я ошибся получателем и никому не сообщал коды. Как начать возврат через свой банк?",
    safe: "Я сделал запланированный перевод знакомому поставщику по официальному счёту; получатель и сумма подтверждены.",
  },
  {
    family: "authority",
    language: "ru",
    profileLang: "uz",
    anchor: "следователь",
    pre: "Мне пишет следователь: если я не оставлю рюкзак у вокзала, меня арестуют.",
    live: "Якобы сотрудник МВД сейчас приказывает мне перерезать кабель камеры, иначе заведёт уголовное дело.",
    after:
      "Человек из прокуратуры заставил меня отнести коробку к школе и велел молчать; я остановился и не подошёл.",
    safe: "В памятке полиции сказано: никогда не переносите чужие пакеты и не повреждайте оборудование.",
  },
  {
    family: "neighbor",
    language: "ru",
    profileLang: "uz",
    anchor: "жилец",
    pre: "Жилец нашего дома внезапно скинул архив: говорит, внутри ролик с дворовой камеры, надо открыть.",
    live: "Знакомая торопит скачать отдельный файл с записью домофона и поставить кодек для просмотра.",
    after:
      "Я нажал на вложение «видео от соседа», теперь оно просит установить проигрыватель. Что делать?",
    safe: "Сосед отправил обычный видеокружок прямо в Telegram; ссылок, архивов и приложений нет.",
  },
  {
    family: "fineapk",
    language: "ru",
    profileLang: "uz",
    anchor: "ROAD24",
    pre: "В чате предлагают оплатить дорожный штраф через ROAD24.apk со стопроцентным кешбэком и просят загрузить файл.",
    live: "Мне сейчас шлют ROAD24 APK ради оплаты штрафа: обещают вернуть 100 процентов и торопят установить.",
    after:
      "Я уже скачал ROAD24.apk для штрафа с кешбэком, но ещё не давал доступ к SMS. Как удалить?",
    safe: "Штраф оплачен мной в официальном банковском приложении из магазина; APK в сообщениях не было.",
  },
  {
    family: "penalty",
    language: "ru",
    profileLang: "uz",
    anchor: "штрафные",
    pre: "Посредник обещает за деньги списать мои штрафные баллы и просит оплату на личный счёт.",
    live: "Человек со «связями» в ГАИ прямо сейчас предлагает аннулировать дорожные баллы за комиссию.",
    after: "Я уже перевёл аванс тому, кто обещал убрать штрафные баллы; теперь он просит доплату.",
    safe: "Хочу бесплатно проверить штрафные баллы и подать официальную жалобу через госпортал.",
  },
  {
    family: "prize",
    language: "ru",
    profileLang: "uz",
    anchor: "приятель",
    pre: "Приятель переслал банковский подарок: говорит, что уже забрал деньги, и зовёт нажать ссылку.",
    live: "Знакомая сейчас торопит получить денежный приз банка по кнопке и утверждает, что сама уже получила.",
    after:
      "Я открыл ссылку на банковский розыгрыш от друга, но данные не вводил. Как проверить его аккаунт?",
    safe: "На официальном сайте банка опубликованы победители; я сам открыл сайт из закладки, сообщений от друзей нет.",
  },
  {
    family: "mistaken",
    language: "uzl",
    profileLang: "en",
    anchor: "o'tkazdim",
    pre: "Men pulni xato qilib begona oluvchiga o'tkazdim. Bank orqali o'tkazmani qaytara olamanmi?",
    live: "Hozir bildim: o'zim boshqa odamning kartasiga pul yubordim, qabul qiluvchini adashtirdim.",
    after:
      "To'lov o'tib bo'ldi, noto'g'ri hisobga jo'natganman. Bankimda bekor qilishni qanday boshlayman?",
    safe: "Rejalashtirilgan to'lovni tanish yetkazib beruvchiga rasmiy hisob bo'yicha yubordim; oluvchi va summa to'g'ri.",
  },
  {
    family: "authority",
    language: "uzl",
    profileLang: "en",
    anchor: "soliqchi",
    pre: "Soliqchi deb tanishtirgan odam: paketni bekatga olib bormasam qamashini aytyapti.",
    live: "IIBdanman degan kishi hozir kamera kabelini buzishimni buyurib, aks holda jinoiy ish bilan qo'rqityapti.",
    after:
      "Prokuraturadanmiz deganlar qutini maktab yoniga qoldirishga majburladi; men hali bormadim.",
    safe: "Ogohlantirish maqolasida bunday xavfli topshiriqlarni bajarmang va 102 ga qo'ng'iroq qiling deyilgan.",
  },
  {
    family: "neighbor",
    language: "uzl",
    profileLang: "en",
    anchor: "qo'shnim",
    pre: "Qo'shnim hovli kamerasi yozuvi deb arxiv yubordi va uni ochishimni aytyapti.",
    live: "Tanishim kirishdagi video uchun alohida faylni yuklab, player o'rnatishga shoshiryapti.",
    after: "Men qo'shni yuborgan video faylni bosdim, endi noma'lum ilova o'rnatishni so'rayapti.",
    safe: "Qo'shnim Telegram ichida oddiy video xabar yubordi, hech qanday havola yoki fayl yo'q.",
  },
  {
    family: "fineapk",
    language: "uzl",
    profileLang: "en",
    anchor: "ROAD24",
    pre: "Jarimani to'lash uchun ROAD24.apk yuborishdi, 100 foiz cashback va'da qilib o'rnat deyishmoqda.",
    live: "Hozir ROAD24 APKni yuklasam jarima pulini to'liq qaytaramiz deb shoshirishyapti.",
    after: "ROAD24.apkni cashbackli jarima to'lovi uchun ochdim, ammo SMS ruxsatini bermadim.",
    safe: "Jarimani bankning rasmiy ilovasida to'ladim; APK fayl kelmadi va hech narsa yuklamadim.",
  },
  {
    family: "penalty",
    language: "uzl",
    profileLang: "en",
    anchor: "jarima",
    pre: "Vositachi pul evaziga jarima ballarimni o'chirishni va shaxsiy kartasiga to'lashni taklif qildi.",
    live: "YHXBda odami bor kishi hozir yo'l qoidasi ballarini nolga qilish uchun haq so'rayapti.",
    after: "Ballarni bekor qilaman degan odamga pul o'tkazdim, endi yana komissiya talab qilyapti.",
    safe: "Jarima ballarini rasmiy portalda bepul tekshirib, qonuniy shikoyat bermoqchiman.",
  },
  {
    family: "prize",
    language: "uzl",
    profileLang: "en",
    anchor: "tanishim",
    pre: "Tanishim bank sovg'asini oldim deb, menga ham pul mukofot havolasini bosishni aytdi.",
    live: "Do'stim hozir bank yutug'ini link orqali olib qolishimga shoshiryapti, o'zi olganini yozdi.",
    after: "Bank sovg'asi haqidagi tanish yuborgan havolani ochdim, lekin ma'lumot kiritmadim.",
    safe: "Bankning rasmiy saytida g'oliblar e'lon qilingan; men saytni xatcho'pdan o'zim ochdim.",
  },
  {
    family: "mistaken",
    language: "uzc",
    profileLang: "en",
    anchor: "ўтказдим",
    pre: "Мен пулни хато қилиб бегона олувчига ўтказдим. Банк орқали ўтказмани қайтарсам бўладими?",
    live: "Ҳозир билдим: ўзим бошқа одамнинг картасига пул юбордим, қабул қилувчини адаштирдим.",
    after:
      "Тўлов ўтиб бўлди, нотўғри ҳисобга жўнатганман. Банкимда бекор қилишни қандай бошлайман?",
    safe: "Режалаштирилган тўловни таниш етказиб берувчига расмий ҳисоб бўйича юбордим; олувчи ва сумма тўғри.",
  },
  {
    family: "authority",
    language: "uzc",
    profileLang: "en",
    anchor: "солиқчи",
    pre: "Солиқчи деб таништирган одам: пакетни бекатга олиб бормасам қамашини айтяпти.",
    live: "ИИБданман деган киши ҳозир камера кабелини бузишимни буюриб, акс ҳолда жиноий иш билан қўрқитяпти.",
    after:
      "Прокуратураданмиз деганлар қутини мактаб ёнига қолдиришга мажбурлади; мен ҳали бормадим.",
    safe: "Огоҳлантириш мақоласида бундай хавфли топшириқларни бажарманг ва 102 га қўнғироқ қилинг дейилган.",
  },
  {
    family: "neighbor",
    language: "uzc",
    profileLang: "en",
    anchor: "қўшним",
    pre: "Қўшним ҳовли камераси ёзуви деб архив юборди ва уни очишимни айтяпти.",
    live: "Танишим киришдаги видео учун алоҳида файлни юклаб, плеер ўрнатишга шоширяпти.",
    after: "Мен қўшни юборган видео файлни босдим, энди номаълум илова ўрнатишни сўраяпти.",
    safe: "Қўшним Телеграм ичида оддий видео хабар юборди, ҳеч қандай ҳавола ёки файл йўқ.",
  },
  {
    family: "fineapk",
    language: "uzc",
    profileLang: "en",
    anchor: "ROAD24",
    pre: "Жаримани тўлаш учун ROAD24.apk юборишди, 100 фоиз cashback ваъда қилиб ўрнат дейишмоқда.",
    live: "Ҳозир ROAD24 APKни юкласам жарима пулини тўлиқ қайтарамиз деб шоширишяпти.",
    after: "ROAD24.apkни cashbackли жарима тўлови учун очдим, аммо SMS рухсатини бермадим.",
    safe: "Жаримани банкнинг расмий иловасида тўладим; APK файл келмади ва ҳеч нарса юкламадим.",
  },
  {
    family: "penalty",
    language: "uzc",
    profileLang: "en",
    anchor: "жарима",
    pre: "Воситачи пул эвазига жарима балларимни ўчиришни ва шахсий картасига тўлашни таклиф қилди.",
    live: "ЙҲХБда одами бор киши ҳозир йўл қоидаси балларини нолга қилиш учун ҳақ сўраяпти.",
    after: "Балларни бекор қиламан деган одамга пул ўтказдим, энди яна комиссия талаб қиляпти.",
    safe: "Жарима балларини расмий порталда бепул текшириб, қонуний шикоят бермоқчиман.",
  },
  {
    family: "prize",
    language: "uzc",
    profileLang: "en",
    anchor: "танишим",
    pre: "Танишим банк совғасини олдим деб, менга ҳам пул мукофот ҳаволасини босишни айтди.",
    live: "Дўстим ҳозир банк ютуғини линк орқали олиб қолишимга шоширяпти, ўзи олганини ёзди.",
    after: "Банк совғаси ҳақидаги таниш юборган ҳаволани очдим, лекин маълумот киритмадим.",
    safe: "Банкнинг расмий сайтида ғолиблар эълон қилинган; мен сайтни хатчўпдан ўзим очдим.",
  },
  {
    family: "mistaken",
    language: "en",
    profileLang: "ru",
    anchor: "transferred",
    pre: "I transferred the payment to an unrelated recipient by mistake. Can my own bank recall it?",
    live: "I have just noticed that I sent the funds to a different card number accidentally. Who should I call now?",
    after:
      "The payment already settled to the wrong account; I shared no codes. How do I start a bank dispute?",
    safe: "I made the planned transfer to a known supplier against its official invoice; the recipient and amount are confirmed.",
  },
  {
    family: "authority",
    language: "en",
    profileLang: "ru",
    anchor: "investigator",
    pre: "An investigator says I will be arrested unless I leave a backpack at the railway station.",
    live: "A supposed police officer is ordering me to cut a security-camera cable now or face a criminal case.",
    after:
      "Someone claiming to be a prosecutor forced me to carry a box to a school and keep it secret; I stopped.",
    safe: "A police safety notice says never carry unknown packages or damage equipment; call emergency services.",
  },
  {
    family: "neighbor",
    language: "en",
    profileLang: "ru",
    anchor: "resident",
    pre: "A resident of my building unexpectedly sent an archive, calling it courtyard-camera footage, and says to open it.",
    live: "Someone I know is rushing me to download a separate doorbell recording and install a codec.",
    after:
      "I clicked the attachment labelled neighbor video; it now wants a separate viewer installed. What next?",
    safe: "My neighbor sent a normal native Telegram video message with no link, archive, or extra application.",
  },
  {
    family: "fineapk",
    language: "en",
    profileLang: "ru",
    anchor: "ROAD24",
    pre: "A chat sent ROAD24.apk for a traffic fine, promising one hundred percent cashback if I install the file.",
    live: "They are pushing me now to download the ROAD24 APK to pay a fine and refund the full amount.",
    after:
      "I opened ROAD24.apk for a cashback fine payment but have not granted SMS access. How do I remove it?",
    safe: "I paid the fine in the official bank app found in the store; no APK or chat attachment was involved.",
  },
  {
    family: "penalty",
    language: "en",
    profileLang: "ru",
    anchor: "penalty",
    pre: "An intermediary offers to erase my driving penalty points for money paid to a personal account.",
    live: "A fixer with an inside traffic-police contact wants a fee right now to reset my violation points.",
    after:
      "I paid a deposit to someone who promised to clear the penalty points; now they demand another fee.",
    safe: "I want a free official check of my penalty points and to file a lawful appeal on the government portal.",
  },
  {
    family: "prize",
    language: "en",
    profileLang: "ru",
    anchor: "colleague",
    pre: "A colleague forwarded a bank cash gift, says she already claimed hers, and wants me to click the link.",
    live: "A friend is rushing me to claim a bank reward through a button and insists he has already received it.",
    after:
      "I opened the bank-giveaway link sent by someone I know but entered no data. How can I verify the account?",
    safe: "The bank published winners on its official site, which I opened from my own bookmark; no friend messaged me.",
  },
] as const;

const CONFUSABLES = new Map<string, string>([
  ["а", "a"],
  ["е", "e"],
  ["о", "o"],
  ["р", "p"],
  ["с", "c"],
  ["х", "x"],
  ["и", "i"],
  ["a", "а"],
  ["e", "е"],
  ["o", "о"],
  ["p", "р"],
  ["c", "с"],
  ["x", "х"],
  ["i", "і"],
]);

function anchorIndex(text: string, anchor: string): number {
  return text.toLocaleLowerCase().indexOf(anchor.toLocaleLowerCase());
}

function typoVariant(text: string, anchor: string): string {
  const index = anchorIndex(text, anchor);
  if (index < 0) throw new Error(`Missing probe anchor: ${anchor}`);
  const removal = index + Math.max(1, Math.floor(anchor.length / 2));
  return text.slice(0, removal) + text.slice(removal + 1);
}

function confusableVariant(text: string, anchor: string): string {
  const index = anchorIndex(text, anchor);
  if (index < 0) throw new Error(`Missing probe anchor: ${anchor}`);
  for (let cursor = index; cursor < index + anchor.length; cursor += 1) {
    const replacement = CONFUSABLES.get(text[cursor].toLocaleLowerCase());
    if (replacement) return text.slice(0, cursor) + replacement + text.slice(cursor + 1);
  }
  throw new Error(`No confusable character in probe anchor: ${anchor}`);
}

const FORWARDED_COPY: Record<ProbeLanguage, { prefix: string; suffix: string }> = {
  ru: { prefix: "Пересланное сообщение", suffix: "Можно этому доверять?" },
  uzl: { prefix: "Yuborilgan xabar", suffix: "Bunga ishonsa bo'ladimi?" },
  uzc: { prefix: "Юборилган хабар", suffix: "Бунга ишонса бўладими?" },
  en: { prefix: "Forwarded message", suffix: "Can this be trusted?" },
};

function zeroWidthMultilineVariant(seed: ProbeSeed): string {
  const index = anchorIndex(seed.pre, seed.anchor);
  if (index < 0) throw new Error(`Missing probe anchor: ${seed.anchor}`);
  const insertion = index + Math.min(2, seed.anchor.length - 1);
  const copy = FORWARDED_COPY[seed.language];
  return `${copy.prefix}:\n${seed.pre.slice(0, insertion)}\u200d${seed.pre.slice(insertion)}\n${copy.suffix}`;
}

interface DangerProbe extends ProbeSeed {
  id: string;
  stage: ProbeStage;
  text: string;
  provenance: "authored-phrase" | "generated-mutation";
}

interface SafeProbe extends ProbeSeed {
  id: string;
  stage: "safe-negative";
  text: string;
  provenance: "authored-phrase";
}

const DANGER_PROBES: readonly DangerProbe[] = SEEDS.flatMap((seed) =>
  [
    { stage: "pre", text: seed.pre },
    { stage: "live", text: seed.live },
    { stage: "after", text: seed.after },
    { stage: "typo", text: typoVariant(seed.pre, seed.anchor) },
    { stage: "confusable", text: confusableVariant(seed.pre, seed.anchor) },
    { stage: "zero-multiline", text: zeroWidthMultilineVariant(seed) },
  ].map(({ stage, text }) => ({
    ...seed,
    id: `${seed.language}-${seed.family}-${stage}`,
    stage: stage as ProbeStage,
    text,
    provenance: ["pre", "live", "after"].includes(stage)
      ? ("authored-phrase" as const)
      : ("generated-mutation" as const),
  })),
);

const SAFE_PROBES: readonly SafeProbe[] = SEEDS.map((seed) => ({
  ...seed,
  id: `${seed.language}-${seed.family}-safe-negative`,
  stage: "safe-negative",
  text: seed.safe,
  provenance: "authored-phrase",
}));

const BENIGN_SAFE_INLINE_IDS = new Set([
  "check-unknown",
  "check-unknown-general-scam-concern",
  "check-unknown-gov-service",
  "check-unknown-link-request",
  "check-unknown-safety-question",
  "check-unknown-transfer-request",
]);

function directMatchesContract(
  match: VictimIntentMatch | null,
  contract: FamilyContract,
  stage: ProbeStage,
): boolean {
  const primary = contract.scenario
    ? match?.scenario === contract.scenario
    : match?.kind === contract.kind;
  if (primary) return true;
  if (stage !== "after") return false;
  return (
    contract.afterDirectAlternatives?.some(
      (alternative) =>
        match?.kind === alternative.kind &&
        (alternative.scenario === undefined || match.scenario === alternative.scenario),
    ) ?? false
  );
}

function riskMatchesContract(
  reasons: readonly ReasonCode[],
  level: ReturnType<typeof scoreFromCodes>["level"],
  contract: FamilyContract,
  stage: ProbeStage,
): boolean {
  if (contract.reasons.length === 0) return level !== "high_risk";
  if (stage === "after" && contract.afterReasonAlternatives) {
    return contract.afterReasonAlternatives.some((reason) => reasons.includes(reason));
  }
  return contract.reasons.every((reason) => reasons.includes(reason));
}

function semanticArticleId(articleId: unknown): string | null {
  if (typeof articleId !== "string") return null;
  return articleId.replace(/-[A-Za-z0-9_-]{16}$/u, "");
}

function inlineMatchesContract(
  semanticId: string | null,
  contract: FamilyContract,
  stage: ProbeStage,
): boolean {
  // Risk level is asserted independently from evaluateText/scoreFromCodes.
  // Here we compare the exact semantic route while allowing the same route to
  // be rendered as unknown, suspicious, or high_risk.
  const route = (value: string | null): string | null =>
    value?.replace(/^check-(?:unknown|suspicious|high_risk)-/u, "check-") ?? null;
  if (route(semanticId) === route(contract.inline)) return true;
  return (
    stage === "after" &&
    (contract.afterInlineAlternatives?.some(
      (alternative) => route(alternative) === route(semanticId),
    ) ??
      false)
  );
}

function expectedMessageLanguage(language: ProbeLanguage): Lang {
  if (language === "ru") return "ru";
  if (language === "en") return "en";
  return "uz";
}

function sessionForProbe(probe: DangerProbe | SafeProbe, ordinal: number, offset = 0): Session {
  return {
    telegramUserId: 750_000 + offset + ordinal,
    lang: probe.profileLang,
    scenario: "none",
    scenarioStep: 0,
    scenarioData: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function plainTelegramText(value: string): string {
  return value
    .replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/gu, "$1")
    .normalize("NFKC")
    .replace(/[\u200b-\u200f\u2060\ufeff]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function withoutProbeEcho(value: string, probe: DangerProbe | SafeProbe): string {
  let visible = plainTelegramText(value);
  const candidates = [probe.text, ...probe.text.split(/\r?\n/u)]
    .map(plainTelegramText)
    .filter((candidate) => candidate.length >= 8);
  for (const candidate of candidates) visible = visible.replaceAll(candidate, " ");
  return visible.replace(/\s+/gu, " ").trim();
}

async function directVisible(
  probe: DangerProbe | SafeProbe,
  ordinal: number,
): Promise<{ visible: string; semanticVisible: string; messages: number }> {
  const session = sessionForProbe(probe, ordinal, 10_000);
  const chatId = 850_000 + ordinal;
  const before = h.sent.length;
  await handleCheck(probe.text, {
    chatId,
    userId: session.telegramUserId,
    session,
  });
  const calls = h.sent.slice(before).filter((call) => call.chatId === chatId);
  const visible = calls.map(({ text }) => plainTelegramText(text)).join("\n");
  return {
    visible,
    semanticVisible: withoutProbeEcho(visible, probe),
    messages: calls.length,
  };
}

async function inlineSemanticId(
  probe: DangerProbe | SafeProbe,
  ordinal: number,
): Promise<string | null> {
  const session = sessionForProbe(probe, ordinal);
  const before = h.answers.length;
  await handleInlineQuery(
    probe.text,
    { userId: session.telegramUserId, session },
    `novel-${ordinal}`,
  );
  expect.soft(h.answers.length, `${probe.id}: exactly one local Inline answer`).toBe(before + 1);
  const article = h.answers[before]?.results[0] as { id?: unknown } | undefined;
  return semanticArticleId(article?.id);
}

describe("novel emerging-scam probes — permanent offline corpus shape", () => {
  it("separates 96 authored phrases from 72 generated mutations without corpus duplicates", () => {
    expect(SEEDS).toHaveLength(24);
    expect(DANGER_PROBES).toHaveLength(144);
    expect(SAFE_PROBES).toHaveLength(24);
    expect(
      [...DANGER_PROBES, ...SAFE_PROBES].filter(
        ({ provenance }) => provenance === "authored-phrase",
      ),
    ).toHaveLength(96);
    expect(
      DANGER_PROBES.filter(({ provenance }) => provenance === "generated-mutation"),
    ).toHaveLength(72);
    expect(new Set([...DANGER_PROBES, ...SAFE_PROBES].map(({ id }) => id)).size).toBe(168);
    expect(new Set([...DANGER_PROBES, ...SAFE_PROBES].map(({ text }) => text)).size).toBe(168);
    expect(
      [...DANGER_PROBES, ...SAFE_PROBES].filter(({ text }) => corpusQueries.has(text)),
    ).toEqual([]);
  });
});

describe("novel emerging-scam probes — danger scenarios", () => {
  beforeEach(() => {
    h.answers.length = 0;
    h.sent.length = 0;
    h.runCheckInputs.length = 0;
    h.sessionWrites.length = 0;
    h.dbMutations.length = 0;
    h.localRunChecks = 0;
  });

  it.each(DANGER_PROBES)("$id", async (probe) => {
    const contract = CONTRACTS[probe.family];
    const direct = classifyVictimIntent(probe.text);
    const reasons = evaluateText(probe.text);
    const level = scoreFromCodes([...reasons]).level;
    const resolvedLanguage = resolveInlineQueryLanguage(probe.text, probe.profileLang);
    const ordinal = DANGER_PROBES.indexOf(probe);
    const directOutput = await directVisible(probe, ordinal);
    const semanticId = await inlineSemanticId(probe, ordinal);
    const outputLanguage = expectedMessageLanguage(probe.language);
    const allowsCompletedPaymentAftercare =
      probe.stage === "after" &&
      (contract.afterDirectAlternatives?.some(
        ({ scenario }) => scenario === "money_already_sent",
      ) ??
        false);
    const directTopicMatches =
      DIRECT_TOPIC[probe.family].test(directOutput.semanticVisible) ||
      (allowsCompletedPaymentAftercare &&
        COMPLETED_PAYMENT_AFTERCARE_TOPIC[outputLanguage].test(directOutput.semanticVisible));

    expect
      .soft(
        directMatchesContract(direct, contract, probe.stage),
        `${probe.id}: Direct: actual=${JSON.stringify(direct)}`,
      )
      .toBe(true);
    expect
      .soft(
        riskMatchesContract(reasons, level, contract, probe.stage),
        `${probe.id}: risk: level=${level}; reasons=${reasons.join(",") || "none"}`,
      )
      .toBe(true);
    expect
      .soft(resolvedLanguage, `${probe.id}: message language`)
      .toBe(expectedMessageLanguage(probe.language));
    expect.soft(directOutput.messages, `${probe.id}: Direct emitted a reply`).toBeGreaterThan(0);
    expect
      .soft(
        directTopicMatches,
        `${probe.id}: Direct concrete topic; actual=${directOutput.semanticVisible}`,
      )
      .toBe(true);
    expect
      .soft(
        DIRECT_SAFETY[outputLanguage].test(directOutput.visible),
        `${probe.id}: Direct localized protective action; actual=${directOutput.visible}`,
      )
      .toBe(true);
    expect
      .soft(
        /\b(?:intent[_ -]?id|reason[_ -]?code|classifier|routing table|deterministic)\b/iu.test(
          directOutput.visible,
        ),
        `${probe.id}: no internal classifier detail in Direct output`,
      )
      .toBe(false);
    expect
      .soft(
        inlineMatchesContract(semanticId, contract, probe.stage),
        `${probe.id}: Inline: actual=${semanticId ?? "none"}`,
      )
      .toBe(true);
    expect.soft(h.dbMutations, `${probe.id}: no database mutation`).toEqual([]);
  });
});

describe("novel emerging-scam probes — bounded safe negatives", () => {
  beforeEach(() => {
    h.answers.length = 0;
    h.sent.length = 0;
    h.runCheckInputs.length = 0;
    h.sessionWrites.length = 0;
    h.dbMutations.length = 0;
    h.localRunChecks = 0;
  });

  it.each(SAFE_PROBES)("$id", async (probe) => {
    const direct = classifyVictimIntent(probe.text);
    const reasons = evaluateText(probe.text);
    const level = scoreFromCodes([...reasons]).level;
    const resolvedLanguage = resolveInlineQueryLanguage(probe.text, probe.profileLang);
    const ordinal = 500 + SAFE_PROBES.indexOf(probe);
    const directOutput = await directVisible(probe, ordinal);
    const semanticId = await inlineSemanticId(probe, ordinal);

    expect
      .soft(
        direct === null || direct.kind === "report_question",
        `${probe.id}: no Direct incident route: actual=${JSON.stringify(direct)}`,
      )
      .toBe(true);
    expect
      .soft(
        reasons.filter((reason) => reasonTrustImpact[reason] === "risk"),
        `${probe.id}: no risk evidence from any family: actual=${reasons.join(",") || "none"}`,
      )
      .toEqual([]);
    expect
      .soft(level, `${probe.id}: benign risk level: reasons=${reasons.join(",") || "none"}`)
      .not.toBe("high_risk");
    expect.soft(directOutput.messages, `${probe.id}: Direct emitted a reply`).toBeGreaterThan(0);
    expect
      .soft(
        /(?:🔴|высок\p{L}*\s+риск|yuqori\s+xavf|high[_ -]?risk)/iu.test(directOutput.visible),
        `${probe.id}: benign Direct output must not be high risk; actual=${directOutput.visible}`,
      )
      .toBe(false);
    expect
      .soft(resolvedLanguage, `${probe.id}: message language`)
      .toBe(expectedMessageLanguage(probe.language));
    expect
      .soft(
        semanticId !== null && BENIGN_SAFE_INLINE_IDS.has(semanticId),
        `${probe.id}: bounded benign Inline route: actual=${semanticId ?? "none"}`,
      )
      .toBe(true);
    expect.soft(h.dbMutations, `${probe.id}: no database mutation`).toEqual([]);
  });
});
