import { createFileRoute, Link } from "@tanstack/react-router";
import { Smartphone, KeyRound, Banknote, ShieldAlert, ArrowRight } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { FancyShell } from "@/components/FancyButton";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Срочные шаги — Ishonch Guard" },
      { name: "description", content: "Если вы уже отправили SMS-код, установили APK или перевели деньги — конкретные шаги что делать прямо сейчас." },
      { property: "og:title", content: "Срочные шаги — Ishonch Guard" },
    ],
  }),
  component: EmergencyPage,
});

const GUIDES = {
  ru: [
    { icon: KeyRound, title: "Отправил SMS-код / OTP", steps: [
      "Срочно позвоните в банк по номеру с обратной стороны карты.",
      "Заблокируйте карту и онлайн-банк, смените пароль.",
      "Проверьте активные сессии в Telegram (Настройки → Устройства) и завершите чужие.",
      "Сохраните скриншоты переписки и номер.",
      "Сообщите о случае в Ishonch Guard.",
    ]},
    { icon: Smartphone, title: "Установил APK / приложение", steps: [
      "Отключите интернет (Wi-Fi и мобильный) на устройстве.",
      "Удалите подозрительное приложение и связанные с ним.",
      "С другого устройства смените пароли банка, почты и Telegram.",
      "Включите двухфакторку, где её ещё нет.",
      "Лучше сделать сброс к заводским настройкам и восстановить чистый бэкап.",
      "Позвоните в банк и сообщите о возможной компрометации.",
    ]},
    { icon: Banknote, title: "Перевёл деньги", steps: [
      "Сразу позвоните в свой банк и попросите попытаться отозвать перевод.",
      "Зафиксируйте всё: чек, скриншоты, номер телефона, Telegram, ссылки.",
      "Подайте заявление в правоохранительные органы — чем раньше, тем выше шанс возврата.",
      "Не продолжайте общение с мошенником, не отправляйте «комиссии за возврат».",
    ]},
  ],
  uz: [
    { icon: KeyRound, title: "SMS-kod / OTP yuborib qo'yganman", steps: [
      "Karta orqa tomonidagi raqam bo'yicha bankka darhol qo'ng'iroq qiling.",
      "Karta va onlayn-bankni bloklang, parolni o'zgartiring.",
      "Telegram → Sozlamalar → Qurilmalar bo'limida begona seanslarni yopib qo'ying.",
      "Yozishmalar skrinshotini va raqamni saqlang.",
      "Ishonch Guard'ga xabar bering.",
    ]},
    { icon: Smartphone, title: "APK / ilova o'rnatib qo'yganman", steps: [
      "Wi-Fi va mobil internetni o'chirib qo'ying.",
      "Shubhali ilova va u bilan bog'liq narsalarni o'chiring.",
      "Boshqa qurilmadan bank, pochta va Telegram parollarini almashtiring.",
      "Ikki bosqichli himoyani yoqing.",
      "Eng yaxshisi — qurilmani zavod sozlamalariga qaytaring.",
      "Bankka qo'ng'iroq qilib, xavf haqida xabar bering.",
    ]},
    { icon: Banknote, title: "Pul o'tkazib yubordim", steps: [
      "Darhol bankka qo'ng'iroq qilib, o'tkazmani qaytarishga urinib ko'ring.",
      "Hamma narsani saqlang: chek, skrinshot, raqam, Telegram, havolalar.",
      "Huquq idoralariga ariza yozing — qancha tez bo'lsa, shuncha yaxshi.",
      "Firibgar bilan suhbatni davom ettirmang, «komissiya» yubormang.",
    ]},
  ],
  en: [
    { icon: KeyRound, title: "I sent an SMS / OTP code", steps: [
      "Call the bank now using the number on the back of your card.",
      "Block the card and online banking, change your password.",
      "Open Telegram → Settings → Devices and terminate any unknown sessions.",
      "Save screenshots of the chat and the phone number.",
      "Report the case to Ishonch Guard.",
    ]},
    { icon: Smartphone, title: "I installed an APK / app", steps: [
      "Turn off Wi-Fi and mobile data on the device.",
      "Uninstall the suspicious app and anything related.",
      "From a different device, change bank, email and Telegram passwords.",
      "Enable two-factor where it isn't on yet.",
      "A factory reset and restoring a clean backup is the safest path.",
      "Call your bank to report a possible compromise.",
    ]},
    { icon: Banknote, title: "I transferred money", steps: [
      "Call your bank immediately and ask them to try to recall the transfer.",
      "Save everything: receipt, screenshots, phone, Telegram, links.",
      "File a police report — the sooner, the better the chance of recovery.",
      "Do not keep chatting with the scammer; do not pay any \u201Crecovery fee\u201D.",
    ]},
  ],
} as const;

function EmergencyPage() {
  const { lang } = useLang();
  const guides = GUIDES[lang];

  return (
    <div className="apex-page space-y-8 sm:space-y-10">
      {/* Header frame */}
      <div className="apex-card apex-frame apex-stripes relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#DC2626] via-[#F97316] to-[#FB923C] z-[1]" />
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono inline-flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#DC2626] opacity-60 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
            </span>
            SYS · EMERGENCY
          </span>
          <span className="apex-mono text-right">
            <span className="hidden xs:inline">PRIORITY · CRITICAL</span>
            <span className="xs:hidden">CRITICAL</span>
          </span>
        </div>

        <div className="max-w-3xl">
          <span className="pain-pill">
            <span className="pain-pill-dot" />
            {{ ru: "Уже отправили код или деньги? Действуйте сейчас", uz: "Kod yoki pul yuborib qo'ydingizmi? Hozir harakat qiling", en: "Sent a code or money? Act right now" }[lang]}
          </span>
          <p className="label-md mb-3 sm:mb-4">03 — {{ ru: "Срочные шаги", uz: "Shoshilinch qadamlar", en: "Emergency" }[lang]}</p>
          <h1 className="apex-h1">
            {{
              ru: <>Действовать <span className="font-serif-italic text-[#8B8B92]">сейчас</span></>,
              uz: <>Hozir <span className="font-serif-italic text-[#8B8B92]">harakat</span> qiling</>,
              en: <>Act <span className="font-serif-italic text-[#8B8B92]">right now</span></>,
            }[lang]}
          </h1>
          <p className="apex-lead mt-5 sm:mt-6">
            {{ ru: "Сделайте сейчас — порядок важен. Каждая минута увеличивает шанс защитить деньги и аккаунты.",
               uz: "Hozir bajaring — tartib muhim. Har bir daqiqa pul va hisoblarni saqlash imkonini oshiradi.",
               en: "Do this now — order matters. Every minute increases your chance to protect money and accounts." }[lang]}
          </p>
        </div>
      </div>

      {/* Guides — apex hairline grid */}
      <section className="apex-card apex-frame apex-stripes" style={{ background: "#F4F2EB" }}>
        <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
          <span className="apex-mono">PROTOCOLS · {guides.length.toString().padStart(2, "0")}</span>
          <span className="apex-mono text-right">
            <span className="hidden xs:inline">FOLLOW IN ORDER</span>
            <span className="xs:hidden">IN ORDER</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
          {guides.map((g, idx) => (
            <article key={g.title} className="bg-white/90 backdrop-blur-[4px] p-6 sm:p-8 md:p-10 flex flex-col min-h-[360px] md:min-h-[420px]">
              <div className="flex items-center justify-between mb-6 sm:mb-8">
                <span className="apex-mono">0{idx + 1}</span>
                <ShieldAlert className="h-3.5 w-3.5 text-[#DC2626]/70" strokeWidth={1.75} aria-hidden="true" focusable="false" />
              </div>
              <div className="flex items-center justify-center w-10 h-10 rounded-[3px] border border-[#E2E0D8] mb-6 sm:mb-8 text-[#F97316]">
                <g.icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" focusable="false" />
              </div>
              <h2 className="apex-h2 mb-5 sm:mb-6">{g.title}</h2>
              <ol className="space-y-2.5 sm:space-y-3 text-[14px] md:text-[14.5px] leading-[1.6] text-[#52525B]">
                {g.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="apex-mono text-[#A1A1AA] shrink-0 mt-[3px] tabular-nums">{(i + 1).toString().padStart(2, "0")}</span>
                    <span className="prose-pretty">{s}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>

        <div className="mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-[#E2E0D8] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <span className="apex-mono text-[#71717A]">
            {{ ru: "Поделитесь случаем — поможете другим", uz: "Holatni baham ko'ring — boshqalarga yordam berasiz", en: "Share the case — help others" }[lang]}
          </span>
          <Link to="/report" className="fancy-btn">
            <FancyShell>
              {{ ru: "Сообщить о мошеннике", uz: "Firibgarni xabar qilish", en: "Report a scammer" }[lang]}
            </FancyShell>
          </Link>
        </div>
      </section>
    </div>
  );
}
