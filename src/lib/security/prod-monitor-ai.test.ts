import { describe, expect, it, vi } from "vitest";

import { checkAiProvider, type MonitorRequest } from "../../../scripts/prod-monitor-ai";

const BASE_CONFIG = {
  apiKey: "test-provider-key",
  baseUrl: "https://provider.example/v1/",
  model: "test-model",
  timeoutMs: 1234,
  optInLabel: "MONITOR_CHECK_AI=true",
};

describe("production monitor AI opt-in policy", () => {
  it("does not call the provider or emit a warning when the probe is disabled", async () => {
    const request = vi.fn<MonitorRequest>();

    const check = await checkAiProvider({ ...BASE_CONFIG, enabled: false }, request);

    expect(request).not.toHaveBeenCalled();
    expect(check).toEqual({
      name: "ai provider",
      severity: "ok",
      detail: "disabled by policy: MONITOR_CHECK_AI=true not provided; no request sent",
    });
  });

  it("fails without making a request when an enabled probe has no key", async () => {
    const request = vi.fn<MonitorRequest>();

    const check = await checkAiProvider({ ...BASE_CONFIG, enabled: true, apiKey: null }, request);

    expect(request).not.toHaveBeenCalled();
    expect(check.severity).toBe("fail");
    expect(check.detail).toBe("enabled but OPENAI_API_KEY is not set");
  });

  it.each([401, 429, 500, 503])("fails hard on enabled provider status %i", async (status) => {
    const request = vi.fn<MonitorRequest>().mockResolvedValue(new Response(null, { status }));

    const check = await checkAiProvider({ ...BASE_CONFIG, enabled: true }, request);

    expect(check).toEqual({
      name: "ai provider",
      severity: "fail",
      detail: `model=test-model, status=${status}`,
    });
  });

  it("fails hard on an enabled provider network error without leaking the key", async () => {
    const request = vi.fn<MonitorRequest>().mockRejectedValue(new Error("network unavailable"));

    const check = await checkAiProvider({ ...BASE_CONFIG, enabled: true }, request);

    expect(check).toEqual({
      name: "ai provider",
      severity: "fail",
      detail: "network unavailable",
    });
    expect(JSON.stringify(check)).not.toContain(BASE_CONFIG.apiKey);
  });

  it("calls the configured endpoint once and records an enabled success", async () => {
    const request = vi
      .fn<MonitorRequest>()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: "ok" } }] }, { status: 200 }),
      );

    const check = await checkAiProvider({ ...BASE_CONFIG, enabled: true }, request);

    expect(check.severity).toBe("ok");
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
      1234,
      "ai provider",
    );
  });

  it("fails a 200 response that does not prove a chat completion", async () => {
    const request = vi
      .fn<MonitorRequest>()
      .mockResolvedValue(Response.json({ choices: [] }, { status: 200 }));

    const check = await checkAiProvider({ ...BASE_CONFIG, enabled: true }, request);

    expect(check).toEqual({
      name: "ai provider",
      severity: "fail",
      detail: "model=test-model, status=200, response=missing_choice",
    });
  });
});
