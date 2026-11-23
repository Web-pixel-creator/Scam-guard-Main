import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight as SignalArrowRight,
  CheckCircle as SignalCheckCircle,
  Sparkle as SignalSparkle,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useLang } from "@/lib/lang-context";
import { t, type Lang } from "@/lib/i18n";
import { safeCheckErrorMessage, safeClientErrorReason } from "@/lib/client-error";
import { useServerFn } from "@tanstack/react-start";
import {
  checkInput,
  issueOcrTicket,
  ocrExtract,
  type MetaIntentCheckResult,
} from "@/lib/check.functions";
import type { CheckResult } from "./RiskResultCard";
import { ADVICE, REASON_LABELS } from "@/lib/risk/rules";
import { filterAdvice } from "@/lib/telegram/advice-filter";
import { reportedBankSms } from "@/lib/risk/reported-bank-sms";
import { displayRiskScore } from "@/lib/risk/display-score";
import { createWebOcrLifecycle, type WebOcrSelection } from "@/lib/web-ocr-lifecycle";
import { digestWebOcrImage } from "@/lib/web-ocr-image-digest";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIN_INPUT_CHARS = 3;
const MAX_INPUT_CHARS = 2000;

// Homepage ("signal") copy. The field starts empty: a prefilled sample with a
// ready-made red verdict read as the visitor's own result in user review.
// Examples avoid phone numbers: any +998 sample may belong to a real person.
const SIGNAL_COPY = {
  ru: {
    examplesLabel: "Примеры",
    examples: [
      {
        label: "SMS «из банка»",
        sample:
          "Служба безопасности банка: зафиксирована подозрительная операция. Назовите код из SMS, чтобы отменить перевод.",
      },
      {
        label: "Ссылка на оплату",
        sample: "Посылка не доставлена. Оплатите 27 000 сум, иначе вернём: uzpost-pay.top",
      },
      {
        label: "Приложение «для защиты»",
        sample:
          "Ваша карта под угрозой. Установите защитное приложение банка: bank-zashita.top/app.apk",
      },
    ],
    inputLabel: "Что проверить",
    placeholder: "Вставьте текст сообщения, номер или ссылку…",
    attach: "Скриншот",
    reading: "Читаем…",
    check: "Проверить риск",
    checking: "Проверяем…",
    loadingTitle: "Проверяем признаки обмана",
    loadingOcr: "Читаем скриншот",
    loadingSub: "Ссылки, давление, просьбы о кодах и переводах",
    resultLabel: "Результат проверки",
    safe: "Низкий риск",
    suspicious: "Подозрительно",
    noReasons: "Явных опасных признаков не найдено",
    next: "Что сделать сейчас",
    screenshot: "Скриншот",
    ocrRecognized: "Текст распознан — проверьте его перед анализом.",
    ocrText: "Текст со скриншота",
    removeShot: "Удалить скриншот",
  },
  uz: {
    examplesLabel: "Misollar",
    examples: [
      {
        label: "SMS «bankdan»",
        sample:
          "Bank xavfsizlik xizmati: shubhali amaliyot qayd etildi. O‘tkazmani bekor qilish uchun SMS-kodni ayting.",
      },
      {
        label: "To‘lov havolasi",
        sample:
          "Posilkangiz yetkazilmadi. 27 000 so‘m to‘lang, aks holda qaytariladi: uzpost-pay.top",
      },
      {
        label: "«Himoya» ilovasi",
        sample:
          "Kartangiz xavf ostida. Bankning himoya ilovasini o‘rnating: bank-himoya.top/app.apk",
      },
    ],
    inputLabel: "Nimani tekshirish kerak",
    placeholder: "Xabar matni, raqam yoki havolani joylashtiring…",
    attach: "Skrinshot",
    reading: "O‘qilmoqda…",
    check: "Xavfni tekshirish",
    checking: "Tekshirilmoqda…",
    loadingTitle: "Aldov belgilarini tekshiryapmiz",
    loadingOcr: "Skrinshot o‘qilmoqda",
    loadingSub: "Havolalar, bosim, kod va pul o‘tkazish so‘rovlari",
    resultLabel: "Tekshiruv natijasi",
    safe: "Past xavf",
    suspicious: "Shubhali",
    noReasons: "Aniq xavf belgilari topilmadi",
    next: "Hozir nima qilish kerak",
    screenshot: "Skrinshot",
    ocrRecognized: "Matn aniqlandi — tahlildan oldin uni tekshirib chiqing.",
    ocrText: "Skrinshotdagi matn",
    removeShot: "Skrinshotni o‘chirish",
  },
  en: {
    examplesLabel: "Examples",
    examples: [
      {
        label: "“Bank” SMS",
        sample:
          "Bank security service: a suspicious transaction was detected. Tell us the SMS code to cancel the transfer.",
      },
      {
        label: "Payment link",
        sample:
          "Your parcel was not delivered. Pay 27,000 UZS or it will be returned: uzpost-pay.top",
      },
      {
        label: "“Protection” app",
        sample: "Your card is at risk. Install the bank’s protection app: bank-secure.top/app.apk",
      },
    ],
    inputLabel: "What to check",
    placeholder: "Paste the message text, number or link…",
    attach: "Screenshot",
    reading: "Reading…",
    check: "Check the risk",
    checking: "Checking…",
    loadingTitle: "Checking for scam signs",
    loadingOcr: "Reading the screenshot",
    loadingSub: "Links, pressure, requests for codes and transfers",
    resultLabel: "Check result",
    safe: "Low risk",
    suspicious: "Suspicious",
    noReasons: "No clear danger signals found",
    next: "What to do now",
    screenshot: "Screenshot",
    ocrRecognized: "Text recognised — review it before the check.",
    ocrText: "Text from the screenshot",
    removeShot: "Remove screenshot",
  },
} as const;

function isMetaIntentResult(value: unknown): value is MetaIntentCheckResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "metaIntent" in value &&
    "response" in value &&
    typeof (value as { response?: unknown }).response === "string"
  );
}

function fileToDataUrl(file: File) {
  const reader = new FileReader();
  const promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new DOMException("Image read cancelled", "AbortError"));
    reader.readAsDataURL(file);
  });
  return {
    promise,
    abort() {
      if (reader.readyState === FileReader.LOADING) reader.abort();
    },
  };
}

function validateInput(value: string, hasOcr: boolean, lang: Lang): string | null {
  const v = value.trim();
  if (!v && !hasOcr) return t("check_input_required", lang);
  if (!hasOcr && v.length < MIN_INPUT_CHARS)
    return t("check_input_too_short", lang).replace("{min}", String(MIN_INPUT_CHARS));
  if (v.length > MAX_INPUT_CHARS)
    return t("check_input_too_long", lang).replace("{max}", String(MAX_INPUT_CHARS));
  return null;
}

export function CheckInput({
  defaultValue = "",
  onResult,
}: {
  defaultValue?: string;
  onResult?: (r: CheckResult | null) => void;
}) {
  const { lang } = useLang();
  const [value, setValue] = useState(defaultValue);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageSelection, setImageSelection] = useState<WebOcrSelection | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrPreviewOpen, setOcrPreviewOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [metaResponse, setMetaResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkRevision] = useState(() => ({ value: 0 }));
  const [ocrLifecycle] = useState(() => createWebOcrLifecycle());
  const activeReadRef = useRef<{
    selection: WebOcrSelection;
    read: ReturnType<typeof fileToDataUrl>;
  } | null>(null);
  const checkFn = useServerFn(checkInput);
  const issueOcrTicketFn = useServerFn(issueOcrTicket);
  const ocrFn = useServerFn(ocrExtract);

  useEffect(() => {
    // StrictMode may set up again after cleanup on the same component instance.
    ocrLifecycle.activate();
    return () => {
      checkRevision.value++;
      ocrLifecycle.dispose();
      const pending = activeReadRef.current;
      activeReadRef.current = null;
      pending?.read.abort();
    };
  }, [checkRevision, ocrLifecycle]);

  function abortActiveRead() {
    const pending = activeReadRef.current;
    activeReadRef.current = null;
    pending?.read.abort();
  }

  // A verdict belongs to the submitted draft, never to its replacement.
  function invalidateCheck() {
    checkRevision.value++;
    setLoading(false);
    setResult(null);
    setMetaResponse(null);
    setError(null);
    onResult?.(null);
  }

  const validationMsg = useMemo(
    () => (touched ? validateInput(value, ocrPreviewOpen, lang) : null),
    [value, ocrPreviewOpen, touched, lang],
  );

  async function onPickFile(file: File | undefined) {
    // Cancelling the native chooser is not a new selection or new consent.
    if (!file) return;
    invalidateCheck();
    const selection = ocrLifecycle.startSelection();
    if (!selection) return;
    // Invalidate first: abort may synchronously settle an older FileReader.
    abortActiveRead();
    setError(null);
    setImageDataUrl(null);
    setImageName(null);
    setImageSelection(null);
    setOcrPreviewOpen(false);
    setOcrText("");
    setOcrLoading(false);
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("screenshot_too_large", lang));
      clearImage();
      return;
    }
    try {
      const read = fileToDataUrl(file);
      activeReadRef.current = { selection, read };
      const dataUrl = await read.promise;
      if (!ocrLifecycle.completeRead(selection)) return;
      setImageDataUrl(dataUrl);
      setImageName(file.name);
      setImageSelection(selection);
    } catch (e: unknown) {
      if (!ocrLifecycle.isCurrentSelection(selection)) return;
      console.error("screenshot staging failed", safeClientErrorReason(e));
      setError(t("ocr_failed", lang));
      clearImage();
    } finally {
      if (activeReadRef.current?.selection === selection) activeReadRef.current = null;
    }
  }

  async function requestOcrWithConsent() {
    if (!imageDataUrl || !imageSelection) return;
    // Claim the selection captured by this rendered button, never the latest
    // image through a stale handler. This lock is synchronous before any await.
    const attempt = ocrLifecycle.claimOcr(imageSelection);
    if (!attempt) return;
    setError(null);
    setOcrLoading(true);
    try {
      const imageDigest = await digestWebOcrImage(imageDataUrl);
      if (!ocrLifecycle.isCurrentAttempt(attempt)) return;
      const { ticket } = await issueOcrTicketFn({
        data: { imageDigest, lang, externalProviderConsent: true },
      });
      if (!ocrLifecycle.isCurrentAttempt(attempt)) return;
      // Keep this ticket for the captured selection. Never automatically mint
      // another after an uncertain issuer/OCR response or retry the image.
      const { text } = await ocrFn({
        data: {
          image: imageDataUrl,
          lang,
          externalProviderConsent: true,
          operationTicket: ticket,
        },
      });
      if (!ocrLifecycle.isCurrentAttempt(attempt)) return;
      if (text && text.trim()) {
        setOcrText(text.trim());
        setOcrPreviewOpen(true);
      } else {
        setError(t("ocr_failed", lang));
        clearImage();
      }
    } catch (e: unknown) {
      if (!ocrLifecycle.isCurrentAttempt(attempt)) return;
      console.error("ocr extraction failed", safeClientErrorReason(e));
      const msg = (e as { message?: string })?.message ?? "";
      if (msg.includes("rate_limited") || msg.includes("429")) setError(t("rate_limited", lang));
      else setError(t("ocr_failed", lang));
      clearImage();
    } finally {
      if (ocrLifecycle.finishAttempt(attempt)) setOcrLoading(false);
    }
  }

  function clearImage() {
    ocrLifecycle.clear();
    abortActiveRead();
    setImageDataUrl(null);
    setImageName(null);
    setImageSelection(null);
    setOcrText("");
    setOcrPreviewOpen(false);
    setOcrLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function run() {
    setTouched(true);
    const vmsg = validateInput(value, ocrPreviewOpen, lang);
    if (vmsg) {
      setError(vmsg);
      return;
    }
    if (loading) return;
    const submittedRevision = checkRevision.value;
    setLoading(true);
    setError(null);
    setResult(null);
    setMetaResponse(null);
    onResult?.(null);
    const checkedImageSelection = ocrPreviewOpen ? imageSelection : null;
    try {
      const input = ocrPreviewOpen
        ? value.trim()
          ? value.trim() + "\n\n" + ocrText.trim()
          : ocrText.trim()
        : value.trim().slice(0, MAX_INPUT_CHARS);
      const r = await checkFn({ data: { input, lang } });
      if (checkedImageSelection && !ocrLifecycle.isCurrentSelection(checkedImageSelection)) {
        return;
      }
      if (submittedRevision !== checkRevision.value) return;
      if (isMetaIntentResult(r)) {
        setMetaResponse(r.response);
        onResult?.(null);
        if (checkedImageSelection && ocrLifecycle.isCurrentSelection(checkedImageSelection)) {
          clearImage();
        }
        return;
      }
      const current: CheckResult = {
        ...(r as CheckResult),
        reportedBankSms: reportedBankSms(input),
      };
      setResult(current);
      onResult?.(current);
      if (checkedImageSelection && ocrLifecycle.isCurrentSelection(checkedImageSelection)) {
        clearImage();
      }
    } catch (e: unknown) {
      if (checkedImageSelection && !ocrLifecycle.isCurrentSelection(checkedImageSelection)) {
        return;
      }
      if (submittedRevision !== checkRevision.value) return;
      console.error("check failed", safeClientErrorReason(e));
      setError(safeCheckErrorMessage(e, lang));
    } finally {
      if (submittedRevision === checkRevision.value) setLoading(false);
    }
  }

  const charCount = value.trim().length;

  const copy = SIGNAL_COPY[lang];
  const visualLevel = result?.level ?? "unknown";
  const signalResultClass = {
    safe: "signal-result-safe",
    unknown: "signal-result-neutral",
    suspicious: "signal-result-warn",
    high_risk: "signal-result-danger",
  }[visualLevel];
  const levelLabel = result
    ? {
        safe: copy.safe,
        unknown: t("risk_unknown", lang),
        suspicious: copy.suspicious,
        high_risk: t("risk_high", lang),
      }[result.level]
    : "";
  const mappedReasons = result
    ? result.reasons.slice(0, 2).map((reason) => REASON_LABELS[reason][lang])
    : [];
  const resultReasons = mappedReasons.length > 0 ? mappedReasons : [copy.noReasons];
  const nextAction = result
    ? (filterAdvice(result.level, result.reasons, lang, {
        reportedBankSms: result.reportedBankSms,
      })[0] ?? ADVICE[result.level][lang][0])
    : "";
  const displayScore = result ? displayRiskScore(result.score) : 0;
  const replaceValue = (next: string) => {
    invalidateCheck();
    setValue(next);
  };
  const editOcrText = (next: string) => {
    invalidateCheck();
    setOcrText(next);
  };
  const removeImage = () => {
    invalidateCheck();
    clearImage();
  };

  return (
    <>
      <div className="check-field">
        <label>
          <span className="sr-only">{copy.inputLabel}</span>
          <textarea
            value={value}
            onChange={(event) => replaceValue(event.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void run();
            }}
            placeholder={copy.placeholder}
            rows={5}
            maxLength={MAX_INPUT_CHARS}
            aria-invalid={!!validationMsg}
          />
        </label>
        <div className="check-field-bar">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => void onPickFile(event.target.files?.[0])}
          />
          <button
            className="upload-button"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrLoading}
          >
            <UploadSimple aria-hidden="true" />
            {ocrLoading ? copy.reading : copy.attach}
          </button>
          <span className="field-counter">
            {charCount} / {MAX_INPUT_CHARS}
          </span>
        </div>
      </div>

      <div className="signal-examples" role="group" aria-label={copy.examplesLabel}>
        <span aria-hidden="true">{copy.examplesLabel}:</span>
        {copy.examples.map((example) => (
          <button type="button" key={example.label} onClick={() => replaceValue(example.sample)}>
            {example.label}
          </button>
        ))}
      </div>

      {imageDataUrl && !ocrPreviewOpen && (
        <div className="signal-ocr-preview">
          <div>
            <strong>{imageName || copy.screenshot}</strong>
            <span>{t("screenshot_warning", lang)}</span>
          </div>
          <div className="checker-actions">
            <button
              type="button"
              className="upload-button"
              onClick={clearImage}
              disabled={ocrLoading}
            >
              <X aria-hidden="true" />
              {t("ocr_cancel", lang)}
            </button>
            <button
              type="button"
              className="check-button vp-submit"
              onClick={() => void requestOcrWithConsent()}
              disabled={ocrLoading}
            >
              <span className="vp-pill-dot" aria-hidden="true">
                <SignalArrowRight weight="bold" />
              </span>
              {ocrLoading ? t("ocr_recognizing", lang) : t("ocr_consent_send", lang)}
            </button>
          </div>
        </div>
      )}

      {ocrPreviewOpen && (
        <div className="signal-ocr-preview">
          <div>
            <strong>{imageName || copy.screenshot}</strong>
            <span>{copy.ocrRecognized}</span>
          </div>
          <textarea
            value={ocrText}
            onChange={(event) => editOcrText(event.target.value)}
            rows={3}
            aria-label={copy.ocrText}
          />
          <button type="button" onClick={removeImage}>
            {copy.removeShot}
          </button>
        </div>
      )}

      <button
        className="check-button vp-submit"
        type="button"
        onClick={() => void run()}
        // Stays clickable when empty: run() explains what to paste instead
        // of showing a greyed-out button that looks broken.
        disabled={loading || ocrLoading}
      >
        <span className="vp-pill-dot" aria-hidden="true">
          <SignalArrowRight weight="bold" />
        </span>
        {loading ? copy.checking : copy.check}
      </button>

      <div
        className={`result-panel ${
          loading || ocrLoading
            ? "result-loading"
            : result
              ? `result-result ${signalResultClass}`
              : error
                ? "result-error"
                : "result-idle"
        }`}
        aria-live="polite"
      >
        {loading || ocrLoading ? (
          <div className="loading-state">
            <span className="loading-ring" />
            <div>
              <strong>{ocrLoading ? copy.loadingOcr : copy.loadingTitle}</strong>
              <small>{copy.loadingSub}</small>
            </div>
          </div>
        ) : result ? (
          <>
            <div className="result-summary">
              <span className="risk-icon">
                {visualLevel === "safe" ? (
                  <SignalCheckCircle weight="fill" />
                ) : (
                  <WarningCircle weight="fill" />
                )}
              </span>
              <div>
                <span className="result-label">{copy.resultLabel}</span>
                <strong>{levelLabel}</strong>
              </div>
              <span className="risk-score">{displayScore} / 100</span>
            </div>
            <div className="reason-list">
              {resultReasons.map((reason) => (
                <span key={reason}>{reason}</span>
              ))}
            </div>
            <div className="safe-action">
              <SignalCheckCircle weight="fill" />
              <div>
                <small>{copy.next}</small>
                <strong>{nextAction}</strong>
              </div>
            </div>
          </>
        ) : error ? (
          <div className="idle-state signal-error-state">
            <WarningCircle weight="fill" />
            {error}
          </div>
        ) : metaResponse ? (
          <div className="idle-state">
            <SignalSparkle />
            {metaResponse}
          </div>
        ) : null}
      </div>
    </>
  );
}
