import { describe, expect, it } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { evaluateText, type ReasonCode } from "@/lib/risk/rules";
import {
  buildImageUnreadableSnapshot,
  buildLastCheckFollowUpText,
  buildLastCheckSnapshot,
  buildOrphanCheckFollowUpText,
  classifyAcknowledgementFollowUp,
  classifyOrphanCheckFollowUp,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import type { LastCheckSnapshot, ReportDraft } from "@/lib/telegram/session.server";

function baseResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "text",
    display: "test",
    level: "safe",
    score: 0,
    reasons: [],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

function scenarioWith(snapshot: LastCheckSnapshot, extra: Partial<ReportDraft> = {}): ReportDraft {
  return { ...extra, lastCheck: snapshot };
}

const NATURAL_FOLLOW_UP_PARAPHRASES = [
  ["Могу ли я доверять этому результату?", "confidence"],
  ["Это точно мошенники?", "confidence"],
  ["How sure are you?", "confidence"],
  ["Are you certain?", "confidence"],
  ["Can I rely on this result?", "confidence"],
  ["Ishonchingiz komilmi?", "confidence"],
  ["Natijaga ishonsam bo'ladimi?", "confidence"],
  ["Откуда такой вывод?", "methodology"],
  ["На чём основан результат?", "methodology"],
  ["Ты реально проверял ссылку?", "methodology"],
  ["What evidence did you use?", "methodology"],
  ["What is this based on?", "methodology"],
  ["What is this verdict based on?", "methodology"],
  ["What was that answer based on?", "methodology"],
  ["Did you actually check the link?", "methodology"],
  ["Why did you flag the domain?", "methodology"],
  ["Bu nimaga asoslangan?", "methodology"],
  ["Qaysi dalillardan foydalandingiz?", "methodology"],
  ["Havolani rostdan tekshirdingizmi?", "methodology"],
  ["Можно спросить у мужа?", "trusted_person"],
  ["Позвонить дочери?", "trusted_person"],
  ["Показать это сыну?", "trusted_person"],
  ["Can I ask my husband?", "trusted_person"],
  ["Should I call my daughter?", "trusted_person"],
  ["Can I show this to my son?", "trusted_person"],
  ["Can I ask someone close to me?", "trusted_person"],
  ["Turmush o'rtog'imdan so'rasam bo'ladimi?", "trusted_person"],
  ["Qizimga qo'ng'iroq qilsam bo'ladimi?", "trusted_person"],
  ["Buni o'g'limga ko'rsatsam bo'ladimi?", "trusted_person"],
  ["Yaqin odamdan so'rasam bo'ladimi?", "trusted_person"],
  ["Спасибо, понял", "acknowledgement"],
  ["Хорошо, благодарю", "acknowledgement"],
  ["Thanks, got it", "acknowledgement"],
  ["Okay, thank you", "acknowledgement"],
  ["Tushunarli, rahmat", "acknowledgement"],
  ["Rahmat, tushundim", "acknowledgement"],
] as const;

describe("last check follow-up router", () => {
  it.each(["Спасибо за помощь", "Thanks for your help", "Yordamingiz uchun rahmat"])(
    "keeps a wrapper-only acknowledgement as a follow-up: %s",
    (text) => {
      const now = new Date("2026-07-13T08:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

      expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now)).toBe("acknowledgement");
      expect(classifyAcknowledgementFollowUp(text)).toBe("acknowledgement");
    },
  );

  it.each(NATURAL_FOLLOW_UP_PARAPHRASES)(
    "recognizes a natural recent-result paraphrase: %s",
    (text, expectedAction) => {
      const now = new Date("2026-07-13T08:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

      expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now)).toBe(expectedAction);
      if (expectedAction === "acknowledgement") {
        expect(classifyAcknowledgementFollowUp(text)).toBe("acknowledgement");
      }
    },
  );

  it.each([
    ["С чего ты сделал такой вывод?", "explain"],
    ["Какие признаки ты увидел?", "methodology"],
    ["Ты вообще это проверял каким-то образом?", "methodology"],
    ["Как ты пришёл к этой оценке?", "methodology"],
    ["Bu xulosaga nimaga asoslanib keldingiz?", "explain"],
    ["Qaysi belgilarni ko'rdingiz?", "methodology"],
    ["Buni biror usul bilan tekshirdingizmi?", "methodology"],
    ["Bu bahoga qanday keldingiz?", "methodology"],
    ["What made you reach that conclusion?", "explain"],
    ["What signs did you notice?", "methodology"],
    ["Did you actually check it in some way?", "methodology"],
    ["How did you arrive at this rating?", "methodology"],
  ] as const)(
    "keeps a natural result-basis question on both recent and orphan follow-up routes: %s",
    (text, expectedAction) => {
      const now = new Date("2026-07-13T08:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

      expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now)).toBe(expectedAction);
      expect(classifyOrphanCheckFollowUp(text)).toBe(expectedAction);
    },
  );

  it.each([
    "С чего ты сделал вывод, что завтра будет дождь?",
    "Какие признаки простуды ты увидел?",
    "Qaysi belgilarni kasallikda ko'rdingiz?",
    "Bu bahoga matematika imtihonida qanday keldingiz?",
    "What signs of rain did you notice?",
    "How did you arrive at this rating for the restaurant?",
  ])("does not turn an unrelated result-like question into a check follow-up: %s", (text) => {
    const now = new Date("2026-07-13T08:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

    expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now)).toBeNull();
    expect(classifyOrphanCheckFollowUp(text)).toBeNull();
  });

  it.each([
    "My husband asked me to send the code.",
    "Дочь просит перевести деньги.",
    "Qizim kodni yuborishni so'rayapti.",
    "Дочь позвонила мне.",
    "Qizim qo'ng'iroq qildi.",
    "Thanks, send me the code.",
    "What evidence is admissible in court?",
    "What is this court verdict based on?",
    "Are you certain what the weather is?",
    "Can I ask my husband to check https://example.com/login?",
  ])("does not hide a new payload or unrelated question as a follow-up: %s", (text) => {
    const now = new Date("2026-07-13T08:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

    expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now)).toBeNull();
  });

  it.each([
    ["Thanks for your help: are you sure? send me the code", "asks_for_sms_code"],
    ["После прошлого результата хочу уточнить: ты уверен? отправь мне пароль", "asks_for_pin"],
    ["Ты точно уверен? Теперь покажи экран телефона", "asks_to_share_screen"],
    ["Are you sure? Install this APK", "asks_to_install_apk"],
    ["Qaysi dalillardan foydalandingiz? SMS kodni yuboring", "asks_for_sms_code"],
  ] as const)(
    "keeps a dangerous clause after follow-up wording on the fresh-check path: %s",
    (text, expectedReason: ReasonCode) => {
      const now = new Date("2026-07-13T08:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

      expect(evaluateText(text), text).toContain(expectedReason);
      expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now), text).toBeNull();
      expect(classifyOrphanCheckFollowUp(text), text).toBeNull();
    },
  );

  it.each([
    [
      "Что теперь? Полиция велит поджечь склад, иначе заведут уголовное дело",
      "authority_coerced_dangerous_act",
    ],
    [
      "Nima qilay? Jarima ballarini pulga o'chirib berish uchun o'tkazma so'rashyapti",
      "fake_penalty_points_erasure",
    ],
    ["Что теперь? Я знаю твой адрес, приеду домой и убью тебя", "threatens_physical_violence"],
  ] as const)("does not attach a new P0/P1 danger to stale check context: %s", (phrase, reason) => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ level: "safe" }), now);

    expect(evaluateText(phrase)).toContain(reason);
    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBeNull();
  });

  it.each([
    ["Что мне делать прямо сейчас?", "next_steps"],
    ["What should I do right now?", "next_steps"],
    ["Hozir nima qilay?", "next_steps"],
    ["что теперь?", "next_steps"],
    ["ok and now?", "next_steps"],
    ["endi-chi?", "next_steps"],
  ] as const)(
    "routes a user safety question without treating it as attacker urgency: %s",
    (text, expectedAction) => {
      const now = new Date("2026-07-13T08:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

      expect(evaluateText(text)).not.toContain("uses_urgency");
      expect(classifyLastCheckFollowUp(text, scenarioWith(snapshot), now)).toBe(expectedAction);
    },
  );

  it.each([
    ["что мне им сказать?", "ru", /не подтверждаю|не перевожу|завершаю/u],
    ["что им ответить?", "ru", /не подтверждаю|не перевожу|завершаю/u],
    ["мне отвечать?", "ru", /не подтверждаю|не перевожу|завершаю/u],
    ["what should I say to them?", "en", /verify|official/u],
    ["ularga nima deyay?", "uz", /mustaqil|rasmiy/u],
    ["ularga nima yozay?", "uz", /mustaqil|rasmiy/u],
    ["Ularga nima deb javob beray?", "uz", /mustaqil|rasmiy/u],
    ["Уларга нима деб жавоб берай?", "uz", /mustaqil|rasmiy/u],
  ] as const)(
    "returns a sendable reply script instead of starting a generic check: %s",
    (phrase, lang, expected) => {
      const now = new Date("2026-08-23T12:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);
      const action = classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now);

      expect(action).toBe("reply_script");
      expect(buildLastCheckFollowUpText(action!, snapshot, lang)).toMatch(expected);
    },
  );

  it.each([
    ["pachemu?", "explain"],
    ["pochemu?", "explain"],
    ["chto delat dalshe?", "next_steps"],
    ["chto im skazat?", "reply_script"],
    ["nu i chto teper?", "next_steps"],
  ] as const)("uses a bounded Russian-Latin follow-up fallback: %s", (phrase, expected) => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);
    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBe(expected);
  });

  it.each([
    ["Nima qilay?", "next_steps"],
    ["Keyin nima?", "next_steps"],
    ["Nega bunday?", "explain"],
    ["Ishonsa bo'ladimi?", "confidence"],
    ["Bank nomeri qane?", "contacts"],
  ] as const)("keeps a short Uzbek last-check follow-up contextual: %s", (phrase, expected) => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);
    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBe(expected);
  });

  it("answers a short confidence question after a recent QR/menu check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        explanation: "Похоже на меню, акцию или информационный QR.",
      }),
      now,
    );

    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);

    expect(action).toBe("confidence");
    expect(buildLastCheckFollowUpText(action!, snapshot, "ru")).toContain(
      "Не могу гарантировать на 100%",
    );
    expect(buildLastCheckFollowUpText(action!, snapshot, "ru")).toContain("информационный QR");
  });

  it("answers an 'is this made by AI?' question instead of running a new check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ explanation: "Похоже на меню, акцию или информационный QR." }),
      now,
    );

    const action = classifyLastCheckFollowUp(
      "Похоже, меню сделано с помощью искусственного интеллекта?",
      scenarioWith(snapshot),
      now,
    );
    expect(action).toBe("ai_origin");

    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    // Honest: never claims it IS AI; redirects to the real risk + a safe action.
    expect(text).toContain("может быть шаблонный или AI");
    expect(text).toContain("не доказывает мошенничество");
    expect(text).toContain("какой адрес откроется по QR");
    expect(text).toContain("SMS-код");
  });

  it("treats a short 'Это AI?' as an ai-origin follow-up", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);
    expect(classifyLastCheckFollowUp("Это AI?", scenarioWith(snapshot), now)).toBe("ai_origin");
    expect(
      classifyLastCheckFollowUp("Похоже, меню сделано с помощью ИИ?", scenarioWith(snapshot), now),
    ).toBe("ai_origin");
  });

  it("does not treat an ai-origin question carrying a new payload as a follow-up", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);
    expect(
      classifyLastCheckFollowUp("Это AI? https://promo.example.com", scenarioWith(snapshot), now),
    ).toBeNull();
  });

  it("answers an ai-origin question even without a recent check (orphan)", () => {
    expect(classifyOrphanCheckFollowUp("Это сделано нейросетью?")).toBe("ai_origin");
    expect(buildOrphanCheckFollowUpText("ai_origin", "ru")).toContain("не главное");
  });

  it("routes a short next-step question to contextual guidance", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        level: "high_risk",
        reasons: ["asks_for_sms_code", "asks_to_scan_qr"],
      }),
      now,
    );

    const action = classifyLastCheckFollowUp("Что мне делать дальше?", scenarioWith(snapshot), now);

    expect(action).toBe("next_steps");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("Следующий безопасный шаг");
    expect(text).toContain("Не сообщайте SMS-код");
  });

  it("routes bank-number requests to official contact guidance after a phone check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ type: "phone", display: "+998 ** *** ** **", reasons: ["valid_uz_phone"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("дай номер банка", scenarioWith(snapshot), now);

    expect(action).toBe("contacts");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("Официальный обратный звонок");
    expect(text).toContain("1340");
    expect(text).not.toContain("+998 **");
  });

  it("routes short explanation questions without exposing scores", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["brand_impersonation"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("Почему так?", scenarioWith(snapshot), now);

    expect(action).toBe("explain");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("видимые признаки риска");
    expect(text).not.toMatch(/score|threshold|порог|коэффициент|вес\s*(?:риска|=|:)/i);
  });

  it("routes explain-like-grandmother phrases to a simpler last-check answer", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code", "asks_to_scan_qr"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("Объясни как бабушке", scenarioWith(snapshot), now);

    expect(action).toBe("simple_explain");
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");
    expect(text).toContain("Объясню совсем просто");
    expect(text).toContain("ключ от ваших денег");
    expect(text).toContain("просят код из SMS");
    expect(text).toContain("Безопасный шаг сейчас");
    expect(text).not.toMatch(/score|threshold|порог|коэффициент|вес\s*(?:риска|=|:)/i);
  });

  it("supports simple explain phrases in RU, UZ and EN", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);
    const context = scenarioWith(snapshot);

    expect(classifyLastCheckFollowUp("простыми словами", context, now)).toBe("simple_explain");
    expect(classifyLastCheckFollowUp("oddiy qilib tushuntir", context, now)).toBe("simple_explain");
    expect(classifyLastCheckFollowUp("explain in simple words", context, now)).toBe(
      "simple_explain",
    );
  });

  it("answers real Russian high-risk confidence follow-ups with action-first guidance", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code"] }),
      now,
    );

    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);
    const text = buildLastCheckFollowUpText(action!, snapshot, "ru");

    expect(action).toBe("confidence");
    expect(text).toContain("Я бы действовал как при реальном риске");
    expect(text).toContain("Не сообщайте SMS-код");
    expect(text).toContain("официальному номеру");
    expect(text).toContain("эти шаги вам не навредят");
    expect(text).not.toContain("Не могу гарантировать на 100%");
    expect(text).not.toContain("Перезвоните в банк");
  });

  it("keeps an independent official callback in every high-risk confidence reply", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code"] }),
      now,
    );

    expect(buildLastCheckFollowUpText("confidence", snapshot, "ru")).toContain(
      "официальному номеру",
    );
    expect(buildLastCheckFollowUpText("confidence", snapshot, "uz")).toContain("rasmiy raqamga");
    expect(buildLastCheckFollowUpText("confidence", snapshot, "en")).toContain("official number");
  });

  it("does not expose weak topic-only evidence in unknown explanations", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const phone = buildLastCheckSnapshot(
      baseResult({ type: "phone", level: "unknown", reasons: ["valid_uz_phone"] }),
      now,
    );
    const profile = buildLastCheckSnapshot(
      baseResult({ type: "telegram", level: "unknown", reasons: ["unknown_sender"] }),
      now,
    );

    const phoneText = buildLastCheckFollowUpText("explain", phone, "ru");
    const profileText = buildLastCheckFollowUpText("explain", profile, "ru");

    expect(phoneText).toContain("сам номер не доказательство");
    expect(phoneText).not.toContain("Что я увидел");
    expect(phoneText).not.toContain("Корректный узбекский номер");
    expect(profileText).toContain("Telegram не показывает мне скрытую SCAM-метку");
    expect(profileText).not.toContain("Что я увидел");
    expect(profileText).not.toContain("Отправитель неизвестен");
  });

  it("keeps simple unknown phone explanations from treating a valid number as evidence", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const phone = buildLastCheckSnapshot(
      baseResult({ type: "phone", level: "unknown", reasons: ["valid_uz_phone"] }),
      now,
    );

    const text = buildLastCheckFollowUpText("simple_explain", phone, "ru");

    expect(text).toContain("Номер сам по себе не доказывает");
    expect(text).not.toContain("Корректный узбекский номер");
    expect(text).not.toContain("Что я заметил");
  });

  it.each([
    ["ru", /физическ.*безопасн|безопасн.*102/isu],
    ["uz", /jismoniy.*xavfsiz|xavfsiz.*102/isu],
    ["en", /physical.*safe|safe.*102/isu],
  ] as const)("keeps simple-explain physical-safety guidance specific in %s", (lang, expected) => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        level: "high_risk",
        score: 80,
        reasons: ["threatens_physical_violence"],
      }),
      now,
    );

    const text = buildLastCheckFollowUpText("simple_explain", snapshot, lang);
    expect(text).toMatch(expected);
    expect(text).toContain("102");
    expect(text).not.toMatch(/ключ от (?:ваших )?(?:денег|аккаунта)|giving a key/iu);
  });

  it.each([
    ["asks_for_money_transfer", /не переводите деньги.*проверьте получателя/isu],
    ["fake_penalty_points_erasure", /не платите.*штрафные баллы.*официальн/isu],
  ] as const)("keeps simple-explain action specific for %s", (reason, expected) => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", score: 80, reasons: [reason] }),
      now,
    );

    const text = buildLastCheckFollowUpText("simple_explain", snapshot, "ru");
    expect(text).toMatch(expected);
    expect(text).not.toMatch(/ключ от ваших денег|ввод через QR/iu);
  });

  it("does not intercept real scam payloads that need a fresh check", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), now);

    expect(
      classifyLastCheckFollowUp(
        "точно https://evil.example/login оплатить картой",
        scenarioWith(snapshot),
        now,
      ),
    ).toBeNull();
    expect(
      classifyLastCheckFollowUp("дай номер банка +998 90 123 45 67", scenarioWith(snapshot), now),
    ).toBeNull();
  });

  it.each([
    ["ru", "Почему меня просят отправить паспорт?"],
    ["uz", "Nega mendan pasport yuborishni so'rashyapti?"],
    ["en", "Why are they asking me to send a passport?"],
    ["ru-id", "Почему требуют фото ID-карты и адрес?"],
    ["uz-id", "Nega JSHSHIR va hujjat rasmini yuborishni so'rashyapti?"],
    ["en-id", "Why do they require a photo of my ID and date of birth?"],
  ])("treats a new personal-data request as a fresh safety event (%s)", (_lang, phrase) => {
    const now = new Date("2026-07-12T10:00:00.000Z");
    const recentSafe = buildLastCheckSnapshot(baseResult({ level: "safe" }), now);

    expect(classifyLastCheckFollowUp(phrase, scenarioWith(recentSafe), now)).toBeNull();
    expect(classifyOrphanCheckFollowUp(phrase)).toBeNull();
  });

  it("preserves a legitimate confidence follow-up after the personal-data guard", () => {
    const now = new Date("2026-07-12T10:00:00.000Z");
    const recentSafe = buildLastCheckSnapshot(baseResult({ level: "safe" }), now);

    expect(classifyLastCheckFollowUp("Are you sure?", scenarioWith(recentSafe), now)).toBe(
      "confidence",
    );
    expect(classifyOrphanCheckFollowUp("Are you sure?")).toBe("confidence");
  });

  it("ignores stale last-check context", () => {
    const now = new Date("2026-06-06T05:30:01.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), new Date("2026-06-06T05:00:00.000Z"));

    expect(classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now)).toBeNull();
  });

  it("lets a newer emergency context win over an older check", () => {
    const now = new Date("2026-06-06T05:10:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult(), new Date("2026-06-06T05:00:00.000Z"));

    expect(
      classifyLastCheckFollowUp(
        "Точно?",
        scenarioWith(snapshot, {
          lastPanicId: 6,
          lastPanicAt: "2026-06-06T05:09:00.000Z",
        }),
        now,
      ),
    ).toBeNull();
  });

  it("classifies phone checks without storing the phone number", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({ type: "phone", display: "+998 ** *** ** **", reasons: ["valid_uz_phone"] }),
      new Date("2026-06-06T05:00:00.000Z"),
    );

    expect(snapshot.context).toBe("phone");
    expect(JSON.stringify(snapshot)).not.toContain("+998");
  });

  it("answers confidence questions after Telegram profile checks with profile-specific limits", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ type: "telegram" }), now);

    expect(snapshot.context).toBe("telegram_profile");
    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);
    expect(action).toBe("confidence");
    expect(buildLastCheckFollowUpText(action!, snapshot, "ru")).toContain(
      "по Telegram-профилю или каналу",
    );
  });

  it("answers confidence questions after an unreadable image without inventing risk", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildImageUnreadableSnapshot(now);

    const action = classifyLastCheckFollowUp("Sure?", scenarioWith(snapshot), now);

    expect(action).toBe("confidence");
    const text = buildLastCheckFollowUpText(action!, snapshot, "en");
    expect(text).toContain("cannot be sure from that image");
    expect(text).toContain("will not invent a risk");
  });

  it("answers next-step questions after an unreadable image with concrete capture guidance", () => {
    const now = new Date("2026-06-06T05:00:00.000Z");
    const snapshot = buildImageUnreadableSnapshot(now);

    const action = classifyLastCheckFollowUp("what next?", scenarioWith(snapshot), now);

    expect(action).toBe("next_steps");
    const text = buildLastCheckFollowUpText(action!, snapshot, "en");
    expect(text).toContain("link it opens");
    expect(text).toContain("closer screenshot");
    expect(JSON.stringify(snapshot)).not.toContain("data:image");
  });

  it("answers orphan confidence follow-ups without running a fake risk check", () => {
    const action = classifyOrphanCheckFollowUp("Точно?");

    expect(action).toBe("confidence");
    const text = buildOrphanCheckFollowUpText(action!, "ru");
    expect(text).toContain("не вижу, к какой именно проверке");
    expect(text).toContain("сам QR не опасен");
    expect(text).not.toContain("Недостаточно данных");
  });

  it("answers orphan bank-contact requests with official callback guidance", () => {
    const action = classifyOrphanCheckFollowUp("дай номер банка");

    expect(action).toBe("contacts");
    const text = buildOrphanCheckFollowUpText(action!, "ru");
    expect(text).toContain("Официальный обратный звонок");
    expect(text).toContain("1340");
  });

  it("answers orphan simple-explain requests without a fake insufficient-data card", () => {
    const action = classifyOrphanCheckFollowUp("объясни простыми словами");

    expect(action).toBe("simple_explain");
    const text = buildOrphanCheckFollowUpText(action!, "ru");
    expect(text).toContain("Совсем просто");
    expect(text).toContain("конкретную проверку");
    expect(text).not.toContain("Недостаточно данных");
  });

  it("does not classify orphan follow-ups when the text contains a new artifact", () => {
    expect(classifyOrphanCheckFollowUp("Точно? https://kapitalbank.uz.evil.com")).toBeNull();
    expect(classifyOrphanCheckFollowUp("дай номер банка +998 90 123 45 67")).toBeNull();
    expect(classifyOrphanCheckFollowUp("check it again https://evil.example/login")).toBeNull();
    expect(classifyOrphanCheckFollowUp("call someone I trust +998 90 123 45 67")).toBeNull();
    expect(classifyOrphanCheckFollowUp("I disagree, transfer money now")).toBeNull();
    expect(classifyOrphanCheckFollowUp("Почему example.com подозрительный?")).toBeNull();
    expect(classifyOrphanCheckFollowUp("Почему paypa1.uz подозрительный?")).toBeNull();
  });

  it("keeps a safety question about codes as a follow-up when no actual code is supplied", () => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_for_sms_code"] }),
      now,
    );

    expect(
      classifyLastCheckFollowUp("Почему нельзя отправлять код?", scenarioWith(snapshot), now),
    ).toBe("explain");
    expect(
      classifyLastCheckFollowUp("Почему нельзя отправлять код 7391?", scenarioWith(snapshot), now),
    ).toBeNull();
  });

  it.each([
    ["ru", "ты точно в этом уверен?", "confidence"],
    ["uz", "siz bunga aniq ishonasizmi?", "confidence"],
    ["en", "are you really sure about that?", "confidence"],
    [
      "ru",
      "Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?",
      "methodology",
    ],
    ["ru", "Почему домен подозрительный?", "methodology"],
    ["ru", "Почему ты считаешь этот домен подозрительным?", "methodology"],
    ["uz", "bu domenni qanday tekshirdingiz?", "methodology"],
    ["uz", "Nega domen shubhali?", "methodology"],
    ["uz", "Nega bu domenni shubhali deb hisobladingiz?", "methodology"],
    ["en", "how did you check this domain?", "methodology"],
    ["en", "Why is the domain suspicious?", "methodology"],
    ["en", "Why did you consider this domain suspicious?", "methodology"],
    ["ru", "я могу связаться с близким?", "trusted_person"],
    ["uz", "yaqin odamim bilan bog'lansam bo'ladimi?", "trusted_person"],
    ["en", "can I call someone I trust?", "trusted_person"],
    ["ru", "перепроверь ещё раз", "recheck"],
    ["uz", "yana bir marta tekshir", "recheck"],
    ["en", "check it again", "recheck"],
    ["ru", "я не согласен, ты ошибся", "disagreement"],
    ["uz", "men rozi emasman, xato qildingiz", "disagreement"],
    ["en", "I disagree, you may be wrong", "disagreement"],
    ["ru", "Можно связаться с мамой?", "trusted_person"],
    ["ru", "Можно показать близкому?", "trusted_person"],
    ["en", "Can I show this to my mother?", "trusted_person"],
    ["uz", "yaqin odamim bilan boglansam bo'ladimi?", "trusted_person"],
    ["uz", "ishonchli odamga qongiroq qilsam bo'ladimi?", "trusted_person"],
    ["ru", "А можешь перепроверить?", "recheck"],
    ["ru", "Проверь ещё", "recheck"],
    ["en", "Can you double-check?", "recheck"],
    ["ru", "Какие источники ты использовал?", "methodology"],
  ] as const)("routes %s phrase '%s' to %s", (_lang, phrase, expected) => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["weird_domain"] }),
      now,
    );

    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBe(expected);
  });

  it.each([
    [
      "ru",
      "Почему домен подозрительный?",
      "необычное доменное окончание",
      "не доказывают владельца",
    ],
    ["uz", "Nega domen shubhali?", "noodatiy domen oxiri", "egani"],
    ["en", "Why is the domain suspicious?", "unusual domain ending", "do not prove ownership"],
  ] as const)(
    "answers a short %s domain question from retained reason provenance",
    (lang, phrase, evidence, limitation) => {
      const now = new Date("2026-07-11T00:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(
        baseResult({ type: "url", level: "suspicious", reasons: ["weird_domain"] }),
        now,
      );

      const action = classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now);
      expect(action).toBe("methodology");

      const text = buildLastCheckFollowUpText(action!, snapshot, lang, phrase);
      expect(text).toContain(evidence);
      expect(text).toContain(limitation);
      expect(text).not.toMatch(/повторно провер|rechecked|qayta tekshir/u);
    },
  );

  it.each([
    ["ru", "Почему домен подозрительный?", "домен не был отдельной причиной"],
    [
      "ru",
      "Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?",
      "домен не был отдельной причиной",
    ],
    ["uz", "Nega domen shubhali?", "domen alohida xavf sababi bo'lmagan"],
    ["en", "Why is the domain suspicious?", "did not contain a domain-specific risk reason"],
  ] as const)(
    "rejects the false domain premise after a non-domain %s result",
    (lang, phrase, expected) => {
      const snapshot = buildLastCheckSnapshot(
        baseResult({ type: "phone", level: "suspicious", reasons: ["asks_for_sms_code"] }),
      );
      const text = buildLastCheckFollowUpText("methodology", snapshot, lang, phrase);

      expect(text).toContain(expected);
      expect(text).not.toMatch(/просят SMS|asks for an SMS|SMS.*so'ral/u);
    },
  );

  it("does not attribute a URL result's unrelated SMS-code reason to the domain", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({ type: "url", level: "suspicious", reasons: ["asks_for_sms_code"] }),
    );
    const text = buildLastCheckFollowUpText(
      "methodology",
      snapshot,
      "ru",
      "Почему домен подозрительный?",
    );

    expect(text).toContain("домен не был отдельной причиной");
    expect(text).not.toContain("SMS");
  });

  it.each([
    "Почему paypa1.uz подозрительный?",
    "Why is paypa1.uz suspicious?",
    "Nega paypa1.uz shubhali?",
    "Почему домен https://paypa1.uz/login подозрительный?",
  ])("keeps a concrete domain or URL as a fresh check: %s", (phrase) => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["weird_domain"] }),
      now,
    );

    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBeNull();
  });

  it.each([
    ["После прошлого результата хочу уточнить: Почему домен подозрительный?", "methodology"],
    ["After the last result I want to clarify: Why is the domain suspicious?", "methodology"],
    ["Oldingi natijadan keyin aniqlashtirmoqchiman: Nega domen shubhali?", "methodology"],
    ["Спасибо за помощь. Ещё вопрос: Почему это опасно?", "explain"],
  ] as const)(
    "keeps a natural conversational lead-in attached to the recent result: %s",
    (phrase, action) => {
      const now = new Date("2026-07-11T00:00:00.000Z");
      const snapshot = buildLastCheckSnapshot(
        baseResult({ level: "suspicious", reasons: ["weird_domain"] }),
        now,
      );

      expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBe(action);
    },
  );

  it.each([
    "После прошлого результата хочу уточнить: Как проверить номер с помощью бота?",
    "After the last result I want to clarify: How do I check a link here?",
    "Oldingi natijadan keyin aniqlashtirmoqchiman: Raqamni qanday tekshirish mumkin?",
  ])("keeps a procedural check question outside recent-result follow-ups: %s", (phrase) => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const snapshot = buildLastCheckSnapshot(baseResult({ level: "suspicious" }), now);

    expect(classifyLastCheckFollowUp(phrase, scenarioWith(snapshot), now)).toBeNull();
  });

  it("stores only bounded methodology enums in the last-check snapshot", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        level: "high_risk",
        reasons: ["weird_domain", "external_phishing_url", "known_reported"],
      }),
    );

    expect(snapshot.provenance).toEqual({
      methods: ["external_reputation", "local_reports", "url_structure"],
      sources: ["external_reputation", "moderated_reports", "visible_input"],
      limitations: ["external_scope", "report_scope", "format_only"],
    });
    expect(JSON.stringify(snapshot)).not.toMatch(/https?:|@|\+998|test/i);
  });

  it("answers methodology, trusted-person, recheck and disagreement honestly", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({ level: "suspicious", reasons: ["weird_domain"] }),
    );

    const methodology = buildLastCheckFollowUpText("methodology", snapshot, "ru");
    const trusted = buildLastCheckFollowUpText("trusted_person", snapshot, "ru");
    const recheck = buildLastCheckFollowUpText("recheck", snapshot, "ru");
    const disagreement = buildLastCheckFollowUpText("disagreement", snapshot, "ru");

    expect(methodology).toMatch(/необычное доменное окончание|IP-адрес|ошибку формата/i);
    expect(methodology).toContain("не доказывают владельца");
    expect(trusted).toMatch(/свяжитесь с близким сами/i);
    expect(trusted).not.toContain("я отправил");
    expect(recheck).toContain("не храню исходную ссылку или текст");
    expect(recheck).toMatch(/пришлите заново/i);
    expect(disagreement).toMatch(/можете не соглашаться/i);
    expect(disagreement).toContain("независимо");
  });

  it("keeps official-directory and moderated-report sources in post-check provenance", () => {
    const snapshot = buildLastCheckSnapshot(
      baseResult({
        type: "phone",
        reasons: ["valid_uz_phone"],
        knownReports: 3,
        verifiedContact: {
          orgName: "Example Bank",
          orgType: "bank",
          source: "https://example.test",
          display: "1000",
          contactType: "short_code",
          verificationLevel: "high",
          description: "Test fixture",
        },
        phoneReputation: {
          source: "ishonch_guard_moderated_reports",
          confirmedReportCount: 3,
          confidence: "medium",
          riskLevel: "suspicious",
          publicScope: "confirmed_moderated_reports_only",
        },
      }),
    );

    expect(snapshot.reasons).toEqual(["known_reported", "verified_official", "valid_uz_phone"]);
    expect(snapshot.provenance?.methods).toEqual([
      "local_reports",
      "official_directory",
      "phone_format",
    ]);
    expect(buildLastCheckFollowUpText("methodology", snapshot, "ru")).toMatch(
      /подтвержд|официальн/i,
    );
  });

  it("uses reason-bound high-risk actions instead of always sending users to a bank", () => {
    const apk = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["asks_to_install_apk"] }),
    );
    const telegram = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["telegram_account_takeover_phishing"] }),
    );
    const wallet = buildLastCheckSnapshot(
      baseResult({ level: "high_risk", reasons: ["wallet_action_urgency"] }),
    );

    expect(buildLastCheckFollowUpText("next_steps", apk, "ru")).toContain("APK");
    expect(buildLastCheckFollowUpText("next_steps", telegram, "ru")).toContain(
      "Telegram → Устройства",
    );
    expect(buildLastCheckFollowUpText("next_steps", wallet, "ru")).toContain("кошелёк");
    for (const snapshot of [apk, telegram, wallet]) {
      expect(buildLastCheckFollowUpText("next_steps", snapshot, "ru")).not.toContain(
        "Перезвоните в банк",
      );
    }
  });
});
