import { beforeEach, describe, expect, it, vi } from "vitest";

type FamilyRow = Record<string, unknown>;

const hoisted = vi.hoisted(() => ({
  rows: [] as FamilyRow[],
  inserts: [] as FamilyRow[],
  updates: [] as FamilyRow[],
  sent: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
}));

function matches(row: FamilyRow, filters: Array<{ column: string; value: unknown }>): boolean {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function makeTable() {
  return {
    insert: async (row: FamilyRow) => {
      const now = new Date().toISOString();
      const stored = {
        id: `row-${hoisted.rows.length + 1}`,
        created_at: now,
        accepted_at: null,
        revoked_at: null,
        last_notified_at: null,
        ...row,
      };
      hoisted.rows.push(stored);
      hoisted.inserts.push(stored);
      return { data: null, error: null };
    },
    select: () => {
      const filters: Array<{ column: string; value: unknown }> = [];
      return {
        eq(column: string, value: unknown) {
          filters.push({ column, value });
          return this;
        },
        maybeSingle: async () => ({
          data: hoisted.rows.find((row) => matches(row, filters)) ?? null,
          error: null,
        }),
      };
    },
    update: (patch: FamilyRow) => {
      const filters: Array<{ column: string; value: unknown }> = [];
      const apply = () => {
        const matched = hoisted.rows.filter((row) => matches(row, filters));
        for (const row of matched) Object.assign(row, patch);
        hoisted.updates.push(patch);
        return matched;
      };
      const chain = {
        eq(column: string, value: unknown) {
          filters.push({ column, value });
          return chain;
        },
        in(column: string, values: unknown[]) {
          const previous = filters.slice();
          filters.length = 0;
          filters.push(...previous);
          const matched = hoisted.rows.filter(
            (row) =>
              previous.every((filter) => row[filter.column] === filter.value) &&
              values.includes(row[column]),
          );
          for (const row of matched) Object.assign(row, patch);
          hoisted.updates.push(patch);
          return {
            select: async () => ({ data: matched.map((row) => ({ id: row.id })), error: null }),
          };
        },
        select: async () => ({ data: apply().map((row) => ({ id: row.id })), error: null }),
        then(resolve: (value: { data: null; error: null }) => void) {
          apply();
          resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "telegram_family_shield") throw new Error(`unexpected table: ${table}`);
      return makeTable();
    },
  },
}));

vi.mock("@/lib/telegram/api.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/telegram/api.server")>();
  return {
    ...actual,
    sendMessage: async (opts: { chatId: number; text: string; keyboard?: unknown }) => {
      hoisted.sent.push({ chatId: opts.chatId, text: opts.text, keyboard: opts.keyboard });
      return { ok: true };
    },
  };
});

import {
  acceptFamilyInvite,
  buildTrustedAlertText,
  createFamilyInvite,
  notifyTrustedContact,
  parseFamilyStartArg,
  revokeFamilyShieldForTrusted,
} from "./family-shield.server";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("HASH_PEPPER_SECRET", "family-shield-test-pepper");
  hoisted.rows.length = 0;
  hoisted.inserts.length = 0;
  hoisted.updates.length = 0;
  hoisted.sent.length = 0;
});

describe("Family Shield v1", () => {
  it("creates a Telegram deep-link invite without storing the raw token", async () => {
    const result = await createFamilyInvite(1001);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const token = parseFamilyStartArg(result.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();
    expect(hoisted.inserts[0]).toMatchObject({
      guardian_telegram_user_id: 1001,
      status: "pending",
    });
    expect(hoisted.inserts[0].invite_code_hash).not.toContain(token);
    expect(JSON.stringify(hoisted.inserts[0])).not.toContain(result.inviteUrl);
  });

  it("uses TELEGRAM_BOT_USERNAME for invite links when configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "@custom_guard_bot");

    const result = await createFamilyInvite(1002);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inviteUrl).toMatch(/^https:\/\/t\.me\/custom_guard_bot\?start=family_/);
  });

  it("rejects linking the guardian account as its own trusted contact", async () => {
    const invite = await createFamilyInvite(1001);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;

    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();

    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 1001,
      trustedChatId: 1001,
    });

    expect(accepted).toEqual({ ok: false, reason: "self_link" });
  });

  it("sends a redacted trusted-contact alert and rate-limits repeats", async () => {
    const invite = await createFamilyInvite(2001);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();

    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 3001,
      trustedChatId: 4001,
    });
    expect(accepted.ok).toBe(true);

    const first = await notifyTrustedContact({
      guardianTelegramUserId: 2001,
      lang: "ru",
      guardianDisplayName: "Akmal",
    });
    const second = await notifyTrustedContact({ guardianTelegramUserId: 2001, lang: "ru" });

    expect(first).toEqual({ ok: true, trustedChatId: 4001 });
    expect(second).toEqual({ ok: false, reason: "cooldown" });
    expect(hoisted.sent).toHaveLength(1);
    expect(hoisted.sent[0].text).toContain("Ishonch Guard");
    expect(hoisted.sent[0].text).toContain("Akmal");
    expect(JSON.stringify(hoisted.sent[0].keyboard)).toContain("family:trusted_opt_out");
    expect(hoisted.sent[0].text).not.toMatch(/\+998|https?:\/\/|@fake|123456|CVV 123/i);
  });

  it("does not create a second invite while an active trusted contact exists", async () => {
    const invite = await createFamilyInvite(2101);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;

    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();
    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 3101,
      trustedChatId: 4101,
    });
    expect(accepted.ok).toBe(true);

    const secondInvite = await createFamilyInvite(2101);

    expect(secondInvite).toEqual({ ok: false, reason: "already_linked" });
    expect(hoisted.inserts).toHaveLength(1);
  });

  it("expires stale pending invites before accepting them", async () => {
    const invite = await createFamilyInvite(2201);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    hoisted.rows[0].created_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();
    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 3201,
      trustedChatId: 4201,
    });

    expect(accepted).toEqual({ ok: false, reason: "expired" });
    expect(hoisted.rows[0]).toMatchObject({ status: "revoked" });
  });

  it("lets the trusted contact opt out from future alerts", async () => {
    const invite = await createFamilyInvite(2301);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();
    await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 3301,
      trustedChatId: 4301,
    });

    const revoked = await revokeFamilyShieldForTrusted(3301);
    const notified = await notifyTrustedContact({ guardianTelegramUserId: 2301, lang: "ru" });

    expect(revoked).toEqual({ ok: true });
    expect(notified).toEqual({ ok: false, reason: "not_linked" });
  });

  it("keeps the trusted alert focused on safe support, not accusation", () => {
    const text = buildTrustedAlertText("ru");

    expect(text).toContain("позвоните");
    expect(text).toContain("Не просите пересылать SMS-коды");
    expect(text).not.toMatch(/мошенник|точно скам/i);
  });
});
