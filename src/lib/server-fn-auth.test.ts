import { afterEach, describe, expect, it, vi } from "vitest";
import { hasStoredSupabaseSession } from "./server-fn-auth";

function storage(keys: string[]) {
  return { length: keys.length, key: (i: number) => keys[i] ?? null };
}

describe("server function auth attachment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sees a persisted Supabase session by its storage key", () => {
    vi.stubGlobal("localStorage", storage(["ig_a11y_font_scale", "sb-127-auth-token"]));
    expect(hasStoredSupabaseSession()).toBe(true);
  });

  it("skips public visitors: no session key, or only the PKCE verifier", () => {
    vi.stubGlobal("localStorage", storage(["ig_lang", "sb-127-auth-token-code-verifier"]));
    expect(hasStoredSupabaseSession()).toBe(false);
  });

  it("treats blocked storage as no session", () => {
    vi.stubGlobal("localStorage", {
      get length(): number {
        throw new DOMException("blocked", "SecurityError");
      },
      key: () => null,
    });
    expect(hasStoredSupabaseSession()).toBe(false);
  });
});
