import { useEffect } from "react";

declare global {
  interface Window {
    UnicornStudio?: { isInitialized: boolean; init: () => void };
  }
}

interface Props {
  projectId: string;
  className?: string;
}

export function UnicornBackground({ projectId, className }: Props) {
  useEffect(() => {
    const ensure = () => {
      if (window.UnicornStudio?.isInitialized) return;
      if (window.UnicornStudio) {
        window.UnicornStudio.init();
        window.UnicornStudio.isInitialized = true;
        return;
      }
      window.UnicornStudio = { isInitialized: false, init: () => {} };
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
      s.onload = () => {
        if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
          window.UnicornStudio.init();
          window.UnicornStudio.isInitialized = true;
        }
      };
      document.head.appendChild(s);
    };
    ensure();
  }, [projectId]);

  return <div data-us-project={projectId} className={className} />;
}
