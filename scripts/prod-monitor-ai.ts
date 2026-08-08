import type { MonitorCheck } from "./prod-monitor-policy";

export interface AiProviderMonitorConfig {
  enabled: boolean;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  optInLabel: string;
}

export type MonitorRequest = (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  label: string,
) => Promise<Response>;

function result(severity: MonitorCheck["severity"], detail: string): MonitorCheck {
  return { name: "ai provider", severity, detail };
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * Runs the billable provider probe only after an explicit opt-in.
 *
 * The scheduled baseline monitor deliberately calls this with `enabled=false`.
 * That path is an OK policy result (not a warning), never invokes `request`, and
 * therefore cannot spend provider quota or trigger a warning alert. Once an
 * operator opts in, every inability to prove provider health is a hard failure.
 */
export async function checkAiProvider(
  config: AiProviderMonitorConfig,
  request: MonitorRequest,
): Promise<MonitorCheck> {
  if (!config.enabled) {
    return result("ok", `disabled by policy: ${config.optInLabel} not provided; no request sent`);
  }

  if (!config.apiKey) {
    return result("fail", "enabled but OPENAI_API_KEY is not set");
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  try {
    const response = await request(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: "Reply with one short word." },
            { role: "user", content: "ping" },
          ],
        }),
      },
      config.timeoutMs,
      "ai provider",
    );

    if (!response.ok) {
      return result("fail", `model=${config.model}, status=${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const hasChoice = Boolean(data.choices?.[0]?.message?.content);
    return result(
      hasChoice ? "ok" : "fail",
      `model=${config.model}, status=${response.status}${hasChoice ? "" : ", response=missing_choice"}`,
    );
  } catch (error) {
    return result("fail", safeError(error));
  }
}
