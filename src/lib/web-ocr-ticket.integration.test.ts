import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Actual server validators/wrappers, image digest, signed ticket helper and OCR
// provider core. The RPC Set models atomic consumption, NOT PostgreSQL locking,
// ACLs, retention or transport. No real database or network is reachable here.
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  limiter: vi.fn(),
  rows: new Set<string>(),
  quotaCounts: new Map<string, number>(),
  providerCalls: [] as Array<{
    url: string;
    method: string;
    redirect: string;
    imageMatched: boolean;
    claimsAtTransfer: number;
  }>,
  unexpectedNetworkAttempts: 0,
  providerMode: "success" as "success" | "throw" | "503",
  quotaEnabled: false,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((data: unknown) => unknown) | undefined;
    const builder = {
      inputValidator(fn: (data: unknown) => unknown) {
        validator = fn;
        return builder;
      },
      handler(handler: (options: { data: unknown }) => unknown) {
        return async (options: { data: unknown }) =>
          handler({
            data: validator ? validator(options?.data) : options?.data,
          });
      },
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: () => undefined,
  getRequestIP: () => "192.0.2.55",
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: h.rpc,
    from: () => {
      throw new Error("Unexpected table I/O in OCR ticket composition");
    },
  },
}));
vi.mock("./risk/shared-rate-limit.server", () => ({ checkSharedRateLimit: h.limiter }));

const IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWH0AAAAASUVORK5CYII=";
const OTHER_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const PROVIDER_URL = "https://ocr-composition.invalid/v1/chat/completions";
const RESULT_TEXT = "ordinary synthetic notice";
type Lang = "ru" | "uz" | "en";
type WebFunctions = typeof import("./check.functions");
let api: WebFunctions;
let digestImage: typeof import("./web-ocr-image-digest").digestWebOcrImage;

function atomicConsumeModel(name: string, args: Record<string, unknown>) {
  expect(name).toBe("claim_web_ocr_ticket");
  expect(Object.keys(args).sort()).toEqual(["p_expires_at_ms", "p_issued_at_ms", "p_ticket_id"]);
  expect(args.p_ticket_id).toMatch(/^[0-9a-f-]{36}$/u);
  expect(Number(args.p_expires_at_ms) - Number(args.p_issued_at_ms)).toBe(600_000);
  const key = String(args.p_ticket_id);
  const applied = !h.rows.has(key);
  if (applied) h.rows.add(key);
  return { data: applied, error: null };
}

async function issue(lang: Lang = "en", image = IMAGE) {
  return api.issueOcrTicket({
    data: {
      imageDigest: await digestImage(image),
      lang,
      externalProviderConsent: true,
    },
  });
}

async function extract(ticket: string, lang: Lang = "en", image = IMAGE) {
  return api.ocrExtract({
    data: {
      image,
      lang,
      externalProviderConsent: true,
      operationTicket: ticket,
    },
  });
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  h.rows.clear();
  h.quotaCounts.clear();
  h.providerCalls.length = 0;
  h.unexpectedNetworkAttempts = 0;
  h.providerMode = "success";
  h.quotaEnabled = false;
  h.rpc.mockImplementation(atomicConsumeModel);
  h.limiter.mockImplementation(async (scope: string, key: string, limit: number) => {
    const bucket = `${scope}:${key}`;
    const used = (h.quotaCounts.get(bucket) ?? 0) + 1;
    h.quotaCounts.set(bucket, used);
    return h.quotaEnabled && used > limit
      ? { ok: false, remaining: 0, retryAfterSec: 37 }
      : { ok: true, remaining: Math.max(0, limit - used), retryAfterSec: 0 };
  });
  for (const name of [
    "HASH_PEPPER_ACTIVE_VERSION",
    "HASH_PEPPER_ACTIVE_SECRET",
    "HASH_PEPPER_PREVIOUS_VERSION",
    "HASH_PEPPER_PREVIOUS_SECRET",
    "TRUST_PROXY_IP_HEADERS",
    "TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_SERVICE_ID",
  ]) {
    vi.stubEnv(name, "");
  }
  vi.stubEnv("HASH_PEPPER_SECRET", "synthetic-ocr-ticket-composition-pepper");
  vi.stubEnv("OPENAI_API_KEY", "synthetic-ocr-composition-key");
  vi.stubEnv("OPENAI_BASE_URL", "https://ocr-composition.invalid/v1");
  vi.stubEnv("OPENAI_FALLBACK_API_KEY", "synthetic-fallback-key");
  vi.stubEnv("OPENAI_FALLBACK_BASE_URL", "https://must-not-send.invalid/v1");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url !== PROVIDER_URL) {
      h.unexpectedNetworkAttempts += 1;
      throw new Error("Unexpected network target in OCR ticket composition");
    }
    // Inspect only synthetic content in memory. Never capture/log payload,
    // authorization headers, signed tickets or provider response bodies.
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    const imageMatched =
      body?.messages?.some(
        (message: { content?: unknown }) =>
          Array.isArray(message.content) &&
          message.content.some(
            (part: { image_url?: { url?: string } }) => part.image_url?.url === IMAGE,
          ),
      ) ?? false;
    h.providerCalls.push({
      url,
      method: String(init?.method),
      redirect: String(init?.redirect),
      imageMatched,
      claimsAtTransfer: h.rows.size,
    });
    if (h.providerMode === "throw") throw new Error("synthetic provider transport failure");
    if (h.providerMode === "503") return new Response("synthetic unavailable", { status: 503 });
    return new Response(JSON.stringify({ choices: [{ message: { content: RESULT_TEXT } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  api = await import("./check.functions");
  ({ digestWebOcrImage: digestImage } = await import("./web-ocr-image-digest"));
});

afterEach(() => {
  expect(h.unexpectedNetworkAttempts).toBe(0);
  for (const call of h.providerCalls) {
    expect(call).toMatchObject({
      url: PROVIDER_URL,
      method: "POST",
      redirect: "error",
      imageMatched: true,
    });
    expect(call.claimsAtTransfer).toBeGreaterThan(0);
  }
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("durable Web OCR ticket actual application composition", () => {
  it.each(["ru", "uz", "en"] as const)(
    "issues metadata-only %s tickets without image/provider/ticket-claim I/O",
    async (lang) => {
      expect(await digestImage(IMAGE)).toBe(createHash("sha256").update(IMAGE).digest("hex"));
      const { ticket } = await issue(lang);
      expect(typeof ticket).toBe("string");
      expect(ticket.length).toBeGreaterThan(32);
      expect(h.rpc).not.toHaveBeenCalled();
      expect(h.providerCalls).toHaveLength(0);
      expect(h.rows.size).toBe(0);
    },
  );

  it("positive control: a real core provider fetch occurs only after consumption, then replay is denied", async () => {
    const { ticket } = await issue();
    expect(await extract(ticket)).toEqual({ text: RESULT_TEXT });
    expect(h.providerCalls).toHaveLength(1);
    expect(h.rows.size).toBe(1);
    await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    expect(h.providerCalls).toHaveLength(1);
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });

  it("a committed claim with a lost receipt never reaches the provider, including replay", async () => {
    const { ticket } = await issue();
    h.rpc.mockImplementationOnce((name, args) => {
      atomicConsumeModel(name, args);
      throw new Error("synthetic lost committed RPC receipt");
    });
    await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    expect(h.rows.size).toBe(1);
    expect(h.providerCalls).toHaveLength(0);
    await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    expect(h.rows.size).toBe(1);
    expect(h.providerCalls).toHaveLength(0);
  });

  it("two overlapping duplicate HTTP calls reach the claim barrier but only one transfers", async () => {
    const { ticket } = await issue();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    let arrivals = 0;
    h.rpc.mockImplementation(async (name, args) => {
      const response = atomicConsumeModel(name, args);
      arrivals += 1;
      if (arrivals === 2) release();
      await barrier;
      return response;
    });
    const results = await Promise.allSettled([extract(ticket), extract(ticket)]);
    expect(arrivals).toBe(2);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(h.providerCalls).toHaveLength(1);
    expect(h.rows.size).toBe(1);
  });

  it.each(["throw", "503"] as const)(
    "provider %s has one attempt, no fallback and no replay transfer",
    async (mode) => {
      const { ticket } = await issue();
      h.providerMode = mode;
      expect(await extract(ticket)).toEqual({ text: null });
      expect(h.providerCalls).toHaveLength(1);
      expect(h.rows.size).toBe(1);
      h.providerMode = "success";
      await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
      expect(h.providerCalls).toHaveLength(1);
    },
  );

  it.each(
    [null, undefined, false, 1, "true", [], [true], { applied: true }, { data: true }].map(
      (data) => ({ data }),
    ),
  )("non-authorizing RPC boolean $data fails closed before provider I/O", async ({ data }) => {
    const { ticket } = await issue();
    h.rpc.mockResolvedValueOnce({ data, error: null });
    await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    expect(h.providerCalls).toHaveLength(0);
  });

  it("a response containing both true and an error is not authorization", async () => {
    const { ticket } = await issue();
    h.rpc.mockResolvedValueOnce({ data: true, error: { code: "synthetic_error" } });
    await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    expect(h.providerCalls).toHaveLength(0);
  });

  it.each(["digest", "language", "signature"] as const)(
    "wrong %s is rejected before any claim or provider transfer",
    async (wrong) => {
      const { ticket } = await issue();
      let candidate = ticket;
      if (wrong === "signature") {
        const index = ticket.length - 8;
        candidate =
          ticket.slice(0, index) + (ticket[index] === "0" ? "1" : "0") + ticket.slice(index + 1);
      }
      await expect(
        extract(
          candidate,
          wrong === "language" ? "uz" : "en",
          wrong === "digest" ? OTHER_IMAGE : IMAGE,
        ),
      ).rejects.toThrow("ocr_operation_unavailable");
      expect(h.rpc).not.toHaveBeenCalled();
      expect(h.providerCalls).toHaveLength(0);
      // Invalid binding must not burn the legitimate operation.
      expect(await extract(ticket)).toEqual({ text: RESULT_TEXT });
      expect(h.providerCalls).toHaveLength(1);
    },
  );

  it("a fresh server-module context cannot replay a ticket already consumed in the durable model", async () => {
    const { ticket } = await issue();
    expect(await extract(ticket)).toEqual({ text: RESULT_TEXT });
    const beforeRestart = api.ocrExtract;
    vi.resetModules();
    api = await import("./check.functions");
    expect(api.ocrExtract).not.toBe(beforeRestart);
    await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    expect(h.providerCalls).toHaveLength(1);
    expect(h.rows.size).toBe(1);
  });

  it("retains the original 10/minute execution quota independently of ticket issuance", async () => {
    h.quotaEnabled = true;
    const { ticket } = await issue();
    const issuanceCall = h.limiter.mock.calls[0];
    expect(await extract(ticket)).toEqual({ text: RESULT_TEXT });
    const executionCall = h.limiter.mock.calls[1];
    expect(executionCall).toEqual(["check", "check:192.0.2.55", 10, 60_000]);
    expect(issuanceCall.slice(0, 2)).not.toEqual(executionCall.slice(0, 2));
    for (let attempt = 2; attempt <= 10; attempt += 1) {
      await expect(extract(ticket)).rejects.toThrow("ocr_operation_unavailable");
    }
    await expect(extract(ticket)).rejects.toMatchObject({ status: 429, retryAfter: 37 });
    expect(h.rpc).toHaveBeenCalledTimes(10);
    expect(h.providerCalls).toHaveLength(1);
  });
});
