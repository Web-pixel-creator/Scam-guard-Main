import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentSource = readFileSync(
  resolve(process.cwd(), "src/components/CheckInput.tsx"),
  "utf8",
);
const i18nSource = readFileSync(resolve(process.cwd(), "src/lib/i18n.ts"), "utf8");

function sourceSection(start: string, end: string): string {
  const startIndex = componentSource.indexOf(start);
  const endIndex = componentSource.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing source marker: ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing source marker: ${end}`).toBeGreaterThan(startIndex);
  return componentSource.slice(startIndex, endIndex);
}

describe("web screenshot external-provider consent boundary", () => {
  it("stages a selected screenshot locally without invoking OCR", () => {
    const selection = sourceSection(
      "async function onPickFile",
      "async function requestOcrWithConsent",
    );

    expect(selection).toContain("fileToDataUrl(file)");
    expect(selection).toContain("setImageDataUrl(dataUrl)");
    expect(selection).not.toContain("ocrFn(");
  });

  it("invokes OCR only from the explicit-consent action and sends the server proof", () => {
    const consentAction = sourceSection(
      "async function requestOcrWithConsent",
      "function clearImage",
    );

    expect(consentAction).toContain("ocrFn(");
    expect(consentAction).toContain("externalProviderConsent: true");
    expect(componentSource).toContain("onClick={() => void requestOcrWithConsent()}");
    expect(componentSource).toContain('t("ocr_consent_send", lang)');
    expect(componentSource).toContain("onClick={clearImage}");
  });

  it("cancels a staged screenshot locally without invoking OCR", () => {
    const cancelAction = sourceSection("function clearImage", "async function run");

    expect(cancelAction).toContain("setImageDataUrl(null)");
    expect(cancelAction).not.toContain("ocrFn(");
  });

  it("discloses the raw external transfer instead of claiming pre-transfer masking", () => {
    expect(i18nSource).toContain("исходный скриншот будет один раз отправлен");
    expect(i18nSource).toContain("До отправки мы не можем скрыть данные внутри картинки");
    expect(i18nSource).toContain("original screenshot will be sent once");
    expect(i18nSource).toContain("cannot hide data inside the image before it is sent");
    expect(i18nSource).not.toContain("Перед анализом мы автоматически маскируем");
    expect(i18nSource).not.toContain("Before analysis we automatically mask");
  });
});
