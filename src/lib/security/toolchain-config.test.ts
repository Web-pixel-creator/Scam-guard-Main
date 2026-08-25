import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("toolchain security boundaries", () => {
  it("binds the default Vite dev server to IPv4 loopback", () => {
    const config = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    expect(config).toMatch(/host:\s*["']127\.0\.0\.1["']/);
    expect(config).not.toMatch(/host:\s*["'](?:::|0\.0\.0\.0)["']/);
  });

  it("keeps the service-role client behind a tree-shakeable server-only boundary", () => {
    const clientSource = readFileSync(
      resolve(process.cwd(), "src/integrations/supabase/client.server.ts"),
      "utf8",
    );
    const configSource = readFileSync(resolve(process.cwd(), "src/lib/config.server.ts"), "utf8");

    expect(clientSource).toMatch(
      /createServerOnlyFn\(\(\) => \{[\s\S]*createSupabaseAdminClient\(\)/u,
    );
    expect(clientSource).toMatch(/\/\* @__PURE__ \*\/ new Proxy/u);
    expect(clientSource).toMatch(
      /return Reflect\.get\(getSupabaseAdminClient\(\), prop, receiver\)/u,
    );
    expect(configSource).not.toMatch(/from\s+["']node:process["']/u);
  });

  it("declares patched toolchain versions and overrides", () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string | Record<string, string>>;
    };

    expect(manifest.devDependencies?.vite).toBe("7.3.6");
    expect(manifest.devDependencies?.eslint).toBe("^10.8.0");
    expect(manifest.devDependencies?.["eslint-plugin-react-hooks"]).toBe("^7.1.1");
    expect(manifest.overrides?.["@babel/core"]).toBe("7.29.7");
    expect(manifest.overrides?.vite).toBe("7.3.6");
    expect(manifest.overrides?.esbuild).toBe("0.28.1");
    expect(manifest.overrides?.["js-yaml"]).toBe("4.3.0");
    expect(manifest.overrides?.postcss).toBe("8.5.22");
    expect(manifest.overrides?.["brace-expansion"]).toBe("5.0.8");
  });

  it("keeps the Docker Bun lock free of the same vulnerable versions", () => {
    const bunLock = readFileSync(resolve(process.cwd(), "bun.lock"), "utf8");

    expect(bunLock).toContain("vite@7.3.6");
    expect(bunLock).toContain("esbuild@0.28.1");
    expect(bunLock).toContain("@babel/core@7.29.7");
    expect(bunLock).toContain("js-yaml@4.3.0");
    expect(bunLock).toContain("postcss@8.5.22");
    expect(bunLock).toContain("brace-expansion@5.0.8");
    expect(bunLock).not.toMatch(/vite@7\.3\.[0-4](?:\D|$)/);
    expect(bunLock).not.toContain("esbuild@0.27.");
    expect(bunLock).not.toContain("js-yaml@4.2.0");
    expect(bunLock).not.toMatch(/postcss@8\.5\.(?:[0-9]|1[01])(?:\D|$)/);
    const braceVersions = [...bunLock.matchAll(/brace-expansion@(\d+\.\d+\.\d+)/gu)].map(
      ([, version]) => version,
    );
    expect(new Set(braceVersions)).toEqual(new Set(["5.0.8"]));
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

  it("keeps canonical documentation paths out of Railway autodeploys", () => {
    const railway = readFileSync(resolve(process.cwd(), "railway.toml"), "utf8");
    const ci = readFileSync(resolve(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    const security = readFileSync(
      resolve(process.cwd(), ".github", "workflows", "security.yml"),
      "utf8",
    );
    const buildStart = railway.search(/^\[build\]\s*$/mu);

    expect(buildStart).toBeGreaterThanOrEqual(0);

    const afterBuildHeader = railway.slice(buildStart + "[build]".length);
    const nextSection = afterBuildHeader.search(/^\[[^\]]+\]\s*$/mu);
    const buildSection =
      nextSection >= 0 ? afterBuildHeader.slice(0, nextSection) : afterBuildHeader;

    expect(buildSection).toMatch(
      /^watchPatterns\s*=\s*\["\*\*",\s*"!\/\*\.md",\s*"!\/ai_docs\/\*\*"\]\s*$/mu,
    );
    expect(railway).toContain('builder = "DOCKERFILE"');
    expect(railway).toContain('dockerfilePath = "Dockerfile"');
    for (const workflow of [ci, security]) {
      expect(workflow).toMatch(/^\s{2}push:\s*\r?\n\s{4}branches:\s*\r?\n\s{6}- main\s*$/mu);
      expect(workflow).not.toMatch(/^\s+paths(?:-ignore)?:/mu);
    }
  });

  it("keeps package managers out of the non-root production image", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");

    expect(dockerfile).toContain("/usr/local/lib/node_modules/npm");
    expect(dockerfile).toContain("/usr/local/lib/node_modules/corepack");
    expect(dockerfile).toContain("/opt/yarn-v1.22.22");
    expect(dockerfile).toMatch(/USER\s+node/u);
    expect(dockerfile).toContain('CMD ["node", "dist/server/index.mjs"]');
  });

  it("ships the isolated QR worker's runtime decoders and resource probe", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");

    expect(dockerfile).toContain("/app/node_modules/jsqr ./node_modules/jsqr");
    expect(dockerfile).toContain("/app/node_modules/jpeg-js ./node_modules/jpeg-js");
    expect(dockerfile).toContain("/app/node_modules/pngjs ./node_modules/pngjs");
    expect(dockerfile).toContain(
      "scripts/qr-worker-resource-soak.ts --target=node --outfile=dist/ops/qr-worker-resource-soak.mjs",
    );
  });

  it("ships the isolated shared rate-limit failure probe", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");

    expect(dockerfile).toContain(
      "scripts/shared-rate-limit-failure-smoke.ts --target=node --outfile=dist/ops/shared-rate-limit-failure-smoke.mjs",
    );
  });
});
