import { describe, expect, it, vi } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { evaluateText, scoreFromCodes } from "@/lib/risk/rules";
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
    expect(evidence?.buttons).toEqual([]);
    expect(evidence?.previews).toEqual([]);
  });

  it("extracts visible link previews and inline buttons as scoring evidence", () => {
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text" dir="auto">
          СЕГОДНЯ СТАВЛЮ НА МАТЧ: США - ГЕРМАНИЯ. Посмотреть прогноз бесплатно.
        </div>
        <a class="tgme_widget_message_link_preview" href="https://t.me/+fdOETKx56pozNTBi">
          <div class="link_preview_site_name accent_color" dir="auto">Telegram</div>
          <div class="link_preview_title" dir="auto">LUXEBET</div>
          <div class="link_preview_description" dir="auto">Азартные игры могут вызывать зависимость. Играйте ответственно. 18+</div>
        </a>
        <div class="tgme_widget_message_inline_keyboard">
          <a class="tgme_widget_message_inline_button" href="https://t.me/+fdOETKx56pozNTBi">
            <span class="tgme_widget_message_inline_button_text">ПРОГНОЗ НА 100.000₽</span>
          </a>
          <a class="tgme_widget_message_inline_button" href="https://example.com/vip">
            <span class="tgme_widget_message_inline_button_text">Подписывайся</span>
          </a>
        </div>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    expect(evidence).not.toBeNull();
    expect(evidence?.previews).toEqual([
      {
        siteName: "Telegram",
        title: "LUXEBET",
        description: "Азартные игры могут вызывать зависимость. Играйте ответственно. 18+",
        url: "https://t.me/+fdOETKx56pozNTBi",
      },
    ]);
    expect(evidence?.buttons).toEqual([
      { text: "ПРОГНОЗ НА 100.000₽", url: "https://t.me/+fdOETKx56pozNTBi" },
      { text: "Подписывайся", url: "https://example.com/vip" },
    ]);
    expect(evidence?.checkInput).toContain("Visible link previews:");
    expect(evidence?.checkInput).toContain("Visible buttons:");
    expect(evidence?.checkInput).toContain("LUXEBET");
    expect(evidence?.checkInput).toContain("ПРОГНОЗ НА");

    const reasons = evaluateText(evidence!.checkInput);
    expect(reasons).toEqual(expect.arrayContaining(["gambling_prediction_promo"]));
  });

  it("uses preview/button evidence for public giveaway voting mechanics", () => {
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text" dir="auto">
          Разыгрываем 3 RANDOM NFT из Банка подарков через 48 часов.
        </div>
        <a class="tgme_widget_message_link_preview" href="https://voting.blockchain-life.com">
          <div class="link_preview_site_name" dir="auto">InvestZone</div>
          <div class="link_preview_title" dir="auto">Зайдите проголосуйте</div>
          <div class="link_preview_description" dir="auto">Со сцены пойду забирать статуэтку</div>
        </a>
        <div class="tgme_widget_message_inline_keyboard">
          <a class="tgme_widget_message_inline_button" href="https://voting.blockchain-life.com">
            <span class="tgme_widget_message_inline_button_text">Участвую!</span>
          </a>
        </div>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    const reasons = evaluateText(evidence!.checkInput);
    expect(reasons).toEqual(
      expect.arrayContaining(["giveaway_engagement_bait", "fake_captcha_or_voting"]),
    );
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it("keeps ordinary public post previews and buttons non-accusatory", () => {
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text" dir="auto">
          Huge Telegram update — 10 major new features and 200+ improvements.
        </div>
        <a class="tgme_widget_message_link_preview" href="https://telegram.org/blog/ai-bot-revolution-11-new-features">
          <div class="link_preview_site_name" dir="auto">Telegram</div>
          <div class="link_preview_title" dir="auto">AI Bot Revolution</div>
          <div class="link_preview_description" dir="auto">New features for developers and users.</div>
        </a>
        <div class="tgme_widget_message_inline_keyboard">
          <a class="tgme_widget_message_inline_button" href="https://telegram.org/blog/ai-bot-revolution-11-new-features">
            <span class="tgme_widget_message_inline_button_text">Read more</span>
          </a>
        </div>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    expect(evidence).not.toBeNull();
    const reasons = evaluateText(evidence!.checkInput);
    expect(reasons).not.toContain("crypto_casino_bonus_funnel");
    expect(reasons).not.toContain("giveaway_engagement_bait");
    expect(reasons).not.toContain("fake_captcha_or_voting");
    expect(reasons).not.toContain("task_reward_engagement_bait");
    expect(reasons).not.toContain("wallet_action_urgency");
    expect(reasons).not.toContain("ton_referral_earning_scheme");
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

  it("sanitizes credential text in post bodies, previews, and button labels", () => {
    const password = "Correct-Horse-Battery-Staple";
    const recoveryPhrase =
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon";
    const evidence = parseTelegramPublicPostHtml(
      telegramHtml(`
        <div class="tgme_widget_message_text js-message_text">
          password = ${password}
        </div>
        <a class="tgme_widget_message_link_preview" href="https://example.com/read">
          <div class="link_preview_title">seed phrase: ${recoveryPhrase}</div>
        </a>
        <div class="tgme_widget_message_inline_keyboard">
          <a class="tgme_widget_message_inline_button" href="https://example.com/action">
            <span class="tgme_widget_message_inline_button_text">password notifier-secret</span>
          </a>
        </div>
      `),
      { username: "TonZnatok", postId: "123" },
    );

    const serialized = JSON.stringify(evidence);
    for (const marker of [password, recoveryPhrase, "notifier-secret"]) {
      expect(serialized).not.toContain(marker);
    }
    expect(evidence?.text).toContain("password");
    expect(evidence?.checkInput).toContain("Visible buttons:");
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
    expect(enriched.explanation).toContain("только видимый текст, ссылки, кнопки и превью");
    expect(enriched.explanation).toContain("SCAM-метки");
    expect(enriched.explanation).toContain("Detected visible giveaway language.");
  });
});
