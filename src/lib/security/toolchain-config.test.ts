import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("toolchain security boundaries", () => {
  it("binds the default Vite dev server to IPv4 loopback", () => {
    const config = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(config).toMatch(/host:\s*["']127\.0\.0\.1["']/);
    expect(config).not.toMatch(/host:\s*["'](?:::|0\.0\.0\.0)["']/);
  });

  it("declares patched toolchain versions and overrides", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string | Record<string, string>>;
    };

    expect(manifest.devDependencies?.vite).toBe("7.3.6");
    expect(manifest.overrides?.["@babel/core"]).toBe("7.29.7");
    expect(manifest.overrides?.vite).toBe("7.3.6");
    expect(manifest.overrides?.esbuild).toBe("0.28.1");
    expect(manifest.overrides?.["js-yaml"]).toBe("4.2.0");
    expect(manifest.overrides?.["minimatch@3.1.5"]).toEqual({
      "brace-expansion": "1.1.13",
    });
  });

  it("keeps the Docker Bun lock free of the same vulnerable versions", () => {
    const bunLock = readFileSync(resolve(process.cwd(), "bun.lock"), "utf8");

    expect(bunLock).toContain("vite@7.3.6");
    expect(bunLock).toContain("esbuild@0.28.1");
    expect(bunLock).toContain("@babel/core@7.29.7");
    expect(bunLock).toContain("js-yaml@4.2.0");
    expect(bunLock).not.toMatch(/vite@7\.3\.[0-4](?:\D|$)/);
    expect(bunLock).not.toContain("esbuild@0.27.");
    expect(bunLock).not.toContain("brace-expansion@1.1.12");
  });
});
