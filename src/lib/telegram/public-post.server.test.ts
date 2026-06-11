import { describe, expect, it, vi } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import {
  buildTelegramPublicPostCheckEvidence,
  enrichTelegramPublicPostResult,
  extractTelegramPublicPostTarget,
  fetchTelegramPublicPost,
  parseTelegramPublicPostHtml,
  type PublicPostFetcher,
} from "@/lib/telegram/public-post.server";

function baseResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "text",
    display: "telegram public post",
    level: "suspicious",
    score: 35,
    reasons: ["giveaway_engagement_bait"],
    explanation: "Detected visible giveaway language.",
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

function telegramHtml(body: string): string {
  return `
    <section class="tgme_channel_history js-message_history">
      <div class="tgme_widget_message_wrap js-widget_message_wrap">
        <div class="tgme_widget_message" data-post="Other/1">
          <div class="tgme_widget_message_text js-message_text">wrong post</div>
        </div>
      </div>
      <div class="tgme_widget_message_wrap js-widget_message_wrap">
        <div class="tgme_widget_message" data-post="TonZnatok/123">
          ${body}
          <a href="https://t.me/TonZnatok/123">self</a>
          <a href="https://t.me/s/TonZnatok/123">self s</a>
        </div>
      </div>
    </section>
  `;
}

describe("telegram public post fetch", () => {
  it("extracts only public Telegram post targets", () => {
    expect(extractTelegramPublicPostTarget("https://t.me/TonZnatok/123")).toEqual({
      username: "TonZnatok",
      postId: "123",
    });
    expect(extractTelegramPublicPostTarget("https://t.me/s/TonZnatok/456")).toEqual({
      username: "TonZnatok",
      postId: "456",
    });
    expect(extractTelegramPublicPostTarget("https://t.me/+fdOETKx56pozNTBi")).toBeNull();
    expect(extractTelegramPublicPostTarget("@UiWebWeb")).toBeNull();
  });

  it("extracts visible post text and outbound links from Telegram web HTML", () => {
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text" dir="auto">
          Разыгрываем 3 RANDOM NFT<br>
          Из условий: пройти капчу, 3 реакции,
          <a href="https://voting.blockchain-life.com">проголосовать</a>
        </div>
        <a href="https://gift.example/claim?x=1">claim</a>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    expect(evidence).not.toBeNull();
    expect(evidence?.text).toContain("RANDOM NFT");
    expect(evidence?.text).toContain("пройти капчу");
    expect(evidence?.links).toEqual([
      "https://voting.blockchain-life.com",
      "https://gift.example/claim?x=1",
    ]);
    expect(evidence?.checkInput).toContain("Telegram public post: https://t.me/TonZnatok/123");
    expect(evidence?.checkInput).toContain("Public post text:");
    expect(evidence?.checkInput).toContain("Visible post links:");
    expect(evidence?.checkInput).not.toContain("<br");
  });

  it("redacts sensitive digits before building risk evidence", () => {
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text">
          SMS-код 123456 и карта 4111111111111111
        </div>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    expect(evidence?.text).toContain("SMS-код ••••");
    expect(evidence?.text).toContain("•••• •••• •••• ••••");
    expect(evidence?.text).not.toContain("123456");
    expect(evidence?.text).not.toContain("4111111111111111");
  });

  it("fetches only the validated Telegram public web URL", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://t.me/s/TonZnatok/123");
      expect(init?.redirect).toBe("error");
      return new Response(
        telegramHtml(`
          <div class="tgme_widget_message_text js-message_text">Пройти капчу за подарок</div>
        `),
        { status: 200, headers: { "content-length": "500" } },
      );
    }) satisfies PublicPostFetcher;

    const evidence = await fetchTelegramPublicPost(
      { username: "TonZnatok", postId: "123" },
      fetcher,
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(evidence?.checkInput).toContain("Пройти капчу за подарок");
  });

  it("fails closed on network errors, missing posts and oversized responses", async () => {
    await expect(
      fetchTelegramPublicPost(
        { username: "TonZnatok", postId: "123" },
        vi.fn(async () => new Response("not found", { status: 404 })),
      ),
    ).resolves.toBeNull();

    await expect(
      fetchTelegramPublicPost(
        { username: "TonZnatok", postId: "123" },
        vi.fn(async () => {
          throw new Error("network down");
        }),
      ),
    ).resolves.toBeNull();

    await expect(
      fetchTelegramPublicPost(
        { username: "TonZnatok", postId: "123" },
        vi.fn(
          async () =>
            new Response("too large", {
              status: 200,
              headers: { "content-length": "1000001" },
            }),
        ),
      ),
    ).resolves.toBeNull();

    await expect(
      fetchTelegramPublicPost(
        { username: "TonZnatok", postId: "123" },
        vi.fn(async () => new Response("x".repeat(1_000_001), { status: 200 })),
      ),
    ).resolves.toBeNull();
  });

  it("rate-limits public post fetch separately from the main check pipeline", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(
          telegramHtml(`
            <div class="tgme_widget_message_text js-message_text">Пройти голосование за NFT</div>
          `),
          { status: 200 },
        ),
    ) satisfies PublicPostFetcher;

    const key = `unit:${Date.now()}:${Math.random()}`;
    const input = "https://t.me/TonZnatok/123";
    const results = await Promise.all(
      Array.from({ length: 6 }, () => buildTelegramPublicPostCheckEvidence(input, key, fetcher)),
    );

    expect(results.filter(Boolean)).toHaveLength(5);
    expect(results[5]).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("prepends a source limitation without changing deterministic verdict fields", () => {
    const result = baseResult();
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text">Розыгрыш NFT за капчу</div>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    const enriched = enrichTelegramPublicPostResult(result, evidence, "ru");

    expect(enriched.level).toBe(result.level);
    expect(enriched.score).toBe(result.score);
    expect(enriched.reasons).toEqual(result.reasons);
    expect(enriched.explanation).toContain("публичный Telegram-пост @TonZnatok/123");
    expect(enriched.explanation).toContain("только видимый текст/ссылки");
    expect(enriched.explanation).toContain("SCAM-метки");
    expect(enriched.explanation).toContain("Detected visible giveaway language.");
  });
});
