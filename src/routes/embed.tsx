import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowSquareOut, Check, Code, Copy } from "@phosphor-icons/react";

import { PageHero, Pill, PillButton } from "@/components/viper/kit";

import { buildEmbedIframeSnippet, buildEmbedWidgetUrl } from "@/lib/embed-widget";
import { useLang } from "@/lib/lang-context";
import type { Lang } from "@/lib/i18n";

export const Route = createFileRoute("/embed")({
  component: EmbedPage,
});

const EMBED_TITLE = {
  ru: ["Проверка Ishonch Guard", "на вашем сайте."],
  uz: ["Ishonch Guard tekshiruvi", "saytingizda."],
  en: ["Ishonch Guard checks", "on your site."],
} as const;

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
    <div className="vp-home vp-page">
      <div className="vp-shell vp-form-layout">
        <PageHero
          icon={<Code weight="bold" />}
          eyebrow={{ ru: "Для партнёров", uz: "Hamkorlar uchun", en: "For partners" }[lang]}
          title={EMBED_TITLE[lang]}
          lead={
            {
              ru: "Компактный iframe помогает читателям **проверить номер, Telegram, ссылку или текст**, не уходя со страницы. Ввод обрабатывается только на стороне Ishonch Guard.",
              uz: "Ixcham iframe o‘quvchilarga sahifani tark etmasdan **raqam, Telegram, havola yoki matnni tekshirishga** yordam beradi. Kiritilgan matn faqat Ishonch Guard tomonida qayta ishlanadi.",
              en: "A compact iframe lets readers **check a number, Telegram, link or text** without leaving the page. Input is processed only by Ishonch Guard.",
            }[lang]
          }
        >
          <ul className="vp-list vp-list--check vp-embed-points">
            {[
              {
                ru: "Без доступа к данным партнёрского сайта",
                uz: "Hamkor sayt ma’lumotlariga kirmaydi",
                en: "No access to partner-site data",
              },
              {
                ru: "Те же ограничения частоты запросов, скрытие личных данных и оценка по правилам",
                uz: "Xuddi shu so‘rovlar cheklovi, shaxsiy ma’lumotlarni yashirish va qoidalarga asoslangan baholash ishlaydi",
                en: "The same request limits, personal-data redaction and rules-based scoring",
              },
              {
                ru: "Подходит для новостных сайтов, банковских FAQ, сайтов махаллей и веб-страниц Telegram-каналов",
                uz: "Yangilik saytlari, bank FAQ, mahalla saytlari va Telegram kanallarining veb-sahifalari uchun mos",
                en: "Fits media sites, bank FAQs, community pages and Telegram-channel web pages",
              },
            ].map((item) => (
              <li key={item.en}>{item[lang]}</li>
            ))}
          </ul>
          <div className="vp-actions">
            <Pill href={previewUrl || "#"} external icon={<ArrowSquareOut weight="bold" />}>
              {{ ru: "Открыть виджет", uz: "Vidjetni ochish", en: "Open widget" }[lang]}
            </Pill>
            <Pill to="/check" tone="outline">
              {{ ru: "Обычная проверка", uz: "Oddiy tekshiruv", en: "Full check page" }[lang]}
            </Pill>
          </div>
        </PageHero>

        <div className="vp-formcard">
          <div className="vp-formcard-head">
            <span className="vp-checker-label">
              {{ ru: "Код вставки", uz: "Joylashtirish kodi", en: "Embed code" }[lang]}
            </span>
            <span>
              {
                {
                  ru: "Скопируйте iframe в HTML-страницу",
                  uz: "Iframe kodini HTML sahifaga qo‘ying",
                  en: "Copy the iframe into an HTML page",
                }[lang]
              }
            </span>
          </div>

          <div className="vp-formcard-body">
            <div className="vp-field-row vp-field-row--embed">
              <div className="vp-field">
                <label htmlFor="embed-partner">
                  {{ ru: "Партнёр", uz: "Hamkor", en: "Partner" }[lang]}
                </label>
                <input
                  id="embed-partner"
                  value={partner}
                  onChange={(event) => setPartner(event.target.value)}
                  className="vp-input"
                />
              </div>
              <div className="vp-field">
                <label htmlFor="embed-lang">
                  {{ ru: "Язык виджета", uz: "Vidjet tili", en: "Widget language" }[lang]}
                </label>
                <select
                  id="embed-lang"
                  value={widgetLang}
                  onChange={(event) => setWidgetLang(event.target.value as Lang)}
                  className="vp-input"
                >
                  <option value="ru">RU</option>
                  <option value="uz">UZ</option>
                  <option value="en">EN</option>
                </select>
              </div>
            </div>

            {/* Scrolls on phones, so it must be reachable from the keyboard. */}
            <pre
              className="vp-code"
              role="region"
              tabIndex={0}
              aria-label={{ ru: "Код вставки", uz: "Joylashtirish kodi", en: "Embed code" }[lang]}
            >
              <code>
                {snippet ||
                  { ru: "Готовим код…", uz: "Kod tayyorlanmoqda…", en: "Preparing the code…" }[
                    lang
                  ]}
              </code>
            </pre>

            <PillButton
              onClick={copySnippet}
              className="vp-formcard-submit"
              icon={copied ? <Check weight="bold" /> : <Copy weight="bold" />}
            >
              {copied
                ? { ru: "Скопировано", uz: "Nusxalandi", en: "Copied" }[lang]
                : { ru: "Скопировать код", uz: "Kodni nusxalash", en: "Copy code" }[lang]}
            </PillButton>

            <div className="vp-embed-preview">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  title={
                    {
                      ru: "Предпросмотр виджета Ishonch Guard",
                      uz: "Ishonch Guard vidjetini oldindan ko‘rish",
                      en: "Ishonch Guard widget preview",
                    }[lang]
                  }
                  width="100%"
                  height="560"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <div aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
