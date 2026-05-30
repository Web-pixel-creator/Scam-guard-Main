import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Send, Loader2, ImagePlus, X, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { checkInput, ocrExtract } from "@/lib/check.functions";
import { RiskResultCard, type CheckResult } from "./RiskResultCard";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkFn = useServerFn(checkInput);
  const ocrFn = useServerFn(ocrExtract);

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
    if ((!value.trim() && !ocrPreviewOpen) || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const input = ocrPreviewOpen
        ? (value.trim() ? value.trim() + "\n\n" + ocrText.trim() : ocrText.trim())
        : value.trim().slice(0, 2000);
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

  const canSubmit = (!!value.trim() || ocrPreviewOpen) && !loading;

  return (
    <div className="w-full">
      <div className="bg-card/80 rounded-[20px] border border-border backdrop-blur-xl transition-all focus-within:border-primary/40 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("input_placeholder", lang)}
          rows={4}
          className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-6 pt-6 pb-3 text-base md:text-[17px] text-foreground placeholder:text-foreground/40 min-h-[120px]"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
        />

        {ocrPreviewOpen && (
          <div className="mt-3 mx-3 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("ocr_preview_title", lang)}</p>
                <p className="text-xs text-foreground/60 mt-0.5">{t("ocr_preview_hint", lang)}</p>
              </div>
            </div>
            <Textarea value={ocrText} onChange={(e) => setOcrText(e.target.value)} rows={4} className="resize-none text-sm bg-background/40 border-border" />
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={run} disabled={!ocrText.trim() || loading} className="gap-1.5 rounded-full">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                {t("ocr_check_this", lang)}
              </Button>
              <Button size="sm" variant="ghost" onClick={clearImage} className="gap-1.5 rounded-full" type="button">
                <X className="h-3.5 w-3.5" />
                {t("ocr_cancel", lang)}
              </Button>
            </div>
          </div>
        )}

        {imageDataUrl && !ocrPreviewOpen && (
          <div className="mt-2 mx-3 flex items-center gap-3 rounded-2xl border border-border bg-secondary p-2">
            <img src={imageDataUrl} alt="screenshot" className="h-14 w-14 rounded-xl object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{imageName}</p>
              {ocrLoading ? (
                <p className="text-xs text-foreground/60 flex items-center gap-1 mt-0.5"><Loader2 className="h-3 w-3 animate-spin" />{t("ocr_recognizing", lang)}</p>
              ) : (
                <p className="text-xs text-foreground/60 flex items-start gap-1 mt-0.5"><Info className="h-3 w-3 mt-0.5 shrink-0" /><span>{t("screenshot_warning", lang)}</span></p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={clearImage} className="shrink-0 rounded-full" type="button"><X className="h-4 w-4" /></Button>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-border">
          <div className="flex items-center gap-1">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0])} />
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-[11px] font-bold tracking-[0.15em] uppercase text-foreground/60 hover:text-foreground hover:bg-secondary rounded-full" type="button" disabled={ocrLoading}>
              <ImagePlus className="h-3.5 w-3.5" />{t("attach_screenshot", lang)}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/report", search: { v: value.trim().slice(0, 200) } as never })} className="gap-1.5 text-[11px] font-bold tracking-[0.15em] uppercase text-foreground/60 hover:text-foreground hover:bg-secondary rounded-full" type="button">
              <Send className="h-3.5 w-3.5" />{t("report_btn", lang)}
            </Button>
          </div>
          <Button onClick={run} disabled={!canSubmit || ocrPreviewOpen} className="gap-2 text-[12px] font-bold tracking-wide bg-foreground text-background hover:bg-primary hover:text-white rounded-full px-6 py-3 h-auto transition-all">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {loading ? t("checking", lang) : t("check_now", lang)}
          </Button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {result && <div className="mt-6"><RiskResultCard result={result} /></div>}
    </div>
  );
}
