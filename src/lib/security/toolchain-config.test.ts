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

  it.each(["ci.yml", "security.yml"])("pins every action in %s to a commit SHA", (name) => {
    const workflow = readFileSync(resolve(process.cwd(), ".github", "workflows", name), "utf8");
    const actions = [...workflow.matchAll(/^\s*uses:\s+[^@\s]+@([^\s#]+)/gmu)];

    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(action[1]).toMatch(/^[0-9a-f]{40}$/u);
    expect(workflow).not.toMatch(/bun-version:\s*latest/iu);
  });

  it("enforces coverage, SAST, secret, container and SBOM gates", () => {
    const ci = readFileSync(resolve(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    const security = readFileSync(
      resolve(process.cwd(), ".github", "workflows", "security.yml"),
      "utf8",
    );

    expect(ci).toContain("--coverage.thresholds.statements=80");
    expect(ci).toContain("--coverage.thresholds.branches=75");
    expect(ci).toContain("--coverage.thresholds.functions=85");
    expect(ci).toContain("--coverage.thresholds.lines=80");
    expect(security).toContain("github/codeql-action/init@");
    expect(security).toContain("gitleaks/gitleaks-action@");
    expect(security).toContain("aquasecurity/trivy-action@");
    expect(security).toContain("format: cyclonedx");
    expect(security).toContain("actions/upload-artifact@");
  });
});
