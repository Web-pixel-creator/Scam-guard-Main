import { describe, expect, it } from "vitest";
import {
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  buildLiveCallActiveKeyboard,
  buildLiveCallPhraseKeyboard,
  classifyEmergencyFollowUp,
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

    expect(blackmail).toContain("Я прекращаю переписку");
    expect(blackmail).toContain("сохраняю доказательства");
    expect(blackmail).not.toContain("перезвоню по официальному номеру");

    expect(romance).toContain("не перевожу деньги");
    expect(romance).toContain("проверю ситуацию с близким человеком");
    expect(romance).not.toContain("входящему звонку");

    expect(telegram).toContain("Мой Telegram могли взломать");
    expect(telegram).toContain("не отправляйте коды");
  });

  it("formats trusted-person guidance by scenario instead of always using bank wording", () => {
    const blackmail = buildEmergencyFollowUpText("trusted_person", 9, "ru");
    const romance = buildEmergencyFollowUpText("trusted_person", 8, "ru");
    const apk = buildEmergencyFollowUpText("trusted_person", 2, "ru");

    expect(blackmail).toContain("Мне угрожают");
    expect(blackmail).toContain("сохранить доказательства");
    expect(blackmail).not.toContain("звоню в банк");

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
        "panicctx:full",
      ]),
    );
    expect(callbackData).not.toContain("share_advice");
    expect(buttons).toHaveLength(5);
    expect(buttons.map((button) => button.text)).toEqual(
      expect.arrayContaining(["📞 Позвонить безопасно", "💬 Готовая фраза"]),
    );
  });

  it("uses a help-directory button for blackmail and minor scenarios", () => {
    expect(
      buildEmergencyFollowUpKeyboard("ru", 7)
        .flat()
        .map((button) => button.text),
    ).toContain("🆘 Куда обратиться");
    expect(
      buildEmergencyFollowUpKeyboard("ru", 10)
        .flat()
        .map((button) => button.text),
    ).toContain("🆘 Куда обратиться");
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
    const contacts = buildEmergencyFollowUpText("contacts", 6, "ru");
    const script = buildEmergencyFollowUpText("script", 6, "ru");

    expect(more).toContain("Хорошо, звонок завершён");
    expect(more).toContain("перезвоните в банк только по номеру");
    expect(contacts).toContain("Проверьте мой счёт");
    expect(contacts).toContain("Не звоните на входящий номер");
    expect(script).toContain("Я не обсуждаю деньги, коды, карты и приложения");
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
      "panicctx:contacts",
      "family:notify",
      "panicctx:script",
      "panicctx:full",
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
