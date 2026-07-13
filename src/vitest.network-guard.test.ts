import { describe, expect, it } from "vitest";

describe("Vitest network safety", () => {
  it("denies an unmocked fetch before any external request can leave the process", async () => {
    await expect(fetch("https://network-must-not-run.invalid/test")).rejects.toThrow(
      "Unexpected network request in Vitest",
    );
  });
});
