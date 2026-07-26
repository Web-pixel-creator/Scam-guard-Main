import { useEffect, useRef, useState } from "react";

import { UNICORN_STUDIO_SCRIPT_INTEGRITY, UNICORN_STUDIO_SCRIPT_SRC } from "@/lib/security/csp";

declare global {
  interface Window {
    UnicornStudio?: { isInitialized: boolean; init: () => void };
  }
}

interface Props {
  projectId: string;
  className?: string;
  fallbackStyle?: React.CSSProperties;
}

function shouldDisableAnimation(): boolean {
  if (typeof window === "undefined") return true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return true;
  const cores = navigator.hardwareConcurrency ?? 8;
  const isSmall = window.matchMedia("(max-width: 640px)").matches;
  if (isSmall && cores <= 4) return true;
  return false;
}

export function UnicornBackground({ projectId, className, fallbackStyle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setEnabled(!shouldDisableAnimation());
  }, []);

  useEffect(() => {
    if (!enabled || !hostRef.current) return;
    const el = hostRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);

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
    let s = document.querySelector<HTMLScriptElement>(`script[src="${UNICORN_STUDIO_SCRIPT_SRC}"]`);
    if (!s) {
      s = document.createElement("script");
      s.src = UNICORN_STUDIO_SCRIPT_SRC;
      s.integrity = UNICORN_STUDIO_SCRIPT_INTEGRITY;
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    } else {
      s.addEventListener("load", init);
    }
  }, [enabled, visible]);

  const fallback: React.CSSProperties = fallbackStyle ?? {
    background:
      "radial-gradient(120% 80% at 30% 30%, #ffd1a8 0%, transparent 60%), radial-gradient(120% 80% at 75% 70%, #fdba74 0%, transparent 55%), linear-gradient(135deg, #fde7d3, #fed7aa 60%, #fdba74)",
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
