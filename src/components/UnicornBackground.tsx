import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    UnicornStudio?: { isInitialized: boolean; init: () => void };
  }
}

interface Props {
  projectId: string;
  className?: string;
  /** Static fallback gradient (CSS) when animation is disabled */
  fallbackStyle?: React.CSSProperties;
}

const SCRIPT_SRC =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";

function shouldDisableAnimation(): boolean {
  if (typeof window === "undefined") return true;
  // Reduced motion preference
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  // Save-Data / low-power hint
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return true;
  // Low-end device: few logical cores + small screen
  const cores = navigator.hardwareConcurrency ?? 8;
  const isSmall = window.matchMedia("(max-width: 640px)").matches;
  if (isSmall && cores <= 4) return true;
  return false;
}

export function UnicornBackground({ projectId, className, fallbackStyle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);

  // Decide once on mount whether to load the engine at all
  useEffect(() => {
    setEnabled(!shouldDisableAnimation());
  }, []);

  // Only load script when the element is on-screen (saves CPU/GPU off-viewport)
  useEffect(() => {
    if (!enabled || !hostRef.current) return;
    const el = hostRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

  // Inject UnicornStudio script lazily, exactly once
  useEffect(() => {
    if (!enabled || !visible) return;
    const init = () => {
      if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
        window.UnicornStudio.init();
        window.UnicornStudio.isInitialized = true;
      }
    };
    if (window.UnicornStudio) {
      init();
      return;
    }
    window.UnicornStudio = { isInitialized: false, init: () => {} };
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    } else {
      s.addEventListener("load", init);
    }
  }, [enabled, visible]);

  const fallback: React.CSSProperties = fallbackStyle ?? {
    background:
      "radial-gradient(120% 80% at 30% 30%, #ffd1a8 0%, transparent 60%), radial-gradient(120% 80% at 75% 70%, #f5a3c7 0%, transparent 55%), linear-gradient(135deg, #fde7d3, #fbd5e6 60%, #e8d4f5)",
  };

  return (
    <div ref={hostRef} className={className} style={!enabled ? fallback : undefined}>
      {enabled && visible && (
        <div
          data-us-project={projectId}
          className="absolute inset-0 w-full h-full"
          style={fallback}
        />
      )}
    </div>
  );
}
