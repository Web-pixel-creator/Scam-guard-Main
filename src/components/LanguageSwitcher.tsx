import { useLang } from "@/lib/lang-context";
import { LANGS } from "@/lib/i18n";
import { Globe } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  const current = LANGS.find((l) => l.code === lang)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-9 rounded-full border border-[#E2E0D8] bg-white/70 backdrop-blur-sm px-3.5 text-[#18181B] hover:bg-white hover:border-[#FDBA74] hover:text-[#C2410C] hover:shadow-[0_4px_14px_-6px_rgba(249,115,22,0.45)] transition-all duration-200"
        >
          <Globe className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
          <span className="hidden sm:inline font-medium">{current.label}</span>
          <span className="sm:hidden uppercase font-medium">{current.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-[#E2E0D8] shadow-[0_20px_50px_-20px_rgba(11,11,15,0.25)] p-1.5 min-w-[160px]">
        {LANGS.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`rounded-lg px-3 py-2 cursor-pointer text-[14px] transition-colors ${
              l.code === lang
                ? "bg-[#FFF7ED] text-[#C2410C] font-medium"
                : "text-[#18181B] focus:bg-[#F4F2EB] focus:text-[#18181B]"
            }`}
          >
            {l.label}
            {l.code === lang && <span className="ml-auto text-[#F97316]">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

