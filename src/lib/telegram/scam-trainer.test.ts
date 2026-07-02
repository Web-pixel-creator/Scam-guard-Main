import { describe, expect, it } from "vitest";

import type { Lang } from "@/lib/i18n";
import {
  buildTrainerAnswer,
  buildTrainerCallbackResponse,
  buildTrainerIntro,
  buildTrainerQuestion,
  parseTrainerCallback,
  trainerAnswerCallback,
  trainerQuestionCallback,
} from "@/lib/telegram/scam-trainer";

const LANGS: Lang[] = ["ru", "uz", "en"];

function callbacks(keyboard: { callback_data?: string }[][]): string[] {
  return keyboard.flat().flatMap((button) => (button.callback_data ? [button.callback_data] : []));
}

describe("Scam-call trainer mini-quiz", () => {
  it.each(LANGS)("builds a localized intro with no session-dependent state (%s)", (lang) => {
    const intro = buildTrainerIntro(lang);

    expect(intro.text).toContain(lang === "ru" ? "Тренажёр" : lang === "uz" ? "trener" : "trainer");
    expect(callbacks(intro.keyboard)).toEqual([trainerQuestionCallback(1, 0), "safety"]);
  });

  it("parses trainer callbacks and rejects malformed values", () => {
    expect(parseTrainerCallback("trainer:start")).toEqual({ kind: "start" });
    expect(parseTrainerCallback("trainer:q:2:1")).toEqual({
      kind: "question",
      questionId: 2,
      score: 1,
    });
    expect(parseTrainerCallback("trainer:a:2:0:1")).toEqual({
      kind: "answer",
      questionId: 2,
      optionIndex: 0,
      score: 1,
    });
    expect(parseTrainerCallback("trainer:q:9:0")).toBeNull();
    expect(parseTrainerCallback("trainer:a:1:9:0")).toBeNull();
    expect(parseTrainerCallback("trainer:a:one:0:0")).toBeNull();
  });

  it("renders question options as defensive choices", () => {
    const question = buildTrainerQuestion(1, "ru", 0);

    expect(question.text).toContain("Что безопаснее сделать?");
    expect(callbacks(question.keyboard)).toEqual([
      trainerAnswerCallback(1, 0, 0),
      trainerAnswerCallback(1, 1, 0),
      trainerAnswerCallback(1, 2, 0),
    ]);
    expect(JSON.stringify(question.keyboard)).toContain("официальный номер");
  });

  it("increments score only for the safe option and advances to the next question", () => {
    const correct = buildTrainerAnswer(1, 0, "ru", 0);
    const wrong = buildTrainerAnswer(1, 1, "ru", 0);

    expect(correct.text).toContain("✅ Верно");
    expect(correct.text).toContain("Счёт: 1/5");
    expect(callbacks(correct.keyboard)).toEqual([trainerQuestionCallback(2, 1)]);

    expect(wrong.text).toContain("⚠️ Небезопасно");
    expect(wrong.text).toContain("Счёт: 0/5");
    expect(callbacks(wrong.keyboard)).toEqual([trainerQuestionCallback(2, 0)]);
  });

  it("finishes after the last question and offers restart or emergency help", () => {
    const final = buildTrainerAnswer(5, 0, "ru", 4);

    expect(final.text).toContain("Тренировка завершена");
    expect(final.text).toContain("Счёт: 5/5");
    expect(callbacks(final.keyboard)).toEqual([trainerQuestionCallback(1, 0), "emergency"]);
  });

  it("builds callback responses without exposing attacker-ready scripts", () => {
    const allText = [
      buildTrainerCallbackResponse("trainer:start", "ru")?.text,
      buildTrainerCallbackResponse("trainer:q:1:0", "ru")?.text,
      buildTrainerCallbackResponse("trainer:a:1:0:0", "ru")?.text,
      buildTrainerCallbackResponse("trainer:q:3:1", "ru")?.text,
      buildTrainerCallbackResponse("trainer:a:3:1:1", "ru")?.text,
    ].join("\n");

    expect(allText).not.toMatch(/продиктуйте|сообщите.*код|безопасн(ый|ом)\s+сч[её]т/i);
    expect(allText).not.toMatch(/AnyDesk|TeamViewer|RustDesk/i);
    expect(allText).not.toMatch(/\b\d{4,8}\b/);
  });
});
