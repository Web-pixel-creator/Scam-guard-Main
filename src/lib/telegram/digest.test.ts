import { describe, expect, it } from "vitest";
import type { Lang } from "@/lib/i18n";
import { CB } from "@/lib/telegram/format";
import {
  buildWeeklyScamDigestKeyboard,
  formatWeeklyScamDigest,
  getWeeklyScamDigestSnapshot,
  WEEKLY_SCAM_DIGEST_ENTRIES,
  type WeeklyScamDigestEntry,
} from "@/lib/telegram/digest";

const LANGS: Lang[] = ["ru", "uz", "en"];
const FRESH_NOW = new Date("2026-07-03T00:00:00.000Z");
const STALE_NOW = new Date("2026-07-20T00:00:00.000Z");

function callbacks(keyboard: ReturnType<typeof buildWeeklyScamDigestKeyboard>): string[] {
  return keyboard.flat().flatMap((button) => (button.callback_data ? [button.callback_data] : []));
}

describe("Weekly scam digest v1", () => {
  it("stays compact in every supported language", () => {
    for (const lang of LANGS) {
      const { text } = formatWeeklyScamDigest(lang, { now: FRESH_NOW });
      expect(text.length).toBeLessThanOrEqual(1600);
    }
  });

  it("covers the main currently-relevant scam funnels", () => {
    const { text } = formatWeeklyScamDigest("ru", { now: FRESH_NOW });

    expect(text).toContain("Казино");
    expect(text).toContain("фриспины");
    expect(text).toContain("NFT");
    expect(text).toContain("Stars");
    expect(text).toContain("Банк");
    expect(text).toContain("APK");
  });

  it("does not make unverifiable accusations", () => {
    const { text } = formatWeeklyScamDigest("ru", { now: FRESH_NOW });

    expect(text).not.toMatch(/точно мошенник|создан вчера|есть скрытая scam-метка/i);
  });

  it("offers only compact next actions", () => {
    expect(callbacks(buildWeeklyScamDigestKeyboard("ru"))).toEqual([
      CB.checkAnother,
      CB.emergency,
      CB.report,
    ]);
  });

  it("keeps every public topic behind manual source/status/update metadata", () => {
    expect(WEEKLY_SCAM_DIGEST_ENTRIES).toHaveLength(3);

    for (const entry of WEEKLY_SCAM_DIGEST_ENTRIES) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(entry.status).toBe("published");
      expect(entry.publishMode).toBe("manual");
      expect(entry.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.source.label).toContain("Ishonch Guard");
      expect(entry.source.type).toMatch(/^(curated_research|moderated_pattern|official_guidance)$/);
      expect(entry.tags.length).toBeGreaterThan(0);

      for (const lang of LANGS) {
        expect(entry.copy[lang].title).toBeTruthy();
        expect(entry.copy[lang].hook).toBeTruthy();
        expect(entry.copy[lang].wants).toBeTruthy();
        expect(entry.copy[lang].safe).toBeTruthy();
      }
    }
  });

  it("renders only fresh manually published entries", () => {
    const draft: WeeklyScamDigestEntry = {
      ...WEEKLY_SCAM_DIGEST_ENTRIES[0],
      id: "draft-test-entry",
      rank: 0,
      status: "draft",
      copy: {
        ...WEEKLY_SCAM_DIGEST_ENTRIES[0].copy,
        en: {
          title: "Draft should not render",
          hook: "Hook: internal draft.",
          wants: "They want: nothing public.",
          safe: "Safe step: keep it private.",
        },
      },
    };

    const snapshot = getWeeklyScamDigestSnapshot("en", {
      now: FRESH_NOW,
      entries: [draft, ...WEEKLY_SCAM_DIGEST_ENTRIES],
    });

    expect(snapshot.isStaleFallback).toBe(false);
    expect(snapshot.entries.map((entry) => entry.id)).not.toContain("draft-test-entry");
    expect(snapshot.text).not.toContain("Draft should not render");
  });

  it("uses a safe stale fallback when there are not enough fresh records", () => {
    const snapshot = getWeeklyScamDigestSnapshot("ru", {
      now: STALE_NOW,
      entries: WEEKLY_SCAM_DIGEST_ENTRIES,
    });

    expect(snapshot.isStaleFallback).toBe(true);
    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.text).toContain("обновляется вручную");
    expect(snapshot.text).not.toContain("Казино");
    expect(snapshot.text).not.toContain("NFT");
  });

  it("falls back instead of publishing a partial digest below the minimum topic count", () => {
    const snapshot = getWeeklyScamDigestSnapshot("en", {
      now: FRESH_NOW,
      entries: WEEKLY_SCAM_DIGEST_ENTRIES.slice(0, 2),
    });

    expect(snapshot.isStaleFallback).toBe(true);
    expect(snapshot.entries).toHaveLength(0);
    expect(snapshot.text).toContain("manually updated");
    expect(snapshot.text).not.toContain("Casino / free spins");
  });

  it("does not expose raw report-shaped evidence in the public text", () => {
    const { text } = getWeeklyScamDigestSnapshot("en", { now: FRESH_NOW });

    expect(text).not.toMatch(/https?:\/\/|t\.me\/|@[\w_]{5,}/i);
    expect(text).not.toMatch(/\+?\d[\d\s().-]{7,}\d/);
    expect(text).not.toMatch(/\b\d{4,8}\b/);
    for (const entry of WEEKLY_SCAM_DIGEST_ENTRIES) {
      expect(text).not.toContain(entry.source.label);
    }
  });
});
