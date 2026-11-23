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
    expect(selection).not.toContain("issueOcrTicketFn(");
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
    expect(cancelAction).not.toContain("issueOcrTicketFn(");
  });

  it("claims selection before digest and issues one ticket before the image transfer", () => {
    const action = sourceSection("async function requestOcrWithConsent", "function clearImage");
    const claim = action.indexOf("ocrLifecycle.claimOcr(imageSelection)");
    const digest = action.indexOf("await digestWebOcrImage(imageDataUrl)");
    const issuer = action.indexOf("await issueOcrTicketFn(");
    const transfer = action.indexOf("await ocrFn(");
    expect(claim).toBeGreaterThanOrEqual(0);
    expect(digest).toBeGreaterThan(claim);
    expect(issuer).toBeGreaterThan(digest);
    expect(transfer).toBeGreaterThan(issuer);
    const staleGuard = "if (!ocrLifecycle.isCurrentAttempt(attempt)) return;";
    expect(action.slice(digest, issuer)).toContain(staleGuard);
    expect(action.slice(issuer, transfer)).toContain(staleGuard);
    expect(action.slice(issuer, transfer)).toContain("imageDigest");
    expect(action.slice(issuer, transfer)).not.toContain("image: imageDataUrl");
    expect(action.slice(transfer)).toContain("operationTicket: ticket");
    expect(action.match(/await issueOcrTicketFn\(/g)).toHaveLength(1);
    expect(action.match(/await ocrFn\(/g)).toHaveLength(1);
    expect(action.slice(action.indexOf("} catch"))).not.toContain("issueOcrTicketFn(");
  });

  it("discloses the raw external transfer instead of claiming pre-transfer masking", () => {
    expect(i18nSource).toContain("исходный скриншот будет один раз отправлен");
    expect(i18nSource).toContain("До отправки мы не можем скрыть данные внутри картинки");
    expect(i18nSource).toContain("original screenshot will be sent once");
    expect(i18nSource).toContain("cannot hide data inside the image before it is sent");
    expect(i18nSource).not.toContain("Перед анализом мы автоматически маскируем");
    expect(i18nSource).not.toContain("Before analysis we automatically mask");
  });

  it("gates OCR-backed check success and failure before every result/error effect", () => {
    const run = sourceSection("async function run()", "const charCount");
    const success = run.slice(run.indexOf("const r = await checkFn("), run.indexOf("} catch"));
    const failure = run.slice(run.indexOf("} catch"), run.indexOf("} finally"));
    const staleGuard =
      /if \(checkedImageSelection && !ocrLifecycle\.isCurrentSelection\(checkedImageSelection\)\)\s*\{\s*return;\s*\}/;
    const successGuard = success.search(staleGuard);
    const failureGuard = failure.search(staleGuard);
    expect(successGuard).toBeGreaterThanOrEqual(0);
    expect(failureGuard).toBeGreaterThanOrEqual(0);
    for (const effect of ["setMetaResponse(", "setResult(", "onResult?.("]) {
      expect(success.indexOf(effect)).toBeGreaterThan(successGuard);
    }
    for (const effect of ["console.error(", "setError("]) {
      expect(failure.indexOf(effect)).toBeGreaterThan(failureGuard);
    }
    // Ordinary typed checks have no image selection, so this guard is scoped
    // to the screenshot generation and is not general check-result routing.
    expect(run).toContain("const checkedImageSelection = ocrPreviewOpen ? imageSelection : null");
  });
});
