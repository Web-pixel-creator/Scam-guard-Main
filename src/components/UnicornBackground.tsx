import { useEffect, useRef } from "react";

declare global {
  interface Window {
    UnicornStudio?: { isInitialized: boolean; init: () => void };
  }
}

export function UnicornBackground({ projectId = "x6cbPWi9roeeiZ8cuBu3" }: { projectId?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function init() {
      if (window.UnicornStudio?.init) {
        try { window.UnicornStudio.init(); } catch { /* noop */ }
        window.UnicornStudio.isInitialized = true;
      }
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
      existing.addEventListener("load", init);
      return () => existing.removeEventListener("load", init);
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
    s.setAttribute("data-unicorn-loader", "true");
    s.onload = init;
    document.head.appendChild(s);
  }, []);

  return (
    <div
      ref={ref}
      data-us-project={projectId}
      data-us-dpi="1.5"
      data-us-fps="60"
      data-us-production="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
