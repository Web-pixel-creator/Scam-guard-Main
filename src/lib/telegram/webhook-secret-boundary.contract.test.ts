import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("Unauthorized webhook reached database");
      },
    },
  ),
}));

describe("Telegram webhook secret comparison contract", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "offline-boundary-test-bot-token");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "test-telegram-webhook-secret");
    vi.stubEnv("TELEGRAM_UPDATE_DELIVERY_MODE", "webhook");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("retains a fixed-length timing-safe comparison instead of string equality", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "lib", "telegram", "webhook.server.ts"),
      "utf8",
    );

    expect(source).toContain('import { createHash, timingSafeEqual } from "node:crypto"');
    expect(source.match(/createHash\("sha256"\)/gu)).toHaveLength(2);
    expect(source).toContain("timingSafeEqual(actualDigest, expectedDigest)");
    expect(source).not.toMatch(/header\s*!==\s*secret/u);
  });

  it.each([undefined, "wrong-local-token", "test-telegram-webhook-secret-with-extra"])(
    "rejects invalid token %s before acquiring or reading a poison body stream",
    async (token) => {
      const { handleTelegramWebhook } = await import("./webhook.server");
      let bodyAccesses = 0;
      let streamReads = 0;
      let textReads = 0;
      const request = new Request("https://offline.invalid/api/telegram/webhook", {
        method: "POST",
        headers: token ? { "X-Telegram-Bot-Api-Secret-Token": token } : {},
      });
      Object.defineProperty(request, "body", {
        get() {
          bodyAccesses += 1;
          return {
            getReader() {
              streamReads += 1;
              throw new Error("Unauthorized body stream was acquired");
            },
          };
        },
      });
      Object.defineProperty(request, "text", {
        value() {
          textReads += 1;
          throw new Error("Unauthorized body text was read");
        },
      });
      const response = await handleTelegramWebhook(request);
      expect(response.status).toBe(401);
      expect({ bodyAccesses, streamReads, textReads }).toEqual({
        bodyAccesses: 0,
        streamReads: 0,
        textReads: 0,
      });
    },
  );

  it("positive control: the exact valid token reaches the same observable body boundary", async () => {
    const { handleTelegramWebhook } = await import("./webhook.server");
    let bodyAccesses = 0;
    let readerAcquisitions = 0;
    const request = new Request("https://offline.invalid/api/telegram/webhook", {
      method: "POST",
      headers: { "X-Telegram-Bot-Api-Secret-Token": "test-telegram-webhook-secret" },
    });
    Object.defineProperty(request, "body", {
      get() {
        bodyAccesses += 1;
        return {
          getReader() {
            readerAcquisitions += 1;
            // Invalid-body acknowledgement prevents dispatch/database work.
            throw new Error("Observable invalid body reached after valid auth");
          },
        };
      },
    });
    const response = await handleTelegramWebhook(request);
    expect(response.status).toBe(200);
    expect({ bodyAccesses, readerAcquisitions }).toEqual({
      bodyAccesses: 1,
      readerAcquisitions: 1,
    });
  });
});
