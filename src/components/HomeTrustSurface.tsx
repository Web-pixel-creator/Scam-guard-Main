import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, PhoneCall, ShieldCheck } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { getOfficialDirectoryStats } from "@/lib/trust/official-directory";

export function HomeTrustSurface() {
  const { lang } = useLang();
  const stats = getOfficialDirectoryStats();

  return (
    <section
      aria-labelledby="trust-surface-title"
      className="approved-official relative overflow-hidden rounded-[8px] border border-[#D9E8DA] bg-[#F0FDF4] p-5 sm:p-7 md:p-8"
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-[#16A34A]" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#166534]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {
              { ru: "доверенный справочник", uz: "ishonchli katalog", en: "trusted directory" }[
                lang
              ]
            }
          </p>
          <h2
            id="trust-surface-title"
            className="font-sans text-[26px] font-medium leading-[1.08] tracking-[-0.04em] text-[#18181B] sm:text-3xl md:text-[36px]"
          >
            {
              {
                ru: "Перезванивайте только по официальным номерам",
                uz: "Faqat rasmiy raqamlarga qayta qo'ng'iroq qiling",
                en: "Call back only through official numbers",
              }[lang]
            }
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#3F3F46]">
            {
              {
                ru: "Мы собрали проверенные контакты банков, платёжных систем, операторов и госслужб. Если входящий звонок давит на вас, положите трубку и наберите номер сами.",
                uz: "Banklar, to'lov tizimlari, operatorlar va davlat xizmatlarining tekshirilgan kontaktlarini jamladik. Kiruvchi qo'ng'iroq bosim qilsa, go'shakni qo'ying va raqamni o'zingiz tering.",
                en: "We collect verified contacts for banks, payment systems, telecoms and government services. If an incoming call pressures you, hang up and dial yourself.",
              }[lang]
            }
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/official-numbers"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-[#0B0B0F] px-4 text-[14px] font-bold text-white transition-colors hover:bg-[#27272A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
            >
              <PhoneCall aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              {{ ru: "Открыть справочник", uz: "Katalogni ochish", en: "Open directory" }[lang]}
              <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              to="/check"
              className="inline-flex h-11 items-center justify-center rounded-[6px] border border-[#B7D7BE] bg-white px-4 text-[14px] font-bold text-[#166534] transition-colors hover:border-[#16A34A] hover:bg-[#F7FFF8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
            >
              {{ ru: "Проверить номер", uz: "Raqamni tekshirish", en: "Check a number" }[lang]}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              value: stats.total,
              label: {
                ru: "проверенных контактов",
                uz: "tekshirilgan kontakt",
                en: "verified contacts",
              }[lang],
            },
            {
              value: stats.callable,
              label: { ru: "номеров для звонка", uz: "qo'ng'iroq raqami", en: "callback numbers" }[
                lang
              ],
            },
            {
              value: stats.bank + stats.payment_system,
              label: {
                ru: "банковских и платёжных линий",
                uz: "bank/to'lov liniyalari",
                en: "bank/payment lines",
              }[lang],
            },
          ].map((item) => (
            <div key={item.label} className="rounded-[6px] border border-[#B7D7BE] bg-white p-4">
              <p className="font-display text-[30px] font-extrabold leading-none tracking-tight text-[#0B0B0F] tabular-nums">
                {item.value}
              </p>
              <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-[#52525B]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-5 flex items-start gap-2 border-t border-[#B7D7BE] pt-4 text-[13px] leading-relaxed text-[#166534]">
        <BadgeCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        {
          {
            ru: "Важно: совпадение с официальным номером не отменяет правило безопасности — банк не просит SMS-код, PIN, CVV, пароль или установку приложений.",
            uz: "Muhim: rasmiy raqam bilan moslik xavfsizlik qoidasini bekor qilmaydi — bank SMS-kod, PIN, CVV, parol yoki ilova o'rnatishni so'ramaydi.",
            en: "Important: a match with an official number does not override safety rules — banks do not ask for SMS codes, PIN, CVV, passwords or app installs.",
          }[lang]
        }
      </p>
    </section>
  );
}
