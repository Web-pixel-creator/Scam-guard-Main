import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type HashCandidate = { hash: string; version: string };
type RpcCall = { name: string; args: Record<string, unknown> };

const hoisted = vi.hoisted(() => ({
  hashCandidateOverrides: new Map<string, HashCandidate[]>(),
  hashErrors: new Map<string, unknown>(),
  hashInputs: [] as string[],
  rpcCalls: [] as RpcCall[],
  tableCalls: [] as string[],
  rpcResults: [] as unknown[],
  rpcError: undefined as unknown,
  moderationNotices: [] as Array<Record<string, unknown>>,
  moderationError: undefined as unknown,
  rateLimitCalls: [] as unknown[][],
  rateLimitResult: { ok: true, remaining: 2, retryAfterSec: 0 } as
    | { ok: true; remaining?: number; retryAfterSec?: number }
    | { ok: false; retryAfterSec: number },
}));

function syntheticHash(value: string): string {
  // Test-only digest makes transport assertions opaque; production uses HMAC.
  return createHash("sha256").update(`appeal-test-only:${value}`).digest("hex");
}

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
      hoisted.tableCalls.push(table);
      throw new Error("Application-side appeal table lookup is forbidden by this contract");
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      hoisted.rpcCalls.push({ name, args });
      if (hoisted.rpcError !== undefined) throw hoisted.rpcError;
      return hoisted.rpcResults.length > 0
        ? hoisted.rpcResults.shift()
        : { data: [{ accepted: true, notify_moderation: true }], error: null };
    },
  },
}));

vi.mock("@/lib/risk/hash", () => ({
  hashIdentifierCandidates: async (value: string) => {
    hoisted.hashInputs.push(value);
    if (hoisted.hashErrors.has(value)) throw hoisted.hashErrors.get(value);
    return (
      hoisted.hashCandidateOverrides.get(value) ?? [
        { hash: syntheticHash(value), version: "legacy" },
      ]
    );
  },
}));

vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: async (...args: unknown[]) => {
    hoisted.rateLimitCalls.push(args);
    return hoisted.rateLimitResult;
  },
}));

vi.mock("@/lib/telegram/moderation-notifier.server", () => ({
  notifyModeration: async (notice: Record<string, unknown>) => {
    hoisted.moderationNotices.push(notice);
    if (hoisted.moderationError !== undefined) throw hoisted.moderationError;
    return { ok: true };
  },
}));

import { submitReputationAppealCore } from "./reputation-appeal.functions";

const defaultInput = {
  target: "@FakeSupportBot",
  reason: "This account needs a corrected reputation review.",
  lang: "en" as const,
};

function rpcArguments(): Record<string, unknown> {
  expect(hoisted.rpcCalls).toHaveLength(1);
  expect(hoisted.rpcCalls[0].name).toBe("submit_reputation_appeal");
  expect(hoisted.tableCalls).toEqual([]);
  return hoisted.rpcCalls[0].args;
}

beforeEach(() => {
  hoisted.hashCandidateOverrides.clear();
  hoisted.hashErrors.clear();
  hoisted.hashInputs.length = 0;
  hoisted.rpcCalls.length = 0;
  hoisted.tableCalls.length = 0;
  hoisted.rpcResults.length = 0;
  hoisted.rpcError = undefined;
  hoisted.moderationNotices.length = 0;
  hoisted.moderationError = undefined;
  hoisted.rateLimitCalls.length = 0;
  hoisted.rateLimitResult = { ok: true, remaining: 2, retryAfterSec: 0 };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("submitReputationAppealCore atomic RPC adapter", () => {
  it("hashes targets and passes only redacted appeal details to the RPC", async () => {
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
    const args = rpcArguments();
    expect(args).toMatchObject({
      p_target_type: "phone",
      p_target_hashes: [{ hash: syntheticHash("+998901234567"), version: "legacy" }],
      p_contact_hashes: [
        { hash: syntheticHash("appeal-contact:owner@example.com"), version: "legacy" },
      ],
    });
    for (const marker of [
      "+998901234567",
      "123456",
      "8600 1234 5678 9012",
      "test@example.com",
      "owner@example.com",
    ]) {
      expect(JSON.stringify(args)).not.toContain(marker);
    }
  });

  it("removes passwords, separated codes and recovery phrases from RPC arguments and alerts", async () => {
    const password = "Correct-Horse-Battery-Staple";
    const separatedOtp = "9 1 4 2 8 7";
    const recoveryPhrase =
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon";
    const contactSecret = "AppealContactSecret7";
    await expect(
      submitReputationAppealCore(
        {
          ...defaultInput,
          reason: `Wrong label. password = ${password}. OTP: ${separatedOtp}. seed phrase: ${recoveryPhrase}.`,
          contact: `password = ${contactSecret}`,
        },
        "appeal:test:credential-sink",
      ),
    ).resolves.toEqual({ ok: true });
    const args = rpcArguments();
    const sinks = JSON.stringify([
      args,
      hoisted.moderationNotices,
      vi.mocked(console.error).mock.calls,
    ]);
    for (const marker of [password, separatedOtp, recoveryPhrase, contactSecret]) {
      expect(sinks.toLowerCase()).not.toContain(marker.toLowerCase());
    }
    expect(args.p_contact_hashes).toEqual([
      {
        hash: syntheticHash(`appeal-contact:password = ${contactSecret.toLowerCase()}`),
        version: "legacy",
      },
    ]);
  });

  it("redacts appeal links and Telegram identifiers before persistence and alerts", async () => {
    await expect(
      submitReputationAppealCore(
        {
          target: "https://t.me/FakeSupportBot?start=secret",
          reason:
            "Evidence: https://evil.example/reset?token=secret, @VictimOwner, and https://t.me/+SecretInviteToken123.",
          contact: "https://contact.example/private?token=contactsecret",
          lang: "ru",
        },
        "appeal:test:url-telegram",
      ),
    ).resolves.toEqual({ ok: true });
    expect(hoisted.hashInputs).toEqual([
      "@FakeSupportBot",
      "appeal-contact:https://contact.example/private",
    ]);
    const stored = JSON.stringify(rpcArguments());
    for (const marker of [
      "https://evil.example/reset?token=secret",
      "@VictimOwner",
      "SecretInviteToken123",
      "?token=contactsecret",
    ]) {
      expect(stored).not.toContain(marker);
    }
    expect(stored).toContain("[link]");
    expect(stored).toContain("[telegram]");
    expect(hoisted.moderationNotices).toHaveLength(1);
    expect(JSON.stringify(hoisted.moderationNotices)).not.toContain("start=secret");
    expect(JSON.stringify(hoisted.moderationNotices)).not.toContain("SecretInviteToken123");
  });

  it("fails malformed URL target displays closed", async () => {
    await expect(
      submitReputationAppealCore(
        { ...defaultInput, target: "https://victim:secret-token@%" },
        "appeal:test",
      ),
    ).resolves.toEqual({ ok: true });
    const args = rpcArguments();
    expect(args).toMatchObject({ p_target_type: "url", p_target_display: "[link]" });
    expect(JSON.stringify([args, hoisted.moderationNotices])).not.toContain("secret-token");
  });

  it("redacts Telegram custom schemes from reason and contact display", async () => {
    await expect(
      submitReputationAppealCore(
        {
          ...defaultInput,
          reason: "Evidence uses tg://resolve?domain=Secret_Handle&start=private-token.",
          contact: "telegram://resolve?domain=ContactSecret&start=contact-token",
        },
        "appeal:test",
      ),
    ).resolves.toEqual({ ok: true });
    const stored = JSON.stringify(rpcArguments());
    for (const marker of ["Secret_Handle", "private-token", "ContactSecret", "contact-token"])
      expect(stored).not.toContain(marker);
    expect(stored).toContain("[telegram]");
  });

  it("bounds an expanded masked contact without truncating its hash input", async () => {
    const contact = Array.from({ length: 22 }, () => "a@b.co").join(" ");
    expect(contact).toHaveLength(153);
    await expect(
      submitReputationAppealCore({ ...defaultInput, contact }, "appeal:test:contact-bound"),
    ).resolves.toEqual({ ok: true });
    const args = rpcArguments();
    expect(String(args.p_contact_display)).toHaveLength(160);
    expect(String(args.p_contact_display)).not.toContain("a@b.co");
    expect(hoisted.hashInputs).toEqual([defaultInput.target, `appeal-contact:${contact}`]);
    expect(args.p_contact_hashes).toEqual([
      { hash: syntheticHash(`appeal-contact:${contact}`), version: "legacy" },
    ]);
  });

  it("redacts a password even when the same contact contains an email address", async () => {
    const secret = "MixedContactSecret7";
    const contact = `owner@example.com password = ${secret}`;
    await expect(
      submitReputationAppealCore({ ...defaultInput, contact }, "appeal:test:mixed-contact"),
    ).resolves.toEqual({ ok: true });
    const args = rpcArguments();
    expect(JSON.stringify(args).toLowerCase()).not.toContain(secret.toLowerCase());
    expect(String(args.p_contact_display)).not.toContain("owner@example.com");
    expect(hoisted.hashInputs).toContain(`appeal-contact:${contact.toLowerCase()}`);
  });

  it.each([
    ["OTP", "OTP: 9 1 4 2 8 7", "9 1 4 2 8 7"],
    [
      "seed phrase",
      "seed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
      "apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    ],
    ["private link", "https://contact.example/reset?token=MixedPrivateToken", "MixedPrivateToken"],
  ])("redacts mixed email plus %s contact content", async (_label, suffix, secret) => {
    const contact = `owner@example.com ${suffix}`;
    await expect(
      submitReputationAppealCore({ ...defaultInput, contact }, "appeal:test:mixed-contact"),
    ).resolves.toEqual({ ok: true });
    const args = rpcArguments();
    expect(JSON.stringify(args).toLowerCase()).not.toContain(secret.toLowerCase());
    expect(String(args.p_contact_display)).not.toContain("owner@example.com");
    expect(hoisted.hashInputs).toContain(`appeal-contact:${contact.toLowerCase()}`);
  });

  it("preserves ordinary contact context after masking an email", async () => {
    await expect(
      submitReputationAppealCore(
        { ...defaultInput, contact: "owner@example.com office reception" },
        "appeal:test:ordinary-contact",
      ),
    ).resolves.toEqual({ ok: true });
    expect(rpcArguments().p_contact_display).toBe("o****@example.com office reception");
  });

  it.each([
    "\u200b",
    "\u202e",
    "\u2066",
    "\ufeff",
    "\ufe0f",
    "\u{e0100}",
    "\u115f",
    "\u180b",
    "\u17b4",
    "\u3164",
  ])(
    "contains an invisibly obfuscated password in real appeal reason/contact transport: %s",
    async (control) => {
      const sample = ["Appeal", "Invisible", "Secret7"].join("");
      const value = `pass${control}word: ${sample}`;
      await expect(
        submitReputationAppealCore(
          {
            ...defaultInput,
            reason: `Please review this evidence. ${value}`,
            contact: `owner@example.com ${value}`,
          },
          "appeal:test:invisible-secret",
        ),
      ).resolves.toEqual({ ok: true });
      const args = rpcArguments();
      expect(args.p_reason).toBe("••••");
      expect(args.p_contact_display).toBe("••••");
      expect(JSON.stringify(args)).not.toContain(sample);
    },
  );

  it("rejects free-text targets before hashing or any database operation", async () => {
    await expect(
      submitReputationAppealCore(
        { ...defaultInput, target: "Somebody posted a bad message in a chat" },
        "appeal:test",
      ),
    ).resolves.toEqual({ ok: false, error: "unsupported_target" });
    expect(hoisted.hashInputs).toEqual([]);
    expect(hoisted.rpcCalls).toEqual([]);
    expect(hoisted.tableCalls).toEqual([]);
    expect(hoisted.moderationNotices).toEqual([]);
  });

  it("keeps the existing three-per-ten-minute rate boundary before hashing and RPC", async () => {
    hoisted.rateLimitResult = { ok: false, retryAfterSec: 42 };
    await expect(submitReputationAppealCore(defaultInput, "appeal:canonical-ip")).resolves.toEqual({
      ok: false,
      error: "rate_limited",
      retryAfterSec: 42,
    });
    expect(hoisted.rateLimitCalls).toEqual([["appeal", "appeal:canonical-ip", 3, 600_000]]);
    expect(hoisted.hashInputs).toEqual([]);
    expect(hoisted.rpcCalls).toEqual([]);
    expect(hoisted.tableCalls).toEqual([]);
    expect(hoisted.moderationNotices).toEqual([]);
  });

  it("forwards all active/previous/legacy target and contact aliases in active-first order", async () => {
    const targetAliases = ["v3", "v2", "legacy"].map((version) => ({
      hash: syntheticHash(`target:${version}`),
      version,
    }));
    const contactAliases = ["v3", "v2", "legacy"].map((version) => ({
      hash: syntheticHash(`contact:${version}`),
      version,
    }));
    hoisted.hashCandidateOverrides.set(defaultInput.target, targetAliases);
    hoisted.hashCandidateOverrides.set("appeal-contact:owner@example.com", contactAliases);
    await expect(
      submitReputationAppealCore(
        { ...defaultInput, contact: "  OWNER@EXAMPLE.COM  " },
        "appeal:test",
      ),
    ).resolves.toEqual({ ok: true });
    expect(rpcArguments()).toMatchObject({
      p_target_hashes: targetAliases,
      p_contact_hashes: contactAliases,
    });
    expect(hoisted.hashInputs).toEqual([defaultInput.target, "appeal-contact:owner@example.com"]);
  });

  it.each([undefined, "", "   "])(
    "uses an empty contact alias set for absent contact %s",
    async (contact) => {
      await expect(
        submitReputationAppealCore({ ...defaultInput, contact }, "appeal:test"),
      ).resolves.toEqual({ ok: true });
      expect(rpcArguments()).toMatchObject({ p_contact_hashes: [], p_contact_display: null });
      expect(hoisted.hashInputs).toEqual([defaultInput.target]);
    },
  );

  it.each([
    ["new target", true],
    ["known entity without open appeal", true],
    ["exact duplicate already queued", false],
    ["distinct evidence in open episode", false],
    ["reopened after all prior evidence closed", true],
  ] as const)("keeps one RPC and a uniform public result for %s", async (_privateState, notify) => {
    // Tests the adapter contract, not the database's private-state algorithm.
    hoisted.rpcResults.push({ data: [{ accepted: true, notify_moderation: notify }], error: null });
    const result = await submitReputationAppealCore(defaultInput, "appeal:test");
    expect(result).toEqual({ ok: true });
    expect(Object.keys(result)).toEqual(["ok"]);
    expect(rpcArguments()).toEqual({
      p_target_type: "telegram",
      p_target_hashes: [{ hash: syntheticHash(defaultInput.target), version: "legacy" }],
      p_target_display: expect.any(String),
      p_reason: defaultInput.reason,
      p_contact_hashes: [],
      p_contact_display: null,
    });
    expect(hoisted.moderationNotices).toHaveLength(notify ? 1 : 0);
  });

  it("forwards follow-up evidence intact while obeying notification suppression", async () => {
    hoisted.rpcResults.push(
      { data: [{ accepted: true, notify_moderation: true }], error: null },
      { data: [{ accepted: true, notify_moderation: false }], error: null },
    );
    const followUpReason = "Additional evidence: the account owner supplied a corrected document.";
    await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
      ok: true,
    });
    await expect(
      submitReputationAppealCore({ ...defaultInput, reason: followUpReason }, "appeal:test"),
    ).resolves.toEqual({ ok: true });
    expect(hoisted.rpcCalls.map((call) => call.args.p_reason)).toEqual([
      defaultInput.reason,
      followUpReason,
    ]);
    expect(hoisted.tableCalls).toEqual([]);
    expect(hoisted.moderationNotices).toHaveLength(1);
  });

  it("submits each retry once and does not alert again for an accepted duplicate", async () => {
    hoisted.rpcResults.push(
      { data: [{ accepted: true, notify_moderation: true }], error: null },
      { data: [{ accepted: true, notify_moderation: false }], error: null },
    );
    await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
      ok: true,
    });
    await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
      ok: true,
    });
    expect(hoisted.rpcCalls).toHaveLength(2);
    expect(hoisted.rpcCalls[0]).toEqual(hoisted.rpcCalls[1]);
    expect(hoisted.tableCalls).toEqual([]);
    expect(hoisted.moderationNotices).toHaveLength(1);
  });

  it.each(["ru", "uz", "en"] as const)(
    "does not let %s language change the database idempotency input",
    async (lang) => {
      await expect(
        submitReputationAppealCore({ ...defaultInput, lang }, "appeal:test"),
      ).resolves.toEqual({ ok: true });
      const args = rpcArguments();
      expect(args).not.toHaveProperty("lang");
      expect(args).not.toHaveProperty("p_lang");
      expect(hoisted.moderationNotices[0]).toEqual({
        kind: "appeal",
        targetType: "telegram",
        targetDisplay: args.p_target_display,
        language: lang,
      });
    },
  );

  it.each([
    ["missing data", undefined],
    ["null data", null],
    ["empty rows", []],
    ["object instead of rows", { accepted: true, notify_moderation: true }],
    ["null row", [null]],
    [
      "two rows",
      [
        { accepted: true, notify_moderation: true },
        { accepted: true, notify_moderation: false },
      ],
    ],
    ["missing acceptance", [{ notify_moderation: true }]],
    ["false acceptance", [{ accepted: false, notify_moderation: false }]],
    ["truthy string acceptance", [{ accepted: "true", notify_moderation: true }]],
    ["numeric acceptance", [{ accepted: 1, notify_moderation: true }]],
    ["missing notice flag", [{ accepted: true }]],
    ["null notice flag", [{ accepted: true, notify_moderation: null }]],
    ["truthy string notice flag", [{ accepted: true, notify_moderation: "false" }]],
    ["numeric notice flag", [{ accepted: true, notify_moderation: 1 }]],
    ["unexpected private field", [{ accepted: true, notify_moderation: true, status: "new" }]],
  ])("fails %s closed without fallback reads, insert or notification", async (_label, data) => {
    hoisted.rpcResults.push({ data, error: null });
    await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
      ok: false,
      error: "submit_failed",
    });
    rpcArguments();
    expect(hoisted.moderationNotices).toEqual([]);
  });

  it("rejects a storage error even when a success-shaped row accompanies it", async () => {
    const secret = "Synthetic-Appeal-Storage-Secret";
    hoisted.rpcResults.push({
      data: [{ accepted: true, notify_moderation: true }],
      error: { code: "XX000", message: secret, details: secret, hint: secret },
    });
    await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
      ok: false,
      error: "submit_failed",
    });
    rpcArguments();
    expect(hoisted.moderationNotices).toEqual([]);
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
  });

  it.each([new Error("Synthetic-Appeal-Thrown-Secret"), "Synthetic-Appeal-Thrown-Secret"])(
    "does not retry or expose a thrown RPC error %#",
    async (error) => {
      hoisted.rpcError = error;
      await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
        ok: false,
        error: "submit_failed",
      });
      rpcArguments();
      expect(hoisted.moderationNotices).toEqual([]);
      expect(console.error).toHaveBeenCalled();
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
        "Synthetic-Appeal-Thrown-Secret",
      );
    },
  );

  it.each(["target", "contact"])(
    "fails missing %s hash candidates closed before the RPC",
    async (kind) => {
      hoisted.hashCandidateOverrides.set(
        kind === "target" ? defaultInput.target : "appeal-contact:owner@example.com",
        [],
      );
      await expect(
        submitReputationAppealCore(
          { ...defaultInput, contact: "owner@example.com" },
          "appeal:test",
        ),
      ).resolves.toEqual({ ok: false, error: "submit_failed" });
      expect(hoisted.rpcCalls).toEqual([]);
      expect(hoisted.tableCalls).toEqual([]);
      expect(hoisted.moderationNotices).toEqual([]);
    },
  );

  it.each(["target", "contact"])(
    "does not persist, retry or leak a thrown %s hash failure",
    async (kind) => {
      const secret = "Synthetic-Appeal-Hash-Secret";
      hoisted.hashErrors.set(
        kind === "target" ? defaultInput.target : "appeal-contact:owner@example.com",
        new Error(secret),
      );
      await expect(
        submitReputationAppealCore(
          { ...defaultInput, contact: "owner@example.com" },
          "appeal:test",
        ),
      ).resolves.toEqual({ ok: false, error: "submit_failed" });
      expect(hoisted.rpcCalls).toEqual([]);
      expect(hoisted.tableCalls).toEqual([]);
      expect(hoisted.moderationNotices).toEqual([]);
      expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(secret);
    },
  );

  it("keeps an accepted appeal accepted when the best-effort notification rejects", async () => {
    hoisted.moderationError = new Error("Synthetic-Appeal-Notification-Secret");
    await expect(submitReputationAppealCore(defaultInput, "appeal:test")).resolves.toEqual({
      ok: true,
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    rpcArguments();
    expect(hoisted.moderationNotices).toHaveLength(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "Synthetic-Appeal-Notification-Secret",
    );
  });
});
