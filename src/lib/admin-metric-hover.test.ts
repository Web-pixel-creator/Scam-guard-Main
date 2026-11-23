import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source regression guard for the observed white-on-white hover. Actual
// computed styles still require the authenticated browser/viewport matrix.
const css = readFileSync(resolve(process.cwd(), "src/signal-exact.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//gu,
  "",
);

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "u"));
  expect(match, `missing CSS rule: ${selector}`).not.toBeNull();
  return match?.[1] ?? "";
}

describe("admin metric hover contrast", () => {
  it("keeps the approved orange background beneath accent-card white text", () => {
    const accent = ruleBody(".admin-metrics article.is-accent");
    expect(accent).toMatch(/background:\s*var\(--orange\)\s*;/u);
    expect(accent).toMatch(/color:\s*#fff\s*;/u);

    const hoveredAccent = ruleBody(".admin-redesign .admin-metrics article.is-accent:hover");
    expect(hoveredAccent).toMatch(/background:\s*var\(--orange\)\s*;/u);
  });

  it("preserves neutral-card hover and the existing no-lift behavior", () => {
    const hover = ruleBody(".admin-redesign .admin-metrics article:hover");
    expect(hover).toMatch(/background:\s*#fff\s*;/u);
    expect(hover).toMatch(/transform:\s*none\s*;/u);
  });
});
