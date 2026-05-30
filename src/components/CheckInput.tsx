import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Send, Loader2, ImagePlus, X, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { checkInput, ocrExtract } from "@/lib/check.functions";
import { RiskResultCard, type CheckResult } from "./RiskResultCard";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MIN_INPUT_CHARS = 3;
const MAX_INPUT_CHARS = 2000;

type Status = "idle" | "loading" | "success" | "error";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function validateInput(value: string, hasOcr: boolean): string | null {
  const v = value.trim();
  if (!v && !hasOcr) return "Введите номер, ссылку, username или текст сообщения.";
  if (!hasOcr && v.length < MIN_INPUT_CHARS) return `Слишком короткий ввод — минимум ${MIN_INPUT_CHARS} символа.`;
  if (v.length > MAX_INPUT_CHARS) return `Слишком длинный текст — максимум ${MAX_INPUT_CHARS} символов.`;
  return null;
}

export function CheckInput({ defaultValue = "" }: { defaultValue?: string }) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const [value, setValue] = useState(defaultValue);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrPreviewOpen, setOcrPreviewOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkFn = useServerFn(checkInput);
  const ocrFn = useServerFn(ocrExtract);

  const validationMsg = useMemo(
    () => (touched ? validateInput(value, ocrPreviewOpen) : null),
    [value, ocrPreviewOpen, touched]
  );

  const status: Status = error
    ? "error"
    : loading || ocrLoading
      ? "loading"
      : result
        ? "success"
        : "idle";

  const statusLabel: Record<Status, string> = {
    idle: "READY",
    loading: ocrLoading ? "OCR · SCAN" : "ANALYZING",
    success: "RISK · READY",
    error: "ERROR",
  };

  async function onPickFile(file: File | undefined) {
    setError(null);
    setOcrPreviewOpen(false);
    setOcrText("");
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("screenshot_too_large", lang));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageName(file.name);
      setOcrLoading(true);
      const { text } = await ocrFn({ data: { image: dataUrl, lang } });
      if (text && text.trim()) {
        setOcrText(text.trim());
        setOcrPreviewOpen(true);
      } else {
        setError(t("ocr_failed", lang));
        clearImage();
      }
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as { message?: string })?.message ?? "";
      if (msg.includes("rate_limited") || msg.includes("429")) setError(t("rate_limited", lang));
      else setError(t("ocr_failed", lang));
      clearImage();
    } finally {
      setOcrLoading(false);
    }
  }

  function clearImage() {
    setImageDataUrl(null);
    setImageName(null);
    setOcrText("");
    setOcrPreviewOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function run() {
    setTouched(true);
    const vmsg = validateInput(value, ocrPreviewOpen);
    if (vmsg) {
      setError(vmsg);
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const input = ocrPreviewOpen
        ? (value.trim() ? value.trim() + "\n\n" + ocrText.trim() : ocrText.trim())
        : value.trim().slice(0, MAX_INPUT_CHARS);
      const r = await checkFn({ data: { input, lang } });
      setResult(r as CheckResult);
      if (ocrPreviewOpen) clearImage();
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as { message?: string })?.message ?? "";
      if (msg.includes("rate_limited") || msg.includes("429")) setError(t("rate_limited", lang));
      else if (msg && !msg.startsWith("[")) setError(msg);
      else setError("Что-то пошло не так. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = (!!value.trim() || ocrPreviewOpen) && !loading && !validationMsg;
  const charCount = value.trim().length;

  return (
    <div className="w-full">
      <div className="apex-frame bg-white rounded-[10px] border border-[#E2E0D8] focus-within:border-[#0B0B0F]/30 focus-within:shadow-[0_0_0_3px_rgba(11,11,15,0.06)] overflow-hidden">
        <span className="apex-scan" aria-hidden />

        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 px-7 pt-5 pb-3 border-b border-[#E2E0D8]/60">
          <span className="apex-mono">INPUT · {lang.toUpperCase()}</span>
          <span className="apex-status" data-state={status} aria-live="polite">
            <span className="apex-status-dot" />
            {statusLabel[status]}
          </span>
        </div>

        {/* Progress bar (loading) */}
        {(loading || ocrLoading) && <div className="apex-progress" />}

        <Textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
          onBlur={() => setTouched(true)}
          placeholder={t("input_placeholder", lang)}
          rows={4}
          aria-invalid={!!validationMsg}
          maxLength={MAX_INPUT_CHARS + 100}
          className="resize-none border-0 bg-transparent shadow-none outline-none focus:outline-none focus:ring-0 focus:shadow-none focus-visible:outline-none focus-visible:ring-0 focus-visible:shadow-none px-7 pt-6 pb-4 text-base md:text-[16px] leading-relaxed text-[#18181B] placeholder:text-[#A1A1AA] min-h-[150px]"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
        />

        {/* Inline validation + char counter */}
        <div className="flex items-center justify-between gap-3 px-7 pb-4 min-h-[20px]">
          <span className="apex-mono text-[#DC2626]" role="alert">
            {validationMsg ? `! ${validationMsg}` : ""}
          </span>
          <span className={`apex-mono ${charCount > MAX_INPUT_CHARS ? "text-[#DC2626]" : ""}`}>
            {charCount} / {MAX_INPUT_CHARS}
          </span>
        </div>

        {ocrPreviewOpen && (
          <div className="mt-1 mx-5 mb-3 rounded-[8px] border border-[#E2E0D8] bg-[#FCFAF9] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#E2E0D8] bg-white">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-[3px] bg-[#F97316]/10">
                  <AlertTriangle className="h-3 w-3 text-[#C2410C]" strokeWidth={2} />
                </span>
                <span className="apex-mono text-[#18181B]">OCR · PREVIEW</span>
              </div>
              <span className="apex-mono text-[#A1A1AA]">{ocrText.trim().length} CHARS</span>
            </div>

            {/* Body */}
            <div className="px-4 pt-3 pb-4">
              <p className="text-[13px] font-medium text-[#18181B] leading-snug">
                {t("ocr_preview_title", lang)}
              </p>
              <p className="text-[12px] text-[#52525B] leading-relaxed mt-1">
                {t("ocr_preview_hint", lang)}
              </p>

              <Textarea
                value={ocrText}
                onChange={(e) => setOcrText(e.target.value)}
                rows={5}
                aria-label={t("ocr_preview_title", lang)}
                className="apex-field resize-y text-[13px] bg-white border-[#E2E0D8] rounded-[6px] mt-3 leading-relaxed font-mono"
              />

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 mt-3">
                <button
                  type="button"
                  onClick={clearImage}
                  className="apex-pill justify-center sm:justify-start"
                >
                  <X className="h-3.5 w-3.5 text-[#52525B]" strokeWidth={2} />
                  {t("ocr_cancel", lang)}
                </button>
                <button
                  type="button"
                  onClick={run}
                  disabled={!ocrText.trim() || loading}
                  className="fancy-btn sm:min-w-[200px]"
                >
                  <span className="fancy-points" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, i) => (<i key={i} className="fancy-point" />))}
                  </span>
                  <span className="fancy-inner">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {t("ocr_check_this", lang)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {imageDataUrl && !ocrPreviewOpen && (
          <div className="mt-1 mx-5 mb-2 flex items-center gap-3 rounded-[6px] border border-[#E2E0D8] bg-[#F4F2EB] p-2.5">
            <img src={imageDataUrl} alt="screenshot" className="h-14 w-14 rounded-[4px] object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-[#18181B]">{imageName}</p>
              {ocrLoading ? (
                <p className="text-xs text-[#A1A1AA] flex items-center gap-1 mt-0.5"><Loader2 className="h-3 w-3 animate-spin" />{t("ocr_recognizing", lang)}</p>
              ) : (
                <p className="text-xs text-[#A1A1AA] flex items-start gap-1 mt-0.5"><Info className="h-3 w-3 mt-0.5 shrink-0" /><span>{t("screenshot_warning", lang)}</span></p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearImage} className="shrink-0 rounded-[4px]" type="button"><X className="h-4 w-4" /></Button>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-5 sm:px-6 py-4 border-t border-[#E2E0D8] bg-[#FCFAF9]/60">
          <div className="flex items-center gap-2.5 flex-wrap">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
            <button onClick={() => fileInputRef.current?.click()} className="apex-pill" type="button" disabled={ocrLoading}>
              <ImagePlus className="h-3.5 w-3.5 text-[#F97316]" strokeWidth={2} />
              {t("attach_screenshot", lang)}
            </button>
            <button onClick={() => navigate({ to: "/report", search: { v: value.trim().slice(0, 200) } as never })} className="apex-pill" type="button">
              <Send className="h-3.5 w-3.5 text-[#FB923C]" strokeWidth={2} />
              {t("report_btn", lang)}
            </button>
          </div>
          <button onClick={run} disabled={!canSubmit || ocrPreviewOpen} className="fancy-btn min-w-[170px]" type="button">
            <span className="fancy-points" aria-hidden="true">
              {Array.from({ length: 10 }).map((_, i) => (<i key={i} className="fancy-point" />))}
            </span>
            <span className="fancy-inner">
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : status === "success"
                  ? <CheckCircle2 className="h-4 w-4" />
                  : <Search className="h-4 w-4" />}
              {loading ? t("checking", lang) : status === "success" ? "Готово" : t("check_now", lang)}
            </span>
          </button>
        </div>


      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-[6px] border border-[#DC2626]/30 bg-[#DC2626]/5 px-3 py-2.5">
          <AlertTriangle className="h-3.5 w-3.5 text-[#DC2626] mt-0.5 shrink-0" />
          <p className="text-[12px] text-[#DC2626] apex-mono leading-relaxed">{error}</p>
        </div>
      )}
      {result && <div className="mt-6"><RiskResultCard result={result} /></div>}
    </div>
  );
}
