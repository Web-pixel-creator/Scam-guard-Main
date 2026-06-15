import { describe, expect, it } from "vitest";

import {
  buildAskedContextKeyboardRows,
  buildAskedContextText,
  parseAskedContextCallback,
} from "@/lib/telegram/check-context-buttons";

describe("check context buttons", () => {
  it("parses only supported asked-context callbacks", () => {
    expect(parseAskedContextCallback("asked:code")).toBe("code");
    expect(parseAskedContextCallback("asked:card")).toBe("card");
    expect(parseAskedContextCallback("asked:transfer")).toBe("transfer");
    expect(parseAskedContextCallback("asked:apk")).toBe("apk");
    expect(parseAskedContextCallback("asked:link_qr")).toBe("link_qr");
    expect(parseAskedContextCallback("asked:call")).toBe("call");

    expect(parseAskedContextCallback("asked:seed")).toBeNull();
    expect(parseAskedContextCallback("check_another")).toBeNull();
  });

  it("builds compact Russian context buttons for inconclusive checks", () => {
    const keyboard = buildAskedContextKeyboardRows("ru");

    expect(keyboard).toHaveLength(3);
    expect(keyboard[0][0]).toMatchObject({ text: "🔐 Просят код", callback_data: "asked:code" });
    expect(keyboard[2][1]).toMatchObject({
      text: "📞 Звонят сейчас",
      callback_data: "asked:call",
    });
  });

  it("answers code context with one safe next step, not a new risk verdict", () => {
    const text = buildAskedContextText("code", "ru");

    expect(text).toContain("Просят SMS-код");
    expect(text).toContain("Не отправляйте код");
    expect(text).toContain("Перезвоните");
    expect(text).not.toContain("Недостаточно данных");
  });
});
