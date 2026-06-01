// Feature: telegram-bot-mvp, Task 3.3 — unit tests for the four new reason codes.
// Covers R14.4 (asks_to_scan_qr), R14.5 (relative_in_distress),
// R14.6 (requests_card_digits) and R14.7 (threatens_account_block + uses_urgency).
//
// Positive examples are written in Russian and Uzbek (Latin) and MUST trigger the
// code; negative examples are neutral phrases that MUST NOT trigger it. We assert
// membership in the reasons array (toContain / not.toContain) rather than strict
// set equality, because realistic messages can legitimately fire several codes.
import { describe, it, expect } from "vitest";
import { evaluateText, scoreFromCodes } from "./rules";

describe("evaluateText — asks_to_scan_qr (R14.4)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — verb after the QR mention (branch: qr.?код .{0,30} (скан|войти|подтверд|вериф))
    { name: "RU вход через QR с просьбой отсканировать", text: "Наведите камеру на QR-код и отсканируйте, чтобы войти" },
    { name: "RU подтверждение через QR", text: "QR код, отсканируйте для подтверждения личности" },
    // RU — branch: скан .{0,15} qr
    { name: "RU отсканируйте QR для входа", text: "Отсканируйте QR код, чтобы войти в личный кабинет" },
    // UZ — branch: qr.?kod .{0,30} (skaner|kiring|tasdiq)
    { name: "UZ skanerlang va kiring", text: "QR kodni skanerlang va tizimga kiring" },
    { name: "UZ tasdiqlash uchun QR", text: "Tasdiqlash uchun QR kodni skaner qiling" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU нейтральная фраза без QR", text: "Я сегодня купил билеты в кино на вечер" },
    { name: "RU показать чужой QR на входе (без сканирования/входа-глагола)", text: "Покажите ваш QR-код на входе в музей" },
    { name: "UZ нейтральная покупка", text: "Men bugun dokondan non sotib oldim" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("asks_to_scan_qr");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("asks_to_scan_qr");
  });
});

describe("evaluateText — relative_in_distress (R14.5)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — (родственник|сын|...|друг).{0,40}(беда|авари|больниц|задержали|срочно нужны деньги)
    { name: "RU сын попал в аварию", text: "Ваш сын попал в аварию, срочно нужны деньги на лечение" },
    { name: "RU брат в больнице", text: "Твой брат сейчас в больнице, нужна помощь с оплатой" },
    { name: "RU родственника задержали", text: "Вашего родственника задержали, нужно срочно перевести деньги" },
    // UZ — (farzand|...|aka|uka|qiz|do'st).{0,40}(avariya|kasalxona|shoshilinch.{0,10}pul)
    { name: "UZ aka avariyaga tushdi", text: "Akangiz avariyaga tushdi, pul kerak" },
    { name: "UZ do'st kasalxonada", text: "Do'stingiz kasalxonada, tezda pul yuboring" },
    { name: "UZ farzand shoshilinch pul", text: "Farzandingiz uchun shoshilinch pul kerak boldi" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU друг играет в футбол", text: "Мой друг любит играть в футбол по выходным" },
    { name: "RU брат купил машину", text: "Мой брат вчера купил новую машину в салоне" },
    { name: "UZ aka mashina sotib oldi", text: "Akam yangi mashina sotib oldi bugun" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("relative_in_distress");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("relative_in_distress");
  });
});

describe("evaluateText — requests_card_digits (R14.6)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — последн(ие|их).{0,10}(4|четыре).{0,10}цифр
    { name: "RU последние 4 цифры карты", text: "Назовите последние 4 цифры вашей карты" },
    { name: "RU последних четыре цифры", text: "Сообщите последних четыре цифры карты для проверки" },
    // RU — подтверд(и|ите).{0,15}цифр.{0,10}карт
    { name: "RU подтвердите цифры карты", text: "Подтвердите цифры карты для верификации" },
    // UZ — karta.{0,20}(raqam|oxirgi).{0,10}(4|to'rt).{0,10}(raqam|son)
    { name: "UZ karta oxirgi 4 raqam", text: "Karta oxirgi 4 raqamini ayting" },
    { name: "UZ karta oxirgi to'rt raqam", text: "Karta oxirgi to'rt raqamini tasdiqlang" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU карта в кошельке", text: "Моя банковская карта лежит в кошельке дома" },
    { name: "RU заказал новую карту", text: "Я заказал новую карту в банке вчера" },
    { name: "UZ kartam hamyonimda", text: "Mening kartam hamyonimda turibdi" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("requests_card_digits");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("requests_card_digits");
  });
});

describe("evaluateText — threatens_account_block (R14.7)", () => {
  const positives: { name: string; text: string }[] = [
    // RU — (карт(а|у)|счёт|счет|аккаунт).{0,30}(заблокир|блокиров)
    { name: "RU карта будет заблокирована", text: "Ваша карта будет заблокирована через 24 часа" },
    { name: "RU счёт заблокируют", text: "Ваш счёт заблокируют, если не подтвердите данные" },
    { name: "RU аккаунт заблокирован", text: "Аккаунт будет заблокирован при бездействии" },
    // UZ — (karta|hisob).{0,30}(bloklan|bloklab)
    { name: "UZ karta bloklanadi", text: "Kartangiz bloklanadi, tasdiqlang" },
    { name: "UZ hisob bloklanadi", text: "Hisobingiz tez orada bloklanadi" },
  ];

  const negatives: { name: string; text: string }[] = [
    { name: "RU пополнил карту", text: "Я пополнил карту в банкомате сегодня утром" },
    { name: "RU открыл счёт", text: "Я открыл новый счёт в банке на прошлой неделе" },
    { name: "UZ hisobga pul qoshdim", text: "Men hisobimga pul qoshdim" },
  ];

  it.each(positives)("позитив: $name", ({ text }) => {
    expect(evaluateText(text)).toContain("threatens_account_block");
  });

  it.each(negatives)("негатив: $name", ({ text }) => {
    expect(evaluateText(text)).not.toContain("threatens_account_block");
  });
});

describe("integration — block threat + urgency → suspicious (R14.7)", () => {
  it("RU: срочность + блокировка даёт оба кода и уровень suspicious", () => {
    const text = "Срочно подтвердите данные, иначе карта будет заблокирована";
    const codes = evaluateText(text);
    expect(codes).toContain("threatens_account_block");
    expect(codes).toContain("uses_urgency");

    const { score, level } = scoreFromCodes(codes);
    // threatens_account_block (20) + uses_urgency (15) = 35 ≥ 20 → suspicious
    expect(score).toBeGreaterThanOrEqual(20);
    expect(score).toBeLessThan(50);
    expect(level).toBe("suspicious");
  });
});
