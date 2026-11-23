import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source guard for the metric-matched font fallbacks. The layout effect itself
// (no re-wrap when Inter arrives) needs a browser and is measured separately.
const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
const fonts = read("src/fonts-inter.css");
const styles = read("src/styles.css");

const FALLBACKS = {
  "Inter Display": ["Inter Display Fallback", "Inter Display Fallback Android"],
  Inter: ["Inter Fallback", "Inter Fallback Android"],
} as const;

function stack(css: string, variable: string): string[] {
  const match = css.match(new RegExp(`${variable}:\\s*([^;]+);`, "u"));
  expect(match, `missing ${variable}`).not.toBeNull();
  return (match?.[1] ?? "").split(",").map((name) => name.trim().replace(/"/gu, ""));
}

const faces = [...fonts.matchAll(/@font-face\s*\{([^}]+)\}/gu)].map((m) => m[1]);
const prop = (face: string, name: string) =>
  face.match(new RegExp(`${name}:\\s*([^;]+);`, "u"))?.[1].trim() ?? "";

describe("metric-matched font fallbacks", () => {
  it.each([
    [fonts, "--ig-font-display", "Inter Display"],
    [fonts, "--ig-font-sans", "Inter"],
    [styles, "--font-display", "Inter Display"],
    [styles, "--font-sans", "Inter"],
  ] as const)("%#: %s lists its fallbacks right after the web font", (css, variable, family) => {
    expect(stack(css, variable).slice(0, 3)).toEqual([family, ...FALLBACKS[family]]);
  });

  it("scales every fallback face and covers Cyrillic and Latin for each weight", () => {
    const fallback = faces.filter((face) => prop(face, "font-family").includes("Fallback"));
    expect(fallback.length).toBe(24);
    const seen = new Set<string>();
    for (const face of fallback) {
      expect(prop(face, "src")).toMatch(/^local\(/u);
      for (const name of ["size-adjust", "ascent-override", "descent-override"]) {
        expect(prop(face, name), name).toMatch(/^\d+(\.\d+)?%$/u);
      }
      expect(prop(face, "line-gap-override")).toBe("0%");
      const range = prop(face, "unicode-range");
      const script = range.includes("U+0400") ? "cyrillic" : "latin";
      seen.add(`${prop(face, "font-family")}|${prop(face, "font-weight")}|${script}`);
    }
    for (const key of seen) {
      const other = key.endsWith("cyrillic")
        ? key.replace(/cyrillic$/u, "latin")
        : key.replace(/latin$/u, "cyrillic");
      expect(seen.has(other), `missing pair for ${key}`).toBe(true);
    }
  });

  it("only covers glyphs Inter has, so the final rendering is unchanged", () => {
    const tokens = (face: string) =>
      prop(face, "unicode-range")
        .split(",")
        .map((t) => t.trim());
    const covered = new Map<string, Set<string>>();
    for (const face of faces.filter((f) => /^"Inter( Display)?"$/u.test(prop(f, "font-family")))) {
      const key = `${prop(face, "font-family").replace(/"/gu, "")}|${prop(face, "font-weight")}`;
      const set = covered.get(key) ?? new Set<string>();
      for (const t of tokens(face)) set.add(t);
      covered.set(key, set);
    }
    for (const face of faces.filter((f) => prop(f, "font-family").includes("Fallback"))) {
      const base = prop(face, "font-family")
        .replace(/"/gu, "")
        .replace(/ Fallback( Android)?$/u, "");
      const web = covered.get(`${base}|${prop(face, "font-weight")}`);
      expect(web, `no Inter face for ${base} ${prop(face, "font-weight")}`).toBeDefined();
      for (const t of tokens(face)) expect(web?.has(t), `${base} lacks ${t}`).toBe(true);
    }
  });

  it("keeps the self-hosted Inter faces on swap", () => {
    const web = faces.filter((face) => /^"Inter( Display)?"$/u.test(prop(face, "font-family")));
    expect(web.length).toBe(24);
    for (const face of web) expect(prop(face, "font-display")).toBe("swap");
  });
});
