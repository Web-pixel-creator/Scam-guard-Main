import { createFileRoute } from "@tanstack/react-router";
import { CheckInput } from "@/components/CheckInput";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";

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
    <div className="container mx-auto px-4 py-12 md:py-16 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
        {{ ru: "Проверка подозрительного", uz: "Shubhalini tekshirish", en: "Check a suspicious thing" }[lang]}
      </h1>
      <p className="mt-3 text-muted-foreground">
        {t("input_placeholder", lang)}
      </p>
      <div className="mt-8">
        <CheckInput />
      </div>
      <p className="mt-6 text-xs text-muted-foreground">{t("privacy_promise", lang)}</p>
    </div>
  );
}
