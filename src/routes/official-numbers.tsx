import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PhoneCall, ShieldCheck } from "lucide-react";
import { OfficialContactsDirectory } from "@/components/OfficialContactsDirectory";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/official-numbers")({
  head: () => ({
    meta: [
      { title: "Официальные номера банков и служб Узбекистана — Ishonch Guard" },
      {
        name: "description",
        content:
          "Проверенный справочник официальных номеров банков, платёжных систем, операторов и госслужб Узбекистана. Перезванивайте сами, не доверяйте входящему caller ID.",
      },
      { property: "og:title", content: "Официальные номера — Ishonch Guard" },
      {
        property: "og:description",
        content:
          "Найдите официальный номер для безопасного обратного звонка и проверьте подозрительный контакт.",
      },
    ],
    links: [{ rel: "canonical", href: "/official-numbers" }],
  }),
  component: OfficialNumbersPage,
});

function OfficialNumbersPage() {
  const { lang } = useLang();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {
              {
                ru: "официальный callback",
                uz: "rasmiy qayta qo'ng'iroq",
                en: "official callback",
              }[lang]
            }
          </p>
          <h1 className="max-w-3xl font-sans text-[34px] font-medium leading-[1.05] tracking-[-0.045em] text-[#18181B] sm:text-5xl md:text-[58px]">
            {
              {
                ru: "Официальные номера для безопасного обратного звонка",
                uz: "Xavfsiz qayta qo'ng'iroq uchun rasmiy raqamlar",
                en: "Official numbers for safe callbacks",
              }[lang]
            }
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.65] text-[#52525B]">
            {
              {
                ru: "Если вам звонят от имени банка, оператора или службы поддержки, не продолжайте разговор под давлением. Найдите контакт здесь и наберите его вручную.",
                uz: "Bank, operator yoki qo'llab-quvvatlash nomidan qo'ng'iroq qilishsa, bosim ostida suhbatni davom ettirmang. Kontaktni shu yerda toping va qo'lda tering.",
                en: "If someone calls as a bank, telecom or support service, do not stay under pressure. Find the contact here and dial it manually.",
              }[lang]
            }
          </p>
        </div>

        <div className="rounded-[8px] border border-[#E2E0D8] bg-white p-5 shadow-[0_10px_28px_-18px_rgba(11,11,15,0.28)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] bg-[#FFF7ED] text-[#C2410C]">
              <PhoneCall aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <h2 className="text-[16px] font-bold text-[#18181B]">
                {
                  {
                    ru: "Входящий номер может быть подделан",
                    uz: "Kiruvchi raqam soxtalashtirilishi mumkin",
                    en: "Incoming caller ID can be spoofed",
                  }[lang]
                }
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#52525B]">
                {
                  {
                    ru: "Совпадение в справочнике — это не разрешение диктовать код. Безопасно: положить трубку и перезвонить самому.",
                    uz: "Katalogdagi moslik kod aytish mumkin degani emas. Xavfsiz yo'l: go'shakni qo'yib, o'zingiz qayta qo'ng'iroq qilish.",
                    en: "A directory match is not permission to share a code. The safe move is to hang up and call back yourself.",
                  }[lang]
                }
              </p>
              <Link
                to="/check"
                className="mt-4 inline-flex items-center gap-2 text-[13px] font-bold text-[#C2410C] underline decoration-[#FED7AA] underline-offset-4 hover:decoration-[#F97316]"
              >
                {
                  {
                    ru: "Проверить подозрительный номер",
                    uz: "Shubhali raqamni tekshirish",
                    en: "Check a suspicious number",
                  }[lang]
                }
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <OfficialContactsDirectory />
    </main>
  );
}
