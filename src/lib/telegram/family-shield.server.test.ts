import { beforeEach, describe, expect, it, vi } from "vitest";

type FamilyRow = Record<string, unknown>;

const hoisted = vi.hoisted(() => ({
  rows: [] as FamilyRow[],
  claims: [] as FamilyRow[],
  inserts: [] as FamilyRow[],
  updates: [] as FamilyRow[],
  rpcCalls: [] as Array<{ name: string; params: FamilyRow }>,
  sent: [] as Array<{ chatId: number; text: string; keyboard?: unknown }>,
  completionThrows: false,
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
        guardian_auto_alerts_enabled: false,
        trusted_auto_alerts_enabled: false,
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
        select: async () => ({ data: apply(), error: null }),
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
    rpc: async (name: string, params: FamilyRow) => {
      hoisted.rpcCalls.push({ name, params });

      if (name === "complete_telegram_family_notification") {
        if (hoisted.completionThrows) throw new Error("completion unavailable");
        const claim = hoisted.claims.find((row) => row.id === params.p_claim_id);
        if (!claim || claim.status !== "claimed") return { data: false, error: null };
        claim.status = params.p_delivered === true ? "delivered" : "failed";
        claim.completed_at = new Date().toISOString();
        return { data: true, error: null };
      }

      if (name !== "claim_telegram_family_notification") {
        throw new Error(`unexpected rpc: ${name}`);
      }

      const family = hoisted.rows.find(
        (row) =>
          row.guardian_telegram_user_id === params.p_guardian_telegram_user_id &&
          row.status === "active",
      );
      if (!family || family.trusted_chat_id == null) {
        return {
          data: [
            {
              decision: "not_linked",
              claim_id: null,
              family_id: null,
              trusted_chat_id: null,
            },
          ],
          error: null,
        };
      }

      if (
        params.p_mode === "automatic" &&
        !(
          family.guardian_auto_alerts_enabled === true &&
          family.trusted_auto_alerts_enabled === true
        )
      ) {
        return {
          data: [
            {
              decision: "auto_alerts_disabled",
              claim_id: null,
              family_id: family.id,
              trusted_chat_id: null,
            },
          ],
          error: null,
        };
      }

      const duplicate = hoisted.claims.find(
        (row) => row.family_id === family.id && row.idempotency_key === params.p_idempotency_key,
      );
      if (duplicate) {
        return {
          data: [
            {
              decision: "duplicate",
              claim_id: duplicate.id,
              family_id: family.id,
              trusted_chat_id: null,
            },
          ],
          error: null,
        };
      }

      const nowMs = Date.now();
      const lastMs =
        typeof family.last_notified_at === "string"
          ? Date.parse(family.last_notified_at)
          : Number.NaN;
      const cooldownMs = Number(params.p_cooldown_seconds) * 1000;
      if (Number.isFinite(lastMs) && nowMs - lastMs < cooldownMs) {
        return {
          data: [
            {
              decision: "cooldown",
              claim_id: null,
              family_id: family.id,
              trusted_chat_id: null,
            },
          ],
          error: null,
        };
      }

      const claim = {
        id: `claim-${hoisted.claims.length + 1}`,
        family_id: family.id,
        idempotency_key: params.p_idempotency_key,
        mode: params.p_mode,
        status: "claimed",
        claimed_at: new Date(nowMs).toISOString(),
        completed_at: null,
      };
      hoisted.claims.push(claim);
      family.last_notified_at = new Date(nowMs).toISOString();
      family.updated_at = new Date(nowMs).toISOString();
      return {
        data: [
          {
            decision: "claimed",
            claim_id: claim.id,
            family_id: family.id,
            trusted_chat_id: family.trusted_chat_id,
          },
        ],
        error: null,
      };
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
  buildFamilyAlreadyLinkedKeyboard,
  buildFamilyCodewordGuideText,
  buildFamilyInviteKeyboard,
  buildFamilySetupKeyboard,
  buildTrustedConsentKeyboard,
  buildTrustedAlertText,
  createFamilyInvite,
  FAMILY_CB,
  familyIdFromCallback,
  notifyTrustedContact,
  parseFamilyCallback,
  parseFamilyStartArg,
  revokeFamilyShieldForTrusted,
  setFamilyAutoAlertsConsent,
} from "./family-shield.server";
import { bt } from "./bot-i18n";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("HASH_PEPPER_SECRET", "family-shield-test-pepper");
  hoisted.rows.length = 0;
  hoisted.claims.length = 0;
  hoisted.inserts.length = 0;
  hoisted.updates.length = 0;
  hoisted.rpcCalls.length = 0;
  hoisted.sent.length = 0;
  hoisted.completionThrows = false;
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
      invite_code_hash_version: "legacy",
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

  it("makes the invite handoff explicit and opens Telegram share flow", () => {
    const inviteUrl = "https://t.me/scamguard_bot?start=family_testToken123";
    const keyboard = buildFamilyInviteKeyboard(inviteUrl, "ru");
    const shareButton = keyboard[0]?.[0] as { text?: string; url?: string };

    expect(bt("family_invite_text", "ru")).toContain("Эта ссылка не для вас");
    expect(bt("family_invite_text", "ru")).toContain("В открывшемся окне Telegram");
    expect(bt("family_accept_self", "ru")).toContain("связь не включилась");
    expect(shareButton.text).toContain("Отправить в чат близкого");
    expect(shareButton.url).toBeTruthy();

    const shareUrl = new URL(shareButton.url!);
    expect(shareUrl.origin + shareUrl.pathname).toBe("https://t.me/share/url");
    expect(shareUrl.searchParams.get("url")).toBe(inviteUrl);
    expect(shareUrl.searchParams.get("text")).toContain("Прими приглашение");
  });

  it("offers an offline codeword guide without storing the secret", () => {
    const setupCallbacks = buildFamilySetupKeyboard("ru")
      .flat()
      .map((button) => button.callback_data);
    const linkedCallbacks = buildFamilyAlreadyLinkedKeyboard("ru")
      .flat()
      .map((button) => button.callback_data);
    const text = buildFamilyCodewordGuideText("ru");

    expect(setupCallbacks).toContain(FAMILY_CB.codewordGuide);
    expect(linkedCallbacks).toContain(FAMILY_CB.codewordGuide);
    expect(bt("family_menu_text", "ru")).toContain("Как проверить голос");
    expect(text).toContain("Не пишите кодовое слово в бот");
    expect(text).toContain("сохранённому номеру");
    expect(text).toContain("личный вопрос");
    expect(text).not.toMatch(/введите|пришлите.*кодовое|сохраню|запомню/i);
    expect(buildFamilyCodewordGuideText("en")).toContain("Do not write the code word");
    expect(buildFamilyCodewordGuideText("uz")).toContain("Maxfiy so'zni botga");
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

  it("accepts a pending legacy invite after a new active pepper is enabled", async () => {
    const invite = await createFamilyInvite(1010);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;

    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    expect(token).toBeTruthy();
    expect(hoisted.rows[0]).toMatchObject({ invite_code_hash_version: "legacy" });

    vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", "v2");
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "family-shield-active-v2-pepper");

    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 2010,
      trustedChatId: 3010,
    });

    expect(accepted).toEqual({
      ok: true,
      guardianTelegramUserId: 1010,
      familyId: "row-1",
    });
    expect(hoisted.rows[0]).toMatchObject({
      invite_code_hash_version: "legacy",
      status: "active",
    });
  });

  it("keeps automatic alerts off by default while preserving manual one-tap alerts", async () => {
    const invite = await createFamilyInvite(1901);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 2901,
      trustedChatId: 3901,
    });
    expect(accepted.ok).toBe(true);

    const automatic = await notifyTrustedContact({
      guardianTelegramUserId: 1901,
      lang: "ru",
      mode: "automatic",
      idempotencyKey: "automatic-default-off",
    });

    expect(automatic).toEqual({ ok: false, reason: "auto_alerts_disabled" });
    expect(hoisted.sent).toHaveLength(0);
    expect(hoisted.claims).toHaveLength(0);
    expect(hoisted.rows[0]).toMatchObject({
      guardian_auto_alerts_enabled: false,
      trusted_auto_alerts_enabled: false,
    });

    const manual = await notifyTrustedContact({
      guardianTelegramUserId: 1901,
      lang: "ru",
      idempotencyKey: "manual-one-tap-alert",
    });
    expect(manual).toEqual({ ok: true, trustedChatId: 3901 });
    expect(hoisted.sent).toHaveLength(1);
  });

  it("requires bilateral consent and sends at most once across concurrent retries", async () => {
    const invite = await createFamilyInvite(1951);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    const accepted = await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 2951,
      trustedChatId: 3951,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;

    const guardianConsent = await setFamilyAutoAlertsConsent({
      role: "guardian",
      telegramUserId: 1951,
      enabled: true,
    });
    expect(guardianConsent).toEqual({ ok: true, automaticActive: false });

    const trustedConsent = await setFamilyAutoAlertsConsent({
      role: "trusted",
      telegramUserId: 2951,
      familyId: accepted.familyId,
      enabled: true,
    });
    expect(trustedConsent).toEqual({ ok: true, automaticActive: true });

    const results = await Promise.all([
      notifyTrustedContact({
        guardianTelegramUserId: 1951,
        lang: "en",
        guardianDisplayName: "Akmal https://evil.example 123456",
        mode: "automatic",
        idempotencyKey: "retry-key:https://evil.example:otp=123456",
      }),
      notifyTrustedContact({
        guardianTelegramUserId: 1951,
        lang: "en",
        guardianDisplayName: "Akmal https://evil.example 123456",
        mode: "automatic",
        idempotencyKey: "retry-key:https://evil.example:otp=123456",
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "cooldown" }]);
    expect(hoisted.sent).toHaveLength(1);
    expect(hoisted.claims).toHaveLength(1);
    expect(JSON.stringify(hoisted.claims)).not.toMatch(
      /evil\.example|123456|checked|screenshot|message_text/i,
    );
    expect(hoisted.sent[0].text).not.toMatch(/evil\.example|123456/i);
  });

  it("offers explicit trilingual consent controls without weakening manual alerts", () => {
    for (const lang of ["ru", "uz", "en"] as const) {
      const guardianCallbacks = buildFamilyAlreadyLinkedKeyboard(lang)
        .flat()
        .map((button) => button.callback_data);
      const trustedCallbacks = buildTrustedConsentKeyboard(lang, "family-id-123")
        .flat()
        .map((button) => button.callback_data);

      expect(guardianCallbacks).toContain(FAMILY_CB.notify);
      expect(guardianCallbacks).toContain(FAMILY_CB.guardianAutoEnable);
      expect(guardianCallbacks).toContain(FAMILY_CB.guardianAutoDisable);
      expect(trustedCallbacks).toContain(`${FAMILY_CB.trustedAutoEnable}:family-id-123`);
      expect(trustedCallbacks).toContain(`${FAMILY_CB.trustedAutoDisable}:family-id-123`);
      expect(bt("family_accept_ok", lang)).toMatch(
        lang === "ru"
          ? /только сигналы по кнопке[\s\S]*Автоматические сигналы.*выключены/i
          : lang === "uz"
            ? /faqat.*tugmani bosganda[\s\S]*avtomatik signallar.*o'chirilgan/i
            : /Only alerts.*button[\s\S]*Automatic high-risk alerts are off/i,
      );
    }
  });

  it("keeps trusted consent and opt-out callbacks scoped to one family link", () => {
    const familyId = "13d42de1-7bdb-4ae4-8cee-e31da312f43e";
    for (const prefix of [
      FAMILY_CB.trustedAutoEnable,
      FAMILY_CB.trustedAutoDisable,
      FAMILY_CB.trustedOptOut,
    ]) {
      const callback = `${prefix}:${familyId}`;
      expect(parseFamilyCallback(callback)).toBe(callback);
      expect(familyIdFromCallback(callback, prefix)).toBe(familyId);
      expect(callback.length).toBeLessThanOrEqual(64);
    }

    expect(parseFamilyCallback(`${FAMILY_CB.trustedAutoEnable}:../../other`)).toBeNull();
    expect(parseFamilyCallback(`${FAMILY_CB.trustedOptOut}:${"x".repeat(41)}`)).toBeNull();
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
    expect(JSON.stringify(hoisted.sent[0].keyboard)).toContain("family:trusted_ack");
    expect(JSON.stringify(hoisted.sent[0].keyboard)).toContain("family:trusted_opt_out");
    expect(hoisted.sent[0].text).not.toMatch(/\+998|https?:\/\/|@fake|123456|CVV 123/i);
  });

  it("does not retry a delivered alert when the outcome write is unavailable", async () => {
    const invite = await createFamilyInvite(2003);
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;
    const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
    await acceptFamilyInvite({
      token: token!,
      trustedTelegramUserId: 3003,
      trustedChatId: 4003,
    });
    hoisted.completionThrows = true;

    const first = await notifyTrustedContact({
      guardianTelegramUserId: 2003,
      lang: "ru",
      idempotencyKey: "delivery-outcome-unavailable",
    });
    const retry = await notifyTrustedContact({
      guardianTelegramUserId: 2003,
      lang: "ru",
      idempotencyKey: "delivery-outcome-unavailable",
    });

    expect(first).toEqual({ ok: true, trustedChatId: 4003 });
    expect(retry).toEqual({ ok: false, reason: "cooldown" });
    expect(hoisted.sent).toHaveLength(1);
  });

  it("allows a longer proactive cooldown without blocking manual alerts after the default window", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-09T12:00:00.000Z"));
      const invite = await createFamilyInvite(2002);
      expect(invite.ok).toBe(true);
      if (!invite.ok) return;
      const token = parseFamilyStartArg(invite.inviteUrl.split("start=")[1] ?? "");
      expect(token).toBeTruthy();

      const accepted = await acceptFamilyInvite({
        token: token!,
        trustedTelegramUserId: 3002,
        trustedChatId: 4002,
      });
      expect(accepted.ok).toBe(true);
      if (!accepted.ok) return;

      await setFamilyAutoAlertsConsent({
        role: "guardian",
        telegramUserId: 2002,
        enabled: true,
      });
      await setFamilyAutoAlertsConsent({
        role: "trusted",
        telegramUserId: 3002,
        familyId: accepted.familyId,
        enabled: true,
      });

      const proactiveCooldownMs = 30 * 60 * 1000;
      const first = await notifyTrustedContact({
        guardianTelegramUserId: 2002,
        lang: "ru",
        guardianDisplayName: "Akmal",
        cooldownMs: proactiveCooldownMs,
        mode: "automatic",
        idempotencyKey: "automatic-first-alert",
      });

      vi.setSystemTime(new Date("2026-07-09T12:04:00.000Z"));
      const secondProactive = await notifyTrustedContact({
        guardianTelegramUserId: 2002,
        lang: "ru",
        guardianDisplayName: "Akmal",
        cooldownMs: proactiveCooldownMs,
        mode: "automatic",
        idempotencyKey: "automatic-second-alert",
      });
      const manualAfterDefaultWindow = await notifyTrustedContact({
        guardianTelegramUserId: 2002,
        lang: "ru",
        guardianDisplayName: "Akmal",
        idempotencyKey: "manual-after-default-window",
      });

      expect(first).toEqual({ ok: true, trustedChatId: 4002 });
      expect(secondProactive).toEqual({ ok: false, reason: "cooldown" });
      expect(manualAfterDefaultWindow).toEqual({ ok: true, trustedChatId: 4002 });
      expect(hoisted.sent).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
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
    expect(text).toContain("кодовое слово");
    expect(text).toContain("сохранённому номеру");
    expect(text).not.toMatch(/мошенник|точно скам/i);
  });
});
