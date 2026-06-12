import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  inserts: [] as Array<{ table: string; payload: unknown }>,
  insertError: null as null | { code?: string; message: string },
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async (payload: unknown) => {
        h.inserts.push({ table, payload });
        return { error: h.insertError };
      },
    }),
  },
}));

import { claimTelegramWebhookUpdate } from "./webhook-dedup.server";

beforeEach(() => {
  h.inserts.length = 0;
  h.insertError = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("claimTelegramWebhookUpdate", () => {
  it("claims a new Telegram update_id with an expiry and no user content", async () => {
    const now = Date.UTC(2026, 5, 12, 12, 0, 0);

    const result = await claimTelegramWebhookUpdate(12345, now, 60_000);

    expect(result).toBe("claimed");
    expect(h.inserts).toHaveLength(1);
    expect(h.inserts[0].table).toBe("telegram_webhook_updates");
    expect(h.inserts[0].payload).toEqual({
      update_id: 12345,
      expires_at: new Date(now + 60_000).toISOString(),
    });
  });

  it("returns duplicate when Postgres rejects the primary key", async () => {
    h.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };

    const result = await claimTelegramWebhookUpdate(12345);

    expect(result).toBe("duplicate");
    expect(h.inserts).toHaveLength(1);
  });

  it("fails open as unavailable for database errors", async () => {
    h.insertError = { code: "42P01", message: "relation does not exist" };

    const result = await claimTelegramWebhookUpdate(12345);

    expect(result).toBe("unavailable");
    expect(console.error).toHaveBeenCalledWith(
      "telegram webhook dedup insert failed",
      "relation does not exist",
    );
  });

  it("does not hit the database for invalid update ids", async () => {
    await expect(claimTelegramWebhookUpdate(-1)).resolves.toBe("unavailable");
    await expect(claimTelegramWebhookUpdate(Number.NaN)).resolves.toBe("unavailable");
    expect(h.inserts).toHaveLength(0);
  });
});
