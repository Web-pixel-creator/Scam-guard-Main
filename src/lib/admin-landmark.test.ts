import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Source guard complements the authenticated browser proof; it does not prove
// accessibility of all rendered states or replace a real screen-reader check.
function landmarks(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(resolve(process.cwd(), path), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const hasMainRole = node.attributes.properties.some(
        (attr) =>
          ts.isJsxAttribute(attr) &&
          attr.name.getText(source) === "role" &&
          attr.initializer &&
          ts.isStringLiteral(attr.initializer) &&
          attr.initializer.text === "main",
      );
      if (tag === "main" || hasMainRole) found.push(tag);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("admin primary landmark ownership", () => {
  it("keeps the main landmark in the shared root", () => {
    expect(landmarks("src/routes/__root.tsx")).toEqual(["main"]);
  });

  it("does not add a nested main in the authenticated admin route", () => {
    expect(landmarks("src/routes/admin.tsx")).toEqual([]);
  });
});
