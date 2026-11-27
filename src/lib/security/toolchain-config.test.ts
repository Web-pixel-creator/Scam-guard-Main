import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("toolchain security boundaries", () => {
  it.each(["verify", "coverage"])("selects Node 22 inside the %s job before install", (job) => {
    const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const jobs = [...ci.matchAll(/^ {2}([a-z][a-z-]*):\r?$/gmu)];
    const index = jobs.findIndex((entry) => entry[1] === job);
    expect(index).toBeGreaterThanOrEqual(0);
    const block = ci.slice(jobs[index].index, jobs[index + 1]?.index ?? ci.length);
    const setup = block.match(
      /uses: actions\/setup-node@[a-f0-9]{40}[^\n]*\r?\n\s+with:\r?\n\s+node-version: 22\s*\r?\n/u,
    );
    expect(
      setup,
      `${job} cannot inherit Node from another job or the hosted runner`,
    ).not.toBeNull();
    expect(setup?.index).toBeLessThan(block.indexOf("run: bun install --frozen-lockfile"));
  });

  it("bounds full-suite CPU contention without relaxing test deadlines or retries", () => {
    const config = readFileSync(resolve(process.cwd(), "vitest.config.ts"), "utf8");

    expect(config).toMatch(/maxWorkers:\s*2\s*,/u);
    expect(config).not.toMatch(/\b(?:testTimeout|hookTimeout|retry|exclude)\s*:/u);
    expect(config).toContain('include: ["src/**/*.{test,spec}.{ts,tsx}"]');
    expect(config).toContain('setupFiles: ["./vitest.setup.ts"]');
    expect(config).not.toMatch(/\bisolate\s*:\s*false/u);
  });

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
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: Record<string, string | Record<string, string>>;
    };

    expect(manifest.devDependencies?.vite).toBe("7.3.8");
    expect(manifest.devDependencies?.vitest).toBe("4.1.12");
    expect(manifest.devDependencies?.eslint).toBe("^10.8.0");
    expect(manifest.devDependencies?.["eslint-plugin-react-hooks"]).toBe("^7.1.1");
    expect(manifest.dependencies?.["@tanstack/react-start"]).toBe("1.168.60");
    expect(manifest.dependencies?.["@tanstack/react-router"]).toBe("1.170.41");
    expect(manifest.dependencies?.["@tanstack/router-plugin"]).toBe("1.168.42");
    expect(manifest.overrides?.["@babel/core"]).toBe("7.29.7");
    expect(manifest.overrides?.vite).toBe("7.3.8");
    expect(manifest.overrides?.esbuild).toBe("0.28.1");
    expect(manifest.overrides?.["js-yaml"]).toBe("4.3.2");
    expect(manifest.overrides?.postcss).toBe("8.5.23");
    expect(manifest.overrides?.["brace-expansion"]).toBe("5.0.12");
    expect(manifest.overrides?.seroval).toBe("1.6.12");
    expect(manifest.overrides?.["baseline-browser-mapping"]).toBe("2.11.0");
    expect(manifest.overrides?.browserslist).toBe("4.28.7");
    expect(manifest.overrides?.nanoid).toBe("3.3.18");
    expect(manifest.overrides?.["source-map-js"]).toBe("1.2.2");
  });

  it("keeps the Docker Bun lock free of the same vulnerable versions", () => {
    const bunLock = readFileSync(resolve(process.cwd(), "bun.lock"), "utf8");

    expect(bunLock).toContain("vite@7.3.8");
    expect(bunLock).toContain("esbuild@0.28.1");
    expect(bunLock).toContain("@babel/core@7.29.7");
    expect(bunLock).toContain("js-yaml@4.3.2");
    expect(bunLock).toContain("postcss@8.5.23");
    expect(bunLock).toContain("brace-expansion@5.0.12");
    expect(bunLock).not.toMatch(/vite@7\.3\.[0-6](?:\D|$)/);
    expect(bunLock).not.toContain("esbuild@0.27.");
    expect(bunLock).not.toContain("js-yaml@4.2.0");
    expect(bunLock).not.toMatch(/postcss@8\.5\.(?:[0-9]|1[01])(?:\D|$)/);
    const braceVersions = [...bunLock.matchAll(/brace-expansion@(\d+\.\d+\.\d+)/gu)].map(
      ([, version]) => version,
    );
    expect(new Set(braceVersions)).toEqual(new Set(["5.0.12"]));

    const patchedVersions = {
      "@tanstack/react-start": "1.168.60",
      "@tanstack/start-server-core": "1.169.39",
      seroval: "1.6.12",
      "baseline-browser-mapping": "2.11.0",
      browserslist: "4.28.7",
      nanoid: "3.3.18",
      "source-map-js": "1.2.2",
      vitest: "4.1.12",
      "@vitest/mocker": "4.1.12",
    };
    const records = [...bunLock.matchAll(/^\s*"[^\n]+?":\s*\["([^"\n]+)"/gmu)];
    for (const [name, version] of Object.entries(patchedVersions)) {
      const resolvedVersions = records
        .map((record) => record[1])
        .filter((record) => record.startsWith(`${name}@`))
        .map((record) => record.slice(name.length + 1));
      expect(new Set(resolvedVersions), name).toEqual(new Set([version]));
    }
    const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    expect(ci).toContain("@vitest/coverage-v8@4.1.12");
    expect(ci).not.toContain("@vitest/coverage-v8@4.1.8");
  });

  it.each(["ci.yml", "security.yml", "prod-monitor.yml", "backup.yml", "backup-restore-drill.yml"])(
    "pins every action in %s to a commit SHA",
    (name) => {
      const workflow = readFileSync(resolve(process.cwd(), ".github", "workflows", name), "utf8");
      const actions = [...workflow.matchAll(/^\s*uses:\s+[^@\s]+@([^\s#]+)/gmu)];

      expect(actions.length).toBeGreaterThan(0);
      for (const action of actions) expect(action[1]).toMatch(/^[0-9a-f]{40}$/u);
      expect(workflow).not.toMatch(/bun-version:\s*latest/iu);
    },
  );

  it("keeps required-check job names ASCII-stable and workflow files BOM-free", () => {
    const ci = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
    const monitor = readFileSync(
      resolve(process.cwd(), ".github/workflows/prod-monitor.yml"),
      "utf8",
    );
    const security = readFileSync(resolve(process.cwd(), ".github/workflows/security.yml"), "utf8");

    const containsNonAsciiOrUnexpectedControl = (text: string): boolean =>
      [...text].some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code > 0x7e || (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d);
      });

    for (const workflow of [ci, monitor, security]) {
      expect(workflow.charCodeAt(0)).not.toBe(0xfeff);
      expect(containsNonAsciiOrUnexpectedControl(workflow)).toBe(false);
    }
    for (const name of ["ci-verify", "coverage-thresholds", "database-gates"]) {
      expect(ci).toContain(`name: ${name}`);
    }
    for (const name of ["codeql-js-ts", "gitleaks-scan", "container-security-sbom"]) {
      expect(security).toContain(`name: ${name}`);
    }
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

  it("keeps the reviewed production invariants in Railway IaC", () => {
    const railway = readFileSync(resolve(process.cwd(), ".railway", "railway.ts"), "utf8");
    const ci = readFileSync(resolve(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    const security = readFileSync(
      resolve(process.cwd(), ".github", "workflows", "security.yml"),
      "utf8",
    );

    expect(existsSync(resolve(process.cwd(), "railway.toml"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "railway.json"))).toBe(false);
    expect(railway).toContain('github("Web-pixel-creator/Scam-guard-Main"');
    expect(railway).toContain('branch: "main"');
    expect(railway).toContain('builder: "DOCKERFILE"');
    expect(railway).toContain('dockerfilePath: "Dockerfile"');
    expect(railway).toMatch(/watchPatterns:\s*\["\*\*",\s*"!\/\*\.md",\s*"!\/ai_docs\/\*\*"\]/u);
    expect(railway).toContain('healthcheckPath: "/healthz"');
    expect(railway).toContain("healthcheckTimeout: 100");
    expect(railway).not.toContain("restartPolicyType:");
    expect(railway).toContain("restartPolicyMaxRetries: 5");
    expect(railway).toContain('replicas: { "us-west2": 1 }');
    expect(railway.match(/\bpreserve\(\)/gu)).toHaveLength(24);
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
    expect(dockerfile).toContain("FROM oven/bun:1.3.14 AS build");
    const dockerignore = readFileSync(resolve(process.cwd(), ".dockerignore"), "utf8");
    expect(dockerignore.split(/\r?\n/u)).toContain("output");
    expect(dockerignore.split(/\r?\n/u)).toContain(".playwright-cli");
    expect(dockerfile).toContain("--only-upgrade perl-base");
    expect(dockerfile).toContain("ge 5.36.0-7+deb12u4");
    expect(dockerfile).toContain("libpam0g");
    expect(dockerfile).toContain("ge 1.5.2-6+deb12u3");
    expect(dockerfile.indexOf("--only-upgrade perl-base")).toBeLessThan(
      dockerfile.indexOf("USER node"),
    );
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
