import { describe, expect, it } from "vitest";

import {
  classifyLiveCallContext,
  classifyTextPanicIntent,
  classifyVoicePanicIntent,
  isAccidentalOutgoingTransferIntent,
  isNegatedVoiceDoneIntent,
  normalizeVoiceIntentText,
} from "@/lib/telegram/text-panic-intent";

describe("pure Telegram text panic intent", () => {
  it.each([
    "деньги не тому человеку перевела, можно вернуть?",
    "не туда деньги отправил по ошибке",
    "перевёл деньги на чужую карту случайно",
    "Платёж уже исполнился, я ошибся получателем. Как начать возврат через свой банк?",
    "Я сам первёл оплату на чужую карту, перепутав адресата. Можно отозвать операцию?",
    "мен пулни адашиб бошқа одамга юбордим",
    "пулни бошқа одамга хато юбордим",
    "To'lov o'tib bo'ldi, noto'g'ri hisobga jo'natganman. Bankimda bekor qilishni qanday boshlayman?",
    "The payment already settled to the wrong account. How do I start a bank dispute?",
    "I transerred the payment to an unrelated recipient by mistake. Can my bank recall it?",
    "По ошибке пополнил чужой номер телефона. Можно отменить?",
    "Оплатила чужой телефон по ошибке — что теперь нажать, чтобы отменить?",
    "I topped up someone else's phone by mistake—how can I cancel it?",
    "Boshqa telefon raqamiga xato to'ladim — bekor qilish mumkinmi?",
    "Adashib boshqa odamning telefon raqamiga to'lov qildim.",
    "я пополнил не ту карту по ошибке",
    "пополнил не тот счёт, как вернуть деньги?",
    "я пополнил не ту карту",
    "пополнил не тот счёт",
  ])("keeps an ordinary outgoing recipient mistake out of scam panic: %s", (text) => {
    expect(isAccidentalOutgoingTransferIntent(text)).toBe(true);
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it.each([
    "мне пришли деньги по ошибке и просят вернуть на другую карту",
    "menga pul xato tushdi, boshqa kartaga qaytar deyapti",
    "я уже пополнил баланс",
    "Men pul o'tkazdim.",
  ])("does not hide an incoming return request behind the outgoing-mistake guard: %s", (text) => {
    expect(isAccidentalOutgoingTransferIntent(text)).toBe(false);
  });

  it.each([
    "Я оплатил не тот тариф.",
    "Я оплатил, но не тут.",
    "Я отправил деньги, но не тотально уверен.",
  ])("does not treat an unrelated Russian 'ту/тот' fragment as a recipient mistake: %s", (text) => {
    expect(isAccidentalOutgoingTransferIntent(text)).toBe(false);
  });

  it.each([
    ["Я отправил не тот код из SMS.", 1],
    ["Я отправил не тот OTP-код человеку, который позвонил из банка.", 1],
  ] as const)(
    "does not hide a completed code-disclosure scam behind the mistake guard: %s",
    (text, panicId) => {
      expect(isAccidentalOutgoingTransferIntent(text)).toBe(false);
      expect(classifyTextPanicIntent(text)).toBe(panicId);
    },
  );

  it.each([
    "Я сделал запланированный перевод знакомому поставщику по официальному счёту; получатель и сумма подтверждены.",
    "Rejalashtirilgan to'lovni tanish yetkazib beruvchiga rasmiy hisob bo'yicha yubordim; oluvchi va summa to'g'ri.",
    "Режалаштирилган тўловни таниш етказиб берувчига расмий ҳисоб бўйича юбордим; олувчи ва сумма тўғри.",
    "I made the planned transfer to a known supplier against its official invoice; the recipient and amount are confirmed.",
  ])("does not turn a confirmed routine transfer into completed-scam panic: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it.each([
    ["Я уже отправил код из SMS.", 1],
    ["I installed AnyDesk and allowed screen access.", 2],
    ["Men pul o'tkazdim.", 3],
    ["I already sent my CVV.", 4],
    ["Я отсканировал QR для входа в Telegram.", 5],
    ["Мне сейчас звонят из банка.", 6],
    ["ya perevel dengi na kartu", 3],
  ] as const)("classifies an active or already-completed emergency: %s", (text, panicId) => {
    expect(classifyTextPanicIntent(text)).toBe(panicId);
  });

  it.each([
    "Я не отправил код.",
    "Я уже почти сказала код, но решила сначала спросить.",
    "Я чуть не назвал код из SMS.",
    "Men kodni yubormadim.",
    "I did not send the verification code.",
    "I shared no codes.",
    "I almost shared the SMS code but stopped.",
    "I did not wire them the money.",
    "I almost wired them the money.",
    "Я не скинул им деньги.",
    "Я почти скинула цифры из сообщения.",
    "Men pul o'tkazmayman.",
    "Raqamni tashlab yubormadim.",
    "Pulni jo'natvormadim.",
  ])("keeps a negated action outside panic: %s", (text) => {
    expect(isNegatedVoiceDoneIntent(text)).toBe(true);
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it.each([
    "Мама уже сообщила им код.",
    "Мошенник написал: я уже перевёл деньги.",
    "Scammer wrote: I already sent the money.",
    "Scammer wrote: The money has already gone to them.",
    "Scammer wrote: They have my verification code now.",
    "He wired them the money.",
    "U kishi aytdi: men kodni yubordim.",
    "U kishi aytdi: pulni jo'natvordim.",
    "They asked me to send a code.",
  ])("does not invent a first-person completed emergency: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBeNull();
  });

  it("does not issue live-call panic instructions for a completed Uzbek call report", () => {
    expect(
      classifyTextPanicIntent("Menga turli noma'lum raqamlardan qayta-qayta qo'ng'iroq qilishdi."),
    ).toBeNull();
    expect(classifyTextPanicIntent("Menga noma'lum raqam qo'ng'iroq qilishyapti.")).toBe(6);
  });

  it.each([
    "Menga akam qo'ng'iroq qildi, shoshilinch pul so'radi",
    "Menga Beeline operatori telefon qildi, raqam bloklanadi deyapti",
    "Menga Soliqdan qo'ng'iroq qildi, SMS kod so'radi",
  ])("keeps an Uzbek call with an explicit active danger on panic guidance: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBe(6);
  });

  it("does not treat forwarded text as the sender's emergency", () => {
    expect(
      classifyTextPanicIntent("Я уже отправил код из SMS.", {
        kind: "channel",
        title: "Example",
        username: "example_channel",
      }),
    ).toBeNull();
  });

  it.each([
    ["Мне сейчас звонят, сын срочно просит деньги.", "relative"],
    ["Мне сейчас звонят из налоговой и просят PINFL.", "government"],
    ["Menga hozir Beeline operatori qo'ng'iroq qilyapti.", "operator"],
    ["A bank caller is on the line.", "bank"],
    ["Someone is calling me right now.", "generic"],
  ] as const)("classifies live-call context in priority order: %s", (text, context) => {
    expect(classifyVoicePanicIntent(text)).toBe(6);
    expect(classifyLiveCallContext(text)).toBe(context);
  });

  it("normalizes Unicode apostrophes and Uzbek Cyrillic letters deterministically", () => {
    expect(normalizeVoiceIntentText("  ҚЎҒИРЎҚ  O‘RNATDIM  ")).toBe("кугирук o'rnatdim");
  });

  it.each([
    "код уже продиктовала им",
    "я им назвала цифры из смс",
    "они уже знают мой код",
    "сказала им шесть цифр которые пришли",
    "я им скинула цифры из сообщения",
    "я уже сообщил одноразовый пароль",
    "raqamlarni aytvordim",
    "raqamni tashlab yubordim",
    "sms kodni aytvordim",
    "They have my verification code now",
    "I read out the one-time password",
  ])("routes a colloquial completed code disclosure to aftercare: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBe(1);
  });

  it.each([
    "pulni otkazvordim",
    "pulni o'tkazvordim",
    "pulni jo'natvordim",
    "я скинул им деньги",
    "I wired them the money",
    "The money has already gone to them",
  ])("routes a colloquial completed transfer to aftercare: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBe(3);
  });

  it.each([
    "Код уже продиктовала мама.",
    "Он сказал: «они уже знают мой код».",
    "Они знают мой код домофона.",
    "They have my apartment door code now.",
    "They do not have my verification code.",
    "The money has not gone to them.",
    "The money has almost gone to them.",
    "I read about one-time password security.",
    "I told my son how a one-time password works.",
    "I said a one-time password is safer.",
    "I said not to share the one-time password.",
    "I said I never shared the one-time password.",
    "Я сообщил банку о проблеме с одноразовым паролем.",
    "Я сказал, что одноразовый пароль безопаснее.",
    "Я сообщил другу, как работает одноразовый пароль.",
    "Я сказал не сообщать одноразовый пароль.",
    "Я сказал, что никогда не сообщал одноразовый пароль.",
    "I wired the money to my landlord.",
    "I wired them the money for rent.",
    "The money has gone to them as planned for the rent.",
    "The money has already gone to them as planned for the rent.",
    "They know my login number but not my password.",
    "They have my SMS number, which is just my phone number.",
    "He knows our verification number from the public ticket.",
    "They know my login code name, not a code.",
    "Kod haqida aytdim.",
    "Men dasturlash kodi haqida aytdim.",
    "SMS haqida aytdim.",
    "Telefon raqamni tashlab yubordim.",
    "Kod xavfsizligi haqida jo'natdim.",
    "Я им скинул код проекта.",
    "Я им скинул код на GitHub.",
    "Я им скинул цифры отчёта.",
    "Я ему скинул SMS-инструкцию.",
    "Я скинул ему карту проезда.",
    "Я скинул им перевод статьи.",
    "Я скинула ей баланс отчёта.",
    "Я скинул им сумму расчёта.",
    "Я скинул ему деньги за обед.",
    "Ular meni hozir shoshirib, yaqinlarimga qo'ng'iroq qilmaslikni aytishyapti",
    "Raqamlarni aytvormadim.",
    "Pulni otkazvormadim.",
  ])("does not turn third-party, physical-access, or negated text into aftercare: %s", (text) => {
    expect(classifyTextPanicIntent(text)).toBeNull();
  });
});
