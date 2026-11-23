import { createFileRoute } from "@tanstack/react-router";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { HeroChecker, HeroChips, KindsBand, UrgentPlaque } from "@/components/home/blocks";
import { Rich } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/check")({
  component: CheckPage,
});

const COPY = {
  ru: {
    eyebrow: "Проверка",
    title: ["Сомневаетесь?", "Проверьте до ответа."],
    lead: "Вставьте **номер, ссылку, @username или текст**. Через несколько секунд — **уровень риска**, причины простыми словами и **один безопасный шаг**.",
  },
  uz: {
    eyebrow: "Tekshirish",
    title: ["Shubhalanyapsizmi?", "Javobdan oldin tekshiring."],
    lead: "**Raqam, havola, @username yoki matnni** joylashtiring. Bir necha soniyada — **xavf darajasi**, oddiy so‘zlar bilan sabablar va **bitta xavfsiz qadam**.",
  },
  en: {
    eyebrow: "Check",
    title: ["In doubt?", "Check before you reply."],
    lead: "Paste **a number, link, @username or text**. In seconds you get **the risk level**, the reasons in plain words and **one safe step**.",
  },
} as const;

function CheckPage() {
  const { lang } = useLang();
  const copy = COPY[lang];

  return (
    <div className="vp-home vp-page vp-page--check">
      <section className="vp-hero">
        <span className="vp-shape vp-shape--hero-right" aria-hidden="true" />
        <div className="vp-shell vp-hero-grid">
          <div className="vp-hero-copy">
            <div className="vp-eyebrow">
              <span aria-hidden="true">
                <MagnifyingGlass weight="bold" />
              </span>
              {copy.eyebrow}
            </div>
            <h1 className="vp-hero-title">
              <span>{copy.title[0]}</span>
              <span>{copy.title[1]}</span>
            </h1>
            <p className="vp-hero-lead">
              <Rich text={copy.lead} />
            </p>
            <HeroChips />
            <UrgentPlaque target="/emergency" />
          </div>
          <HeroChecker />
        </div>
        <KindsBand />
      </section>
    </div>
  );
}
