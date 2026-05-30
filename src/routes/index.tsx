import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Phone, MessageSquare, Link2, FileWarning, ArrowRight, Sparkles, Users, ShieldAlert, ShieldCheck, AlertTriangle, MapPin, ArrowDown } from "lucide-react";
import { CheckInput } from "@/components/CheckInput";
import { RiskResultCard, type CheckResult } from "@/components/RiskResultCard";
import { FancyShell } from "@/components/FancyButton";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { UnicornBackground } from "@/components/UnicornBackground";




export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ishonch Guard — проверьте номер, Telegram или ссылку до того, как вас обманут" },
      { name: "description", content: "Бесплатный антискам-помощник для Узбекистана. Вставьте подозрительное сообщение, номер, ссылку или Telegram username — получите оценку риска и шаги, что делать." },
      { property: "og:title", content: "Ishonch Guard — антискам-помощник для Узбекистана" },
      { property: "og:description", content: "Распознайте мошенников до того, как потеряете деньги." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Ishonch Guard",
              url: "/",
              description:
                "Бесплатный антискам-помощник для Узбекистана: проверка номеров, ссылок, Telegram-аккаунтов и сообщений.",
              areaServed: "UZ",
            },
            {
              "@type": "WebSite",
              name: "Ishonch Guard",
              url: "/",
              inLanguage: ["ru", "uz", "en"],
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "Мне звонят из «службы безопасности банка» — это правда?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Настоящий банк никогда не просит SMS-код, пароль или установку приложений по ссылке. Положите трубку и перезвоните по номеру с обратной стороны карты.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Я уже отправил код из SMS — что делать?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Срочно позвоните в банк и попросите блокировку карты и онлайн-банка. Затем смените пароль в приложении банка и проверьте недавние операции.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Перевёл деньги «на безопасный счёт» — можно вернуть?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Немедленно — звонок в банк с просьбой о возврате/споре операции, и заявление в Cyber Police (102). Шанс есть только в первые часы.",
                  },
                },
                {
                  "@type": "Question",
                  name: "В Telegram пишет «менеджер банка» — отвечать?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Банки не ведут клиентскую поддержку в личных Telegram-сообщениях. Не отвечайте, пришлите username нам — проверим за секунды.",
                  },
                },
              ],
            },
          ],
        }),
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { lang } = useLang();
  const router = useRouter();
  const [homeResult, setHomeResult] = useState<CheckResult | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [formVisible, setFormVisible] = useState(true);

  // Re-clicking the brand/Home link while already on "/" does not unmount
  // this component — subscribe to router resolves and reset the result so the
  // hero re-appears as the user expects.
  useEffect(() => {
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      if (toLocation.pathname === "/") setHomeResult(null);
    });
    return () => unsub();
  }, [router]);

  // Hide mobile sticky CTA when the form is on screen
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setFormVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="overflow-hidden home-stripes-bg">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 space-y-14 md:space-y-20 lg:space-y-24 pt-3 md:pt-4">


        {/* HERO v2 — minimal centered editorial with vertical gradient rule */}
        <section className="relative isolate pt-1 md:pt-2">
          <div
            className={`relative max-w-5xl mx-auto overflow-hidden transition-[max-height,opacity,margin,padding] duration-700 ease-out ${
              homeResult
                ? "max-h-0 opacity-0 pt-0 pb-0 -mt-2 pointer-events-none"
                : "max-h-[900px] opacity-100 pt-4 md:pt-6 pb-10 md:pb-12"
            }`}
            aria-hidden={homeResult ? true : undefined}
          >
            {/* Subtle dot-grid backdrop behind the title */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-8 h-[280px] md:h-[340px] opacity-[0.3] [mask-image:radial-gradient(55%_55%_at_50%_40%,#000_0%,transparent_75%)]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(11,11,15,0.18) 1px, transparent 0)",
                backgroundSize: "22px 22px",
              }}
            />


            <div className="relative text-center px-0">
              {/* Compact pain badge — single visual signal, no separate quote block */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#FCA5A5]/60 bg-[#FEF2F2] text-[12px] font-semibold tracking-[0.16em] uppercase text-[#991B1B] mb-5 animate-fade-in-up font-mono">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                </span>
                {{ ru: "Звонят мошенники? Проверьте за 3 секунды", uz: "Firibgar qo'ng'iroq qilyaptimi? 3 soniyada tekshiring", en: "Scam call? Check it in 3 seconds" }[lang]}
              </div>

              <h1 className="font-display font-extrabold tracking-[-0.025em] leading-[1.05] text-[36px] sm:text-5xl md:text-6xl lg:text-[68px] animate-fade-in-up text-foreground max-w-3xl mx-auto text-center">
                {{
                  ru: <>Проверьте до того,<br /><span className="relative inline-block text-foreground/55">как обманут.<span aria-hidden className="absolute left-0 right-0 -bottom-1 md:-bottom-1.5 h-[2px] bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent rounded-full" /></span></>,
                  uz: <>Aldanmasdan oldin<br /><span className="relative inline-block text-foreground/55">tekshiring.<span aria-hidden className="absolute left-0 right-0 -bottom-1 md:-bottom-1.5 h-[2px] bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent rounded-full" /></span></>,
                  en: <>Check it before<br /><span className="relative inline-block text-foreground/55">you get scammed.<span aria-hidden className="absolute left-0 right-0 -bottom-1 md:-bottom-1.5 h-[2px] bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent rounded-full" /></span></>,
                }[lang]}
              </h1>

              {/* One-line subtitle — unified orange brand accent */}
              <p className="mt-5 md:mt-6 text-[16px] md:text-[18px] text-[#3F3F46] max-w-xl mx-auto leading-[1.5] text-center animate-fade-in-up">
                {{
                  ru: <>Номер, ссылка или сообщение — <span className="text-[#C2410C] font-semibold whitespace-nowrap">бесплатно, без регистрации</span></>,
                  uz: <>Raqam, havola yoki xabar — <span className="text-[#C2410C] font-semibold whitespace-nowrap">bepul, ro'yxatdan o'tmasdan</span></>,
                  en: <>Number, link or message — <span className="text-[#C2410C] font-semibold whitespace-nowrap">free, no signup</span></>,
                }[lang]}
              </p>

              {/* One-action CTA — scrolls straight to the form */}
              <div className="mt-7 md:mt-8 flex justify-center animate-fade-in-up">
                <button type="button" onClick={scrollToForm} className="fancy-btn min-w-[240px]">
                  <FancyShell showArrow={false}>
                    {{ ru: "Проверить сейчас", uz: "Hozir tekshirish", en: "Check now" }[lang]}
                    <ArrowDown className="h-4 w-4" strokeWidth={2} />
                  </FancyShell>
                </button>
              </div>
            </div>
          </div>

          {/* Bloom band with animated Unicorn background that stretches with content */}
          <div
            id="check-form"
            ref={formRef}
            className={`scroll-mt-24 w-full max-w-[1200px] mx-auto mb-6 animate-fade-in-up transition-[margin] duration-700 ease-out ${homeResult ? "mt-2" : "mt-5 md:mt-6"}`}
          >
            <div className="relative isolate rounded-[28px] overflow-hidden min-h-[380px] md:min-h-[440px] bg-[#fde7d3]">
              <UnicornBackground
                projectId="pSxbKYCCk7vGhrLFRLrG"
                className="absolute inset-0 w-full h-full z-0 pointer-events-none"
              />
              <div
                aria-hidden
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
                }}
              />
              <div className="relative z-20 flex items-center justify-center px-4 md:px-10 py-8 md:py-12 min-h-[380px] md:min-h-[440px]">
                <div className="w-full max-w-3xl cta-glow rounded-[8px]">
                  <CheckInput hideInlineResult onResult={setHomeResult} />
                </div>
              </div>
            </div>

            {homeResult && (
              <div className="mt-6 w-full max-w-3xl mx-auto animate-fade-in-up">
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setHomeResult(null)}
                    className="apex-pill"
                  >
                    {{ ru: "Сбросить", uz: "Tozalash", en: "Reset" }[lang]}
                  </button>
                </div>
                <RiskResultCard result={homeResult} />
              </div>
            )}

          </div>


        </section>




        {/* MARQUEE — APEX: stripes texture + edge fade mask */}
        <section
          className="relative -mx-4 sm:-mx-6 overflow-hidden border-y border-[#E2E0D8] py-4 md:py-5 bg-white/55 backdrop-blur-[4px] apex-stripes"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0, #000 clamp(28px,8vw,80px), #000 calc(100% - clamp(28px,8vw,80px)), transparent 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0, #000 clamp(28px,8vw,80px), #000 calc(100% - clamp(28px,8vw,80px)), transparent 100%)",
          }}
        >

          <div className="flex gap-12 whitespace-nowrap animate-marquee">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex gap-12 shrink-0">
                {({
                  ru: ["Безопасный счёт", "Звонок «из банка»", "Поддельное приложение", "Просят код из СМС", "Кредит в Telegram", "Фейковый курьер", "«Вы выиграли приз»", "Удвоение крипты", "Фейковая вакансия", "Знакомство с обманом"],
                  uz: ["«Xavfsiz hisob»", "«Bankdan qo'ng'iroq»", "Soxta ilova", "SMS kodini so'rashmoqda", "Telegram'da kredit", "Soxta kuryer", "«Sovrin yutdingiz»", "Kriptoni ikki barobar", "Soxta ish o'rni", "Tanishuv firibgarligi"],
                  en: ["«Safe account»", "Fake bank call", "Fake banking app", "Asking for SMS code", "Loan in Telegram", "Fake courier", "«You won a prize»", "Crypto doubler", "Fake job offer", "Romance scam"],
                }[lang]).map((w, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-12 text-xl md:text-2xl font-sans font-medium tracking-tight text-[#71717A]">
                    {w}
                    <span className="text-[#F97316] text-2xl md:text-3xl">×</span>
                  </span>
                ))}
              </div>
            ))}

          </div>
        </section>


        {/* CAPABILITIES — pain-first cards: what scares the user → what we check */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">{{ ru: "Что мы проверяем", uz: "Nimani tekshiramiz", en: "What we check" }[lang]}</span>
            <span className="apex-mono text-right">{{ ru: "Сервис работает", uz: "Xizmat ishlamoqda", en: "Service online" }[lang]}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <div className="max-w-3xl">
              <p className="label-md mb-4">02 — {{ ru: "Что мы проверяем", uz: "Nimani tekshiramiz", en: "What we check" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B]">
                {{
                  ru: <>Если что-то <span className="font-serif-italic text-[#DC2626]">подозрительное</span> — пришлите нам</>,
                  uz: <>Biror narsa <span className="font-serif-italic text-[#DC2626]">shubhali</span> bo'lsa — bizga yuboring</>,
                  en: <>If something feels <span className="font-serif-italic text-[#DC2626]">off</span> — send it to us</>,
                }[lang]}
              </h2>
              <p className="mt-5 text-[16.5px] md:text-[18px] text-[#3F3F46] max-w-2xl leading-[1.6]">
                {{
                  ru: "Четыре самые частые схемы в Узбекистане. Каждая карточка показывает реальную боль и то, что мы за вас проверяем за секунды.",
                  uz: "O'zbekistondagi eng keng tarqalgan to'rtta sxema. Har bir karta haqiqiy muammoni va biz soniyalarda nimani tekshirayotganimizni ko'rsatadi.",
                  en: "The four most common scam patterns in Uzbekistan. Each card shows a real pain and what we verify for you in seconds.",
                }[lang]}
              </p>
            </div>
            <span className="hidden md:block apex-mono shrink-0">{{ ru: "4 из 4", uz: "4 / 4", en: "4 of 4" }[lang]}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {[
              {
                i: Phone, accent: "#F97316",
                k: { ru: "Номер телефона", uz: "Telefon raqami", en: "Phone number" },
                pain: { ru: "«Здравствуйте, служба безопасности банка…»", uz: "«Assalomu alaykum, bank xavfsizlik xizmati…»", en: "“Hello, this is the bank security service…”" },
                check: { ru: "Сверим с базой жалоб, найдём фейковые «банки», «операторы» и звонки-обманы.", uz: "Shikoyatlar bazasi bilan tekshiramiz, soxta «bank», «operator» va aldov qo'ng'iroqlarni topamiz.", en: "Cross-check against our scam database, flag fake “banks”, “operators” and call scams." },
              },
              {
                i: MessageSquare, accent: "#FB923C",
                k: { ru: "Telegram-аккаунт", uz: "Telegram hisob", en: "Telegram account" },
                pain: { ru: "«Менеджер банка пишет в личку — просит код из SMS»", uz: "«Bank menejeri shaxsiyga yozyapti — SMS kodini so'rayapti»", en: "“A bank manager DMs you and asks for the SMS code.”" },
                check: { ru: "Боты, каналы-ловушки и псевдо-сотрудники банков — определяем по паттернам.", uz: "Botlar, tuzoq-kanallar va soxta bank xodimlarini namunalar bo'yicha aniqlaymiz.", en: "Detect bots, trap channels and fake bank employees by behavior patterns." },
              },
              {
                i: Link2, accent: "#C2410C",
                k: { ru: "Ссылки и сайты", uz: "Havolalar va saytlar", en: "Links & sites" },
                pain: { ru: "«Оплатите доставку по этой ссылке — иначе посылку вернут»", uz: "«Yetkazib berishni shu havola orqali to'lang — aks holda qaytariladi»", en: "“Pay the delivery fee via this link or your parcel is returned.”" },
                check: { ru: "Фишинг, поддельные платёжки и вредоносные APK — отделяем от настоящих.", uz: "Fishing, soxta to'lov sahifalari va zararli APK fayllarini haqiqiylaridan ajratamiz.", en: "Phishing, fake payment pages and malicious APKs — separated from the real ones." },
              },
              {
                i: FileWarning, accent: "#F97316",
                k: { ru: "Текст SMS / Telegram", uz: "SMS / Telegram matni", en: "SMS / Telegram text" },
                pain: { ru: "«Срочно! По вашей карте подозрительная операция…»", uz: "«Shoshilinch! Kartangizda shubhali amaliyot…»", en: "“Urgent! A suspicious transaction on your card…”" },
                check: { ru: "Признаки социальной инженерии: давление, срочность, просьба о коде или переводе.", uz: "Ijtimoiy muhandislik belgilari: bosim, shoshqaloqlik, kod yoki o'tkazma so'rovi.", en: "Social-engineering signals: pressure, urgency, asking for codes or transfers." },
              },
            ].map((c, idx) => (
              <div key={c.k.en} className="relative bg-white/85 backdrop-blur-[4px] p-7 sm:p-8 md:p-10 overflow-hidden flex flex-col">
                <span className="absolute top-6 right-6 apex-mono">0{idx + 1}</span>

                <div className="flex items-center justify-center w-10 h-10 rounded-[3px] border border-[#E2E0D8] mb-6 transition-colors" style={{ color: c.accent }}>
                  <c.i aria-hidden="true" focusable="false" className="h-4 w-4" strokeWidth={1.5} />
                </div>

                {/* Pain badge — red dot signals "this is the problem" */}
                <div className="inline-flex items-center gap-1.5 mb-3 text-[10px] font-semibold tracking-[0.18em] uppercase text-[#B91C1C] font-mono">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                  </span>
                  {{ ru: "Болевая точка", uz: "Og'riqli nuqta", en: "Pain point" }[lang]}
                </div>

                <h3 className="font-sans text-[17px] font-medium mb-3 tracking-tight text-[#18181B] text-balance">
                  {c.k[lang]}
                </h3>

                {/* Pain quote — the scammer's line, visually emphasized */}
                <blockquote className="border-l-2 border-[#DC2626]/30 pl-3 mb-5 text-[13.5px] leading-[1.55] text-[#18181B] italic font-serif-italic">
                  {c.pain[lang]}
                </blockquote>

                {/* What we do about it — outcome line */}
                <div className="mt-auto pt-4 border-t border-[#E2E0D8]">
                  <p className="apex-mono text-[#C2410C] mb-1.5">

                    ✓ {{ ru: "Что мы делаем", uz: "Biz nima qilamiz", en: "What we do" }[lang]}
                  </p>
                  <p className="card-body">{c.check[lang]}</p>
                </div>
              </div>
            ))}
          </div>
        </section>




        {/* BEFORE / AFTER — real scam message vs what's actually safe, with plain-language why */}
        <section aria-labelledby="ba-title" className="apex-frame apex-stripes cv-auto border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">{{ ru: "Реальные примеры", uz: "Haqiqiy misollar", en: "Real examples" }[lang]}</span>
            <span className="apex-mono text-right">{{ ru: "Было → Стало", uz: "Edi → Bo'ldi", en: "Before → After" }[lang]}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <div className="max-w-3xl">
              <p className="label-md mb-4">03 — {{ ru: "Было / Стало", uz: "Edi / Bo'ldi", en: "Before / After" }[lang]}</p>
              <h2 id="ba-title" className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B]">
                {{
                  ru: <>Как выглядит <span className="font-serif-italic text-[#DC2626]">обман</span> — и как должно быть на самом деле</>,
                  uz: <>«<span className="font-serif-italic text-[#DC2626]">Aldov</span>» qanday ko'rinadi va aslida qanday bo'lishi kerak</>,
                  en: <>What a <span className="font-serif-italic text-[#DC2626]">scam</span> looks like — and what it should look like</>,
                }[lang]}
              </h2>
              <p className="mt-5 text-[16.5px] md:text-[18px] text-[#3F3F46] max-w-2xl leading-[1.6]">
                {{
                  ru: "Три реальных сообщения от мошенников и три признака, по которым их можно узнать за 5 секунд. Сравните с тем, как пишет настоящий банк или магазин.",
                  uz: "Firibgarlarning uchta haqiqiy xabari va ularni 5 soniyada tanish mumkin bo'lgan uchta belgi. Haqiqiy bank yoki do'kon qanday yozishini taqqoslang.",
                  en: "Three real scam messages and three signals that give them away in 5 seconds. Compare with how a real bank or store actually writes.",
                }[lang]}
              </p>
            </div>
            <span className="hidden md:block apex-mono shrink-0">{{ ru: "3 из 3", uz: "3 / 3", en: "3 of 3" }[lang]}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {[
              {
                topic: { ru: "СМС от «банка»", uz: "«Bank»dan SMS", en: "“Bank” SMS" },
                bad: { ru: "СРОЧНО! По вашей карте подозрительная операция 4 500 000 сум. Если это не вы — позвоните: +998 99 412-87-03", uz: "SHOSHILINCH! Kartangizda shubhali amaliyot 4 500 000 so'm. Agar bu siz bo'lmasangiz — qo'ng'iroq qiling: +998 99 412-87-03", en: "URGENT! Suspicious transaction of 4,500,000 UZS on your card. If it wasn't you — call: +998 99 412-87-03" },
                good: { ru: "Покупка 89 000 сум · Korzinka · 14:32. Баланс: 312 400 сум. Поддержка — номер на обороте карты.", uz: "Xarid 89 000 so'm · Korzinka · 14:32. Hisob: 312 400 so'm. Yordam — karta orqasidagi raqam.", en: "Purchase 89,000 UZS · Korzinka · 14:32. Balance: 312,400 UZS. Support — number on the back of your card." },
                why: [
                  { ru: "Слово «СРОЧНО» большими буквами — давление на эмоции", uz: "Katta harflar bilan «SHOSHILINCH» — hissiyotga bosim", en: "ALL-CAPS «URGENT» — emotional pressure" },
                  { ru: "Незнакомый мобильный номер вместо короткого банковского", uz: "Qisqa bank raqami o'rniga notanish mobil raqam", en: "Random mobile number instead of the short bank code" },
                  { ru: "Просят перезвонить — настоящий банк не даёт чужие номера", uz: "Qayta qo'ng'iroq qilishni so'rashadi — haqiqiy bank begona raqam bermaydi", en: "Asks you to call back — a real bank never gives an outside number" },
                ],
              },
              {
                topic: { ru: "Сообщение от «курьера»", uz: "«Kuryer»dan xabar", en: "Message from a “courier”" },
                bad: { ru: "Ваша посылка не доставлена. Оплатите 27 000 сум, иначе будет возвращена: hxxp://uzpost-pay.top/track?id=8821", uz: "Sizning posilkangiz yetkazilmadi. 27 000 so'm to'lang, aks holda qaytariladi: hxxp://uzpost-pay.top/track?id=8821", en: "Your parcel was not delivered. Pay 27,000 UZS or it will be returned: hxxp://uzpost-pay.top/track?id=8821" },
                good: { ru: "Посылка №RA12345UZ ожидает в отделении №7 до 12 апреля. Доплата не требуется. uzpost.uz", uz: "RA12345UZ raqamli posilka 12 aprelgacha 7-bo'limda kutmoqda. Qo'shimcha to'lov shart emas. uzpost.uz", en: "Parcel RA12345UZ is waiting at branch #7 until Apr 12. No extra payment needed. uzpost.uz" },
                why: [
                  { ru: "Подозрительный домен .top вместо официального .uz", uz: "Rasmiy .uz o'rniga shubhali .top domen", en: "Sketchy .top domain instead of the official .uz" },
                  { ru: "Требование оплатить «прямо сейчас» по ссылке", uz: "Havola orqali «hozir» to'lash talabi", en: "Demand to pay «right now» via a link" },
                  { ru: "Почта никогда не просит доплату через ссылку в SMS", uz: "Pochta hech qachon SMS havola orqali to'lov so'ramaydi", en: "Post offices never request payment via an SMS link" },
                ],
              },
              {
                topic: { ru: "Telegram «менеджер банка»", uz: "Telegram «bank menejeri»", en: "Telegram «bank manager»" },
                bad: { ru: "Здравствуйте, я Алишер из службы безопасности. Чтобы отменить операцию — назовите код из SMS, который пришёл сейчас.", uz: "Assalomu alaykum, men xavfsizlik xizmatidan Alisherman. Amaliyotni bekor qilish uchun — hozir kelgan SMS kodni ayting.", en: "Hi, I'm Alisher from security. To cancel the transaction — tell me the SMS code you just got." },
                good: { ru: "Банк пишет только в официальном приложении и никогда не спрашивает SMS-код. Поддержка — телефон с обратной стороны карты.", uz: "Bank faqat rasmiy ilovada yozadi va hech qachon SMS-kod so'ramaydi. Yordam — karta orqasidagi telefon.", en: "Banks only message you inside their official app and never ask for an SMS code. Support — the phone on the back of your card." },
                why: [
                  { ru: "Просит код из SMS — главный признак мошенника", uz: "SMS kodni so'rayapti — firibgarning asosiy belgisi", en: "Asks for an SMS code — the #1 scam signal" },
                  { ru: "Связь через Telegram, а не в приложении банка", uz: "Bank ilovasi orqali emas, Telegram orqali bog'lanish", en: "Contact via Telegram instead of the bank app" },
                  { ru: "Спешка — «прямо сейчас», чтобы вы не успели подумать", uz: "Shoshqaloqlik — «hozir», o'ylab ko'rmasligingiz uchun", en: "Hurry — «right now» so you don't have time to think" },
                ],
              },
            ].map((ex, idx) => (
              <article key={idx} className="rounded-[6px] border border-[#E2E0D8] bg-white overflow-hidden flex flex-col">
                <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#E2E0D8] bg-[#FAFAF7]">
                  <span className="apex-mono text-[#52525B]">0{idx + 1}</span>
                  <span className="text-[13px] font-semibold text-[#18181B]">{ex.topic[lang]}</span>
                </header>

                {/* BAD */}
                <div className="px-5 pt-5 pb-4">
                  <div className="inline-flex items-center gap-1.5 mb-2 text-[10.5px] font-bold tracking-[0.18em] uppercase text-[#991B1B] font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" aria-hidden />
                    {{ ru: "Было — мошенник", uz: "Edi — firibgar", en: "Before — scammer" }[lang]}
                  </div>
                  <blockquote className="rounded-[4px] border border-[#FCA5A5]/50 bg-[#FEF2F2] p-3.5 text-[14px] leading-[1.55] text-[#3F1A0A] font-sans whitespace-pre-wrap break-words">
                    {ex.bad[lang]}
                  </blockquote>
                </div>

                {/* GOOD */}
                <div className="px-5 pb-5">
                  <div className="inline-flex items-center gap-1.5 mb-2 text-[10.5px] font-bold tracking-[0.18em] uppercase text-[#065F46] font-mono">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#059669]" aria-hidden />
                    {{ ru: "Стало — как настоящий", uz: "Bo'ldi — haqiqiysi", en: "After — the real one" }[lang]}
                  </div>
                  <blockquote className="rounded-[4px] border border-[#A7F3D0]/60 bg-[#ECFDF5] p-3.5 text-[14px] leading-[1.55] text-[#064E3B] font-sans whitespace-pre-wrap break-words">
                    {ex.good[lang]}
                  </blockquote>
                </div>

                {/* WHY */}
                <div className="mt-auto px-5 py-4 border-t border-[#E2E0D8] bg-[#FFF7ED]">
                  <p className="apex-mono text-[#9A3412] mb-2.5">
                    → {{ ru: "Почему это обман", uz: "Nega bu aldov", en: "Why it's a scam" }[lang]}
                  </p>
                  <ul className="space-y-1.5">
                    {ex.why.map((w, i) => (
                      <li key={i} className="flex gap-2 text-[13.5px] leading-[1.55] text-[#3F1A0A]">
                        <span className="text-[#F97316] font-bold shrink-0" aria-hidden>·</span>
                        <span className="text-pretty">{w[lang]}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button type="button" onClick={scrollToForm} className="fancy-btn">
              <FancyShell>
                {{ ru: "Проверить своё сообщение", uz: "O'z xabaringizni tekshiring", en: "Check your message" }[lang]}
              </FancyShell>
            </button>
          </div>
        </section>


        {/* HOW IT WORKS — APEX striped surface panel */}
        <section className="apex-frame apex-stripes relative overflow-hidden border border-[#E2E0D8] bg-[#F4F2EB] rounded-[6px] cv-auto">

          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#C2410C] z-[1]" />
          <div className="relative p-6 sm:p-10 md:p-14">
            <div className="flex items-start justify-between gap-4 mb-6">
              <span className="apex-mono">{{ ru: "Как это работает", uz: "Bu qanday ishlaydi", en: "How it works" }[lang]}</span>
              <span className="apex-mono text-right">{{ ru: "3 шага", uz: "3 qadam", en: "3 steps" }[lang]}</span>
            </div>
            <div className="mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
              <p className="label-md mb-4">03 — {{ ru: "Алгоритм", uz: "Algoritm", en: "Algorithm" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] max-w-3xl text-balance">{t("how_it_works", lang)}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
              {[
                {
                  i: "01", t: t("step_1", lang), d: t("step_1_d", lang),
                  pain: { ru: "«Сомневаюсь — но времени думать нет»", uz: "«Shubhalanyapman — o'ylashga vaqt yo'q»", en: "“I'm suspicious — but no time to think.”" },
                  out: { ru: "Вставьте номер, ссылку или текст — без регистрации.", uz: "Raqam, havola yoki matnni joylashtiring — ro'yxatdan o'tmasdan.", en: "Paste the number, link or text — no signup." },
                },
                {
                  i: "02", t: t("step_2", lang), d: t("step_2_d", lang),
                  pain: { ru: "«Не понимаю, реально это банк или развод»", uz: "«Bu haqiqiy bankmi yoki firibgarlikmi — tushunmayapman»", en: "“I can't tell if this is a real bank or a scam.”" },
                  out: { ru: "Сверяем с базой жалоб и паттернами в реальном времени.", uz: "Shikoyatlar bazasi va naqshlar bilan real vaqtda tekshiramiz.", en: "We cross-check against the reports DB and live patterns." },
                },
                {
                  i: "03", t: t("step_3", lang), d: t("step_3_d", lang),
                  pain: { ru: "«Что делать прямо сейчас?»", uz: "«Hozir nima qilishim kerak?»", en: "“What should I do right now?”" },
                  out: { ru: "Конкретные шаги: что не отправлять, кому звонить, куда писать.", uz: "Aniq qadamlar: nimani yubormaslik, kimga qo'ng'iroq qilish, qayerga yozish.", en: "Concrete steps: what not to send, whom to call, where to report." },
                },
              ].map((s, idx) => (
                <div key={s.i} className="relative bg-[#F4F2EB] p-8 sm:p-10 md:p-12 apex-stripes min-h-[300px] md:min-h-[320px] flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="block font-sans text-5xl md:text-6xl font-medium tracking-[-0.05em] text-[#D4D1C6] leading-none tabular-nums">{s.i}</span>
                    <span className="apex-mono text-[#71717A]">{{ ru: `Шаг ${idx + 1} из 3`, uz: `${idx + 1}/3 qadam`, en: `Step ${idx + 1} of 3` }[lang]}</span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase text-[#B91C1C] font-mono">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                    </span>
                    {{ ru: "Что чувствует человек", uz: "Inson nimani his qiladi", en: "What the user feels" }[lang]}
                  </div>
                  <blockquote className="border-l-2 border-[#DC2626]/30 pl-3 text-[13.5px] leading-[1.55] text-[#18181B] italic font-serif-italic">
                    {s.pain[lang]}
                  </blockquote>

                  <h3 className="font-sans text-[19px] md:text-xl font-medium tracking-tight text-[#18181B] text-balance">{s.t}</h3>
                  <p className="card-body">{s.d}</p>

                  <div className="mt-auto pt-4 border-t border-[#E2E0D8]">
                    <p className="apex-mono text-[#C2410C] mb-1.5">
                      → {{ ru: "Что получите", uz: "Nima olasiz", en: "What you get" }[lang]}
                    </p>
                    <p className="card-body">{s.out[lang]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* EXAMPLE — APEX striped frame around the demo */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">{{ ru: "Пример проверки", uz: "Tekshirish misoli", en: "Check example" }[lang]}</span>
            <span className="apex-mono text-right">{{ ru: "Опасно", uz: "Xavfli", en: "Dangerous" }[lang]}</span>
          </div>
          <div className="text-center mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <p className="label-md mb-4">04 — {{ ru: "Пример работы", uz: "Ish misoli", en: "Example" }[lang]}</p>
            <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] max-w-2xl mx-auto text-[#18181B] text-balance">
              {t("example_title", lang)}
            </h2>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="apex-glass p-8 sm:p-10 md:p-12 rounded-[6px] flex flex-col">
              <p className="label-md mb-8">{{ ru: "Входящий текст", uz: "Kirish matni", en: "Incoming text" }[lang]}</p>

              <div className="flex-1 flex flex-col justify-center max-w-[52ch]">
                <span aria-hidden className="font-serif-italic text-[64px] md:text-[80px] leading-none text-[#F97316]/30 mb-2 select-none">“</span>
                <p className="text-[16px] md:text-[17px] leading-[1.65] text-[#18181B] italic text-pretty">
                  {{
                    ru: "Здравствуйте, это служба безопасности банка. По вашей карте подозрительная операция. Срочно назовите код из SMS…",
                    uz: "Assalomu alaykum, bu bank xavfsizlik xizmati. Kartangiz bo'yicha shubhali amaliyot. Tezda SMS-kodni ayting…",
                    en: "Hello, this is the bank security service. A suspicious transaction was detected on your card. Tell us the SMS code now…",
                  }[lang]}
                </p>
              </div>

              <div className="mt-10 pt-6 border-t border-[#E2E0D8]">
                <p className="text-[16px] md:text-[17px] text-[#3F3F46] leading-[1.7] max-w-[52ch] text-pretty">
                  {{ ru: "Мы объясняем, почему сообщение выглядит подозрительным, и какие конкретные шаги предпринять.",
                     uz: "Xabar nima uchun shubhali ekani va aniq qadamlarni tushuntiramiz.",
                     en: "We explain why the message looks suspicious and which exact steps to take." }[lang]}
                </p>
              </div>
            </div>

            {/* Gradient-shell card — APEX signature technique */}
            <div className="apex-shell">
              <div className="relative bg-white p-8 sm:p-10 md:p-12">
                <div className="flex items-start justify-between gap-4 mb-10">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.12em] uppercase mb-3 inline-flex items-center gap-2">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                      </span>
                      <span className="bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#C2410C] bg-clip-text text-transparent">{{ ru: "Опасность · 98%", uz: "Xavf · 98%", en: "Risk · 98%" }[lang]}</span>
                    </p>
                    <h3 className="font-sans text-[28px] sm:text-3xl md:text-4xl font-medium tracking-[-0.05em] text-[#18181B] leading-[1.05]">{t("risk_high", lang)}</h3>
                    <p className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-[3px] bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#991B1B] text-[11px] font-medium tracking-[0.08em] uppercase">
                      <span className="font-mono text-[10px] text-[#991B1B]">{{ ru: "ОБМАН", uz: "ALDOV", en: "SCAM" }[lang]}</span>
                      <span className="h-3 w-px bg-[#FCA5A5]/70" />
                      <span>{{ ru: "Звонок «из банка» · код из SMS", uz: "«Bank»dan qo'ng'iroq · SMS kod", en: "Fake bank call · SMS code" }[lang]}</span>
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-[3px] border border-[#E2E0D8] flex items-center justify-center text-[#F97316] shrink-0">
                    <ShieldAlert aria-hidden="true" focusable="false" className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-10">
                  <div>
                    <p className="label-md mb-5">{t("why_title", lang)}</p>
                    <ul className="space-y-3.5 text-[15.5px] md:text-[16.5px] text-[#18181B] leading-[1.55]">
                      {(({
                        ru: ["Просят SMS-код (OTP)", "Представляются банком", "Создают срочность и давление", "Похожая схема уже в жалобах"],
                        uz: ["SMS-kod (OTP) so'rashmoqda", "Bank nomidan murojaat", "Shoshilinchlik va bosim", "Shu sxema shikoyatlarda uchragan"],
                        en: ["They ask for an SMS code (OTP)", "They impersonate a bank", "Urgency and pressure", "Similar pattern already reported"],
                      })[lang]).map((r) => (
                        <li key={r} className="flex items-start gap-3">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#F97316] shrink-0 mt-[7px]" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-8 border-t border-[#E2E0D8]">
                    <p className="label-md mb-5">{t("what_to_do", lang)}</p>
                    <div className="space-y-2.5">
                      {(({
                        ru: ["Не отправляйте код", "Завершите разговор", "Позвоните в банк по номеру с карты"],
                        uz: ["Kodni yubormang", "Suhbatni tugating", "Bankka kartadagi raqam orqali qo'ng'iroq qiling"],
                        en: ["Don't send the code", "End the call", "Call the bank using the number on your card"],
                      })[lang]).map((r, i) => (
                        <div key={r} className="flex items-center gap-4 px-4 py-3.5 rounded-[3px] bg-[#F4F2EB] border border-[#E2E0D8] text-[14px]">
                          <span className="text-[#71717A] text-[11px] font-mono">0{i + 1}</span>
                          <span className="text-[#18181B]">{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* KNOWLEDGE BASE — APEX striped frame */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">{{ ru: "Известные обманы", uz: "Ma'lum aldovlar", en: "Known scams" }[lang]}</span>
            <span className="apex-mono text-right">{{ ru: "6 из 6", uz: "6 / 6", en: "6 of 6" }[lang]}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <div className="max-w-3xl">
              <p className="label-md mb-4">05 — {{ ru: "База знаний", uz: "Bilimlar bazasi", en: "Knowledge base" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] text-balance">{t("schemes_title", lang)}</h2>
            </div>
            <span className="hidden md:block apex-mono shrink-0">{{ ru: "6 случаев", uz: "6 holat", en: "6 cases" }[lang]}</span>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {([
              { n: "01", ru: "«Служба безопасности банка»", uz: "«Bank xavfsizlik xizmati»", en: "Bank security call",
                d_ru: "Звонят якобы из банка, говорят о подозрительной операции и просят SMS-код.", d_uz: "Bank nomidan qo'ng'iroq qilib, SMS-kod so'rashadi.", d_en: "They call “from the bank” and ask for your SMS code.",
                bait_ru: "«По вашей карте подозрительная операция. Назовите код из SMS»", bait_uz: "«Kartangizda shubhali amaliyot. SMS kodni ayting»", bait_en: "“Suspicious activity on your card. Tell me the SMS code.”",
                loss_ru: "Списание всей карты за минуты", loss_uz: "Daqiqalarda kartadan barcha pul yo'qoladi", loss_en: "Whole card drained in minutes" },
              { n: "02", ru: "APK от мнимого банка", uz: "Soxta bank APK", en: "Fake bank APK",
                d_ru: "Просят установить «безопасное приложение» — оно крадёт SMS и данные.", d_uz: "«Xavfsiz ilova» o'rnatishni so'rashadi — u SMS o'g'irlaydi.", d_en: "They push a “safe app” that steals SMS and data.",
                bait_ru: "«Установите это приложение для защиты счёта»", bait_uz: "«Hisobni himoya qilish uchun ilovani o'rnating»", bait_en: "“Install this app to protect your account.”",
                loss_ru: "Полный доступ к SMS и банк-приложению", loss_uz: "SMS va bank ilovasiga to'liq kirish", loss_en: "Full access to SMS and banking apps" },
              { n: "03", ru: "Безопасный счёт", uz: "Xavfsiz hisob", en: "Safe account",
                d_ru: "Уговаривают перевести деньги на «безопасный счёт». Их не существует.", d_uz: "«Xavfsiz hisob»ga pul o'tkazishga undashadi.", d_en: "They push you to move money to a “safe account”.",
                bait_ru: "«Переведите деньги на безопасный счёт, пока мы блокируем мошенников»", bait_uz: "«Firibgarlarni bloklaganimizcha pulni xavfsiz hisobga o'tkazing»", bait_en: "“Move your money to a safe account while we block fraud.”",
                loss_ru: "Перевод собственных денег мошенникам", loss_uz: "O'z pullarini firibgarlarga o'tkazish", loss_en: "Your own money sent to scammers" },
              { n: "04", ru: "Лёгкий кредит в Telegram", uz: "Telegram'dagi oson kredit", en: "Easy Telegram loan",
                d_ru: "Telegram-канал обещает быстрый кредит, просит предоплату.", d_uz: "Telegram kanali kredit va'da qilib oldindan to'lov so'raydi.", d_en: "A Telegram channel promises a quick loan, asks a fee upfront.",
                bait_ru: "«Кредит без проверок. Оплатите страховку — и деньги ваши»", bait_uz: "«Tekshiruvsiz kredit. Sug'urtani to'lang — pul sizniki»", bait_en: "“Loan with no checks. Pay the insurance fee and money is yours.”",
                loss_ru: "Предоплата уходит, кредита нет", loss_uz: "Oldindan to'lov ketadi, kredit yo'q", loss_en: "Upfront fee gone, no loan" },
              { n: "05", ru: "Фейковая доставка", uz: "Soxta yetkazib berish", en: "Fake delivery",
                d_ru: "«Курьер» отправляет ссылку для оплаты доставки — это фишинг карты.", d_uz: "«Kuryer» to'lov havolasini yuboradi — bu fishing.", d_en: "A “courier” sends a payment link — card phishing.",
                bait_ru: "«Доплатите 12 000 сум за доставку по ссылке»", bait_uz: "«Yetkazib berish uchun 12 000 so'm to'lang»", bait_en: "“Pay 12,000 UZS delivery fee via this link.”",
                loss_ru: "Реквизиты карты уходят на фишинг-сайт", loss_uz: "Karta ma'lumotlari fishing saytga ketadi", loss_en: "Card details captured by phishing site" },
              { n: "06", ru: "Выигрыш / приз", uz: "Yutuq / sovrin", en: "Prize won",
                d_ru: "Сообщают о выигрыше и просят данные карты для «зачисления».", d_uz: "Yutuq haqida xabar berib karta ma'lumotlarini so'rashadi.", d_en: "They claim you won and ask for card details.",
                bait_ru: "«Вы выиграли iPhone! Введите карту для зачисления приза»", bait_uz: "«Siz iPhone yutdingiz! Sovg'a uchun karta ma'lumotlarini kiriting»", bait_en: "“You won an iPhone! Enter your card to receive it.”",
                loss_ru: "Карта попадает в руки мошенников", loss_uz: "Karta firibgarlar qo'liga tushadi", loss_en: "Card details handed to scammers" },
            ] as const).map((s) => (
              <div key={s.en} className="relative bg-white/85 backdrop-blur-[4px] p-8 sm:p-10 md:p-12 min-h-[340px] flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <span className="apex-mono">{{ ru: `Случай №${s.n}`, uz: `Holat №${s.n}`, en: `Case #${s.n}` }[lang]}</span>
                  <span className="flex-1 h-px bg-[#E2E0D8]" />
                  <span className="inline-flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.18em] uppercase text-[#B91C1C] font-mono">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                    </span>
                    {{ ru: "ОБМАН", uz: "ALDOV", en: "SCAM" }[lang]}
                  </span>
                </div>

                <h3 className="font-sans text-[18px] md:text-[19px] font-medium mb-3 tracking-tight text-[#18181B] leading-[1.3] text-balance">{s[lang]}</h3>
                <p className="card-body mb-5">
                  {(s as never as Record<string, string>)["d_" + lang]}
                </p>

                {/* Scammer bait */}
                <blockquote className="border-l-2 border-[#DC2626]/30 pl-3 mb-5 text-[13px] leading-[1.55] text-[#18181B] italic font-serif-italic">
                  {(s as never as Record<string, string>)["bait_" + lang]}
                </blockquote>

                {/* Consequence — what you lose */}
                <div className="mt-auto pt-4 border-t border-[#E2E0D8]">
                  <p className="apex-mono text-[#B91C1C] mb-1.5">
                    ⚠ {{ ru: "Что теряете", uz: "Nima yo'qotasiz", en: "What you lose" }[lang]}
                  </p>
                  <p className="card-body">{(s as never as Record<string, string>)["loss_" + lang]}</p>
                </div>
              </div>

            ))}
          </div>
        </section>

        {/* FAQ — pain scenarios with green "what we do" answer */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">{{ ru: "Частые вопросы", uz: "Tez-tez beriladigan savollar", en: "Common questions" }[lang]}</span>
            <span className="apex-mono text-right">{{ ru: "Реальные ситуации", uz: "Haqiqiy holatlar", en: "Real situations" }[lang]}</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <div className="max-w-3xl">
              <p className="label-md mb-4">06 — {{ ru: "Частые вопросы", uz: "Tez-tez beriladigan savollar", en: "Frequent questions" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] text-balance">
                {{
                  ru: <>А что если <span className="font-serif-italic text-[#DC2626]">уже случилось</span>?</>,
                  uz: <>Agar <span className="font-serif-italic text-[#DC2626]">allaqachon sodir bo'lgan</span> bo'lsa-chi?</>,
                  en: <>What if it <span className="font-serif-italic text-[#DC2626]">already happened</span>?</>,
                }[lang]}
              </h2>
              <p className="mt-5 text-[16.5px] md:text-[18px] text-[#3F3F46] max-w-2xl leading-[1.6]">
                {{
                  ru: "Шесть реальных ситуаций, в которых пользователи приходят к нам. Для каждой — что сделать прямо сейчас.",
                  uz: "Foydalanuvchilar bizga keladigan oltita haqiqiy holat. Har biri uchun — hozir nima qilish kerak.",
                  en: "Six real situations users come to us with. For each — what to do right now.",
                }[lang]}
              </p>
            </div>
            <span className="hidden md:block apex-mono shrink-0">{{ ru: "6 из 6", uz: "6 / 6", en: "6 of 6" }[lang]}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {[
              {
                q: { ru: "Мне звонят из «службы безопасности банка» — это правда?", uz: "Menga «bank xavfsizlik xizmati»dan qo'ng'iroq qilishyapti — bu rostmi?", en: "I'm getting a call from “bank security” — is it real?" },
                pain: { ru: "«Они знают моё имя и последние цифры карты — как такому не верить?»", uz: "«Ular ismimni va karta raqamining oxirini bilishadi — qanday ishonmaslik kerak?»", en: "“They know my name and last card digits — how can I not trust this?”" },
                ans: { ru: "Настоящий банк никогда не просит SMS-код, пароль или установку приложений по ссылке. Положите трубку и перезвоните по номеру с обратной стороны карты.", uz: "Haqiqiy bank hech qachon SMS-kod, parol yoki havola orqali ilova o'rnatishni so'ramaydi. Qo'ng'iroqni tugating va karta orqasidagi raqamga qo'ng'iroq qiling.", en: "A real bank never asks for an SMS code, password, or app install via a link. Hang up and call the number printed on your card." },
              },
              {
                q: { ru: "Я уже отправил код из SMS — что делать?", uz: "Men SMS kodni allaqachon yubordim — nima qilish kerak?", en: "I already sent the SMS code — what now?" },
                pain: { ru: "«Прошло 2 минуты — успею я что-то остановить?»", uz: "«2 daqiqa o'tdi — biror narsani to'xtata olamanmi?»", en: "“It's been 2 minutes — can I still stop something?”" },
                ans: { ru: "Срочно позвоните в банк и попросите блокировку карты и онлайн-банка. Затем смените пароль в приложении банка и проверьте недавние операции.", uz: "Zudlik bilan bankka qo'ng'iroq qiling va karta hamda onlayn-bankni bloklashni so'rang. So'ngra bank ilovasidagi parolni o'zgartiring va so'nggi amaliyotlarni tekshiring.", en: "Call the bank immediately and request a card and online-banking block. Then change your banking app password and review recent transactions." },
              },
              {
                q: { ru: "Установил подозрительный APK — телефон скомпрометирован?", uz: "Shubhali APK o'rnatdim — telefonim xavf ostidami?", en: "I installed a sketchy APK — is my phone compromised?" },
                pain: { ru: "«Приложение просит доступ ко всем SMS и контактам — это нормально?»", uz: "«Ilova barcha SMS va kontaktlarga ruxsat so'rayapti — bu normalmi?»", en: "“The app asks for access to all my SMS and contacts — is that normal?”" },
                ans: { ru: "Включите авиарежим, удалите приложение, смените пароли в банках через другой телефон. При необходимости сделайте сброс к заводским настройкам.", uz: "Aviarejimni yoqing, ilovani o'chiring, boshqa telefon orqali bank parollarini o'zgartiring. Kerak bo'lsa, telefonni zavod sozlamalariga qaytaring.", en: "Switch on airplane mode, uninstall the app, change banking passwords from a different phone. Factory-reset if needed." },
              },
              {
                q: { ru: "Перевёл деньги «на безопасный счёт» — можно вернуть?", uz: "Pulni «xavfsiz hisob»ga o'tkazdim — qaytarib olsa bo'ladimi?", en: "I sent money to a “safe account” — can I get it back?" },
                pain: { ru: "«Перевод ушёл 10 минут назад — это уже навсегда?»", uz: "«O'tkazma 10 daqiqa oldin ketgan — bu butunlay yo'qoldimi?»", en: "“The transfer left 10 minutes ago — is it gone for good?”" },
                ans: { ru: "Немедленно — звонок в банк с просьбой о возврате/споре операции, и заявление в Cyber Police (102). Шанс есть только в первые часы.", uz: "Zudlik bilan — bankka qo'ng'iroq qilib amaliyotni qaytarish/bahslashishni so'rang va Cyber Police'ga (102) ariza bering. Imkoniyat faqat dastlabki soatlarda.", en: "Immediately call the bank to request a refund/dispute, and file a report with Cyber Police (102). The window is just a few hours." },
              },
              {
                q: { ru: "В Telegram пишет «менеджер банка» — отвечать?", uz: "Telegram'da «bank menejeri» yozyapti — javob berishim kerakmi?", en: "A “bank manager” is DMing me on Telegram — should I reply?" },
                pain: { ru: "«У него аватарка с логотипом банка и официальное имя — выглядит настоящим»", uz: "«Uning avatarida bank logotipi va rasmiy ism — haqiqiyga o'xshaydi»", en: "“Their avatar has the bank logo and an official name — it looks real.”" },
                ans: { ru: "Банки не ведут клиентскую поддержку в личных Telegram-сообщениях. Не отвечайте, пришлите username нам — проверим за секунды.", uz: "Banklar shaxsiy Telegram xabarlarida mijozlarga xizmat ko'rsatmaydi. Javob bermang, username'ni bizga yuboring — soniyalarda tekshiramiz.", en: "Banks don't run support over Telegram DMs. Don't reply — send the username to us, we'll check it in seconds." },
              },
              {
                q: { ru: "Хочу проверить ссылку, но боюсь по ней переходить", uz: "Havolani tekshirmoqchiman, lekin bosishdan qo'rqyapman", en: "I want to check a link but I'm scared to click it" },
                pain: { ru: "«А вдруг это вирус, и просто открытие в браузере уже навредит?»", uz: "«Agar virus bo'lsa va shunchaki brauzerda ochish allaqachon zarar yetkazsa-chi?»", en: "“What if it's malware and just opening it in a browser already hurts?”" },
                ans: { ru: "Не открывайте. Скопируйте ссылку как текст и вставьте в нашу проверку — мы анализируем её безопасно, не загружая страницу на ваш телефон.", uz: "Ochmang. Havolani matn sifatida nusxalang va tekshiruvimizga joylashtiring — biz sahifani telefoningizga yuklamasdan xavfsiz tahlil qilamiz.", en: "Don't open it. Copy the link as text and paste it into our checker — we analyze it safely, without loading the page on your phone." },
              },
            ].map((item, idx) => (
              <details
                key={idx}
                className="group bg-white/85 backdrop-blur-[4px] p-7 sm:p-8 md:p-10 [&_summary::-webkit-details-marker]:hidden"
                open={idx === 0}
              >
                <summary className="cursor-pointer list-none flex items-start justify-between gap-4 rounded-[6px] -m-2 p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] hover:bg-[#F4F2EB]/50 transition-colors min-h-11">
                  <div className="flex-1">
                    <span className="apex-mono text-[#52525B] block mb-2">{{ ru: `Вопрос ${idx + 1}`, uz: `Savol ${idx + 1}`, en: `Question ${idx + 1}` }[lang]}</span>
                    <h3 className="font-sans text-[17px] sm:text-[18px] md:text-[20px] font-semibold tracking-tight text-[#0B0B0F] leading-[1.35] text-balance">
                      {item.q[lang]}
                    </h3>
                  </div>
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 w-10 h-10 rounded-full border border-[#E2E0D8] bg-white flex items-center justify-center text-[#F97316] text-xl leading-none transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>

                {/* Pain scenario — what the user is actually feeling */}
                <div className="mt-5 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.16em] uppercase text-[#991B1B] font-mono">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
                  </span>
                  {{ ru: "Что вы думаете в этот момент", uz: "Shu daqiqada nima o'ylaysiz", en: "What you're thinking" }[lang]}
                </div>
                <blockquote className="mt-2.5 border-l-2 border-[#DC2626]/40 pl-3 text-[15px] md:text-[16px] leading-[1.55] text-[#18181B] italic font-serif-italic">
                  {item.pain[lang]}
                </blockquote>

                {/* Answer — unified warm cream with orange brand accent */}
                <div className="mt-5 rounded-[6px] bg-[#FFF7ED] border border-[#FED7AA] p-4 md:p-5">
                  <p className="text-[11.5px] font-semibold tracking-[0.16em] uppercase text-[#C2410C] font-mono mb-2">
                    → {{ ru: "Что делаем / что делать", uz: "Nima qilamiz / nima qilish kerak", en: "What we do / what you do" }[lang]}
                  </p>
                  <p className="text-[15.5px] md:text-[16.5px] leading-[1.6] text-[#3F1A0A]">
                    {item.ans[lang]}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </section>


        {/* EMERGENCY CONTACTS — large tap-targets for elderly users, always on home */}
        <section aria-labelledby="emergency-contacts-title" className="apex-frame border border-[#FCA5A5]/60 rounded-[6px] p-6 sm:p-8 md:p-10 bg-[#FFF7ED]">
          <div className="flex items-start justify-between gap-4 mb-4">
            <span className="apex-mono text-[#991B1B] inline-flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
              </span>
              {{ ru: "Если уже случилось — звоните сразу", uz: "Agar allaqachon yuz bergan bo'lsa — darhol qo'ng'iroq qiling", en: "If it already happened — call now" }[lang]}
            </span>
            <span className="apex-mono text-right hidden sm:block">{{ ru: "Каждая минута важна", uz: "Har bir daqiqa muhim", en: "Every minute counts" }[lang]}</span>
          </div>
          <h2 id="emergency-contacts-title" className="font-sans font-medium text-[26px] sm:text-3xl md:text-[36px] tracking-[-0.04em] leading-[1.1] text-[#18181B] mb-6 md:mb-8 text-balance">
            {{ ru: "Срочные телефоны — нажмите, чтобы позвонить", uz: "Shoshilinch telefonlar — qo'ng'iroq qilish uchun bosing", en: "Emergency phones — tap to call" }[lang]}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {[
              {
                num: "102",
                label: { ru: "Полиция · Cyber Police", uz: "Politsiya · Cyber Police", en: "Police · Cyber Police" },
                desc: { ru: "Заявление о мошенничестве", uz: "Firibgarlik haqida ariza", en: "File a fraud report" },
              },
              {
                num: "1252",
                label: { ru: "Антифрод-линия ЦБ", uz: "MB antifirib liniyasi", en: "Central Bank anti-fraud" },
                desc: { ru: "Блокировка карт и счетов", uz: "Karta va hisoblarni bloklash", en: "Block cards and accounts" },
              },
              {
                num: "1173",
                label: { ru: "Горячая линия Узкарт", uz: "UzCard ishonch telefoni", en: "UzCard hotline" },
                desc: { ru: "Споры по платежам", uz: "To'lovlar bo'yicha bahslar", en: "Payment disputes" },
              },
            ].map((c) => (
              <a
                key={c.num}
                href={`tel:${c.num}`}
                className="group flex items-center gap-4 rounded-[6px] border border-[#E2E0D8] bg-white p-4 md:p-5 min-h-[72px] hover:border-[#F97316] hover:shadow-[0_8px_24px_-12px_rgba(249,115,22,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F97316] transition-all"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[4px] bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#DC2626]">
                  <Phone aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display font-extrabold text-[26px] md:text-[28px] tracking-tight text-[#0B0B0F] leading-none tabular-nums">
                    {c.num}
                  </span>
                  <span className="block mt-1 text-[13.5px] font-semibold text-[#18181B] truncate">
                    {c.label[lang]}
                  </span>
                  <span className="block text-[12.5px] text-[#52525B] truncate">
                    {c.desc[lang]}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-[#A1A1AA] group-hover:text-[#F97316] group-hover:translate-x-0.5 transition-all" strokeWidth={2} />
              </a>
            ))}
          </div>
          <p className="mt-5 text-[13.5px] text-[#52525B] leading-[1.55] text-pretty">
            {{
              ru: "Не уверены, что говорить? Откройте раздел «Срочная помощь» — там пошаговая инструкция на 3 минуты.",
              uz: "Nima deyishni bilmayapsizmi? «Shoshilinch yordam» bo'limini oching — u yerda 3 daqiqalik bosqichma-bosqich ko'rsatma bor.",
              en: "Not sure what to say? Open the “Emergency help” page — 3-minute step-by-step guide.",
            }[lang]}{" "}
            <Link to="/emergency" className="text-[#C2410C] font-semibold underline-offset-4 decoration-[#FED7AA] hover:decoration-[#F97316] hover:underline">
              {{ ru: "Открыть инструкцию →", uz: "Ko'rsatmani ochish →", en: "Open the guide →" }[lang]}
            </Link>
          </p>
        </section>


        {/* CTA pair — APEX: one gradient-shell (emergency), one flat surface (community) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          <div className="apex-shell">
            <div className="relative bg-white p-7 sm:p-9 md:p-11 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <span className="label-md text-[#F97316]">[ {{ ru: "Срочно", uz: "Shoshilinch", en: "Urgent" }[lang]} ]</span>
                <AlertTriangle aria-hidden="true" focusable="false" className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
              </div>
              <h3 className="font-sans text-[28px] sm:text-3xl md:text-4xl font-medium tracking-[-0.05em] leading-[1.05] mb-5 text-[#18181B] text-balance">{t("emergency_title", lang)}</h3>
              <p className="text-[#3F3F46] text-[16px] md:text-[17px] leading-[1.7] mb-8 max-w-[44ch] text-pretty">
                {{ ru: "Если вы уже отправили SMS-код, установили APK или перевели деньги — время идёт на минуты.",
                   uz: "Agar SMS-kod yuborgan, APK o'rnatgan yoki pul o'tkazgan bo'lsangiz — vaqt daqiqalar bilan o'lchanadi.",
                   en: "If you already sent an SMS code, installed an APK or transferred money — every minute counts." }[lang]}
              </p>
              <Link to="/emergency" className="fancy-btn">
                <FancyShell>{t("emergency_cta", lang)}</FancyShell>
              </Link>
            </div>
          </div>

          <div className="relative bg-[#F4F2EB] border border-[#E2E0D8] rounded-[6px] p-7 sm:p-9 md:p-11 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#C2410C] via-[#FB923C] to-[#F97316]" />
            <div className="flex items-center justify-between mb-6">
              <span className="label-md">[ {{ ru: "Сообщество", uz: "Hamjamiyat", en: "Community" }[lang]} ]</span>
              <Users aria-hidden="true" focusable="false" className="h-5 w-5 text-[#C2410C]" strokeWidth={1.5} />
            </div>
            <h3 className="font-sans text-[28px] sm:text-3xl md:text-4xl font-medium tracking-[-0.05em] leading-[1.05] mb-5 text-[#18181B] text-balance">
              {{ ru: "Помогите защитить других", uz: "Boshqalarni himoya qiling", en: "Help protect others" }[lang]}
            </h3>
            <p className="text-[#3F3F46] text-[16px] md:text-[17px] leading-[1.7] mb-8 max-w-[44ch] text-pretty">
              {{ ru: "Каждая жалоба проходит модерацию и помогает системе обучиться и предупредить тысячи пользователей.",
                 uz: "Har bir shikoyat moderatsiyadan o'tadi va tizimni o'rgatadi.",
                 en: "Every report is moderated and helps the system learn and warn thousands." }[lang]}
            </p>
            <Link to="/report" className="fancy-btn">
              <FancyShell>{t("report_btn", lang)}</FancyShell>
            </Link>
          </div>
        </section>


        {/* APEX-style footer band: ghost wordmark + status meta */}
        <footer className="apex-frame apex-stripes border-t border-[#E2E0D8] mt-4 pt-12 sm:pt-16 pb-8 -mx-6 px-6 sm:px-10 md:px-14">
          {/* Top meta row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-14 sm:mb-20">
            <div className="space-y-1.5">
              <p className="apex-mono flex items-center gap-2">
                <ShieldCheck aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-[#F97316] shrink-0" strokeWidth={1.5} />
                {{ ru: "Версия 3.1", uz: "Versiya 3.1", en: "Version 3.1" }[lang]}
              </p>
              <p className="apex-mono flex items-center gap-2">
                <span className="relative inline-flex h-2 w-2 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-[#F97316]/40 animate-ping" />
                  <span className="relative inline-block h-2 w-2 rounded-full bg-[#F97316]" />
                </span>
                {{ ru: "Сервис работает", uz: "Xizmat ishlamoqda", en: "Service online" }[lang]}
              </p>
            </div>
            <div className="sm:text-right space-y-1.5">
              <p className="apex-mono flex items-center gap-2 sm:justify-end">
                <MapPin aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-[#F97316] shrink-0" strokeWidth={1.5} />
                {{ ru: "ТАШКЕНТ · UZ", uz: "TOSHKENT · UZ", en: "TASHKENT · UZ" }[lang]}
              </p>
              <p className="apex-mono">© 2025 ISHONCH GUARD</p>
            </div>
          </div>

          {/* Ghost wordmark — SVG scales to container width, never clips */}
          <div className="select-none pointer-events-none mb-12 sm:mb-16" aria-hidden="true">
            <svg
              viewBox="0 0 1000 220"
              preserveAspectRatio="xMidYMid meet"
              className="block w-full h-auto overflow-visible"
            >
              <text
                x="500"
                y="180"
                textAnchor="middle"
                fontFamily="var(--font-display)"
                fontWeight={800}
                fontSize={240}
                letterSpacing="-12"
                fill="transparent"
                stroke="rgba(11,11,15,0.10)"
                strokeWidth={1.2}
              >
                ISHONCH.
              </text>
            </svg>
          </div>

          {/* Tagline */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 label-md text-center mb-12 sm:mb-16">
            <ShieldCheck aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-[#F97316] shrink-0" strokeWidth={1.5} />
            <span>{{ ru: "Без сохранения · За секунды · Бесплатно", uz: "Saqlanmaydi · Soniyalarda · Bepul", en: "No storage · In seconds · Free" }[lang]}</span>
            <Sparkles aria-hidden="true" focusable="false" className="h-3.5 w-3.5 text-[#F97316] shrink-0" strokeWidth={1.5} />
          </div>

          {/* Bottom strip */}
          <div className="pt-8 border-t border-[#E2E0D8] flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
            <p className="apex-mono text-[#71717A] text-pretty max-w-[44ch] sm:max-w-none">
              {{ ru: "ISHONCH GUARD — ПОМОЩНИК ПРОТИВ ОБМАНА ДЛЯ УЗБЕКИСТАНА",
                 uz: "ISHONCH GUARD — O'ZBEKISTON UCHUN ALDOVGA QARSHI YORDAMCHI",
                 en: "ISHONCH GUARD — ANTI-FRAUD HELPER FOR UZBEKISTAN" }[lang]}

            </p>
            <nav aria-label="Footer" className="flex items-center gap-4 sm:gap-8 shrink-0">
              <Link to="/" className="footer-link apex-mono">
                {{ ru: "ПРИВАТНОСТЬ", uz: "MAXFIYLIK", en: "PRIVACY" }[lang]}
              </Link>
              <Link to="/" className="footer-link apex-mono">
                {{ ru: "ПОМОЩЬ", uz: "YORDAM", en: "HELP" }[lang]}
              </Link>
            </nav>
          </div>
        </footer>

      </div>

      {/* Mobile sticky CTA — visible only when the check form is off-screen */}
      <div
        aria-hidden={formVisible || !!homeResult}
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-[#FCFAF9] via-[#FCFAF9]/95 to-[#FCFAF9]/0 transition-all duration-300 ${
          formVisible || homeResult ? "opacity-0 translate-y-3 pointer-events-none" : "opacity-100 translate-y-0"
        }`}
      >
        <button
          type="button"
          onClick={scrollToForm}
          className="fancy-btn w-full shadow-[0_10px_30px_-8px_rgba(194,65,12,0.45)]"
        >
          <FancyShell showArrow={false}>
            {{ ru: "Проверить номер или ссылку", uz: "Raqam yoki havolani tekshirish", en: "Check a number or link" }[lang]}
            <ArrowDown className="h-4 w-4" strokeWidth={2} />
          </FancyShell>
        </button>
      </div>
    </div>
  );
}

