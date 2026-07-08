import { describe, expect, it } from "vitest";
import {
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  buildLiveCallActiveKeyboard,
  buildLiveCallPhraseKeyboard,
  buildPanicKeyboardPage2,
  buildPanicKeyboardPage3,
  buildPanicScenarioText,
  classifyEmergencyFollowUp,
  parsePanicContextCallbackData,
  parsePanicCallback,
  withPanicContextData,
} from "@/lib/telegram/emergency";

const now = new Date("2026-06-05T12:00:00.000Z");
const recent = new Date("2026-06-05T11:30:00.000Z");
const expired = new Date("2026-06-05T08:00:00.000Z");

function callbackData(keyboard: ReturnType<typeof buildEmergencyFollowUpKeyboard>): string[] {
  return keyboard
    .flat()
    .map((button) => button.callback_data)
    .filter((data): data is string => typeof data === "string");
}

describe("Emergency Copilot v2 follow-up routing", () => {
  it("routes short next-step questions to the last panic scenario", () => {
    const context = withPanicContextData({}, 2, recent);

    expect(classifyEmergencyFollowUp("Что еще посоветуешь?", context, now)).toEqual({
      action: "more",
      panicId: 2,
    });
  });

  it("routes bank-number requests to verified contact guidance", () => {
    const context = withPanicContextData({}, 4, recent);

    expect(classifyEmergencyFollowUp("дай номер банка", context, now)).toEqual({
      action: "contacts",
      panicId: 4,
    });
    expect(classifyEmergencyFollowUp("куда звонить в банк?", context, now)).toEqual({
      action: "contacts",
      panicId: 4,
    });
    expect(classifyEmergencyFollowUp("дай горячую линию банка", context, now)).toEqual({
      action: "contacts",
      panicId: 4,
    });
  });

  it("routes personal-safety help requests to non-bank contact guidance", () => {
    const context = withPanicContextData({}, 7, recent);

    expect(classifyEmergencyFollowUp("куда обратиться?", context, now)).toEqual({
      action: "contacts",
      panicId: 7,
    });
    expect(classifyEmergencyFollowUp("можно в полицию?", context, now)).toEqual({
      action: "contacts",
      panicId: 7,
    });
  });

  it("routes stress and close-person wording to trusted-person guidance", () => {
    const context = withPanicContextData({}, 6, recent);

    expect(classifyEmergencyFollowUp("я нервничаю, позови близкого", context, now)).toEqual({
      action: "trusted_person",
      panicId: 6,
    });
    expect(classifyEmergencyFollowUp("что сказать близкому?", context, now)).toEqual({
      action: "trusted_person",
      panicId: 6,
    });
    expect(classifyEmergencyFollowUp("я пожилой человек и мне страшно", context, now)).toEqual({
      action: "trusted_person",
      panicId: 6,
    });
  });

  it("routes broader next-step wording to scenario-specific advice", () => {
    const context = withPanicContextData({}, 2, recent);

    expect(classifyEmergencyFollowUp("что мне делать дальше?", context, now)).toEqual({
      action: "more",
      panicId: 2,
    });
    expect(classifyEmergencyFollowUp("как быть?", context, now)).toEqual({
      action: "more",
      panicId: 2,
    });
  });

  it("does not intercept suspicious payloads that should be risk-checked", () => {
    const context = withPanicContextData({}, 2, recent);

    expect(
      classifyEmergencyFollowUp("Проверь https://kapitalbank.uz.evil.com", context, now),
    ).toBeNull();
    expect(classifyEmergencyFollowUp("+998 90 123 45 67", context, now)).toBeNull();
    expect(classifyEmergencyFollowUp("код 123456", context, now)).toBeNull();
  });

  it("expires old panic context", () => {
    const context = withPanicContextData({}, 4, expired);

    expect(classifyEmergencyFollowUp("дай номер банка", context, now)).toBeNull();
  });

  it("formats elder-friendly trusted-person guidance", () => {
    const text = buildEmergencyFollowUpText("trusted_person", 6, "ru");

    expect(text).toContain("Позовите человека");
    expect(text).toContain("побудь со мной");
    expect(text).toContain("Не пересылайте SMS-код");
  });

  it("formats callback contact guidance without trusting caller-provided numbers", () => {
    const text = buildEmergencyFollowUpText("contacts", 4, "ru");

    expect(text).toContain("Безопасный обратный звонок");
    expect(text).toContain("Не звоните на входящий номер");
    expect(text).toContain("1340");
  });

  it("formats personal-safety contact guidance without bank callback wording", () => {
    const text = buildEmergencyFollowUpText("contacts", 7, "ru");

    expect(text).toContain("Куда обратиться");
    expect(text).toContain("Полиция / МВД");
    expect(text).toContain("UZCERT");
    expect(text).not.toContain("Позвоните в банк");
    expect(text).not.toContain("Проверьте мой счёт");
  });

  it("formats scenario-specific ready phrases for non-bank SOS cases", () => {
    const blackmail = buildEmergencyFollowUpText("script", 7, "ru");
    const romance = buildEmergencyFollowUpText("script", 8, "ru");
    const telegram = buildEmergencyFollowUpText("script", 5, "ru");
    const publicationThreat = buildEmergencyFollowUpText("script", 9, "ru");

    expect(blackmail).toContain("Я прекращаю переписку");
    expect(blackmail).toContain("сохраняю доказательства");
    expect(blackmail).not.toContain("перезвоню по официальному номеру");

    expect(publicationThreat).toContain("Оплата не гарантирует удаления");
    expect(publicationThreat).toContain("сохраняю доказательства");
    expect(publicationThreat).not.toContain("перезвоню по официальному номеру");
    // P5: publication-threat ready phrase is now distinct from sextortion (7).
    expect(publicationThreat).not.toBe(blackmail);

    expect(romance).toContain("не перевожу деньги");
    expect(romance).toContain("проверю ситуацию с близким человеком");
    expect(romance).not.toContain("входящему звонку");

    expect(telegram).toContain("Мой Telegram могли взломать");
    expect(telegram).toContain("не отправляйте коды");
  });

  it("keeps sextortion, publication-threat and minor-safety first cards distinct", () => {
    const sextortion = buildPanicScenarioText(7, "ru");
    const publicationThreat = buildPanicScenarioText(9, "ru");
    const minorSafety = buildPanicScenarioText(10, "ru");

    expect(sextortion).toContain("НЕ ПЛАТИТЕ И НЕ ОТПРАВЛЯЙТЕ НОВЫЕ ФОТО/ВИДЕО");
    expect(sextortion).toContain("скриншоты чата, профиля");
    expect(sextortion).not.toContain("ссылку на пост/профиль");

    expect(publicationThreat).toContain("НЕ ПЛАТИТЕ ЗА «УДАЛЕНИЕ»");
    expect(publicationThreat).toContain("ссылку на пост/профиль");
    expect(publicationThreat).toContain("поддержку платформы");
    expect(publicationThreat).not.toContain("новые фото/видео");

    expect(minorSafety).toContain("ПОКАЖИ ПЕРЕПИСКУ ВЗРОСЛОМУ");
    expect(minorSafety).toContain("Если первый взрослый не помогает");
    expect(minorSafety).not.toContain("платите за «удаление»");

    expect(new Set([sextortion, publicationThreat, minorSafety]).size).toBe(3);
  });

  it("formats already-happened financial ready phrases without incoming-call fallback", () => {
    const smsCode = buildEmergencyFollowUpText("script", 1, "ru");
    const transfer = buildEmergencyFollowUpText("script", 3, "ru");
    const card = buildEmergencyFollowUpText("script", 4, "ru");

    expect(smsCode).toContain("Код уже отправлен");
    expect(smsCode).toContain("заблокировать карту и онлайн-банк");
    expect(smsCode).toContain("Я больше ничего не подтверждаю");
    expect(smsCode).not.toContain("входящему звонку");

    expect(transfer).toContain("Перевод уже сделан");
    expect(transfer).toContain("заморозьте или оспорьте операцию");
    expect(transfer).toContain("сохранить чек");
    expect(transfer).not.toContain("входящему звонку");

    expect(card).toContain("Данные карты уже могли попасть");
    expect(card).toContain("Заблокируйте карту");
    expect(card).toContain("через приложение или официальный номер банка");
    expect(card).not.toContain("входящему звонку");
  });

  it("formats trusted-person guidance by scenario instead of always using bank wording", () => {
    const sextortion = buildEmergencyFollowUpText("trusted_person", 7, "ru");
    const publicationThreat = buildEmergencyFollowUpText("trusted_person", 9, "ru");
    const minorSafety = buildEmergencyFollowUpText("trusted_person", 10, "ru");
    const romance = buildEmergencyFollowUpText("trusted_person", 8, "ru");
    const apk = buildEmergencyFollowUpText("trusted_person", 2, "ru");

    expect(sextortion).toContain("Мне угрожают/давят");
    expect(sextortion).toContain("сохранить доказательства");
    expect(sextortion).not.toContain("звоню в банк");

    expect(publicationThreat).toContain("угрожают публикацией");
    expect(publicationThreat).toContain("сохранить ссылки/скриншоты");
    expect(publicationThreat).not.toBe(sextortion);

    expect(minorSafety).toContain("Позови взрослого");
    expect(minorSafety).toContain("Если первый взрослый не помогает");
    expect(minorSafety).not.toBe(sextortion);

    expect(romance).toContain("Посмотри переписку со стороны");
    expect(romance).toContain("Поставьте паузу на переводы");

    expect(apk).toContain("Я установил подозрительное приложение");
    expect(apk).toContain("изолирую телефон");
  });

  it("includes a one-tap next-step button in the follow-up keyboard", () => {
    const buttons = buildEmergencyFollowUpKeyboard("ru").flat();
    const callbackData = buttons.map((button) => button.callback_data);

    expect(callbackData).toEqual(
      expect.arrayContaining([
        "panicctx:more",
        "panicctx:contacts",
        "panicctx:script",
        "family:notify",
        "voiceout:panic",
        "panicctx:full",
      ]),
    );
    expect(callbackData).not.toContain("share_advice");
    expect(buttons).toHaveLength(6);
    expect(buttons.map((button) => button.text)).toEqual(
      expect.arrayContaining([
        "📞 Позвонить безопасно",
        "💬 Готовая фраза",
        "🔊 Озвучить главный шаг",
      ]),
    );
  });

  it("can hide the voice-out button in contexts where it would replay the same generic step", () => {
    const regular = callbackData(buildEmergencyFollowUpKeyboard("ru", 1, { includeVoice: false }));
    const liveCall = callbackData(buildEmergencyFollowUpKeyboard("ru", 6, { includeVoice: false }));

    expect(regular).not.toContain("voiceout:panic");
    expect(liveCall).not.toContain("voiceout:panic");
    expect(regular).toContain("panicctx:1:full");
    expect(liveCall).toContain("panicctx:6:full");
  });

  it("encodes panic scenario ids in new follow-up callbacks while parsing legacy callbacks", () => {
    const scenarioData = callbackData(buildEmergencyFollowUpKeyboard("ru", 4));
    const legacyData = callbackData(buildEmergencyFollowUpKeyboard("ru"));

    expect(scenarioData).toEqual(
      expect.arrayContaining([
        "panicctx:4:more",
        "panicctx:4:contacts",
        "panicctx:4:script",
        "voiceout:panic:4",
        "panicctx:4:full",
      ]),
    );
    expect(scenarioData).not.toContain("panicctx:more");
    expect(parsePanicContextCallbackData("panicctx:4:contacts")).toEqual({
      action: "contacts",
      panicId: 4,
    });
    expect(parsePanicContextCallbackData("panicctx:contacts")).toEqual({
      action: "contacts",
      panicId: null,
    });
    expect(legacyData).toEqual(
      expect.arrayContaining(["panicctx:more", "panicctx:contacts", "voiceout:panic"]),
    );
  });

  it("encodes the follow-up action in contextual voice-out callbacks", () => {
    const scriptData = callbackData(
      buildEmergencyFollowUpKeyboard("ru", 3, { voiceAction: "script" }),
    );
    const contactsData = callbackData(
      buildEmergencyFollowUpKeyboard("ru", 4, { voiceAction: "contacts" }),
    );

    expect(scriptData).toContain("voiceout:panic:3:script");
    expect(scriptData).not.toContain("voiceout:panic:3");
    expect(contactsData).toContain("voiceout:panic:4:contacts");
  });

  it("profiles SOS follow-up keyboards by scenario instead of reusing the bank template", () => {
    const smsCode = buildEmergencyFollowUpKeyboard("ru", 1).flat();
    const blackmail = buildEmergencyFollowUpKeyboard("ru", 7).flat();
    const romance = buildEmergencyFollowUpKeyboard("ru", 8).flat();
    const minor = buildEmergencyFollowUpKeyboard("ru", 10).flat();
    const voiceClone = buildEmergencyFollowUpKeyboard("ru", 11).flat();
    const crypto = buildEmergencyFollowUpKeyboard("ru", 14).flat();

    expect(smsCode.map((button) => button.text)).toContain("📞 Позвонить безопасно");
    expect(callbackData(buildEmergencyFollowUpKeyboard("ru", 1)).slice(0, 2)).toEqual([
      "panicctx:1:more",
      "panicctx:1:contacts",
    ]);

    expect(blackmail.map((button) => button.text)).toContain("🆘 Куда обратиться");
    expect(callbackData(buildEmergencyFollowUpKeyboard("ru", 7)).slice(0, 2)).toEqual([
      "family:notify",
      "panicctx:7:contacts",
    ]);
    expect(blackmail.map((button) => button.text)).not.toContain("📞 Позвонить безопасно");

    expect(romance.map((button) => button.text)).toContain("🧭 Проверить с близким");
    expect(callbackData(buildEmergencyFollowUpKeyboard("ru", 8)).slice(0, 2)).toEqual([
      "family:notify",
      "panicctx:8:contacts",
    ]);

    expect(minor.map((button) => button.text)).toContain("🆘 Куда обратиться");
    expect(callbackData(buildEmergencyFollowUpKeyboard("ru", 10)).slice(0, 2)).toEqual([
      "family:notify",
      "panicctx:10:contacts",
    ]);

    expect(voiceClone.map((button) => button.text)).toContain("🎙️ Проверить голос");
    expect(callbackData(buildEmergencyFollowUpKeyboard("ru", 11)).slice(0, 2)).toEqual([
      "family:notify",
      "panicctx:11:contacts",
    ]);

    expect(crypto.map((button) => button.text)).toContain("💼 Безопасность wallet");
  });

  it("includes AI voice-clone in the second panic menu page", () => {
    const data = callbackData(buildPanicKeyboardPage2("ru"));

    expect(data).toContain("panic:11");
    expect(parsePanicCallback("panic:11")).toBe(11);
    expect(data).toContain("panic:more2");
  });

  it("includes modern scam SOS scenarios in the third panic menu page", () => {
    const data = callbackData(buildPanicKeyboardPage3("ru"));

    expect(data).toEqual(["panic:12", "panic:13", "panic:14", "panic:15", "panic:back2"]);
    expect(parsePanicCallback("panic:12")).toBe(12);
    expect(parsePanicCallback("panic:15")).toBe(15);
  });

  it("formats AI voice-clone guidance without bank-first wording", () => {
    const firstCard = buildPanicScenarioText(11, "ru");
    const more = buildEmergencyFollowUpText("more", 11, "ru");
    const script = buildEmergencyFollowUpText("script", 11, "ru");
    const contacts = buildEmergencyFollowUpText("contacts", 11, "ru");
    const trusted = buildEmergencyFollowUpText("trusted_person", 11, "ru");

    expect(firstCard).toContain("НЕ ПЕРЕВОДИТЕ ДЕНЬГИ ПО ГОЛОСУ");
    expect(firstCard).toContain("сохранённому номеру");
    expect(firstCard).toContain("кодовое слово");
    expect(firstCard).not.toContain("ЗАБЛОКИРУЙТЕ КАРТУ");
    expect(more).toContain("кодовое слово");
    expect(more).toContain("не переводите деньги");
    expect(script).toContain("перезвоню тебе по сохранённому номеру");
    expect(script).not.toContain("входящему звонку");
    expect(contacts).toContain("Как проверить голос безопасно");
    expect(contacts).toContain("Не используйте номер");
    expect(trusted).toContain("Голос похож на близкого");
  });

  it("formats modern scam SOS guidance without generic bank-call fallback", () => {
    const job = buildPanicScenarioText(12, "ru");
    const delivery = buildPanicScenarioText(13, "ru");
    const crypto = buildPanicScenarioText(14, "ru");
    const grant = buildPanicScenarioText(15, "ru");
    const jobScript = buildEmergencyFollowUpText("script", 12, "ru");
    const jobContacts = buildEmergencyFollowUpText("contacts", 12, "ru");
    const cryptoContacts = buildEmergencyFollowUpText("contacts", 14, "ru");
    const grantTrusted = buildEmergencyFollowUpText("trusted_person", 15, "ru");

    expect(job).toContain("НЕ ПЛАТИТЕ ЗА РАБОТУ");
    expect(job).toContain("юридическое название компании");
    expect(delivery).toContain("НЕ ОПЛАЧИВАЙТЕ ПО ССЫЛКЕ");
    expect(delivery).toContain("официальное приложение");
    expect(crypto).toContain("НЕ ПОДКЛЮЧАЙТЕ WALLET");
    expect(crypto).toContain("seed-фразу");
    expect(grant).toContain("НЕ ПЛАТИТЕ");
    expect(grant).toContain("официальный сайт");
    expect(jobScript).toContain("Сначала спокойно проверю источник");
    expect(jobScript).not.toContain("входящему звонку");
    expect(jobContacts).toContain("Проверить источник");
    expect(jobContacts).toContain("юридическое название");
    expect(jobContacts).not.toContain("Куда обратиться");
    expect(cryptoContacts).toContain("Крипто/TON");
    expect(cryptoContacts).toContain("seed-фразу");
    expect(grantTrusted).toContain("Поставьте паузу");
  });

  it("keeps the full checklist behind the explicit full button", () => {
    const firstCard = buildEmergencyFollowUpText("more", 1, "ru");
    const full = buildEmergencyFollowUpText("full", 1, "ru");

    expect(firstCard).not.toContain("Национальный банк Узбекистана");
    expect(full).toContain("Национальный банк Узбекистана");
    expect(full).toContain("Ishonch Guard помогает");
  });

  it("formats live-call follow-up as a guided post-call flow", () => {
    const more = buildEmergencyFollowUpText("more", 6, "ru");
    const bankContacts = buildEmergencyFollowUpText("contacts", 6, "ru", {
      liveCallContext: "bank",
    });
    const script = buildEmergencyFollowUpText("script", 6, "ru");
    const governmentMore = buildEmergencyFollowUpText("more", 6, "ru", {
      liveCallContext: "government",
    });
    const governmentContacts = buildEmergencyFollowUpText("contacts", 6, "ru", {
      liveCallContext: "government",
    });
    const governmentScript = buildEmergencyFollowUpText("script", 6, "ru", {
      liveCallContext: "government",
    });
    const operatorMore = buildEmergencyFollowUpText("more", 6, "ru", {
      liveCallContext: "operator",
    });

    expect(more).toContain("Хорошо, звонок завершён");
    expect(more).toContain("официальный сайт, приложение или сохранённый номер организации");
    expect(more).not.toContain("перезвоните в банк только по номеру");
    expect(bankContacts).toContain("Проверьте мой счёт");
    expect(bankContacts).toContain("Не звоните на входящий номер");
    expect(script).toContain("Я не обсуждаю деньги, коды, документы, карты и приложения");
    expect(governmentMore).toContain("официальный сайт, приложение или номер госоргана");
    expect(governmentMore).not.toContain("перезвоните в банк");
    expect(governmentContacts).toContain("Официальный канал госоргана");
    expect(governmentContacts).not.toContain("Проверьте мой счёт");
    expect(governmentScript).toContain("проверю запрос через официальный сайт");
    expect(governmentScript).not.toContain("перезвонить в банк");
    expect(operatorMore).toContain("номер оператора связи");
  });

  it("uses relative-specific live-call follow-up text for loved-one money pressure", () => {
    const contacts = buildEmergencyFollowUpText("contacts", 6, "ru", {
      liveCallContext: "relative",
    });
    const script = buildEmergencyFollowUpText("script", 6, "ru", {
      liveCallContext: "relative",
    });
    const more = buildEmergencyFollowUpText("more", 6, "ru", {
      liveCallContext: "relative",
    });
    const full = buildEmergencyFollowUpText("full", 6, "ru", {
      liveCallContext: "relative",
    });

    expect(contacts).toContain("Проверить близкого безопасно");
    expect(contacts).toContain("сохранённому номеру из контактов");
    expect(script).toContain("сохранённому номеру");
    expect(script).toContain("кодовое слово");
    expect(more).toContain("перезвоните близкому");
    expect(full).toContain("Все срочные шаги");
    expect(full).toContain("сохранённому номеру из контактов");
    expect(full).toContain("семейное кодовое слово");
    expect(full).not.toContain("Национальный банк Узбекистана");
    expect(contacts).not.toContain(
      "официальный сайт, приложение или сохранённый номер организации",
    );
    expect(script).not.toContain("официальному номеру");
  });

  it("keeps active live-call buttons focused on ending the call first", () => {
    const data = callbackData(buildLiveCallActiveKeyboard("ru"));

    expect(data).toEqual([
      "livecall:hangup",
      "livecall:what_to_say",
      "livecall:sent_code",
      "livecall:tell_family",
    ]);
    expect(data).not.toContain("livecall:call_bank");
  });

  it("uses a compact post-call keyboard for live-call follow-ups", () => {
    const data = callbackData(buildEmergencyFollowUpKeyboard("ru", 6));

    expect(data).toEqual([
      "panicctx:6:contacts",
      "family:notify",
      "panicctx:6:script",
      "panicctx:6:full",
      "voiceout:panic:6",
    ]);
    expect(data).not.toContain("panicctx:more");
  });

  it("keeps the ready-phrase keyboard focused on hangup and trusted help", () => {
    expect(callbackData(buildLiveCallPhraseKeyboard("ru"))).toEqual([
      "livecall:hangup",
      "livecall:tell_family",
    ]);
  });
});
