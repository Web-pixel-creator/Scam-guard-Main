// Feature: telegram-bot-mvp, Property 8: MarkdownV2-безопасность
//
// Property 8 (design.md → "MarkdownV2-безопасность", Validates: Requirements 4.4, 7.5):
// для любой строки результат `escapeMarkdownV2` корректно экранирован — каждый
// спецсимвол MarkdownV2 ( _ * [ ] ( ) ~ ` > # + - = | { } . ! ) предварён
// нечётным числом обратных слешей (т.е. экранирован) — и функция идемпотентна:
// `escapeMarkdownV2(escapeMarkdownV2(s)) === escapeMarkdownV2(s)`.
//
// Импорт api.server.ts в node-тесте безопасен: `escapeMarkdownV2` — чистая
// функция, а токен бота читается лениво внутри ДРУГИХ функций (getTelegramBotToken
// вызывается только в сетевых хелперах), поэтому загрузка модуля ничего не читает.
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { escapeMarkdownV2 } from "@/lib/telegram/api.server";

/**
 * Набор спецсимволов MarkdownV2, которые `escapeMarkdownV2` обязан экранировать.
 * Дублируется здесь (а не импортируется) намеренно: тест проверяет контракт
 * независимо от внутренней константы модуля.
 */
const MARKDOWN_V2_SPECIALS = new Set([
  "_", "*", "[", "]", "(", ")", "~", "`", ">", "#",
  "+", "-", "=", "|", "{", "}", ".", "!",
]);

/**
 * Проверка валидности экранирования MarkdownV2.
 *
 * Строка считается корректно экранированной, если КАЖДЫЙ спецсимвол предварён
 * НЕЧЁТНЫМ числом подряд идущих обратных слешей. Чётное число слешей (включая
 * ноль) означает, что спецсимвол НЕ экранирован: при чётном числе слешей все они
 * "схлопываются" в литеральные слеши, а спецсимвол остаётся управляющим. При
 * нечётном — последний слеш экранирует спецсимвол.
 *
 * Итерация по код-поинтам ([...s]) совпадает с обходом самой функции
 * (`for (const ch of s)`), поэтому подсчёт слешей согласован для любых строк,
 * включая суррогатные пары.
 */
function isValidMarkdownV2(s: string): boolean {
  const chars = [...s];
  for (let i = 0; i < chars.length; i++) {
    if (!MARKDOWN_V2_SPECIALS.has(chars[i])) continue;
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && chars[j] === "\\"; j--) backslashes++;
    if (backslashes % 2 === 0) return false; // спецсимвол не экранирован
  }
  return true;
}

/**
 * Генератор краевых случаев: строки из подмножества {спецсимволы, слеши,
 * безобидные символы}. Такие входы максимально нагружают логику подсчёта слешей
 * и соседства спецсимволов (включая уже-экранированные и двойные слеши).
 */
const specialHeavyString = fc
  .array(
    fc.constantFrom(
      "_", "*", "[", "]", "(", ")", "~", "`", ">", "#",
      "+", "-", "=", "|", "{", "}", ".", "!",
      "\\", "\\", // слеши встречаются чаще, чтобы провоцировать чётные/нечётные серии
      "a", " ",
    ),
    { maxLength: 40 },
  )
  .map((parts) => parts.join(""));

describe("escapeMarkdownV2 — Property 8: MarkdownV2-безопасность", () => {
  it("валиден и идемпотентен для произвольных строк (fast-check, ≥100 прогонов)", () => {
    fc.assert(
      fc.property(
        // fc.string() — ASCII-ориентированные строки; { unit: "grapheme" } —
        // полноценный Unicode (включая эмодзи/суррогатные пары, fast-check v4);
        // specialHeavyString — краевые случаи из спецсимволов и слешей.
        fc.oneof(fc.string(), fc.string({ unit: "grapheme" }), specialHeavyString),
        (s) => {
          const once = escapeMarkdownV2(s);

          // (1) Валидность: каждый спецсимвол экранирован (нечётное число слешей).
          expect(isValidMarkdownV2(once)).toBe(true);

          // (2) Идемпотентность относительно набора спецсимволов.
          expect(escapeMarkdownV2(once)).toBe(once);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("экранирует все 18 спецсимволов в явном примере и идемпотентен", () => {
    const allSpecials = "_*[]()~`>#+-=|{}.!";
    const escaped = escapeMarkdownV2(allSpecials);

    // Каждый спецсимвол предварён ровно одним слешем.
    expect(escaped).toBe("\\_\\*\\[\\]\\(\\)\\~\\`\\>\\#\\+\\-\\=\\|\\{\\}\\.\\!");
    expect(isValidMarkdownV2(escaped)).toBe(true);

    // Повторное экранирование ничего не меняет (нет двойного экранирования).
    expect(escapeMarkdownV2(escaped)).toBe(escaped);

    // Уже экранированный ввод остаётся валидным и стабильным.
    expect(escapeMarkdownV2("\\_already\\.escaped\\!")).toBe("\\_already\\.escaped\\!");

    // Обычный текст без спецсимволов не меняется.
    expect(escapeMarkdownV2("обычный текст 123")).toBe("обычный текст 123");
  });
});
