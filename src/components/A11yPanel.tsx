import { useEffect, useState, useCallback } from "react";
import { Type, Contrast, ChevronUp, ChevronDown, X, Accessibility } from "lucide-react";
import { useLang } from "@/lib/lang-context";

// Keep the in-app scale within the smallest supported mobile layout.
// Larger magnification remains available through the browser/OS zoom.
const SCALES = [1, 1.1, 1.2] as const;
type Scale = (typeof SCALES)[number];

const STORAGE_SCALE = "ig_a11y_font_scale";
const STORAGE_CONTRAST = "ig_a11y_contrast";

function applyScale(scale: Scale) {
  document.documentElement.style.setProperty("--a11y-font-scale", String(scale));
}
function applyContrast(on: boolean) {
  document.documentElement.classList.toggle("a11y-high-contrast", on);
}

export function A11yPanel() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState<Scale>(1);
  const [contrast, setContrast] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const s = parseFloat(localStorage.getItem(STORAGE_SCALE) || "1") as Scale;
      const valid = (SCALES as readonly number[]).includes(s) ? (s as Scale) : 1;
      setScale(valid);
      applyScale(valid);
      const c = localStorage.getItem(STORAGE_CONTRAST) === "1";
      setContrast(c);
      applyContrast(c);
    } catch {
      /* no-op */
    }
  }, []);

  const changeScale = useCallback((delta: 1 | -1) => {
    setScale((prev) => {
      const idx = SCALES.indexOf(prev);
      const next = SCALES[Math.min(SCALES.length - 1, Math.max(0, idx + delta))];
      applyScale(next);
      try {
        localStorage.setItem(STORAGE_SCALE, String(next));
      } catch {
        /* no-op */
      }
      return next;
    });
  }, []);

  const toggleContrast = useCallback(() => {
    setContrast((prev) => {
      const next = !prev;
      applyContrast(next);
      try {
        localStorage.setItem(STORAGE_CONTRAST, next ? "1" : "0");
      } catch {
        /* no-op */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setScale(1);
    applyScale(1);
    setContrast(false);
    applyContrast(false);
    try {
      localStorage.removeItem(STORAGE_SCALE);
      localStorage.removeItem(STORAGE_CONTRAST);
    } catch {
      /* no-op */
    }
  }, []);

  const L = {
    title: { ru: "Доступность", uz: "Imkoniyatlar", en: "Accessibility" }[lang],
    open: {
      ru: "Открыть панель доступности",
      uz: "Imkoniyatlar panelini ochish",
      en: "Open accessibility panel",
    }[lang],
    close: { ru: "Закрыть", uz: "Yopish", en: "Close" }[lang],
    fontSize: { ru: "Размер шрифта", uz: "Shrift o'lchami", en: "Text size" }[lang],
    inc: { ru: "Увеличить шрифт", uz: "Shriftni kattalashtirish", en: "Increase text size" }[lang],
    dec: { ru: "Уменьшить шрифт", uz: "Shriftni kichraytirish", en: "Decrease text size" }[lang],
    contrast: { ru: "Высокий контраст", uz: "Yuqori kontrast", en: "High contrast" }[lang],
    reset: { ru: "Сбросить", uz: "Tiklash", en: "Reset" }[lang],
  };

  const idx = SCALES.indexOf(scale);
  const pct = Math.round(scale * 100);

  return (
    <div
      className="a11y-panel-root fixed z-50 left-3 bottom-3 sm:left-4 sm:bottom-4 print:hidden"
      style={{ zoom: 1 / scale }}
    >
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={L.open}
          aria-expanded={false}
          className="a11y-launcher grid place-items-center h-12 w-12 rounded-full bg-[#0B0B0F] text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.4)] hover:bg-[#C2410C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] transition-colors"
        >
          <Accessibility className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        </button>
      )}
      {open && (
        <div
          role="region"
          aria-label={L.title}
          className="a11y-panel-card w-[280px] rounded-[10px] border border-[#E2E0D8] bg-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <p className="apex-mono text-[#18181B]">{L.title}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={L.close}
              className="grid place-items-center h-8 w-8 rounded-[4px] border border-transparent hover:border-[#E2E0D8] text-[#52525B] hover:text-[#18181B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {/* Font size */}
          <div className="mb-4">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#18181B] mb-2">
              <Type className="h-4 w-4 text-[#C2410C]" strokeWidth={2} aria-hidden="true" />
              {L.fontSize}
              <span className="ml-auto apex-mono tabular-nums">{pct}%</span>
            </label>
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => changeScale(-1)}
                disabled={idx <= 0}
                aria-label={L.dec}
                className="flex-1 inline-flex items-center justify-center gap-1 h-11 rounded-[6px] border border-[#E2E0D8] bg-white text-[#18181B] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#F97316] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                <span className="text-[15px]">A−</span>
              </button>
              <button
                type="button"
                onClick={() => changeScale(1)}
                disabled={idx >= SCALES.length - 1}
                aria-label={L.inc}
                className="flex-1 inline-flex items-center justify-center gap-1 h-11 rounded-[6px] border border-[#E2E0D8] bg-white text-[#18181B] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#F97316] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316]"
              >
                <ChevronUp className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                <span className="text-[19px]">A+</span>
              </button>
            </div>
          </div>

          {/* High contrast */}
          <button
            type="button"
            onClick={toggleContrast}
            aria-pressed={contrast}
            className={`w-full flex items-center gap-2 h-11 px-3 rounded-[6px] border text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] transition-colors ${
              contrast
                ? "bg-[#0B0B0F] text-white border-[#0B0B0F]"
                : "bg-white text-[#18181B] border-[#E2E0D8] hover:border-[#F97316]"
            }`}
          >
            <Contrast className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            {L.contrast}
            <span className="ml-auto apex-mono">{contrast ? "ON" : "OFF"}</span>
          </button>

          <button
            type="button"
            onClick={reset}
            className="mt-3 w-full text-[12px] text-[#52525B] hover:text-[#C2410C] underline underline-offset-4 decoration-[#E2E0D8] hover:decoration-[#F97316]"
          >
            {L.reset}
          </button>
        </div>
      )}
    </div>
  );
}
