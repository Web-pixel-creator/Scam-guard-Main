import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, BadgeInfo, CircleDollarSign, ShieldCheck } from "lucide-react";
import { getPublicStats, type PublicStats } from "@/lib/check.functions";
import { useLang } from "@/lib/lang-context";
import { formatImpactNumber, formatUzsCompact } from "@/lib/trust/impact-stats";

export function HomeImpactCounters() {
  const { lang } = useLang();
  const statsFn = useServerFn(getPublicStats);
  const { data, isLoading } = useQuery({
    queryKey: ["check-stats"],
    queryFn: () => statsFn({ data: undefined as never }) as Promise<PublicStats>,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const stats = data ?? {
    total: 0,
    today: 0,
    confirmed_entities: 0,
    high_risk: 0,
    suspicious: 0,
    dangerous: 0,
    reports_total: 0,
    reports_with_loss_amount: 0,
    reported_loss_uzs: 0,
  };

  // Don't show an all-zero "dead service" block. Keep the loading skeleton, but
  // once data has loaded, render only when there is something real to show.
  const hasMeaningfulData =
    stats.total > 0 ||
    stats.dangerous > 0 ||
    stats.confirmed_entities > 0 ||
    stats.reported_loss_uzs > 0;
  if (!isLoading && !hasMeaningfulData) return null;

  const lossValue =
    stats.reported_loss_uzs > 0
      ? `${formatUzsCompact(stats.reported_loss_uzs, lang)} UZS`
      : formatUzsCompact(0, lang);

  const cards = [
    {
      key: "checks",
      icon: Activity,
      value: formatImpactNumber(stats.total, lang),
      label: {
        ru: "проверок всего",
        uz: "jami tekshiruv",
        en: "total checks",
      }[lang],
      detail: {
        ru: `${formatImpactNumber(stats.today, lang)} сегодня`,
        uz: `${formatImpactNumber(stats.today, lang)} bugun`,
        en: `${formatImpactNumber(stats.today, lang)} today`,
      }[lang],
    },
    {
      key: "dangerous",
      icon: AlertTriangle,
      value: formatImpactNumber(stats.dangerous, lang),
      label: {
        ru: "предупреждений о риске",
        uz: "xavf ogohlantirishi",
        en: "risk alerts",
      }[lang],
      detail: {
        ru: `${formatImpactNumber(stats.high_risk, lang)} высокого риска`,
        uz: `${formatImpactNumber(stats.high_risk, lang)} yuqori xavf`,
        en: `${formatImpactNumber(stats.high_risk, lang)} high-risk`,
      }[lang],
    },
    {
      key: "loss",
      icon: CircleDollarSign,
      value: lossValue,
      label: {
        ru: "подтверждённых потерь",
        uz: "tasdiqlangan zarar",
        en: "confirmed losses",
      }[lang],
      detail:
        stats.reports_with_loss_amount > 0
          ? {
              ru: `${formatImpactNumber(stats.reports_with_loss_amount, lang)} подтверждённых жалоб с суммой`,
              uz: `${formatImpactNumber(stats.reports_with_loss_amount, lang)} ta tasdiqlangan summa bilan`,
              en: `${formatImpactNumber(stats.reports_with_loss_amount, lang)} confirmed reports with amount`,
            }[lang]
          : {
              ru: "покажем после первых данных",
              uz: "ma'lumot bo'lsa ko'rsatamiz",
              en: "shown after first data",
            }[lang],
    },
    {
      key: "moderated",
      icon: ShieldCheck,
      value: formatImpactNumber(stats.confirmed_entities, lang),
      label: {
        ru: "проверенных вручную записей",
        uz: "qo'lda tekshirilgan yozuvlar",
        en: "manually reviewed records",
      }[lang],
      detail: {
        ru: "только после проверки",
        uz: "faqat tekshiruvdan keyin",
        en: "only after review",
      }[lang],
    },
  ];

  return (
    <section
      aria-labelledby="impact-counters-title"
      className="rounded-[8px] border border-[#E2E0D8] bg-[#FAFAF8] p-5 sm:p-7 md:p-8"
    >
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
            <BadgeInfo aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {{ ru: "честная польза", uz: "halol ta'sir", en: "honest impact" }[lang]}
          </p>
          <h2
            id="impact-counters-title"
            className="font-sans text-[26px] font-medium leading-[1.08] tracking-[-0.04em] text-[#18181B] sm:text-3xl md:text-[36px]"
          >
            {
              {
                ru: "Показываем цифры без громких обещаний",
                uz: "Raqamlarni oshirmasdan ko'rsatamiz",
                en: "Numbers without inflated claims",
              }[lang]
            }
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-[1.65] text-[#52525B]">
            {
              {
                ru: "Это только общие цифры: проверки и предупреждения о риске показывают raw activity сервиса, а сумма потерь считается только по подтверждённым модератором жалобам.",
                uz: "Bu faqat umumiy raqamlar: tekshiruvlar va xavf ogohlantirishlari servisning raw activity ko'rsatkichlari, zarar summasi esa faqat moderator tasdiqlagan shikoyatlardan hisoblanadi.",
                en: "These are general totals only: checks and risk alerts are raw service activity, while loss totals use only moderator-confirmed reports.",
              }[lang]
            }
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <div key={card.key} className="rounded-[8px] border border-[#E2E0D8] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-[#FED7AA] bg-[#FFF7ED] text-[#C2410C]">
                  <card.icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p
                    className={`font-display text-[26px] font-extrabold leading-none tracking-tight text-[#0B0B0F] tabular-nums ${
                      isLoading ? "animate-pulse text-[#A1A1AA]" : ""
                    }`}
                  >
                    {isLoading ? "-" : card.value}
                  </p>
                  <p className="mt-1.5 text-[13px] font-bold leading-snug text-[#18181B]">
                    {card.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-snug text-[#71717A]">{card.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 border-t border-[#E2E0D8] pt-4 text-[13px] leading-relaxed text-[#71717A]">
        {
          {
            ru: "Мы не публикуем список номеров, аккаунтов или людей в этих счётчиках. Сумма потерь берётся только из подтверждённых жалоб; это не гарантия возврата и не точная оценка предотвращённых потерь.",
            uz: "Bu hisoblagichlarda raqamlar, akkauntlar yoki odamlar ro'yxati ko'rsatilmaydi. Zarar summasi faqat tasdiqlangan shikoyatlardan olinadi; bu qaytarish kafolati yoki aniq oldini olingan zarar emas.",
            en: "These counters do not publish numbers, accounts or people. Loss totals come only from confirmed reports; they are not a recovery guarantee or an exact prevented-loss estimate.",
          }[lang]
        }
      </p>
    </section>
  );
}
