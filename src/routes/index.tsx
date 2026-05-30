import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageSquare, Link2, FileWarning, ArrowRight, Sparkles, Users, ShieldAlert, ShieldCheck, AlertTriangle, MapPin } from "lucide-react";
import { CheckInput } from "@/components/CheckInput";
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
    ],
  }),
  component: Index,
});

function Index() {
  const { lang } = useLang();
  return (
    <div className="overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 space-y-14 md:space-y-20 lg:space-y-24 pt-3 md:pt-4">

        {/* HERO v2 — minimal centered editorial with vertical gradient rule */}
        <section className="relative isolate pt-1 md:pt-2">
          {/* Title block — laconic, generous whitespace */}
          <div className="relative max-w-5xl mx-auto pt-4 md:pt-6 pb-2">
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
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E2E0D8] bg-white/85 backdrop-blur-sm text-[10px] font-semibold tracking-[0.22em] uppercase text-[#52525B] mb-8 animate-fade-in-up font-mono shadow-[0_1px_0_rgba(11,11,15,0.02)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Anti-Scam Intelligence
              </div>

              <h1 className="font-display font-extrabold tracking-[-0.025em] leading-[1.1] text-[38px] sm:text-5xl md:text-6xl lg:text-[72px] animate-fade-in-up text-foreground max-w-3xl mx-auto text-center">
                {{
                  ru: <>Проверьте до того,<br /><span className="relative inline-block text-foreground/55">как обманут.<span aria-hidden className="absolute left-0 right-0 -bottom-1 md:-bottom-1.5 h-[2px] bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent rounded-full" /></span></>,
                  uz: <>Aldanmasdan oldin<br /><span className="relative inline-block text-foreground/55">tekshiring.<span aria-hidden className="absolute left-0 right-0 -bottom-1 md:-bottom-1.5 h-[2px] bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent rounded-full" /></span></>,
                  en: <>Check it before<br /><span className="relative inline-block text-foreground/55">you get scammed.<span aria-hidden className="absolute left-0 right-0 -bottom-1 md:-bottom-1.5 h-[2px] bg-gradient-to-r from-transparent via-[#F97316]/70 to-transparent rounded-full" /></span></>,
                }[lang]}
              </h1>

              <p className="mt-8 md:mt-10 text-[15px] md:text-[16px] text-foreground/65 max-w-lg mx-auto leading-[1.55] text-center animate-fade-in-up">
                {{
                  ru: "Оценка риска для номера, ссылки или сообщения — за секунды.",
                  uz: "Raqam, havola yoki xabar uchun xavf bahosi — soniyalarda.",
                  en: "Risk score for a number, link or message — in seconds.",
                }[lang]}
              </p>

              <div className="mt-7 md:mt-8 flex items-center justify-center gap-5 animate-fade-in-up">
                <Link to="/check" className="fancy-btn">
                  <FancyShell>
                    {{ ru: "Проверить", uz: "Tekshirish", en: "Check now" }[lang]}
                  </FancyShell>
                </Link>
                <Link
                  to="/report"
                  className="text-[12px] font-semibold tracking-[0.15em] uppercase text-[#52525B] underline-offset-4 decoration-[#E2E0D8] hover:text-[#18181B] hover:underline hover:decoration-[#F97316] transition-colors"
                >
                  {{ ru: "Сообщить о мошеннике", uz: "Firibgarni xabar qilish", en: "Report a scammer" }[lang]}
                </Link>
              </div>
            </div>
          </div>





          {/* Bloom band with form centered on top — animation stretches with content */}
          <div className="w-full max-w-[1200px] mx-auto mt-10 mb-6 animate-fade-in-up">
            <div className="bloom-band rounded-[28px] min-h-[460px] md:min-h-[520px]">
              <div
                aria-hidden
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
                }}
              />
              <div className="relative z-10 flex items-center justify-center px-4 md:px-10 py-10 md:py-14 min-h-[460px] md:min-h-[520px]">
                <div className="w-full max-w-3xl cta-glow rounded-[8px]">
                  <CheckInput />
                </div>
              </div>
            </div>
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
                {[
                  "Безопасный счёт", "Bank security call", "Fake APK", "OTP request", "Telegram loan",
                  "Soxta kuryer", "Prize phishing", "Crypto doubler", "Job offer scam", "Romance scam",
                  "Безопасный счёт", "Bank security call", "Fake APK", "OTP request",
                ].map((w, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-12 text-xl md:text-2xl font-sans font-medium tracking-tight text-[#71717A]">
                    {w}
                    <span className="text-[#F97316] text-2xl md:text-3xl">×</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>


        {/* CAPABILITIES — APEX grid inside a striped frame with corner ticks */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">BUILD V3.1 · CAPABILITIES</span>
            <span className="apex-mono text-right">CORE SYSTEMS: ONLINE</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <div className="max-w-3xl">
              <p className="label-md mb-4">02 — {{ ru: "Возможности", uz: "Imkoniyatlar", en: "Capabilities" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B]">
                {{
                  ru: <>Что <span className="font-serif-italic text-[#8B8B92]">можно</span> проверить</>,
                  uz: <>Nimani <span className="font-serif-italic text-[#8B8B92]">tekshirish</span> mumkin</>,
                  en: <>What you <span className="font-serif-italic text-[#8B8B92]">can</span> check</>,
                }[lang]}
              </h2>
            </div>
            <span className="hidden md:block apex-mono shrink-0">04 / 04</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {[
              { i: Phone, accent: "#F97316", k: { ru: "Номер телефона", uz: "Telefon raqami", en: "Phone number" },
                d: { ru: "«Банки», «операторы» или анонимные мошенники.", uz: "«Bank», «operator» yoki noma'lum raqamlar.", en: "“Banks”, “operators” or anonymous scammers." } },
              { i: MessageSquare, accent: "#FB923C", k: { ru: "Telegram-аккаунт", uz: "Telegram hisob", en: "Telegram account" },
                d: { ru: "Боты, каналы или псевдо-менеджеры банков.", uz: "Botlar, kanallar yoki soxta menejerlar.", en: "Bots, channels or fake account managers." } },
              { i: Link2, accent: "#C2410C", k: { ru: "Ссылки и сайты", uz: "Havolalar va saytlar", en: "Links & sites" },
                d: { ru: "Фишинг, ложные оплаты и вредоносные APK.", uz: "Fishing, soxta to'lovlar va zararli APK.", en: "Phishing, fake payments and malicious APKs." } },
              { i: FileWarning, accent: "#F97316", k: { ru: "Текст SMS / Telegram", uz: "SMS / Telegram matni", en: "SMS / Telegram text" },
                d: { ru: "Анализ сообщений на признаки соц. инженерии.", uz: "Xabarlarni ijtimoiy muhandislik belgilariga tekshirish.", en: "Analyze messages for social engineering patterns." } },
            ].map((c, idx) => (
              <div key={c.k.en} className="relative bg-white/85 backdrop-blur-[4px] p-7 sm:p-8 md:p-10 overflow-hidden min-h-[260px] md:min-h-[280px] flex flex-col">
                <span className="absolute top-6 right-6 apex-mono">0{idx + 1}</span>
                <div className="flex items-center justify-center w-10 h-10 rounded-[3px] border border-[#E2E0D8] mb-10 md:mb-12 transition-colors" style={{ color: c.accent }}>
                  <c.i aria-hidden="true" focusable="false" className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <h3 className="font-sans text-[17px] font-medium mb-3 tracking-tight text-[#18181B] text-balance">{c.k[lang]}</h3>
                <p className="card-body">{c.d[lang]}</p>
              </div>
            ))}
          </div>
        </section>



        {/* HOW IT WORKS — APEX striped surface panel */}
        <section className="apex-frame apex-stripes relative overflow-hidden border border-[#E2E0D8] bg-[#F4F2EB] rounded-[6px]">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#C2410C] z-[1]" />
          <div className="relative p-6 sm:p-10 md:p-14">
            <div className="flex items-start justify-between gap-4 mb-6">
              <span className="apex-mono">SYS · ALGORITHM</span>
              <span className="apex-mono text-right">03 / 03 STEPS</span>
            </div>
            <div className="mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
              <p className="label-md mb-4">03 — {{ ru: "Алгоритм", uz: "Algoritm", en: "Algorithm" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] max-w-3xl text-balance">{t("how_it_works", lang)}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
              {[
                { i: "01", t: t("step_1", lang), d: t("step_1_d", lang) },
                { i: "02", t: t("step_2", lang), d: t("step_2_d", lang) },
                { i: "03", t: t("step_3", lang), d: t("step_3_d", lang) },
              ].map((s) => (
                <div key={s.i} className="bg-[#F4F2EB] p-8 sm:p-10 md:p-12 apex-stripes min-h-[260px] md:min-h-[280px] flex flex-col gap-6 md:gap-8">
                  <span className="block font-sans text-5xl md:text-6xl font-medium tracking-[-0.05em] text-[#D4D1C6] leading-none tabular-nums">{s.i}</span>
                  <h3 className="font-sans text-[19px] md:text-xl font-medium tracking-tight text-[#18181B] text-balance">{s.t}</h3>
                  <p className="card-body">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* EXAMPLE — APEX striped frame around the demo */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[6px] p-6 sm:p-10 md:p-14 bg-white/55">
          <div className="flex items-start justify-between gap-4 mb-6">
            <span className="apex-mono">CASE STUDY · DEMO</span>
            <span className="apex-mono text-right">RISK · LIVE</span>
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
                <p className="text-[14px] md:text-[15px] text-[#52525B] leading-[1.7] max-w-[52ch] text-pretty">
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
                      <span className="bg-gradient-to-r from-[#F97316] via-[#FB923C] to-[#C2410C] bg-clip-text text-transparent">Risk score · 98%</span>
                    </p>
                    <h3 className="font-sans text-[28px] sm:text-3xl md:text-4xl font-medium tracking-[-0.05em] text-[#18181B] leading-[1.05]">{t("risk_high", lang)}</h3>
                    <p className="mt-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-[3px] bg-[#FEF2F2] border border-[#FCA5A5]/60 text-[#991B1B] text-[11px] font-medium tracking-[0.08em] uppercase">
                      <span className="font-mono text-[10px] text-[#DC2626]">SCAM</span>
                      <span className="h-3 w-px bg-[#FCA5A5]/70" />
                      <span>{{ ru: "Вишинг · OTP-фрод", uz: "Vishing · OTP-firibgar", en: "Vishing · OTP fraud" }[lang]}</span>
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-[3px] border border-[#E2E0D8] flex items-center justify-center text-[#F97316] shrink-0">
                    <ShieldAlert aria-hidden="true" focusable="false" className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-10">
                  <div>
                    <p className="label-md mb-5">{t("why_title", lang)}</p>
                    <ul className="space-y-3.5 text-[14px] md:text-[15px] text-[#18181B] leading-[1.55]">
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
            <span className="apex-mono">DB · SCAM CASES</span>
            <span className="apex-mono text-right">INDEX 06 / 06</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 md:gap-6 mb-10 md:mb-12 pb-6 md:pb-8 border-b border-[#E2E0D8]">
            <div className="max-w-3xl">
              <p className="label-md mb-4">05 — {{ ru: "База знаний", uz: "Bilimlar bazasi", en: "Knowledge base" }[lang]}</p>
              <h2 className="font-sans font-medium text-[34px] sm:text-5xl md:text-6xl tracking-[-0.05em] leading-[1.02] text-[#18181B] text-balance">{t("schemes_title", lang)}</h2>
            </div>
            <span className="hidden md:block apex-mono shrink-0">06 cases</span>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {([
              { n: "01", ru: "«Служба безопасности банка»", uz: "«Bank xavfsizlik xizmati»", en: "Bank security call",
                d_ru: "Звонят якобы из банка, говорят о подозрительной операции и просят SMS-код.", d_uz: "Bank nomidan qo'ng'iroq qilib, SMS-kod so'rashadi.", d_en: "They call “from the bank” and ask for your SMS code." },
              { n: "02", ru: "APK от мнимого банка", uz: "Soxta bank APK", en: "Fake bank APK",
                d_ru: "Просят установить «безопасное приложение» — оно крадёт SMS и данные.", d_uz: "«Xavfsiz ilova» o'rnatishni so'rashadi — u SMS o'g'irlaydi.", d_en: "They push a “safe app” that steals SMS and data." },
              { n: "03", ru: "Безопасный счёт", uz: "Xavfsiz hisob", en: "Safe account",
                d_ru: "Уговаривают перевести деньги на «безопасный счёт». Их не существует.", d_uz: "«Xavfsiz hisob»ga pul o'tkazishga undashadi.", d_en: "They push you to move money to a “safe account”." },
              { n: "04", ru: "Лёгкий кредит в Telegram", uz: "Telegram'dagi oson kredit", en: "Easy Telegram loan",
                d_ru: "Telegram-канал обещает быстрый кредит, просит предоплату.", d_uz: "Telegram kanali kredit va'da qilib oldindan to'lov so'raydi.", d_en: "A Telegram channel promises a quick loan, asks a fee upfront." },
              { n: "05", ru: "Фейковая доставка", uz: "Soxta yetkazib berish", en: "Fake delivery",
                d_ru: "«Курьер» отправляет ссылку для оплаты доставки — это фишинг карты.", d_uz: "«Kuryer» to'lov havolasini yuboradi — bu fishing.", d_en: "A “courier” sends a payment link — card phishing." },
              { n: "06", ru: "Выигрыш / приз", uz: "Yutuq / sovrin", en: "Prize won",
                d_ru: "Сообщают о выигрыше и просят данные карты для «зачисления».", d_uz: "Yutuq haqida xabar berib karta ma'lumotlarini so'rashadi.", d_en: "They claim you won and ask for card details." },
            ] as const).map((s) => (
              <div key={s.en} className="bg-white/85 backdrop-blur-[4px] p-8 sm:p-10 md:p-12 min-h-[260px] md:min-h-[280px] flex flex-col">
                <div className="flex items-center gap-3 mb-8">
                  <span className="apex-mono">CASE #{s.n}</span>
                  <span className="flex-1 h-px bg-[#E2E0D8]" />
                </div>
                <h3 className="font-sans text-[18px] md:text-[19px] font-medium mb-4 tracking-tight text-[#18181B] leading-[1.3] text-balance">{s[lang]}</h3>
                <p className="card-body">
                  {(s as never as Record<string, string>)["d_" + lang]}
                </p>
              </div>

            ))}
          </div>
        </section>


        {/* CTA pair — APEX: one gradient-shell (emergency), one flat surface (community) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          <div className="apex-shell">
            <div className="relative bg-white p-7 sm:p-9 md:p-11 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <span className="label-md text-[#F97316]">[ Emergency ]</span>
                <AlertTriangle aria-hidden="true" focusable="false" className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
              </div>
              <h3 className="font-sans text-[28px] sm:text-3xl md:text-4xl font-medium tracking-[-0.05em] leading-[1.05] mb-5 text-[#18181B] text-balance">{t("emergency_title", lang)}</h3>
              <p className="text-[#52525B] text-[14px] md:text-[15px] leading-[1.7] mb-8 max-w-[44ch] text-pretty">
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
              <span className="label-md">[ Community ]</span>
              <Users aria-hidden="true" focusable="false" className="h-5 w-5 text-[#C2410C]" strokeWidth={1.5} />
            </div>
            <h3 className="font-sans text-[28px] sm:text-3xl md:text-4xl font-medium tracking-[-0.05em] leading-[1.05] mb-5 text-[#18181B] text-balance">
              {{ ru: "Помогите защитить других", uz: "Boshqalarni himoya qiling", en: "Help protect others" }[lang]}
            </h3>
            <p className="text-[#52525B] text-[14px] md:text-[15px] leading-[1.7] mb-8 max-w-[44ch] text-pretty">
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
                BUILD V3.1
              </p>
              <p className="apex-mono flex items-center gap-2">
                <span className="relative inline-flex h-2 w-2 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-[#059669]/40 animate-ping" />
                  <span className="relative inline-block h-2 w-2 rounded-full bg-[#059669]" />
                </span>
                CORE SYSTEMS: ONLINE
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

          {/* Ghost wordmark */}
          <div className="apex-wordmark text-[26vw] md:text-[18vw] leading-none select-none pointer-events-none mb-12 sm:mb-16">
            ISHONCH.
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
              {{ ru: "ISHONCH GUARD — АНТИ-СКАМ АССИСТЕНТ ДЛЯ УЗБЕКИСТАНА",
                 uz: "ISHONCH GUARD — O'ZBEKISTON UCHUN ANTI-SCAM YORDAMCHI",
                 en: "ISHONCH GUARD — ANTI-SCAM ASSISTANT FOR UZBEKISTAN" }[lang]}
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
    </div>
  );
}

