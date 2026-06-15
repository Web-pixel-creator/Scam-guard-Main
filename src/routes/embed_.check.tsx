import { createFileRoute } from "@tanstack/react-router";

import { EmbedCheckWidget } from "@/components/EmbedCheckWidget";
import { normalizeEmbedLang, sanitizePartner } from "@/lib/embed-widget";

export const Route = createFileRoute("/embed_/check")({
  validateSearch: (search: Record<string, unknown>) => ({
    lang: normalizeEmbedLang(search.lang),
    partner: sanitizePartner(search.partner),
  }),
  head: () => ({
    meta: [
      { title: "Ishonch Guard Embed Check" },
      {
        name: "description",
        content: "Compact Ishonch Guard anti-scam check widget for trusted partner sites.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: EmbedCheckRoute,
});

function EmbedCheckRoute() {
  const { lang, partner } = Route.useSearch();
  return <EmbedCheckWidget lang={lang} partner={partner} />;
}
