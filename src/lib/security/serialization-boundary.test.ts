import { createPlugin, fromJSON, toJSON, toJSONAsync, type SerovalJSON } from "seroval";
import { describe, expect, it } from "vitest";

describe("patched server-function serialization dependency", () => {
  it("rejects a plugin-produced thenable before Promise assimilation calls it", async () => {
    let calls = 0;
    const plugin = createPlugin<
      { then: (resolve: (value: string) => void) => void },
      Record<string, never>
    >({
      tag: "local-regression-fixture",
      test: () => false,
      parse: {},
      serialize: () => "void 0",
      deserialize: () => ({
        then(resolve) {
          calls += 1;
          resolve("harmless fixture");
        },
      }),
    });
    // Synthetic plugin proves the dependency's guard; it is not evidence that
    // this plugin or arbitrary-callable production adapters are configured.
    const payload = {
      t: { t: 12, i: 0, s: 1, f: { t: 25, i: 1, c: plugin.tag, s: {} } },
      f: 127,
      m: [],
    } as unknown as SerovalJSON;
    expect(() => fromJSON(payload, { plugins: [plugin] })).toThrow();
    await Promise.resolve();
    expect(calls).toBe(0);
  });

  it("rejects an unbounded typed-array length with only a 16-byte numeric source", () => {
    // Vulnerable versions ignore the third constructor argument when the
    // first is numeric and allocate just 16 bytes here. This bounded fixture
    // tests the patched guard without an OOM or a large allocation on failure.
    const payload = {
      t: { t: 15, i: 0, c: "Uint8Array", f: { t: 0, s: 16 }, b: 0, l: 1e12 },
      f: 127,
      m: [],
    } as unknown as SerovalJSON;
    expect(() => fromJSON(payload)).toThrow();
  });

  it("preserves valid structured server-function values and fulfilled promises", async () => {
    const value = {
      message: "Проверка / tekshiruv / check",
      flags: new Set(["unknown", "redacted"]),
      at: new Date("2026-10-08T00:00:00.000Z"),
      bytes: new Uint8Array([1, 2, 3]),
    };
    expect(fromJSON(toJSON(value))).toEqual(value);
    await expect(fromJSON(await toJSONAsync(Promise.resolve(value)))).resolves.toEqual(value);
  });
});
