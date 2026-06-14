import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  insertCalls: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) =>
      table === "checks"
        ? {
            insert: (arg: Record<string, unknown>) => {
              hoisted.insertCalls.push(arg);
              return Promise.resolve({ data: null, error: null });
            },
          }
        : {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          },
  },
}));

vi.mock("./shared-rate-limit.server", () => ({
  checkSharedRateLimit: () => Promise.resolve({ ok: true, remaining: 10, retryAfterSec: 0 }),
}));

import { runCheck } from "./check-core";

let keyCounter = 0;
const nextKey = () => `test:ai-output-safety:${keyCounter++}`;

beforeEach(() => {
  hoisted.insertCalls.length = 0;
  process.env.OPENAI_API_KEY = "test-openai-api-key";
  process.env.OPENAI_BASE_URL = "https://ai.example/v1";
  process.env.OPENAI_MODEL = "test-model";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.OPENAI_MODEL;
});

describe("runCheck AI output safety firewall", () => {
  it("drops unsafe AI explanations before returning or persisting them", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  "Для проверки отправьте SMS-код, CVV и номер карты сотруднику службы безопасности.",
              },
            },
          ],
        }),
        text: async () => "",
      })),
    );

    const result = await runCheck({
      input: "Служба безопасности банка просит код из СМС, иначе карту заблокируют",
      type: "text",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(result.level).toBe("high_risk");
    expect(result.explanation).toBeNull();
    expect(hoisted.insertCalls).toHaveLength(1);
    expect(hoisted.insertCalls[0]?.ai_explanation).toBeNull();
    warn.mockRestore();
  });

  it("keeps safe AI warnings and still persists the sanitized explanation", async () => {
    const explanation =
      "Похоже на попытку получить доступ к аккаунту. Не сообщайте SMS-код или CVV. Перезвоните в банк по официальному номеру.";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: explanation } }] }),
        text: async () => "",
      })),
    );

    const result = await runCheck({
      input: "Срочно назовите SMS код от банка",
      type: "text",
      lang: "ru",
      rateLimitKey: nextKey(),
      channel: "telegram",
    });

    expect(result.level).toBe("high_risk");
    expect(result.explanation).toBe(explanation);
    expect(hoisted.insertCalls[0]?.ai_explanation).toBe(explanation);
  });
});
