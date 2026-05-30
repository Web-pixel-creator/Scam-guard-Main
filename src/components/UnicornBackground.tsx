import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    UnicornStudio?: { isInitialized: boolean; init: () => void };
  }
}

/**
 * Lightweight wrapper around Unicorn Studio.
 * Optimizations:
 *  - Lazy: only mounts the canvas when scrolled into view (IntersectionObserver).
 *  - Pauses by unmounting when offscreen.
 *  - Respects `prefers-reduced-motion` (renders a static gradient instead).
 *  - Downscales DPI/FPS on low-end / small-memory / mobile devices.
 *  - Shares a single script load across instances.
 */
export function UnicornBackground({ projectId = "x6cbPWi9roeeiZ8cuBu3" }: { projectId?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [perf, setPerf] = useState<{ dpi: string; fps: string }>({ dpi: "1", fps: "60" });

  // Detect device capability once
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);

    // @ts-expect-error - non-standard
    const mem: number | undefined = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency || 4;
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const lowEnd = (mem !== undefined && mem <= 4) || cores <= 4 || isMobile;
    setPerf(lowEnd ? { dpi: "1", fps: "30" } : { dpi: "1.25", fps: "45" });

    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // IntersectionObserver — only render when on screen
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.01, rootMargin: "100px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Load script + init when visible
  useEffect(() => {
    if (!visible || reducedMotion) return;
    function init() {
      try { window.UnicornStudio?.init(); } catch { /* noop */ }
      if (window.UnicornStudio) window.UnicornStudio.isInitialized = true;
    }
    if (window.UnicornStudio?.init) {
      init();
      return;
    }
    if (!window.UnicornStudio) {
      window.UnicornStudio = { isInitialized: false, init: () => {} };
    }
    const existing = document.querySelector<HTMLScriptElement>("script[data-unicorn-loader]");
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
    s.async = true;
    s.setAttribute("data-unicorn-loader", "true");
    s.onload = init;
    document.head.appendChild(s);
  }, [visible, reducedMotion]);

  return (
    <div ref={wrapRef} className="absolute inset-0 w-full h-full pointer-events-none">
      {reducedMotion ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, #4F46E5 0%, #1E1B4B 45%, #08080B 100%)",
          }}
          aria-hidden
        />
      ) : visible ? (
        <div
          key={`${perf.dpi}-${perf.fps}`}
          data-us-project={projectId}
          data-us-dpi={perf.dpi}
          data-us-fps={perf.fps}
          data-us-production="true"
          data-us-disablemobile="false"
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        // Static placeholder while not in view
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, #4F46E5 0%, #1E1B4B 50%, #08080B 100%)",
          }}
          aria-hidden
        />
      )}
    </div>
  );
}
