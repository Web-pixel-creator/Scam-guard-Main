import { describe, expect, it } from "vitest";

import { evaluateText, scoreFromCodes } from "./rules";

describe("risk hardening — giveaway suppression stays clause-local", () => {
  it.each([
    "Банк предупреждает о мошенническом розыгрыше: ничего не открывайте. Но знакомый пишет: подарок 70 000 сум, открой ссылку и забирай.",
    "A bank warns that scammers promise cash gifts and says do not open links. However, a friend sent a cash gift: open the link and claim yours.",
    "Bank firibgarlar sovg'a va'da qilishidan ogohlantirdi, havolani ochmang. Lekin tanishim 70 000 so'm sovg'a yubordi: havolani ochib olib qol.",
    "Знакомый пишет: подарок 70 000 сум, открой ссылку и забирай. Банк отдельно предупреждает: мошенники обещают подарки, не открывайте ссылки.",
  ])("does not let a neighboring safety clause hide a live CTA: %s", (text) => {
    expect(evaluateText(text)).toContain("giveaway_engagement_bait");
  });

  it.each([
    "Официальные итоги розыгрыша опубликованы. Получите денежный подарок на официальном сайте.",
    "Rasmiy tanlov natijalari e'lon qilindi. Pul sovg'angizni rasmiy saytda olib oling.",
    "Official giveaway results are published. Get your cash gift on the official website.",
  ])("does not trust a self-declared official results page with a live claim CTA: %s", (text) => {
    expect(evaluateText(text)).toContain("giveaway_engagement_bait");
  });

  it.each([
    "Официальные итоги розыгрыша опубликованы; победители перечислены на официальной странице банка.",
    "Official giveaway results are published; the official bank page lists the winners.",
    "Rasmiy tanlov natijalari e'lon qilindi; g'oliblar rasmiy bank sahifasida ko'rsatilgan.",
    "Расмий танлов натижалари эълон қилинди; ғолиблар расмий банк саҳифасида кўрсатилган.",
    "Фирибгарлар банк номидан совға ваъда қилмоқда. Ҳаволани очманг ва совринни олманг.",
    "Официальные итоги опубликованы. Откройте официальную страницу банка через сохранённую закладку, чтобы посмотреть победителей.",
  ])("keeps official results and protective wording negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("giveaway_engagement_bait");
  });

  it.each([
    "Я получил подарок на день рождения.",
    "На свадьбе нам вручили подарок лично.",
    "Друг лично передал мне подарок.",
    "Tug'ilgan kunimda sovg'a oldim.",
    "To'yda bizga shaxsan sovg'a berishdi.",
    "Do'stim menga sovg'ani shaxsan berdi.",
    "I got a birthday gift.",
    "We received a wedding gift in person.",
    "A friend handed me a gift in person.",
  ])("keeps a completed personal gift outside giveaway bait: %s", (text) => {
    expect(evaluateText(text)).not.toContain("giveaway_engagement_bait");
  });
});

describe("risk hardening — fake fine APK requires untrusted provenance", () => {
  it.each([
    "Неизвестный прислал в Telegram файл ROAD24.apk: 100% кешбэк за оплату штрафа, сказал установить.",
    "Telegramda notanish odam ROAD24.apk faylini yubordi: jarimani 100% cashback bilan to'lash uchun o'rnating.",
    "A stranger sent ROAD24.apk in chat and asked me to install it for 100% cashback on a traffic fine.",
    "Неизвестный прислал «официальное приложение ROAD24.apk» в Telegram и просит установить для 100% кешбэка по штрафу.",
  ])("flags a messaged APK/cashback lure: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("malicious_file_bait");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Штраф оплачен в официальном приложении my.gov.uz. Квитанция сохранена.",
    "Я установил официальное приложение из Google Play и оплатил обычный дорожный штраф.",
    "Jarimani my.gov.uz rasmiy ilovasida to'ladim. Ilovani Google Play'dan o'rnatganman.",
    "Жаримани my.gov.uz расмий иловасида тўладим. Иловани Google Play орқали ўрнатганман.",
    "I paid the traffic fine in the official government app installed from Google Play; payment was successful.",
  ])("does not treat an ordinary official-app fine payment as an APK lure: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("asks_to_install_apk");
    expect(reasons).not.toContain("malicious_file_bait");
  });
});

describe("risk hardening — ordinary payments are not scam evidence by themselves", () => {
  it.each([
    "Переведите деньги на мою карту за ужин.",
    "Скинь мне половину за наше такси.",
    "Kechki ovqat uchun pulni kartamga o'tkazing.",
    "Taksi uchun o'z ulushingni yubor.",
    "Send me the payment for our shared bill.",
    "Please send your share of last night's dinner.",
    "Переведите сотруднику обычную зарплату по ведомости.",
    "Оплатите стандартный счёт компании по договору и сохраните квитанцию.",
    "Купи книги и переведи продавцу сумму заказа.",
    "Xodimning maoshini odatdagi ish haqi vedomosti bo'yicha o'tkazing.",
    "Buyurtma uchun rasmiy hisob-fakturani to'lang.",
    "Pay the normal company invoice under our signed contract.",
    "Send the scheduled salary payment through payroll.",
    "Pay for the book order in the store checkout.",
    "Арендодатель требует перевести сумму на эту карту по договору аренды.",
    "Поставщик требует оплатить обычный счёт компании по договору.",
    "Uy egasi ijara shartnomasi bo'yicha to'lovni shu hisobga o'tkazishni so'radi.",
    "Yetkazib beruvchi rasmiy hisob-fakturani to'lashni talab qiladi.",
    "The supplier requires payment to this account under the signed invoice.",
    "The landlord requires the rent payment to this account under our lease.",
    "Оплатите обычный счёт компании. Не переводите деньги незнакомцам.",
    "Pay the signed invoice. Do not transfer money to strangers.",
    "Rasmiy hisob-fakturani to'lang. Notanish odamlarga pul o'tkazmang.",
    "В сообщении от бухгалтерии сказано: оплатите обычный счёт поставщика по договору.",
    "Buxgalteriya xabarida rasmiy hisob-fakturani shartnoma bo'yicha to'lash so'ralgan.",
    "The message from accounting says to pay the normal supplier invoice under our contract.",
  ])("keeps a normal payment negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("asks_for_money_transfer");
  });

  it.each([
    "Неизвестный пишет: срочно переведите деньги на эту личную карту и никому не говорите.",
    "Begona odam pulni shaxsiy kartaga darhol o'tkazib, hech kimga aytmaslikni talab qilyapti.",
    "A stranger says to send the payment to a personal card urgently and keep it secret.",
  ])("keeps an independently suspicious transfer request positive: %s", (text) => {
    expect(evaluateText(text)).toContain("asks_for_money_transfer");
  });

  it.each([
    "chto delat dalshe?",
    "chto im skazat?",
    "nu i chto teper?",
    "что делать дальше?",
    "что им сказать?",
    "ну и что теперь?",
    "Can I send a screenshot of a payment request?",
  ])("does not turn a follow-up or capability question into a transfer request: %s", (text) => {
    expect(evaluateText(text)).toEqual([]);
  });
});

describe("risk hardening — explicit physical violence threats", () => {
  it.each([
    "Я приеду и убью тебя.",
    "Я знаю твой адрес, приеду домой и убью тебя.",
    "Мы придем к тебе домой и изобьем тебя, если не заплатишь.",
    "Твой адрес у меня, скоро приеду — тебе конец.",
    "Manzilingni bilamiz, uyingga kelib seni o'ldiramiz.",
    "Uyingga boraman va seni o'ldiraman.",
    "Pul bermasang uyingga borib seni kaltaklaymiz.",
    "Манзилингни биламиз, уйингга келиб сени ўлдирамиз.",
    "I know your address and I will come to your house and beat you.",
    "I will come to your home and kill you.",
    "We know where you live; we'll find you and kill you.",
  ])("maps a concrete physical threat to the dedicated high-risk reason: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("threatens_physical_violence");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Я читал памятку. Он пишет: я приеду и убью тебя.",
    "Zo'ravonlikka qarshi eslatmani o'qidim. U hozir yozdi: uyingga boraman va seni o'ldiraman.",
    "I read an awareness notice. He writes: I will come to your home and kill you.",
  ])("does not let an educational preamble hide a later live threat: %s", (text) => {
    expect(evaluateText(text)).toContain("threatens_physical_violence");
  });

  it.each([
    "Памятка: если незнакомец пишет «я приеду домой и убью тебя», не отвечайте и сохраните сообщение.",
    "Zo'ravonlikka qarshi eslatma: agar kimdir «uyingga borib seni uraman» deb yozsa, javob bermang.",
    "Огоҳлантириш: агар кимдир «уйингга бориб сени ураман» деб ёзса, бундай таҳдидга жавоб берманг.",
    "Awareness example: if someone says “I will come to your house and kill you”, do not reply.",
    "I will beat you at chess tonight.",
    "This novel says the villain will kill the monster.",
    "Как убить зависший процесс в Windows?",
    "Мы придем домой и будем смотреть фильм.",
    "I read an awareness notice. If someone says “I will come to your home and kill you”, do not reply.",
  ])("keeps safety, education, fiction, games, and technical text negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("threatens_physical_violence");
  });
});

describe("risk hardening — child/third-person authority coercion", () => {
  it.each([
    "15-летнему сыну написали от имени налоговой и пригрозили уголовным делом, если он не подожжет заправку.",
    "Несовершеннолетней дочери якобы из МВД велели поджечь АЗС, иначе заведут уголовное дело.",
    "15 yoshli o'g'limga soliqdan yozishdi: zapravkani yoqmasa jinoiy ish ochamiz deb qo'rqitishdi.",
    "Voyaga yetmagan qizimga IIBdanmiz deb, zapravkani yoqmasa jinoiy ish ochish bilan tahdid qilishdi.",
  ])("flags the screenshot-like child coercion report: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("authority_coerced_dangerous_act");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Полиция пишет. Не поджигайте старый склад. Подожгите школу, иначе уголовное дело.",
    "Police wrote to me. Do not burn the old warehouse. Set fire to the school or they will open a criminal case.",
    "IIB yozdi. Eski omborni yoqmang. Maktabga o't qo'ying, aks holda jinoiy ish ochamiz.",
  ])("does not let a neighboring safety clause hide a later live command: %s", (text) => {
    expect(evaluateText(text)).toContain("authority_coerced_dangerous_act");
  });

  it.each([
    "В памятке такого не было. Налоговая пишет: подожги заправку, иначе уголовное дело.",
    "Buni o'quv materialida ko'rmaganman. Soliqdan yozishdi: zapravkaga o't qo'ying, aks holda jinoiy ish ochamiz.",
    "I read security training material. The tax authority writes: set fire to the gas station or they will open a criminal case.",
  ])("does not let an educational preamble hide a later live authority demand: %s", (text) => {
    expect(evaluateText(text)).toContain("authority_coerced_dangerous_act");
  });

  it.each([
    "Полиция предупреждает: не поджигайте склад и не выполняйте такие требования.",
    "Police safety notice: do not set fire to a warehouse and do not follow such demands.",
    "IIB ogohlantiradi: omborga o't qo'ymang va bunday talabni bajarmang.",
    "Security training example. Fake police may order someone to set fire to a warehouse.",
  ])("keeps a protective authority warning negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("authority_coerced_dangerous_act");
  });
});

describe("risk hardening — neighboring topics and questions cannot suppress live risk", () => {
  it("keeps a live dropper offer after an unrelated penalty-points clause", () => {
    expect(evaluateText("Штрафные баллы обсуждают. Продай банковскую карту за деньги.")).toContain(
      "dropper_recruitment",
    );
  });

  it("keeps a pure card-handover warning negative", () => {
    expect(evaluateText("Штрафные баллы обсуждают. Не продавайте банковскую карту.")).not.toContain(
      "dropper_recruitment",
    );
  });

  it("does not let a neighboring scam question hide a paid points-erasure offer", () => {
    expect(
      evaluateText("Это мошенничество? Посредник предлагает удалить штрафные баллы за деньги."),
    ).toContain("fake_penalty_points_erasure");
  });

  it("keeps an explicit penalty-points safety warning negative", () => {
    expect(
      evaluateText("МВД предупреждает: удалить штрафные баллы за деньги невозможно. Не платите."),
    ).not.toContain("fake_penalty_points_erasure");
  });

  it("does not borrow an unrelated completed payment from a neighboring clause", () => {
    expect(evaluateText("Я оплатил ужин. Как удалить штрафные баллы?")).not.toContain(
      "fake_penalty_points_erasure",
    );
  });

  it.each([
    "Посредник обещает за деньги списать мои штрафные баллы и просит оплату на личный счёт.",
    "Человек со связями в ГАИ предлагает аннулировать дорожные баллы за комиссию.",
    "YHXBda odami bor kishi yo'l qoidasi ballarini nolga qilish uchun haq so'rayapti.",
    "A fixer wants a fee to reset my violation points.",
    "I paid a deposit to someone who promised to clear the penalty points; now they demand another fee.",
  ])("keeps bounded conversational paid-erasure wording positive: %s", (text) => {
    expect(evaluateText(text)).toContain("fake_penalty_points_erasure");
  });
});

describe("risk hardening — final semantic review regressions", () => {
  it.each(["Я убью тебя.", "Убью тебя.", "Мы изобьем вас."])(
    "recognizes a direct Russian action-first violence threat: %s",
    (text) => {
      const reasons = evaluateText(text);

      expect(reasons).toContain("threatens_physical_violence");
      expect(scoreFromCodes(reasons).level).toBe("high_risk");
    },
  );

  it.each([
    "Pul bermasang, seni urib tashlaymiz.",
    "Пул бермасанг, сени уриб ташлаймиз.",
    "Seni o'ldirib tashlayman.",
    "Сени ўлдириб ташлайман.",
  ])("recognizes a natural Uzbek violence threat: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("threatens_physical_violence");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "ROAD24 ilovasini chatdan o'rnatsam, jarima pulining hammasini qaytarishar ekan.",
    "ROAD24 иловасини чатдан ўрнатсам, жарима пулининг ҳаммасини қайтаришар экан.",
  ])("recognizes a chat-delivered ROAD24 full-refund app pitch: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("malicious_file_bait");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Я приеду. Но не убью тебя.",
    "Я приду завтра, однако не причиню тебе вред и не убью тебя.",
  ])("does not borrow negated harm from a neighboring clause: %s", (text) => {
    expect(evaluateText(text)).not.toContain("threatens_physical_violence");
  });

  it("does not reinterpret a neutral police news report as authority coercion", () => {
    expect(evaluateText("Police says a suspect set fire to a gas station.")).not.toContain(
      "authority_coerced_dangerous_act",
    );
  });

  it("keeps a concrete arrest-backed authority demand high risk", () => {
    const reasons = evaluateText(
      "An investigator says I will be arrested unless I leave a backpack at the railway station.",
    );

    expect(reasons).toContain("authority_coerced_dangerous_act");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "A detective ordered me to set fire to a car or I would be arrested.",
    "Прокурорман деган одам камера симини узишимни талаб қиляпти.",
  ])("recognizes a natural authority-backed dangerous demand: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("authority_coerced_dangerous_act");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it("does not turn a police safety notice into a legal threat", () => {
    expect(
      evaluateText(
        "A police safety notice says never carry unknown packages or damage equipment; call emergency services.",
      ),
    ).not.toContain("threatens_legal_action");
  });

  it("does not borrow an unrelated dinner payment for a penalty-points question", () => {
    expect(evaluateText("Оплатите ужин. Как удалить штрафные баллы?")).not.toContain(
      "fake_penalty_points_erasure",
    );
  });

  it("keeps a referential completed payment tied to penalty-points erasure", () => {
    expect(
      evaluateText(
        "Я уже перевёл аванс тому, кто обещал убрать штрафные баллы; теперь он просит доплату.",
      ),
    ).toContain("fake_penalty_points_erasure");
  });

  it.each([
    "Незнакомец спросил дорогу. Переведите деньги сотруднику по обычной зарплатной ведомости.",
    "A stranger asked for directions. Transfer the money to the employee under normal payroll.",
    "Notanish odam yo'l so'radi. Pulni xodimga odatiy maosh vedomosti bo'yicha o'tkazing.",
  ])("does not attach an unrelated stranger mention to an ordinary transfer: %s", (text) => {
    expect(evaluateText(text)).not.toContain("asks_for_money_transfer");
  });
});

describe("risk hardening — live red-team paraphrases", () => {
  it.each([
    "Прислали ROAD24 в чате: поставьте на телефон, тогда вернём всю сумму штрафа.",
    "They sent ROAD24 in chat: put it on your phone and we will refund the whole fine.",
    "ROAD24 ilovasini yuborishdi, yuz foiz pul qaytadi, o'rnatish kerak.",
    "ROAD24 иловасини юборишди, юз фоиз пул қайтади, ўрнатиш керак.",
  ])("recognizes a chat-delivered ROAD24 whole-refund paraphrase: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("malicious_file_bait");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Tanishim jarima ballarini olib tashlab beradi, buning uchun pul so'radi.",
    "Танишим жарима балларини олиб ташлаб беради, бунинг учун пул сўради.",
    "A fixer says he can wipe my driving penalty points for a cash fee.",
    "A traffic officer contact will take my violation points off for cash.",
  ])("recognizes a paid penalty-points erasure paraphrase: %s", (text) => {
    expect(evaluateText(text)).toContain("fake_penalty_points_erasure");
  });

  it.each([
    "Yetkazib beruvchiga to'lov rejalashtirilgan edi, oluvchi va summa tasdiqlangan.",
    "Етказиб берувчига тўлов режалаштирилган эди, олувчи ва сумма тасдиқланган.",
    "Оплата поставщику была запланирована, получатель и сумма подтверждены.",
    "The supplier payment was scheduled; the recipient and amount were confirmed.",
  ])("keeps a confirmed planned supplier payment outside delivery fraud: %s", (text) => {
    expect(evaluateText(text)).not.toContain("fake_delivery_payment");
  });

  it("does not let a safe supplier preamble hide a later fake delivery fee", () => {
    expect(
      evaluateText(
        "The supplier payment was scheduled and the recipient and amount were confirmed. But an unknown courier sent a link for an extra delivery fee.",
      ),
    ).toContain("fake_delivery_payment");
  });

  it.each([
    "Police warn residents: never carry unknown packages or damage equipment.",
    "Police said a suspect set fire to a gas station and was arrested.",
    "Полиция сообщила: подозреваемый поджёг заправку и был задержан.",
  ])("keeps public-safety notices and neutral police news outside legal threats: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("threatens_legal_action");
    expect(reasons).not.toContain("authority_coerced_dangerous_act");
  });

  it("keeps an official self-service penalty appeal outside government phishing", () => {
    expect(
      evaluateText(
        "Хочу официально обжаловать штрафные баллы через госуслуги, без посредников и оплаты.",
      ),
    ).not.toContain("oneid_government_phishing");
  });

  it("does not let official-appeal wording hide a credential-phishing lure", () => {
    expect(
      evaluateText(
        "Хочу обжаловать штраф через госуслуги. Но в чате прислали ссылку и просят код для входа.",
      ),
    ).toContain("oneid_government_phishing");
  });

  it.each([
    "A detective ordered me to set fire to a car or I would be arrested.",
    "Прокурорман деган одам камера симини узишимни талаб қиляпти.",
    "Пишет оперативник: подожги склад, иначе посадим.",
    "Profilaktika inspektoriman, kamerani buzmasang seni qamayman.",
    "Профилактика инспекториман, камерани бузмасанг сени қамайман.",
    "A federal agent told me to leave a backpack at the station or face arrest.",
    "A law-enforcement detective says I must destroy a camera or go to jail.",
  ])("recognizes a natural authority-backed dangerous act: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("authority_coerced_dangerous_act");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Я тебя застрелю.",
    "Я сломаю тебе шею.",
    "Мы тебя закопаем.",
    "Seni otib tashlayman.",
    "Seni yo'q qilaman.",
    "Сени отиб ташлайман.",
    "Сени йўқ қиламан.",
    "I'll shoot you.",
    "I'll break your neck.",
    "We will make you disappear.",
  ])("recognizes a direct extended violence threat: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("threatens_physical_violence");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each(["I will come, but I won't hurt or kill you.", "Я приеду. Но не убью тебя."])(
    "keeps an explicit violence negation negative: %s",
    (text) => {
      expect(evaluateText(text)).not.toContain("threatens_physical_violence");
    },
  );

  it.each([
    "Сосед написал «это ты на видео?» и прислал camera_video.zip, просит открыть.",
    "Qo'shnim 'bu senmi?' deb camera_video.zip yubordi, ochishni so'rayapti.",
    "Қўшним «бу сенми?» деб camera_video.zip юборди, очишни сўраяпти.",
    "A resident asks “is this you?” and sent camera_video.zip for me to open.",
  ])("recognizes a neighbor-video archive lure: %s", (text) => {
    expect(evaluateText(text)).toContain("malicious_file_bait");
  });
});

describe("risk hardening — independent natural-language red team", () => {
  it.each([
    "В Telegram прислали ROAD24 и сказали поставить на телефон — обещают вернуть весь штраф.",
    "Telegramdan ROAD24 keldi, o'rnatgach jarima uchun ketgan pulingning bari qaytadi.",
    "Чатдан жарима учун дастур юборишди, ўрнатсанг пулни бутунлай қайтарар экан.",
    "Install ROAD24 from this message and we will reimburse the entire ticket.",
  ])("recognizes broader messaged fine-refund app wording: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("malicious_file_bait");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "За вознаграждение спишут штрафные баллы.",
    "Qoidabuzarlik ballarimni pul berib kamaytirishar ekan.",
    "Қоидабузарлик балларимни пул бериб камайтиришар экан.",
    "They will knock the points off my driving record if I pay cash.",
  ])("recognizes broader paid points-erasure wording: %s", (text) => {
    expect(evaluateText(text)).toContain("fake_penalty_points_erasure");
  });

  it.each([
    "Хочу оспорить штраф через официальный портал госуслуг, без ссылок из сообщений.",
    "OneID orqali jarima arizasini o'zim tasdiqlayapman, parolni hech kimga bermayman.",
    "OneID орқали жарима аризасини ўзим тасдиқлаяпман, паролни ҳеч кимга бермайман.",
    "I confirmed my traffic-fine appeal inside OneID myself; I shared no password or code.",
  ])("keeps protected self-service OneID use negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("oneid_government_phishing");
  });

  it.each([
    "За доставку поставщику предусмотрена доплата по договору; получатель и сумма сверены.",
    "Yetkazib beruvchiga qo'shimcha to'lov avvaldan kelishilgan, oluvchi bilan summa tekshirildi.",
    "An extra delivery fee to our contracted supplier is budgeted and the recipient was verified.",
  ])("keeps verified contracted supplier fees negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("fake_delivery_payment");
  });

  it("recognizes a live Uzbek Cyrillic courier payment request", () => {
    expect(evaluateText("Курьер етказиб бериш учун тўлов сўради.")).toContain(
      "fake_delivery_payment",
    );
  });

  it.each([
    "Полиция сообщила: подозреваемого задержали за поджог заправки.",
    "В новости сказано, что полиция задержала человека, который поджёг автомобиль.",
    "МВД предупреждает, что за поджог автомобиля грозит уголовная ответственность.",
    "Полиция рақами 102.",
    "Полиция огоҳлантиради: ҳеч нарсага ўт қўйманг ва бегона пакетни ташиманг.",
    "The police emergency number is 102.",
    "Police report that a suspect was arrested for setting fire to a gas station.",
  ])("keeps police contact info, news, and public warnings negative: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("threatens_legal_action");
    expect(reasons).not.toContain("authority_coerced_dangerous_act");
  });

  it.each([
    "Следователь велит отключить пожарную сигнализацию, иначе обвинит меня.",
    "IIB xodimi kamera simini kesishni talab qildi, bo'lmasa qamaydi.",
    "ИИВ ходими камера симини кесишни талаб қилди, бўлмаса қамайди.",
    "An FBI agent demands that I cut the security camera cable or go to jail.",
  ])("recognizes authority coercion with natural word order: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("authority_coerced_dangerous_act");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Он угрожает, что зарежет меня.",
    "Не заплачу — обещают избить.",
    "He says he will kill me.",
    "They threatened to beat me if I don't pay.",
    "Meni pichoqlash bilan qo'rqityapti.",
    "Я выбью тебе зубы.",
    "Я тебя утоплю.",
    "I'll cut your throat.",
    "Oyog'ingni sindiraman.",
    "Приедем и сломаем тебе шею.",
    "Мы сожжём твой дом, если не заплатишь.",
    "Я тебя покалечу.",
    "Kelib bo'yningni sindiraman.",
    "Pul bermasang uyingni yoqib yuboramiz.",
    "Келиб бўйнингни синдираман.",
    "Пул бермасанг уйингни ёқиб юборамиз.",
    "We will burn your house down unless you pay.",
    "I am going to cripple you.",
  ])("recognizes direct and victim-reported violence: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("threatens_physical_violence");
    expect(scoreFromCodes(reasons).level).toBe("high_risk");
  });

  it.each([
    "Неправда, что я убью тебя — я этого не сделаю.",
    "Bu noto'g'ri: men seni o'ldiraman deganim yo'q.",
    "Бу нотўғри: мен сени ўлдираман деганим йўқ.",
    "It is not true that I will kill you; I would never do that.",
    "I did not say “I'll shoot you,” and I would never hurt you.",
  ])("keeps explicit denials of quoted violence negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("threatens_physical_violence");
  });

  it("does not let an earlier negation hide a later live threat", () => {
    expect(evaluateText("Я не убью тебя, но застрелю.")).toContain("threatens_physical_violence");
  });

  it.each([
    "Соседи скинули ZIP с записью домофона, просят глянуть.",
    "В домовом чате неизвестный отправил podiezd_video.7z: “узнаёшь себя?”, просит скачать.",
    "A resident says the door camera caught me and attached video.zip.",
  ])("recognizes broader neighbor-video archive bait: %s", (text) => {
    expect(evaluateText(text)).toContain("malicious_file_bait");
  });

  it.each([
    "Я сам экспортировал архив с домашней камеры и распаковал резервную копию.",
    "I exported a backup archive from my own home camera and unpacked it.",
    "O'zim uy kameramdan zaxira arxivini yaratib, uni ochdim.",
  ])("keeps self-created camera backups outside malicious file bait: %s", (text) => {
    expect(evaluateText(text)).not.toContain("malicious_file_bait");
  });

  it.each([
    "Подарок уже получил. Брат лично вручил мне телефон на день рождения, ссылок не было.",
    "Sovg'ani oldim. Akam tug'ilgan kunimga telefonni shaxsan berdi, havola yo'q.",
    "Совғани олдим. Акам туғилган кунимга телефонни шахсан берди, ҳавола йўқ.",
    "I received the gift. My brother handed me a phone for my birthday; there was no link.",
  ])("keeps completed in-person family gifts negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("giveaway_engagement_bait");
  });
});

describe("risk hardening — safe preambles cannot hide a later live lure", () => {
  it.each([
    "Хочу оспорить штраф через официальный портал госуслуг, без ссылок и пароль никому не сообщаю. Но незнакомец прислал ссылку и просит войти в OneID.",
    "OneID orqali jarimani rasmiy portalda o'zim tekshiraman, parolni hech kimga bermayman. Lekin notanish odam havola yuborib, OneIDga kirishni so'radi.",
    "I contest fines in the official portal myself and share no password. But a stranger sent a link and asks me to sign in to OneID.",
  ])("keeps a later OneID phishing clause visible: %s", (text) => {
    expect(evaluateText(text)).toContain("oneid_government_phishing");
  });

  it.each([
    "За доставку поставщику предусмотрена доплата по договору; получатель и сумма сверены. Теперь курьер просит перевести ещё 300 000 сум на другой счёт.",
    "Yetkazib beruvchiga to'lov shartnoma bo'yicha kelishilgan, oluvchi va summa tekshirildi. Endi kuryer yana 300 ming so'mni boshqa hisobga o'tkazishni so'rayapti.",
    "The supplier delivery fee is covered by our contract and the recipient was verified. Now the courier asks for another payment to a different account.",
  ])("keeps a later changed delivery payment visible: %s", (text) => {
    expect(evaluateText(text)).toContain("fake_delivery_payment");
  });

  it.each([
    "Я сам экспортировал архив с домашней камеры и распаковал резервную копию. Потом в домовом чате появился новый podiezd_video.zip, просят открыть.",
    "I exported and unpacked my own camera backup. Later a new lobby_video.zip appeared in the building chat and they ask me to open it.",
  ])("keeps a newly received archive visible after an owned backup: %s", (text) => {
    expect(evaluateText(text)).toContain("malicious_file_bait");
  });

  it.each([
    "Брат лично вручил подарок на день рождения без ссылки а сегодня прислал ссылку на приз и просит открыть и войти в аккаунт",
    "My brother handed me a birthday gift in person with no link and now he sent a prize link and asks me to open it and log in",
  ])("keeps a later prize link visible after an in-person gift: %s", (text) => {
    expect(evaluateText(text)).toContain("giveaway_engagement_bait");
  });

  it.each([
    "Полиция сообщила, что подозреваемого задержали за поджог. Сотрудник МВД пишет: если не переведёшь деньги, откроют уголовное дело.",
    "Police report that a suspect was arrested for setting fire to a station. Now an officer says: transfer the money or face arrest.",
  ])("keeps a later legal threat visible after neutral news: %s", (text) => {
    expect(evaluateText(text)).toContain("threatens_legal_action");
  });

  it("keeps a live OneID lure visible after a bookmarked self-service appeal", () => {
    expect(
      evaluateText(
        "I opened OneID from my saved bookmark and filed the appeal; nobody received my code. But a stranger now asks me to open a new link and send the code.",
      ),
    ).toContain("oneid_government_phishing");
  });

  it("keeps a later live threat visible after a police educational example", () => {
    expect(
      evaluateText(
        "Police shared ‘I will shoot you’ as an example threat and advised saving the message. Then the caller wrote: I will shoot you tonight.",
      ),
    ).toContain("threatens_physical_violence");
  });

  it("keeps an external archive lure visible after a native Telegram video", () => {
    expect(
      evaluateText(
        "My neighbour sent a normal video inside Telegram with no archive. Later a stranger sent courtyard_video.zip and asks me to open it.",
      ),
    ).toContain("malicious_file_bait");
  });

  it("keeps a later bank-prize link visible after an ordinary family gift", () => {
    expect(
      evaluateText(
        "Oilam menga uyda sovg'a berdi, tugma yoki havola yo'q. Endi tanishim bank sovg'asi havolasini ochib tugmani bosishni so'radi.",
      ),
    ).toContain("giveaway_engagement_bait");
  });

  it("keeps a live paid-erasure offer visible after a penalty warning", () => {
    expect(
      evaluateText(
        "Police warn that nobody can erase penalty points. But a fixer says he can reduce the penalty points if I pay cash.",
      ),
    ).toContain("fake_penalty_points_erasure");
  });
});

describe("risk hardening — independent P0 natural-language probes", () => {
  it.each([
    "Они пишут, что сожгут мой дом, если я не переведу деньги.",
    "Заплати, иначе тебе переломают ноги.",
    "U uyim oldida meni otishini va'da qildi.",
    "У уйим олдида мени отишини ваъда қилди.",
    "Pay up or we will break your legs.",
  ])("recognizes a natural physical threat: %s", (text) => {
    expect(evaluateText(text)).toContain("threatens_physical_violence");
  });

  it.each([
    "В чате прислали ROAD24: установи на телефон, и весь штраф вернут обратно.",
    "Telegramdan jarima dasturi keldi, o'rnatgach to'lovni to'la-to'kis qaytarishar ekan.",
    "Телеграмдан жарима дастури келди, ўрнатгач тўловни тўла-тўкис қайтаришар экан.",
    "A stranger shared a fine-payment app and promised every penny back once I install it.",
  ])("recognizes a natural messaged fine-refund app: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("malicious_file_bait");
  });

  it.each([
    "Участковый велит отключить пожарную сигнализацию, а за отказ обещает арест.",
    "A security agent told me to set fire to a car to avoid being accused.",
  ])("recognizes an authority-backed dangerous act: %s", (text) => {
    expect(evaluateText(text)).toContain("authority_coerced_dangerous_act");
  });

  it.each([
    "В чате подъезда кинули lobby_video.zip и торопят распаковать.",
    "Uyda yashovchi kamera meni olganini aytib, ochish uchun video.rar biriktirdi.",
    "Яшовчидан хабар: кодекни юклаб, бириктирилган видео архивини очинг.",
    "Someone in the building chat sent lobby_video.7z, asks ‘is this you?’, and says download it.",
  ])("recognizes a natural neighbor-video archive lure: %s", (text) => {
    expect(evaluateText(text)).toContain("malicious_file_bait");
  });
});

describe("risk hardening — broader live P1 paraphrases", () => {
  it.each([
    "Посредник говорит, что уменьшит водительские баллы, если заплачу наличными.",
    "Vositachi haydovchilik ballarini naqd pulga o'chirishni taklif qildi.",
    "Воситачи ҳайдовчилик балларини нақд пулга ўчиришни таклиф қилди.",
    "A fixer will reduce my driving penalty points if I pay cash.",
  ])("recognizes a paid penalty-points reduction: %s", (text) => {
    expect(evaluateText(text)).toContain("fake_penalty_points_erasure");
  });

  it.each([
    "Для получения уже оплаченного товара просят ещё один курьерский платёж.",
    "Kuryer kutilmaganda yetkazib berish uchun shaxsiy kartaga qo'shimcha pul so'radi.",
    "Етказиш комиссиясини янги карта рақамига юбормасам буюртма туради дейишди.",
    "They want another courier payment before releasing an item already paid for.",
  ])("recognizes an unexpected additional delivery payment: %s", (text) => {
    expect(evaluateText(text)).toContain("fake_delivery_payment");
  });

  it.each([
    "Тётя переслала акцию банка: она забрала подарок и зовёт меня зарегистрироваться.",
    "Sinfdoshim bankdan 70 ming olganini aytib, men ham olishim uchun tugmani bosishni so'radi.",
    "Дўстим пул ютганини айтиб, ҳаволасини очишни сўради.",
    "My brother sent a bank gift and says claim it through the button.",
  ])("recognizes a known-contact bank-gift lure: %s", (text) => {
    expect(evaluateText(text)).toContain("giveaway_engagement_bait");
  });
});

describe("risk hardening — natural safe-language controls", () => {
  it.each([
    "Сам открыл OneID из сохранённой закладки и подал жалобу; код никому не сообщал.",
    "Saqlangan manzildan OneIDni o'zim ochib shikoyat yubordim; kodni aytmadim.",
    "Сақланган манзилдан OneIDни ўзим очиб шикоят юбордим; кодни айтмадим.",
    "I opened OneID from my saved bookmark and filed the appeal; nobody received my code.",
  ])("keeps bookmarked self-service OneID appeals negative: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("oneid_government_phishing");
    expect(reasons).not.toContain("asks_for_sms_code");
  });

  it.each([
    "A detective told reporters that a suspect damaged the alarm and was arrested.",
    "The official notice lists 102 as the police number.",
  ])("keeps neutral authority reporting and contact information negative: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("authority_coerced_dangerous_act");
    expect(reasons).not.toContain("threatens_legal_action");
  });

  it.each([
    "I am not going to hurt you or come to your house.",
    "'Seni otaman' degan gap filmdan olingan, tahdid emas.",
    "'Сени отаман' деган гап фильмдан олинган, таҳдид эмас.",
    "Police shared ‘I will shoot you’ as an example threat and advised saving the message.",
    "Полиция привела пример угрозы «я тебя застрелю» и советует сохранить сообщение.",
    "Памятка объясняет: если пишут «приедем и изобьём», не отвечайте и звоните 102.",
  ])("keeps explicit negation, fiction, and safety examples outside violence: %s", (text) => {
    expect(evaluateText(text)).not.toContain("threatens_physical_violence");
  });

  it.each([
    "Я сам создал архив с видео двора и попросил соседа открыть его.",
    "Qo'shnim men yuborgan oilaviy video arxivini ochdi.",
    "Қўшним мен юборган оилавий видео архивини очди.",
    "My neighbor opened the family-video archive that I had sent.",
    "My neighbour sent a normal video inside Telegram, with no archive, link, or installation.",
    "Қўшним оддий видеони Telegram ичида юборди, архив, ҳавола ва ўрнатиш йўқ.",
  ])("keeps owned archives and native videos outside malicious-file bait: %s", (text) => {
    expect(evaluateText(text)).not.toContain("malicious_file_bait");
  });

  it.each([
    "Банк предупредил о поддельных призах; знакомый ничего не получал и ссылку не открывал.",
    "Bank soxta sovg'alar haqida ogohlantirdi; tanishim hech narsa olmadi va havolani ochmadi.",
    "Банк сохта совғалар ҳақида огоҳлантирди; танишим ҳеч нарса олмади ва ҳаволани очмади.",
    "The bank warned about fake prizes; my friend received nothing and opened no link.",
  ])("keeps prize warnings and negated contact actions negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("giveaway_engagement_bait");
  });

  it.each([
    "Семья вручила мне подарок дома, без регистрации, кнопок и переводов.",
    "Oilam menga uyda sovg'a berdi, ro'yxatdan o'tish, tugma yoki o'tkazma yo'q.",
    "Оилам менга уйда совға берди, рўйхатдан ўтиш, тугма ёки ўтказма йўқ.",
  ])("keeps ordinary family gifts outside casino and giveaway funnels: %s", (text) => {
    const reasons = evaluateText(text);

    expect(reasons).not.toContain("giveaway_engagement_bait");
    expect(reasons).not.toContain("crypto_casino_bonus_funnel");
  });

  it.each([
    "МВД предупредило: за деньги штрафные баллы никто не спишет, посредникам не платите.",
    "Police warn that nobody can erase penalty points for money; do not pay a fixer.",
  ])("keeps penalty-points safety warnings negative: %s", (text) => {
    expect(evaluateText(text)).not.toContain("fake_penalty_points_erasure");
  });
});
