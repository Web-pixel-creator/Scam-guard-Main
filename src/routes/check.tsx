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
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-12 md:py-16">
      <div className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] bg-white/55 p-6 sm:p-10 md:p-14">
        <div className="flex items-start justify-between gap-4 mb-6">
          <span className="apex-mono">SYS · CHECK</span>
          <span className="apex-mono text-right inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3 text-[#F97316]" strokeWidth={2} />
            PRIVATE · HASHED
          </span>
        </div>

        <div className="mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8] max-w-3xl">
          <p className="label-md mb-4">01 — {{ ru: "Проверка", uz: "Tekshirish", en: "Check" }[lang]}</p>
          <h1 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] text-balance">
            {{
              ru: <>Проверка <span className="font-serif-italic text-[#8B8B92]">подозрительного</span></>,
              uz: <>Shubhalini <span className="font-serif-italic text-[#8B8B92]">tekshirish</span></>,
              en: <>Check a <span className="font-serif-italic text-[#8B8B92]">suspicious</span> thing</>,
            }[lang]}
          </h1>
          <p className="mt-6 text-[15px] md:text-[16px] text-[#52525B] leading-[1.65] max-w-xl text-pretty">
            {t("input_placeholder", lang)}
          </p>
        </div>

        <div className="max-w-3xl">
          <div className="cta-glow rounded-[10px]">
            <CheckInput />
          </div>
          <p className="mt-6 apex-mono text-[#71717A]">{t("privacy_promise", lang)}</p>
        </div>
      </div>
    </div>
  );
}
