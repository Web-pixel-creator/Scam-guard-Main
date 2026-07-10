import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  inserts: [] as unknown[],
  shouldFail: false,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      insert: async (row: unknown) => {
        if (table !== "embed_origin_events") {
          throw new Error(`unexpected table: ${table}`);
        }
        hoisted.inserts.push(row);
        return hoisted.shouldFail ? { error: new Error("db unavailable") } : { error: null };
      },
    }),
  },
}));

import {
  normalizeEmbedTelemetryContext,
  recordEmbedOriginEvent,
} from "./embed-origin-analytics.server";

beforeEach(() => {
  hoisted.inserts.length = 0;
  hoisted.shouldFail = false;
});

describe("embed origin analytics", () => {
  it("normalizes partner and referrer to origin/host only", () => {
    const normalized = normalizeEmbedTelemetryContext({
      partner: "  Bank <script> Media  ",
      referrer: "https://partner.example.uz/articles/check?phone=998901234567#secret",
    });

    expect(normalized).toEqual({
      partner: "Bank script Media",
      referrerOrigin: "https://partner.example.uz",
      referrerHost: "partner.example.uz",
    });
    expect(JSON.stringify(normalized)).not.toContain("998901234567");
    expect(JSON.stringify(normalized)).not.toContain("/articles/check");
    expect(JSON.stringify(normalized)).not.toContain("phone=");
    expect(JSON.stringify(normalized)).not.toContain("secret");
  });

  it("drops invalid referrers instead of storing unsafe schemes", () => {
    expect(
      normalizeEmbedTelemetryContext({
        partner: "Mahalla",
        referrer: "javascript:alert(1)",
      }),
    ).toEqual({
      partner: "Mahalla",
      referrerOrigin: null,
      referrerHost: null,
    });
  });

  it("records only aggregate result shape for embed checks", async () => {
    const recorded = await recordEmbedOriginEvent({
      context: {
        partner: "Trusted Site",
        referrer: "https://trusted.example/path?token=998901234567",
      },
      eventType: "check_result",
      lang: "en",
      result: {
        type: "phone",
        level: "suspicious",
        reasons: ["asks_for_sms_code", "uses_urgency", "unknown_sender"],
      },
    });

    expect(recorded).toBe(true);
    expect(hoisted.inserts).toEqual([
      {
        event_type: "check_result",
        partner: "Trusted Site",
        referrer_origin: "https://trusted.example",
        referrer_host: "trusted.example",
        language: "en",
        input_type: "phone",
        risk_level: "suspicious",
        reason_count: 3,
      },
    ]);
    expect(JSON.stringify(hoisted.inserts)).not.toContain("998901234567");
    expect(JSON.stringify(hoisted.inserts)).not.toContain("token=");
    expect(JSON.stringify(hoisted.inserts)).not.toContain("/path");
  });

  it("does not fail the caller when telemetry storage is unavailable", async () => {
    hoisted.shouldFail = true;

    await expect(
      recordEmbedOriginEvent({
        context: { partner: "Trusted Site", referrer: "https://trusted.example" },
        eventType: "meta_intent",
        lang: "ru",
      }),
    ).resolves.toBe(false);
  });
});
