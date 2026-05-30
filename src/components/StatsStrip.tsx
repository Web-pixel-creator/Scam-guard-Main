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
  const { data } = useQuery({
    queryKey: ["check-stats"],
    queryFn: fetchStats,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const items = [
    {
      icon: Calendar,
      value: data?.today ?? 0,
      label: { ru: "Проверок сегодня", uz: "Bugungi tekshiruvlar", en: "Checks today" }[lang],
    },
    {
      icon: Activity,
      value: data?.total ?? 0,
      label: { ru: "Проверок всего", uz: "Jami tekshiruvlar", en: "Total checks" }[lang],
    },
    {
      icon: ShieldCheck,
      value: data?.confirmed_entities ?? 0,
      label: { ru: "Подтверждённых мошенников", uz: "Tasdiqlangan firibgarlar", en: "Confirmed scammers" }[lang],
    },
  ];

  return (
    <section
      aria-label={{ ru: "Статистика сервиса", uz: "Xizmat statistikasi", en: "Service stats" }[lang]}
      className="grid grid-cols-1 sm:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8] rounded-[6px] overflow-hidden"
    >
      {items.map((it) => (
        <div key={it.label} className="bg-white/85 backdrop-blur-[4px] px-5 py-5 flex items-center gap-4">
          <span className="grid h-10 w-10 place-items-center rounded-[4px] bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] shrink-0">
            <it.icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-display font-extrabold text-[22px] md:text-[26px] tracking-tight text-[#0B0B0F] tabular-nums leading-none">
              {formatNum(it.value, lang)}
            </p>
            <p className="mt-1 text-[12.5px] text-[#52525B] truncate">{it.label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
