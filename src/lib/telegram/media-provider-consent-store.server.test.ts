import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TelegramUpdateLease } from "./update-lifecycle.server";

const h = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: h.rpc },
}));

import {
  claimMediaProviderConsent,
  grantMediaProviderConsent,
  isMediaProviderConsentSupported,
  registerMediaProviderConsent,
  revokeMediaProviderConsent,
} from "./media-provider-consent-store.server";
import { runWithTelegramUpdateExecution } from "./update-execution.server";

const LEASE: TelegramUpdateLease = {
  updateId: 101,
  leaseToken: "11111111-1111-4111-8111-111111111111",
  processingFence: 3,
  leaseExpiresAt: "2026-09-04T10:02:00.000Z",
  leaderToken: "22222222-2222-4222-8222-222222222222",
  leaderFence: 7,
};

const SCOPE = { userId: 42, chatId: -1005, chatType: "supergroup" as const };
const REPORT_FLOW_ID = "4a761fe8-d3d6-4ff4-996c-59bef651ed86";

async function withLease<T>(work: () => Promise<T>, lease = LEASE): Promise<T> {
  return (await runWithTelegramUpdateExecution(lease.updateId, work, { lease })).value;
}

beforeEach(() => {
  h.rpc.mockReset().mockResolvedValue({
    data: [{ lease_valid: true, applied: true }],
    error: null,
  });
});

describe("media provider consent RPC adapter", () => {
  it("passes the exact polling lease, scope, prompt and report generation", async () => {
    await expect(
      withLease(() =>
        registerMediaProviderConsent({
          ...SCOPE,
          kind: "report_image",
          promptMessageId: 77,
          reportFlowId: REPORT_FLOW_ID,
        }),
      ),
    ).resolves.toBe("applied");

    expect(h.rpc).toHaveBeenCalledWith("register_telegram_media_provider_consent", {
      p_telegram_user_id: 42,
      p_chat_id: -1005,
      p_chat_type: "supergroup",
      p_media_kind: "report_image",
      p_prompt_message_id: 77,
      p_report_flow_id: REPORT_FLOW_ID,
      p_update_id: 101,
      p_lease_token: LEASE.leaseToken,
      p_processing_fence: 3,
      p_leader_token: LEASE.leaderToken,
      p_leader_fence: 7,
    });
  });

  it("uses the four closed RPC contracts and never adds media content", async () => {
    await withLease(() =>
      grantMediaProviderConsent({ ...SCOPE, kind: "image", promptMessageId: 77 }),
    );
    await withLease(() => revokeMediaProviderConsent({ ...SCOPE, promptMessageId: 77 }));
    await withLease(() => claimMediaProviderConsent({ ...SCOPE, kind: "voice" }));

    expect(h.rpc.mock.calls.map(([name]) => name)).toEqual([
      "grant_telegram_media_provider_consent",
      "revoke_telegram_media_provider_consent",
      "claim_telegram_media_provider_consent",
    ]);
    expect(JSON.stringify(h.rpc.mock.calls)).not.toMatch(
      /data:image|file_id|transcript|provider_payload/u,
    );
  });

  it("distinguishes semantic miss and stale ownership from storage uncertainty", async () => {
    h.rpc.mockResolvedValueOnce({ data: [{ lease_valid: true, applied: false }], error: null });
    await expect(
      withLease(() => claimMediaProviderConsent({ ...SCOPE, kind: "image" })),
    ).resolves.toBe("missing");

    h.rpc.mockResolvedValueOnce({ data: [{ lease_valid: false, applied: false }], error: null });
    await expect(
      withLease(() => claimMediaProviderConsent({ ...SCOPE, kind: "image" })),
    ).resolves.toBe("stale");

    h.rpc.mockResolvedValueOnce({ data: [{ lease_valid: false, applied: true }], error: null });
    await expect(
      withLease(() => claimMediaProviderConsent({ ...SCOPE, kind: "image" })),
    ).resolves.toBe("storage");
  });

  it("fails closed for an absent lease, invalid scope, RPC error or malformed result", async () => {
    await expect(claimMediaProviderConsent({ ...SCOPE, kind: "image" })).resolves.toBe("storage");
    await expect(
      withLease(() => claimMediaProviderConsent({ ...SCOPE, userId: 0, kind: "image" })),
    ).resolves.toBe("storage");

    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "hidden" } });
    await expect(
      withLease(() => claimMediaProviderConsent({ ...SCOPE, kind: "image" })),
    ).resolves.toBe("storage");

    h.rpc.mockResolvedValueOnce({ data: [{ lease_valid: true }], error: null });
    await expect(
      withLease(() => claimMediaProviderConsent({ ...SCOPE, kind: "image" })),
    ).resolves.toBe("storage");
  });

  it("disables raw-media consent outside single-leader polling", async () => {
    const webhookLease: TelegramUpdateLease = {
      updateId: 102,
      leaseToken: LEASE.leaseToken,
      processingFence: 1,
      leaseExpiresAt: LEASE.leaseExpiresAt,
    };

    await expect(
      withLease(() => {
        expect(isMediaProviderConsentSupported()).toBe(false);
        return registerMediaProviderConsent({ ...SCOPE, kind: "image", promptMessageId: 77 });
      }, webhookLease),
    ).resolves.toBe("unsupported");
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
