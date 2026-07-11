import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  existingRows: [] as Array<{ id: string }>,
  inserts: [] as Array<Record<string, unknown>>,
  hashInputs: [] as string[],
  moderationNotices: [] as Array<Record<string, unknown>>,
  rateLimitResult: { ok: true, remaining: 2, retryAfterSec: 0 } as
    | { ok: true; remaining?: number; retryAfterSec?: number }
    | { ok: false; retryAfterSec: number },
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      inputValidator() {
        return builder;
      },
      handler(handler: unknown) {
        return handler;
      },
    };
    return builder;
  },
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => null,
  getRequestIP: () => "127.0.0.1",
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "reputation_appeals") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              limit: async () => ({ data: hoisted.existingRows, error: null }),
            }),
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          hoisted.inserts.push(row);
          return { data: null, error: null };
        },
      };
    },
  },
}));

vi.mock("@/lib/risk/hash", () => ({
  hashIdentifier: async (value: string) => {
    hoisted.hashInputs.push(value);
    return `hash:${value}`;
  },
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: async () => hoisted.rateLimitResult,
}));

vi.mock("@/lib/telegram/moderation-notifier.server", () => ({
  notifyModeration: async (notice: Record<string, unknown>) => {
    hoisted.moderationNotices.push(notice);
    return { ok: true };
  },
}));

import { submitReputationAppealCore } from "./reputation-appeal.functions";

beforeEach(() => {
  hoisted.existingRows.length = 0;
  hoisted.inserts.length = 0;
  hoisted.hashInputs.length = 0;
  hoisted.moderationNotices.length = 0;
  hoisted.rateLimitResult = { ok: true, remaining: 2, retryAfterSec: 0 };
});

describe("submitReputationAppealCore", () => {
  it("hashes targets and stores only redacted appeal details", async () => {
    const result = await submitReputationAppealCore(
      {
        target: "+998 90 123 45 67",
        reason:
          "Wrong label. My SMS code is 123456, card is 8600 1234 5678 9012, email test@example.com.",
        contact: "owner@example.com",
        lang: "ru",
      },
      "appeal:test",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.hashInputs).toEqual(["+998901234567", "appeal-contact:owner@example.com"]);
    expect(hoisted.inserts).toHaveLength(1);

    const row = hoisted.inserts[0];
    expect(row).toMatchObject({
      target_type: "phone",
      target_hash: "hash:+998901234567",
      contact_hash: "hash:appeal-contact:owner@example.com",
    });
    expect(String(row.target_display)).not.toContain("1234567");
    expect(String(row.reason)).not.toContain("123456");
    expect(String(row.reason)).not.toContain("8600 1234 5678 9012");
    expect(String(row.reason)).not.toContain("test@example.com");
    expect(String(row.contact_display)).not.toContain("owner@example.com");
  });

  it("redacts appeal links and Telegram identifiers before persistence and alerts", async () => {
    const result = await submitReputationAppealCore(
      {
        target: "https://t.me/FakeSupportBot?start=secret",
        reason:
          "Evidence: https://evil.example/reset?token=secret, @VictimOwner, and https://t.me/+SecretInviteToken123.",
        contact: "https://contact.example/private?token=contactsecret",
        lang: "ru",
      },
      "appeal:test:url-telegram",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.hashInputs).toEqual([
      "@FakeSupportBot",
      "appeal-contact:https://contact.example/private",
    ]);
    expect(hoisted.inserts).toHaveLength(1);

    const stored = JSON.stringify(hoisted.inserts[0]);
    expect(stored).not.toContain("https://evil.example/reset?token=secret");
    expect(stored).not.toContain("@VictimOwner");
    expect(stored).not.toContain("SecretInviteToken123");
    expect(stored).not.toContain("?token=contactsecret");
    expect(stored).toContain("[link]");
    expect(stored).toContain("[telegram]");

    expect(hoisted.moderationNotices).toHaveLength(1);
    const alert = JSON.stringify(hoisted.moderationNotices[0]);
    expect(alert).not.toContain("start=secret");
    expect(alert).not.toContain("SecretInviteToken123");
  });

  it("fails malformed URL appeal target displays closed", async () => {
    const result = await submitReputationAppealCore(
      {
        target: "https://victim:secret-token@%",
        reason: "This malformed target should be reviewed without exposing its credential.",
        lang: "ru",
      },
      "appeal:test:malformed-url-display",
    );

    expect(result).toEqual({ ok: true });
    expect(hoisted.inserts[0]).toMatchObject({ target_type: "url", target_display: "[link]" });
    const { target_hash: _targetHash, ...displayFields } = hoisted.inserts[0];
    expect(JSON.stringify(displayFields)).not.toContain("secret-token");
    expect(JSON.stringify(hoisted.moderationNotices)).not.toContain("secret-token");
  });

  it("redacts Telegram custom schemes from appeal reason and contact display", async () => {
    const result = await submitReputationAppealCore(
      {
        target: "@FakeSupportBot",
        reason: "Evidence uses tg://resolve?domain=Secret_Handle&start=private-token.",
        contact: "telegram://resolve?domain=ContactSecret&start=contact-token",
        lang: "ru",
      },
      "appeal:test:telegram-custom-scheme",
    );

    expect(result).toEqual({ ok: true });
    const {
      target_hash: _targetHash,
      contact_hash: _contactHash,
      ...displayFields
    } = hoisted.inserts[0];
    const stored = JSON.stringify(displayFields);
    expect(stored).not.toContain("Secret_Handle");
    expect(stored).not.toContain("private-token");
    expect(stored).not.toContain("ContactSecret");
    expect(stored).not.toContain("contact-token");
    expect(stored).toContain("[telegram]");
  });

  it("rejects free text appeals so reports stay in the report flow", async () => {
    await expect(
      submitReputationAppealCore(
        {
          target: "Somebody posted a bad message in a chat",
          reason: "This is a general situation, not a concrete reputation target.",
          lang: "ru",
        },
        "appeal:test",
      ),
    ).resolves.toEqual({ ok: false, error: "unsupported_target" });

    expect(hoisted.inserts).toHaveLength(0);
  });

  it("stores follow-up appeal evidence even when the same target is already queued", async () => {
    hoisted.existingRows.push({ id: "appeal-1" });

    await expect(
      submitReputationAppealCore(
        {
          target: "@FakeSupportBot",
          reason: "I already requested review for this account and have context.",
          lang: "ru",
        },
        "appeal:test",
      ),
    ).resolves.toEqual({ ok: true, duplicate: true });

    expect(hoisted.hashInputs).toEqual(["@FakeSupportBot"]);
    expect(hoisted.inserts).toHaveLength(1);
    expect(hoisted.inserts[0]).toMatchObject({
      target_type: "telegram",
      target_hash: "hash:@FakeSupportBot",
    });
  });
});
