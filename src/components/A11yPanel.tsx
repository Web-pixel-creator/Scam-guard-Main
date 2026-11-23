import { useEffect, useRef, useState, useCallback } from "react";
import { CaretDown, CaretUp, CircleHalf, PersonArmsSpread, TextAa, X } from "@phosphor-icons/react";
import { OPEN_A11Y_PANEL_EVENT } from "@/lib/a11y-panel-bus";
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
  const launcherRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Focus follows the panel: into it on open, back to whatever opened it on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Esc closes the panel wherever focus is. Focus goes back to the opener only
  // if it was still inside the panel; otherwise the visitor stays where they are.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const active = document.activeElement;
      restoreFocusRef.current =
        active === document.body || !!(active && panelRef.current?.contains(active));
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const openFromMenu = () => {
      returnFocusRef.current = document.querySelector<HTMLElement>(".vp-menu-button");
      setOpen(true);
    };
    window.addEventListener(OPEN_A11Y_PANEL_EVENT, openFromMenu);
    return () => window.removeEventListener(OPEN_A11Y_PANEL_EVENT, openFromMenu);
  }, []);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = true;
      closeRef.current?.focus();
    } else if (wasOpenRef.current && restoreFocusRef.current) {
      const target = returnFocusRef.current;
      // The floating launcher is hidden where the mobile menu replaces it.
      if (target && target.offsetParent !== null) target.focus();
      else launcherRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

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
    title: { ru: "Доступность", uz: "Maxsus imkoniyatlar", en: "Accessibility" }[lang],
    open: {
      ru: "Открыть панель доступности",
      uz: "Maxsus imkoniyatlar panelini ochish",
      en: "Open accessibility panel",
    }[lang],
    close: { ru: "Закрыть", uz: "Yopish", en: "Close" }[lang],
    fontSize: { ru: "Размер шрифта", uz: "Shrift o‘lchami", en: "Text size" }[lang],
    inc: { ru: "Увеличить шрифт", uz: "Shriftni kattalashtirish", en: "Increase text size" }[lang],
    dec: { ru: "Уменьшить шрифт", uz: "Shriftni kichraytirish", en: "Decrease text size" }[lang],
    contrast: { ru: "Высокий контраст", uz: "Yuqori kontrast", en: "High contrast" }[lang],
    reset: { ru: "Сбросить", uz: "Tiklash", en: "Reset" }[lang],
  };

  const idx = SCALES.indexOf(scale);
  const pct = Math.round(scale * 100);

  return (
    <div className="a11y-panel-root vp-a11y" style={{ zoom: 1 / scale }}>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            returnFocusRef.current = launcherRef.current;
            setOpen(true);
          }}
          aria-label={L.open}
          aria-expanded={false}
          className="a11y-launcher vp-a11y-launcher"
        >
          <PersonArmsSpread weight="bold" aria-hidden="true" />
        </button>
      )}
      {open && (
        <div
          ref={panelRef}
          role="region"
          aria-label={L.title}
          className="a11y-panel-card vp-a11y-card"
        >
          <div className="vp-a11y-head">
            <span className="vp-checker-label">{L.title}</span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label={L.close}
              className="vp-a11y-close"
            >
              <X weight="bold" aria-hidden="true" />
            </button>
          </div>

          <div className="vp-a11y-row" role="group" aria-labelledby="a11y-font-size">
            <p className="vp-a11y-label" id="a11y-font-size">
              <TextAa weight="bold" aria-hidden="true" />
              {L.fontSize}
              <b>{pct}%</b>
            </p>
            <div className="vp-a11y-steps">
              {/* The name starts with the visible "A−"/"A+" (WCAG 2.5.3, voice control). */}
              <button type="button" onClick={() => changeScale(-1)} disabled={idx <= 0}>
                <CaretDown weight="bold" aria-hidden="true" />
                <span>A−</span>
                <span className="sr-only"> {L.dec}</span>
              </button>
              <button
                type="button"
                onClick={() => changeScale(1)}
                disabled={idx >= SCALES.length - 1}
              >
                <CaretUp weight="bold" aria-hidden="true" />
                <span className="vp-a11y-big">A+</span>
                <span className="sr-only"> {L.inc}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleContrast}
            aria-pressed={contrast}
            className="vp-a11y-toggle"
          >
            <CircleHalf weight="fill" aria-hidden="true" />
            {L.contrast}
            <b>{contrast ? "ON" : "OFF"}</b>
          </button>

          <button type="button" onClick={reset} className="vp-a11y-reset">
            {L.reset}
          </button>
        </div>
      )}
    </div>
  );
}
