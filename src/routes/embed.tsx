import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Code2, Copy, ExternalLink, ShieldCheck } from "lucide-react";

import { buildEmbedIframeSnippet, buildEmbedWidgetUrl } from "@/lib/embed-widget";
import { useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n";

export const Route = createFileRoute("/embed")({
  head: () => ({
    meta: [
      { title: "Встраиваемый антискам-виджет — Ishonch Guard" },
      {
        name: "description",
        content:
          "Добавьте на сайт компактный виджет Ishonch Guard для проверки номеров, ссылок, Telegram username и подозрительных сообщений.",
      },
      { property: "og:title", content: "Виджет проверки Ishonch Guard" },
      {
        property: "og:description",
        content: "Iframe-виджет для СМИ, банков, махаллинских групп и сообществ.",
      },
    ],
    links: [{ rel: "canonical", href: "/embed" }],
  }),
  component: EmbedPage,
});

function EmbedPage() {
  const { lang } = useLang();
  const [origin, setOrigin] = useState("");
  const [widgetLang, setWidgetLang] = useState<Lang>(lang);
  const [partner, setPartner] = useState("Trusted partner");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    setWidgetLang(lang);
  }, [lang]);

  const snippet = useMemo(
    () => (origin ? buildEmbedIframeSnippet(origin, { lang: widgetLang, partner }) : ""),
    [origin, partner, widgetLang],
  );
  const previewUrl = useMemo(
    () => (origin ? buildEmbedWidgetUrl(origin, { lang: widgetLang, partner }) : ""),
    [origin, partner, widgetLang],
  );

  async function copySnippet() {
    if (!snippet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <p className="apex-mono mb-3 inline-flex items-center gap-2 text-[#C2410C]">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2} />
            {
              {
                ru: "для партнёров",
                uz: "hamkorlar uchun",
                en: "for partners",
              }[lang]
            }
          </p>
          <h1 className="max-w-3xl font-sans text-[34px] font-medium leading-[1.05] tracking-[-0.045em] text-[#18181B] sm:text-5xl md:text-[58px]">
            {
              {
                ru: "Вставьте проверку Ishonch Guard на свой сайт",
                uz: "Ishonch Guard tekshiruvini saytingizga qo'shing",
                en: "Embed Ishonch Guard checks on your site",
              }[lang]
            }
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-[1.65] text-[#52525B]">
            {
              {
                ru: "Компактный iframe помогает читателям проверить номер, Telegram, ссылку или текст, не уходя со страницы. Ввод обрабатывается только на стороне Ishonch Guard.",
                uz: "Ixcham iframe o'quvchilarga sahifani tark etmasdan raqam, Telegram, havola yoki matnni tekshirishga yordam beradi. Kiritilgan matn faqat Ishonch Guard tomonida qayta ishlanadi.",
                en: "A compact iframe lets readers check a number, Telegram, link or text without leaving the page. Input is processed only by Ishonch Guard.",
              }[lang]
            }
          </p>

          <div className="mt-7 grid gap-3">
            {[
              {
                ru: "Без доступа к данным партнёрского сайта",
                uz: "Hamkor sayt ma'lumotlariga kirmaydi",
                en: "No access to partner-site data",
              },
              {
                ru: "Использует тот же rate-limit, redaction и rules-first scoring",
                uz: "Xuddi shu rate-limit, redaction va rules-first scoring ishlaydi",
                en: "Uses the same rate-limit, redaction and rules-first scoring",
              },
              {
                ru: "Подходит для новостников, банковских FAQ, махаллинских сайтов и Telegram-каналов с web page",
                uz: "Yangilik saytlari, bank FAQ, mahalla saytlari va Telegram kanallari web page uchun mos",
                en: "Fits media sites, bank FAQs, community pages and Telegram-channel web pages",
              },
            ].map((item) => (
              <div
                key={item.en}
                className="flex items-start gap-3 rounded-[8px] border border-[#E2E0D8] bg-white p-4"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                <p className="text-[14px] leading-relaxed text-[#3F3F46]">{item[lang]}</p>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a href={previewUrl || "#"} target="_blank" rel="noreferrer" className="fancy-btn">
              <span className="fancy-inner">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {
                  {
                    ru: "Открыть виджет",
                    uz: "Vidjetni ochish",
                    en: "Open widget",
                  }[lang]
                }
              </span>
            </a>
            <Link
              to="/check"
              className="inline-flex min-h-11 items-center gap-2 rounded-[6px] border border-[#E2E0D8] bg-white px-4 text-[13px] font-bold text-[#18181B] hover:border-[#F97316] hover:text-[#C2410C]"
            >
              {
                {
                  ru: "Обычная проверка",
                  uz: "Oddiy tekshiruv",
                  en: "Full check page",
                }[lang]
              }
            </Link>
          </div>
        </div>

        <div className="rounded-[8px] border border-[#E2E0D8] bg-white p-4 shadow-[0_10px_28px_-20px_rgba(11,11,15,0.28)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="apex-mono text-[#C2410C]">
                {
                  {
                    ru: "Код вставки",
                    uz: "Joylashtirish kodi",
                    en: "Embed code",
                  }[lang]
                }
              </p>
              <p className="mt-1 text-[13px] text-[#71717A]">
                {
                  {
                    ru: "Скопируйте iframe и вставьте в HTML-страницу.",
                    uz: "Iframe kodini HTML sahifaga qo'ying.",
                    en: "Copy the iframe into an HTML page.",
                  }[lang]
                }
              </p>
            </div>
            <Code2 className="h-5 w-5 text-[#C2410C]" aria-hidden="true" />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.12em] text-[#71717A]">
                Partner
              </span>
              <input
                value={partner}
                onChange={(event) => setPartner(event.target.value)}
                className="h-10 w-full rounded-[6px] border border-[#E2E0D8] bg-white px-3 text-[14px] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.12em] text-[#71717A]">
                Lang
              </span>
              <select
                value={widgetLang}
                onChange={(event) => setWidgetLang(event.target.value as Lang)}
                className="h-10 rounded-[6px] border border-[#E2E0D8] bg-white px-3 text-[14px] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/15"
              >
                <option value="ru">RU</option>
                <option value="uz">UZ</option>
                <option value="en">EN</option>
              </select>
            </label>
          </div>

          <pre className="mt-4 max-h-[260px] overflow-auto rounded-[8px] border border-[#E2E0D8] bg-[#0B0B0F] p-4 text-[12px] leading-relaxed text-[#FCFAF9]">
            <code>{snippet || "Loading widget origin..."}</code>
          </pre>

          <button
            type="button"
            onClick={copySnippet}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#0B0B0F] px-4 text-[13px] font-bold text-white hover:bg-[#18181B]"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied
              ? {
                  ru: "Скопировано",
                  uz: "Nusxalandi",
                  en: "Copied",
                }[lang]
              : {
                  ru: "Скопировать код",
                  uz: "Kodni nusxalash",
                  en: "Copy code",
                }[lang]}
          </button>

          <div className="mt-5 overflow-hidden rounded-[8px] border border-[#E2E0D8]">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Ishonch Guard widget preview"
                width="100%"
                height="560"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                className="block w-full border-0"
              />
            ) : (
              <div className="h-[560px] bg-[#FCFAF9]" aria-hidden="true" />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
