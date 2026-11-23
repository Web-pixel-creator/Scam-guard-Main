import { createFileRoute } from "@tanstack/react-router";

import { EmbedCheckWidget } from "@/components/EmbedCheckWidget";
import { sanitizePartner } from "@/lib/embed-widget";
import { useLang } from "@/lib/lang-context";
import { isLang } from "@/lib/lang-preference";

export const Route = createFileRoute("/embed_/check")({
  // Absent values stay undefined: a null would be written back into the URL
  // (/embed/check?partner=null) through an extra redirect.
  validateSearch: (search: Record<string, unknown>) => ({
    // Without ?lang= the widget follows the visitor's language (D-120).
    lang: isLang(search.lang) ? search.lang : undefined,
    partner: sanitizePartner(search.partner) ?? undefined,
  }),
  component: EmbedCheckRoute,
});

function EmbedCheckRoute() {
  const { lang, partner } = Route.useSearch();
  const visitor = useLang().lang;
  const effectiveLang = lang ?? visitor;
  return (
    <EmbedCheckWidget
      key={JSON.stringify([effectiveLang, partner])}
      lang={effectiveLang}
      partner={partner}
    />
  );
}
