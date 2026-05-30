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
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{current.label}</span>
          <span className="sm:hidden uppercase">{current.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)}>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
