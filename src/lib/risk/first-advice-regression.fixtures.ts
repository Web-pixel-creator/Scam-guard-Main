// Synthetic user reports shared by rule and webhook tests; no real identifiers.
const ruCall = "Мне позвонил оператор и попросил набрать команду на телефоне.";
const uzCall = "Operator qo‘ng‘iroq qilib, telefonda buyruq terishimni so‘radi.";
const cyCall = "Оператор қўнғироқ қилиб, телефонда буйруқ теришимни сўради.";
const charge = "С моей банковской карты списали деньги без моего разрешения.";
const bank = /банк.{0,110}(?:оспор|списани|операци)/iu;
const uzBank = /bank.{0,120}(?:operatsiya|to‘lov|yechib)/iu;
export const mixedIncidents = [
  ["ru", "С моей банковской карты списали 200 000 сумов без моего разрешения.", [bank]],
  ["uz", "Картамдан рухсатсиз 200 минг сўм ечилди.", [uzBank]],
  [
    "ru",
    ruCall +
      " Я уже набрал её. С моей банковской карты списали 200 000 сумов без моего разрешения.",
    [bank],
  ],
  ["ru", ruCall.slice(0, -1) + "\n" + charge, [bank]],
  ["uz", uzCall + " Kartamdan ruxsatsiz 200 ming so‘m yechildi.", [uzBank]],
  ["uz", cyCall + " Картамдан рухсатсиз 200 минг сўм ечилди.", [uzBank]],
  ["ru", ruCall.slice(0, -1) + " и назвать код из SMS.", [/не набирайте/iu, /не сообщайте SMS/iu]],
  [
    "uz",
    "Operator telefonda buyruq terishimni va SMS kodini aytishimni so‘radi.",
    [/termang/iu, /SMS.{0,22}aytmang/iu],
  ],
  [
    "uz",
    "Оператор телефонда буйруқ теришимни ва СМС кодини айтишимни сўради.",
    [/termang/iu, /SMS.{0,22}aytmang/iu],
  ],
  [
    "ru",
    "После памятки мне позвонил оператор и попросил набрать команду на телефоне.",
    [/не набирайте команду/iu],
  ],
  ["ru", ruCall + " Я её уже набрала, что делать?", [/проверить.{0,45}настройки/iu]],
  ["ru", ruCall + " " + charge + " Ещё просят назвать код из SMS.", [bank, /не сообщайте SMS/iu]],
  ["ru", ruCall + " Я уже набрал её. " + charge, [bank]],
  ["ru", charge + " " + ruCall, [bank]],
  ["ru", ruCall + " С карты уже сняли деньги без моего согласия, что мне теперь делать?", [bank]],
  ["uz", uzCall + " Kartamdan pul ruxsatsiz yechildi, endi nima qilay?", [uzBank]],
  ["ru", "У меня только что списали деньги без разрешения. " + ruCall, [bank]],
  ["ru", "Позвонила внучка и попросила срочно перевести ей деньги. " + charge, [bank]],
  ["uz", uzCall + " Kartamdan ruxsatsiz pul yechildi.", [uzBank]],
  ["uz", cyCall + " Картамдан рухсатсиз пул ечилди.", [uzBank]],
  [
    "ru",
    ruCall + " Ещё просят назвать код из SMS.",
    [/не набирайте/iu, /(?:не сообщайте|никому не говорите).{0,16}SMS/iu],
  ],
  ["uz", uzCall + " SMS kodini ham aytishimni so‘rashdi.", [/termang/iu, /SMS.{0,22}aytmang/iu]],
  ["uz", cyCall + " СМС кодини ҳам айтишимни сўрашди.", [/termang/iu, /SMS.{0,22}aytmang/iu]],
  [
    "ru",
    "Я уже читал памятку, но сейчас мне позвонил оператор и попросил набрать команду на телефоне.",
    [/не набирайте команду/iu],
  ],
  ["ru", ruCall + " Я уже набрал её, что делать?", [/проверить.{0,45}настройки/iu]],
  ["uz", uzCall + " Men uni allaqachon terdim, endi nima qilay?", [/sozlamalari.{0,50}tekshir/iu]],
  ["uz", cyCall + " Мен уни аллақачон тердим, энди нима қилай?", [/sozlamalari.{0,50}tekshir/iu]],
] as const;
export const changedSpeakers = [
  "Набирам телефон қилди\nБанк зудлик билан пул сўради.",
  "Nabiram telefon qildi\nBank zudlik bilan pul so‘radi.",
  "Nabiram telefon qildi. Bank zudlik bilan pul so‘radi.",
  "Набирам телефон қилди. Банк зудлик билан пул сўради.",
  "Nabiram telefon qildi, bank xodimi zudlik bilan pul so‘radi.",
] as const;
