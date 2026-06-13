import { describe, expect, it } from "vitest";
import type { Lang } from "@/lib/i18n";
import { CB } from "@/lib/telegram/format";
import { buildWeeklyScamDigestKeyboard, formatWeeklyScamDigest } from "@/lib/telegram/digest";

const LANGS: Lang[] = ["ru", "uz", "en"];

function callbacks(keyboard: ReturnType<typeof buildWeeklyScamDigestKeyboard>): string[] {
  return keyboard.flat().flatMap((button) => (button.callback_data ? [button.callback_data] : []));
}

describe("Weekly scam digest v1", () => {
  it("stays compact in every supported language", () => {
    for (const lang of LANGS) {
      const { text } = formatWeeklyScamDigest(lang);
      expect(text.length).toBeLessThanOrEqual(1600);
    }
  });

  it("covers the main currently-relevant scam funnels", () => {
    const { text } = formatWeeklyScamDigest("ru");

    expect(text).toContain("Казино");
    expect(text).toContain("фриспины");
    expect(text).toContain("NFT");
    expect(text).toContain("Stars");
    expect(text).toContain("Банк");
    expect(text).toContain("APK");
  });

  it("does not make unverifiable accusations", () => {
    const { text } = formatWeeklyScamDigest("ru");

    expect(text).not.toMatch(/точно мошенник|создан вчера|есть скрытая scam-метка/i);
  });

  it("offers only compact next actions", () => {
    expect(callbacks(buildWeeklyScamDigestKeyboard("ru"))).toEqual([
      CB.checkAnother,
      CB.emergency,
      CB.report,
    ]);
  });
});
