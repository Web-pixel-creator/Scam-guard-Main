import { createFileRoute } from "@tanstack/react-router";
import { Smartphone, KeyRound, Banknote, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useLang } from "@/lib/lang-context";

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
    { icon: KeyRound, title: "SMS-kod / OTP yuborib qo‘yganman", steps: [
      "Karta orqa tomonidagi raqam bo‘yicha bankka darhol qo‘ng‘iroq qiling.",
      "Karta va onlayn-bankni bloklang, parolni o‘zgartiring.",
      "Telegram → Sozlamalar → Qurilmalar bo‘limida begona seanslarni yopib qo‘ying.",
      "Yozishmalar skrinshotini va raqamni saqlang.",
      "Ishonch Guard’ga xabar bering.",
    ]},
    { icon: Smartphone, title: "APK / ilova o‘rnatib qo‘yganman", steps: [
      "Wi-Fi va mobil internetni o‘chirib qo‘ying.",
      "Shubhali ilova va u bilan bog‘liq narsalarni o‘chiring.",
      "Boshqa qurilmadan bank, pochta va Telegram parollarini almashtiring.",
      "Ikki bosqichli himoyani yoqing.",
      "Eng yaxshisi — qurilmani zavod sozlamalariga qaytaring.",
      "Bankka qo‘ng‘iroq qilib, xavf haqida xabar bering.",
    ]},
    { icon: Banknote, title: "Pul o‘tkazib yubordim", steps: [
      "Darhol bankka qo‘ng‘iroq qilib, o‘tkazmani qaytarishga urinib ko‘ring.",
      "Hamma narsani saqlang: chek, skrinshot, raqam, Telegram, havolalar.",
      "Huquq idoralariga ariza yozing — qancha tez bo‘lsa, shuncha yaxshi.",
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
      "Enable two-factor where it isn’t on yet.",
      "A factory reset and restoring a clean backup is the safest path.",
      "Call your bank to report a possible compromise.",
    ]},
    { icon: Banknote, title: "I transferred money", steps: [
      "Call your bank immediately and ask them to try to recall the transfer.",
      "Save everything: receipt, screenshots, phone, Telegram, links.",
      "File a police report — the sooner, the better the chance of recovery.",
      "Do not keep chatting with the scammer; do not pay any “recovery fee”.",
    ]},
  ],
} as const;

function EmergencyPage() {
  const { lang } = useLang();
  const guides = GUIDES[lang];
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-danger/10 text-danger shrink-0">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {{ ru: "Срочные шаги", uz: "Shoshilinch qadamlar", en: "Emergency steps" }[lang]}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {{ ru: "Сделайте сейчас — порядок важен. Каждая минута увеличивает шанс защитить деньги и аккаунты.",
               uz: "Hozir bajaring — tartib muhim. Har bir daqiqa pul va hisoblarni saqlash imkonini oshiradi.",
               en: "Do this now — order matters. Every minute increases your chance to protect money and accounts." }[lang]}
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-5">
        {guides.map((g) => (
          <Card key={g.title} className="p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary">
                <g.icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">{g.title}</h2>
            </div>
            <ol className="mt-4 space-y-2 list-decimal pl-5 text-sm">
              {g.steps.map((s, i) => (<li key={i}>{s}</li>))}
            </ol>
          </Card>
        ))}
      </div>
    </div>
  );
}
