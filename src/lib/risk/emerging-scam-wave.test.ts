import { describe, expect, it } from "vitest";

import { canVerifiedContactMarkSafe, evaluateText, scoreFromCodes } from "./rules";

describe("emerging scam wave — authority-coerced dangerous physical acts", () => {
  const positives = [
    "Мне написали из налоговой и пригрозили уголовным делом. Приказали поджечь заправку.",
    "Сотрудник МВД заставляет оставить пакет у входа в школу, иначе меня арестуют.",
    "Из прокуратуры велели перерезать кабель камеры и никому не говорить.",
    "Мне написали из нaлоговой.\nЕсли не пoджечь АЗС, заведут уголовное дело.",
    "Soliq idorasidanmiz deb yozishdi. Aks holda jinoiy ish ochamiz deb, yoqilg'i shoxobchasiga o't qo'yishni buyurishdi.",
    "IIB xodimi deb tanishtirdi. Sumkani maktab kirishida tashlab ketishga majburlayapti.",
    "Прокуратураданмиз деб ёзишди. Камера кабелини узиб ташлашни буюришяпти.",
    "Солиқ идорасиданмиз дейишди.\nЁқилғи шохобчасини ёқиб юборишга мажбурлашяпти.",
    "Someone claiming to be law enforcement threatened a criminal case and ordered me to set fire to a gas station.",
    "A police officer in chat told me to leave a backpack at the school entrance or else I would be arrested.",
    "The tax inspector is forcing me to disable the security camera and cut its cable.",
    "They claimed to be the pоlice.\nCarry this package to the gas station, or else they will open a criminal case.",
  ] as const;

  it.each(positives)("flags a live coercion report: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("authority_coerced_dangerous_act");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  const negatives = [
    "Учебный пример: налоговая якобы приказала поджечь заправку — так действуют мошенники.",
    "Security training example: fake police may order someone to leave a package at a school.",
    "O'quv materiali: soxta soliq xodimi yoqilg'i shoxobchasiga o't qo'yishni buyurishi mumkin.",
    "Полиция предупреждает: никогда не поджигайте здания и не оставляйте чужие пакеты.",
    "Law enforcement says never carry an unknown package or damage public equipment.",
    "IIB ogohlantiradi: begona sumkani olib bormang va kamerani buzmang.",
    "Полиция попросила привезти опечатанный пакет с уликами в отделение.",
    "The police asked the courier to deliver an evidence box to the police station.",
    "Soliq idorasi korxonaga eski uskunani qonuniy tartibda almashtirish haqida xat yubordi.",
    "Пожарные проводят учебное занятие на закрытом полигоне.",
  ] as const;

  it.each(negatives)("keeps education, safety, and ordinary official work negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("authority_coerced_dangerous_act");
  });
});

describe("emerging scam wave — paid erasure of traffic penalty points", () => {
  const positives = [
    "Предлагают за 500 тысяч сум обнулить штрафные баллы, деньги просят перевести на карту.",
    "Пишут, что удалят штрафние баллы за оплату 2 миллиона сум.",
    "Штрафные баллы можно убрать.\nЗаплати нам 700 000 сум, и всё обнулим.",
    "Jarima ballarini pul evaziga o'chirib beramiz, 500 ming so'm to'lang.",
    "Vositachi 800 ming so'mga jarima ballarimni nol qilib, pulni kartasiga o'tkazishni so'radi.",
    "Yo'l qoidasi bo'yicha ballarni nolga tushiramiz. Pulni kartaga o'tkazing.",
    "Жарима балларини 500 минг сўмга ўчириб берамиз.",
    "Йўл қоидаси балларини бекор қиламиз.\nПулни картага ўтказинг.",
    "Pay us a fee and we will erase your traffic penalty points.",
    "They offered to clear my driving penalty points for a 2,000,000 soum payment.",
    "Traffic penalty points reset service.\nTransfer 500,000 soum and we delete them today.",
    "They can remоve traffic penalty points for mоney, send the payment now.",
  ] as const;

  it.each(positives)("keeps the specific paid-erasure evidence: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("fake_penalty_points_erasure");
    expect(["suspicious", "high_risk"]).toContain(scoreFromCodes(reasons).level);
  });

  const negatives = [
    "МВД предупреждает: обнулить штрафные баллы за деньги невозможно, это мошенничество.",
    "Не платите тем, кто обещает удалить штрафные баллы.",
    "Обычный дорожный штраф я оплатил через официальное приложение банка.",
    "Штрафные баллы истекают автоматически в предусмотренный законом срок.",
    "Постановление можно обжаловать в официальном порядке через суд.",
    "Traffic penalty points cannot be erased for money. Do not pay such offers.",
    "I paid a legitimate traffic fine through the official government portal.",
    "Jarima ballarini pulga o'chirishning iloji yo'q — bu firibgarlik.",
    "Jarimani rasmiy bank ilovasida to'ladim.",
    "Жарима балларини пулга ўчириб бўлмайди, пул тўламанг.",
  ] as const;

  it.each(negatives)(
    "does not confuse warnings or official processes with the scam: %s",
    (text) => {
      expect(evaluateText(text)).not.toContain("fake_penalty_points_erasure");
    },
  );
});

describe("emerging scam wave — neighbor/security-camera attachment bait", () => {
  const positives = [
    "Соседи прислали ссылку: открой, там видео с камеры у подъезда.",
    "Открой прикреплённый файл — якобы видео от соседей с камеры во дворе.",
    "Qo'shni yuborgan havolani och, unda kuzatuv kamerasi videosi bor deyapti.",
    "Kuzatuv kamerasi videosi emish. Biriktirilgan faylni yuklab oching.",
    "Қўшни юборган ҳаволани очинг, унда кузатув камераси видеоси бор дейишяпти.",
    "Open the attached file; they say it is security-camera video from the neighbors.",
    "Download the archive from this link to see the neighbor's doorbell-camera video.",
    "Neighbоr camera footage.\nOpen the attached fіle to watch it.",
  ] as const;

  it.each(positives)("flags only an attachment/link open request: %s", (text) => {
    expect(evaluateText(text)).toContain("malicious_file_bait");
  });

  const negatives = [
    "Сосед прислал обычное видео прямо в чате, я посмотрел его во встроенном плеере.",
    "Мы обсуждаем видео с камеры во дворе, никаких файлов и ссылок нет.",
    "Qo'shnim video xabar yubordi, uni Telegram ichida ko'rdim.",
    "Қўшним оддий видео хабар юборди, ҳавола йўқ.",
    "My neighbor sent a native video message in the chat player.",
    "We had a video call with the building security guard.",
    "Не открывайте вложение с якобы видео от соседей и не переходите по ссылке.",
    "Do not download a link claiming to contain neighbor security-camera footage.",
  ] as const;

  it.each(negatives)("does not label native video or safety advice as a file lure: %s", (text) => {
    expect(evaluateText(text)).not.toContain("malicious_file_bait");
  });
});

describe("emerging scam wave — ROAD24 / 100% cashback fine-payment APK", () => {
  const positives = [
    "Мне прислали ROAD24.apk для оплаты штрафа и сказали установить файл.",
    "100% CASHBACK за оплату штрафов.\nСкачайте APK-файл и откройте его.",
    "Jarimani cashback bilan to'lash uchun ROAD24 APK faylini o'rnating deyishdi.",
    "100 foiz cashback va jarima to'lovi uchun yuborilgan APK faylni oching.",
    "Жаримани тўлаш учун ROAD24 APK файлини ўрнатинг дейишди.",
    "Install the ROAD24.apk file they sent to pay a traffic fine with cashback.",
    "100% CASHBACK on fine payments. Download and open this APK file.",
    "RОAD24.аpk\nОткрой файл для оплаты штрaфа.",
  ] as const;

  it.each(positives)("emits both APK and malicious-file evidence: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("malicious_file_bait");
  });

  const negatives = [
    "МВД предупреждает: не устанавливайте ROAD24.apk и не открывайте APK ради оплаты штрафа.",
    "Do not install the ROAD24 APK; fake cashback files may be malicious.",
    "ROAD24 — название в статье о вредоносных APK, никаких файлов я не открывал.",
    "Я оплатил штраф через официальное приложение банка из Google Play, APK мне не присылали.",
    "Jarimani rasmiy ilovada to'ladim, APK fayl yuklamadim.",
  ] as const;

  it.each(negatives)("keeps warnings and official-store payments negative: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("malicious_file_bait");
    expect(reasons).not.toContain("asks_to_install_apk");
  });
});

describe("emerging scam wave — known-contact bank giveaway links", () => {
  const positives = [
    "Знакомый пишет: я уже получил подарок 70 000 сум от National Bank, ты тоже забирай по ссылке.",
    "Друг переслал: денежный подарок от банка. Открой ссылку и получи свой.",
    "Tanishim yubordi: National Bank 70 000 so'm sovg'a beryapti, havolani ochib olib qol.",
    "Танишим юборди: банк 70 000 сўм совға берармиш, ҳаволани очиб олинг.",
    "A friend says they already received a cash gift from the bank; open the link and claim yours.",
    "Known contact forwarded a bank prize.\nGet yours through this link.",
  ] as const;

  it.each(positives)("does not let familiarity erase giveaway evidence: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("giveaway_engagement_bait");
    expect(canVerifiedContactMarkSafe([...reasons, "verified_official"])).toBe(false);
    expect(scoreFromCodes([...reasons, "verified_official"]).level).not.toBe("safe");
  });

  const negatives = [
    "На официальном сайте банка опубликованы итоги розыгрыша и объявлены победители.",
    "Банк предупреждает: не переходите по ссылкам из сообщений ради денежного подарка.",
    "Official bank announcement: giveaway winners have been announced on the bank website.",
    "Do not open a link claiming a cash gift from a bank.",
    "Bankning rasmiy saytida yutuq g'oliblari e'lon qilindi.",
    "Bank ogohlantiradi: sovg'a uchun kelgan havolani ochmang.",
  ] as const;

  it.each(negatives)("keeps official results and warnings negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("giveaway_engagement_bait");
  });
});
