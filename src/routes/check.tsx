import { createFileRoute } from "@tanstack/react-router";
import { CheckInput } from "@/components/CheckInput";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/check")({
  head: () => ({
    meta: [
      { title: "Проверка — Ishonch Guard" },
      { name: "description", content: "Вставьте номер, Telegram, ссылку или текст и получите risk score и понятные шаги." },
      { property: "og:title", content: "Проверка подозрительного — Ishonch Guard" },
    ],
  }),
  component: CheckPage,
});

function CheckPage() {
  const { lang } = useLang();
  return (
    <div className="apex-page" style={{ maxWidth: 1080 }}>
      <div className="apex-card apex-frame apex-stripes">
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono">SYS · CHECK</span>
          <span className="apex-mono text-right inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#F97316]" strokeWidth={2} aria-hidden="true" focusable="false" />
            <span className="hidden xs:inline">PRIVATE · HASHED</span>
            <span className="xs:hidden">PRIVATE</span>
          </span>
        </div>

        <div className="mb-8 sm:mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8] max-w-3xl">
          <p className="label-md mb-3 sm:mb-4">01 — {{ ru: "Проверка", uz: "Tekshirish", en: "Check" }[lang]}</p>
          <h1 className="apex-h1">
            {{
              ru: <>Проверка <span className="font-serif-italic text-[#8B8B92]">подозрительного</span></>,
              uz: <>Shubhalini <span className="font-serif-italic text-[#8B8B92]">tekshirish</span></>,
              en: <>Check a <span className="font-serif-italic text-[#8B8B92]">suspicious</span> thing</>,
            }[lang]}
          </h1>
          <p className="apex-lead mt-5 sm:mt-6">{t("input_placeholder", lang)}</p>
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="cta-glow rounded-[10px]">
            <CheckInput />
          </div>
          <p className="mt-5 sm:mt-6 apex-mono text-[#71717A]">{t("privacy_promise", lang)}</p>
        </div>
      </div>
    </div>
  );
}
