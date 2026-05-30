import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/lang-context";
import { Activity, ShieldCheck, Calendar } from "lucide-react";

type Stats = { total: number; today: number; confirmed_entities: number };

async function fetchStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc("get_check_stats");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total: Number(row?.total ?? 0),
    today: Number(row?.today ?? 0),
    confirmed_entities: Number(row?.confirmed_entities ?? 0),
  };
}

function formatNum(n: number, lang: string) {
  try {
    return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : lang === "uz" ? "uz-UZ" : "en-US").format(n);
  } catch {
    return String(n);
  }
}

export function StatsStrip() {
  const { lang } = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["check-stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const items = [
    {
      key: "today",
      icon: Calendar,
      value: data?.today ?? 0,
      label: { ru: "Проверок сегодня", uz: "Bugungi tekshiruvlar", en: "Checks today" }[lang],
      live: true,
    },
    {
      key: "total",
      icon: Activity,
      value: data?.total ?? 0,
      label: { ru: "Проверок всего", uz: "Jami tekshiruvlar", en: "Total checks" }[lang],
    },
    {
      key: "confirmed",
      icon: ShieldCheck,
      value: data?.confirmed_entities ?? 0,
      label: { ru: "Подтверждённых мошенников", uz: "Tasdiqlangan firibgarlar", en: "Confirmed scammers" }[lang],
    },
  ];

  return (
    <section
      aria-label={{ ru: "Статистика сервиса", uz: "Xizmat statistikasi", en: "Service stats" }[lang]}
      className="relative"
    >
      {/* Header strip */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="label-md text-[#52525B]">
          [ {{ ru: "статистика", uz: "statistika", en: "stats" }[lang]} ]
        </span>
        <span className="inline-flex items-center gap-2 label-md text-[#52525B]">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inset-0 rounded-full bg-[#059669] animate-ping opacity-70" />
            <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-[#059669]" />
          </span>
          {{ ru: "обновляется в реальном времени", uz: "real vaqtda yangilanadi", en: "live" }[lang]}
        </span>
      </div>

      <div className="relative rounded-[8px] border border-[#E2E0D8] bg-white overflow-hidden shadow-[0_1px_0_0_rgba(0,0,0,0.02),0_8px_24px_-12px_rgba(194,65,12,0.12)]">
        {/* Top hairline accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#C2410C] via-[#FB923C] to-[#F97316]" />

        <ul className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E2E0D8]">
          {items.map((it) => (
            <li
              key={it.key}
              className="group relative flex items-center gap-4 px-5 py-5 sm:px-6 sm:py-6 transition-colors hover:bg-[#FFF7ED]/60"
            >
              <span className="grid h-11 w-11 place-items-center rounded-[6px] bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:shadow-[0_6px_14px_-6px_rgba(249,115,22,0.45)]">
                <it.icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p
                    className={`font-display font-extrabold text-[26px] md:text-[30px] tracking-tight text-[#0B0B0F] tabular-nums leading-none ${
                      isLoading ? "animate-pulse text-[#A1A1AA]" : ""
                    }`}
                  >
                    {isLoading ? "—" : formatNum(it.value, lang)}
                  </p>
                  {it.live && !isLoading && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-[#059669] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" />
                      live
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12.5px] text-[#52525B] leading-snug">{it.label}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
