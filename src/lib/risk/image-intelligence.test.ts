import { describe, expect, it } from "vitest";
import { evaluateText, scoreFromCodes } from "./rules";
import {
  buildDecodedQrOnlyImageEvidence,
  buildImageCheckInput,
  buildImageUserExplanation,
  fallbackImageIntelligence,
  hasUsableImageEvidence,
  isBenignImageContext,
  isEvidenceBackedBenignImageContext,
  mergeDecodedQrEvidence,
  sanitizeImageIntelligence,
  type ImageIntelligenceResult,
} from "./image-intelligence";

function scoreImageEvidence(evidence: ImageIntelligenceResult) {
  const input = buildImageCheckInput(evidence);
  const reasons = evaluateText(input);
  return { input, reasons, score: scoreFromCodes(reasons) };
}

describe("image intelligence evidence builder", () => {
  it("does not turn a restaurant QR/menu poster into a QR-login high risk", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Уважаемые гости! Посетите сайт chenson.uz. Узнайте больше о меню, акциях и онлайн-бронировании столов. Зарегистрируйтесь в Telegram-боте, отсканировав QR-код ниже.",
      visualCategory: "restaurant_menu_qr",
      confidence: "high",
      qr: {
        present: true,
        visibleUrl: "https://chenson.uz/loyalty",
        purpose: "menu",
        decodedValues: ["https://chenson.uz/loyalty"],
      },
      riskHints: [],
      summary: "Похоже на ресторанное меню и QR программы лояльности.",
    });

    expect(evidence).not.toBeNull();
    const { input, reasons, score } = scoreImageEvidence(evidence!);

    expect(input).toContain("меню ресторана");
    expect(input).not.toContain("https://chenson.uz/loyalty");
    expect(reasons).not.toContain("asks_to_scan_qr");
    expect(score.level).not.toBe("high_risk");
  });

  it("keeps a readable provider URL in deterministic scoring input even for benign context", () => {
    const visibleUrl = "https://evil.uz/kapitalbank";
    const evidence = sanitizeImageIntelligence({
      text: `QR ${visibleUrl}`,
      visualCategory: "qr_menu_or_info",
      confidence: "high",
      qr: { present: true, visibleUrl, purpose: "info" },
      riskHints: [],
    });

    expect(evidence).not.toBeNull();
    expect(isEvidenceBackedBenignImageContext(evidence!)).toBe(true);
    expect(buildImageCheckInput(evidence!)).toContain(visibleUrl);
  });

  it("ignores a model-only URL guess even when the provider labels the QR benign", () => {
    const guessed = sanitizeImageIntelligence({
      text: "QR menu",
      visualCategory: "qr_menu_or_info",
      confidence: "high",
      qr: {
        present: true,
        visibleUrl: "https://kapital-bank-verify.click/login",
        purpose: "info",
      },
      riskHints: [],
    });

    expect(guessed).not.toBeNull();
    expect(isBenignImageContext(guessed!)).toBe(true);
    const { input, reasons } = scoreImageEvidence(guessed!);
    expect(input).not.toContain("kapital-bank-verify.click");
    expect(reasons).toHaveLength(0);
  });

  it("does not bind a truncated official provider URL to a longer observed phishing host", () => {
    const observedUrl = "https://kapitalbank.uz.evil.com/login";
    const evidence = sanitizeImageIntelligence({
      text: `QR ${observedUrl}`,
      visualCategory: "qr_menu_or_info",
      confidence: "high",
      qr: {
        present: true,
        visibleUrl: "https://kapitalbank.uz",
        purpose: "info",
      },
      riskHints: [],
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.qr.visibleUrl).toBe(observedUrl);
    const { input, reasons, score } = scoreImageEvidence(evidence!);
    expect(input).toContain(observedUrl);
    expect(reasons.length).toBeGreaterThan(0);
    expect(score.level).not.toBe("safe");
  });

  it("matches a complete observed URL across host case and sentence punctuation", () => {
    const evidence = sanitizeImageIntelligence({
      text: "QR HTTPS://KAPITALBANK.UZ/help.",
      visualCategory: "qr_menu_or_info",
      confidence: "high",
      qr: {
        present: true,
        visibleUrl: "https://kapitalbank.uz/help",
        purpose: "info",
      },
      riskHints: [],
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.qr.visibleUrlObservedInText).toBe(true);
    expect(buildImageCheckInput(evidence!)).toContain("KAPITALBANK.UZ/help");
  });

  it("does not flag a domain the model only guessed near an undecoded QR (P3)", () => {
    const guessed: ImageIntelligenceResult = {
      text: null,
      visualCategory: "unknown",
      confidence: "low",
      qr: {
        present: true,
        visibleUrl: "https://kapital-bank-verify.click/login",
        purpose: "unknown",
      },
      riskHints: [],
      summary: "Похоже на меню или информационный QR.",
    };

    const { input, reasons } = scoreImageEvidence(guessed);
    // A URL the model only guessed (QR not pixel-decoded, URL not in OCR text)
    // must not enter scoring, so it cannot produce a domain verdict on its own.
    expect(input).not.toContain("kapital-bank-verify.click");
    expect(reasons).toHaveLength(0);
  });

  it("still flags a genuinely readable QR URL — pixel-decoded or visible in OCR (P3)", () => {
    const decoded: ImageIntelligenceResult = {
      text: null,
      visualCategory: "unknown",
      confidence: "low",
      qr: {
        present: true,
        visibleUrl: "https://kapital-bank-verify.click/login",
        purpose: "unknown",
        decodedValues: ["https://kapital-bank-verify.click/login"],
      },
      riskHints: [],
      summary: "Похоже на меню или информационный QR.",
    };
    expect(scoreImageEvidence(decoded).reasons.length).toBeGreaterThan(0);

    const inText: ImageIntelligenceResult = {
      text: "Вход https://kapital-bank-verify.click/login",
      visualCategory: "unknown",
      confidence: "low",
      qr: {
        present: true,
        visibleUrl: "https://kapital-bank-verify.click/login",
        purpose: "unknown",
      },
      riskHints: [],
      summary: null,
    };
    expect(scoreImageEvidence(inText).reasons.length).toBeGreaterThan(0);
  });

  it("treats a normal delivery pickup SMS as insufficient data, not high risk", () => {
    const evidence = fallbackImageIntelligence(
      "kutadi\nBuyurtma 106894935 sizni topshirish punktida kutmoqda. Uni 23.05.2026gacha olib keting",
    );

    expect(evidence.visualCategory).toBe("delivery_sms");
    const { reasons, score } = scoreImageEvidence(evidence);

    expect(reasons).not.toContain("fake_delivery_payment");
    expect(reasons).not.toContain("asks_for_sms_code");
    expect(score.level).not.toBe("high_risk");
  });

  it("keeps QR login evidence dangerous", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Отсканируйте QR-код, чтобы войти в личный кабинет и подтвердить операцию",
      visualCategory: "qr_login_or_payment",
      confidence: "high",
      qr: { present: true, visibleUrl: null, purpose: "login" },
      riskHints: [],
      summary: "QR используется для входа или подтверждения аккаунта.",
    });

    expect(evidence).not.toBeNull();
    expect(evidence!.riskHints).toContain("qr_login");
    const { reasons, score } = scoreImageEvidence(evidence!);

    expect(reasons).toContain("asks_to_scan_qr");
    expect(score.level).toBe("high_risk");
  });

  it("classifies Telegram device-login QR screens as dangerous", () => {
    const evidence = fallbackImageIntelligence(
      "Быстрый вход по QR-коду. Откройте Telegram с телефона. Настройки > Устройства > Подключить устройство. Для подтверждения направьте камеру телефона на этот экран.",
    );

    expect(evidence.visualCategory).toBe("qr_login_or_payment");
    expect(evidence.qr.purpose).toBe("login");
    expect(evidence.riskHints).toContain("qr_login");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("asks_to_scan_qr");
    expect(score.level).toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("подключения устройства");
    expect(explanation).toContain("Не сканируйте QR");
  });

  it("classifies 2FA authenticator QR screens as dangerous account access QR", () => {
    const evidence = fallbackImageIntelligence(
      "Двухфакторная аутентификация. Please use your authentication app such as Google Authenticator to scan this QR code.",
    );

    expect(evidence.visualCategory).toBe("qr_login_or_payment");
    expect(evidence.qr.purpose).toBe("login");
    expect(evidence.riskHints).toContain("qr_login");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("asks_to_scan_qr");
    expect(score.level).toBe("high_risk");
  });

  it("classifies bank and Yandex QR login screens as account-access QR", () => {
    const bankLogin = fallbackImageIntelligence(
      "Вход по QR. Откройте камеру на смартфоне, где установлено приложение Альфа-Бизнес, и отсканируйте QR-код.",
    );
    const yandexLogin = fallbackImageIntelligence(
      "Обычная камера не подойдет, скачайте и откройте мобильное приложение Яндекса. Сканировать код через приложение Яндекса. Войти через Яндекс.",
    );

    for (const evidence of [bankLogin, yandexLogin]) {
      expect(evidence.visualCategory).toBe("qr_login_or_payment");
      expect(evidence.qr.purpose).toBe("login");
      expect(evidence.riskHints).toContain("qr_login");

      const { reasons, score } = scoreImageEvidence(evidence);
      expect(reasons).toContain("asks_to_scan_qr");
      expect(score.level).toBe("high_risk");
    }
  });

  it("keeps QR payment evidence dangerous", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Для брони отсканируйте QR-код и внесите предоплату",
      visualCategory: "qr_login_or_payment",
      confidence: "high",
      qr: { present: true, visibleUrl: null, purpose: "payment" },
      riskHints: ["qr_payment", "payment_request"],
      summary: "QR используется для оплаты до услуги.",
    });

    expect(evidence).not.toBeNull();
    const { reasons, score } = scoreImageEvidence(evidence!);

    expect(reasons).toContain("asks_to_scan_qr");
    expect(reasons).toContain("payment_before_service");
    expect(score.level).toBe("high_risk");
  });

  it("flags fake Apple/iOS security popups as install-risk image evidence", () => {
    const evidence = fallbackImageIntelligence(
      "Оповещение безопасности Apple. На вашем iPhone обнаружено 8 вирусов. iOS повреждена на 72%. При дальнейшем повреждении системы устройство заблокируется, и все данные будут потеряны. Нажмите кнопку ниже, чтобы получить инструкции по удалению всех вирусов. Установить",
    );

    expect(evidence.visualCategory).toBe("apk_prompt");
    expect(evidence.riskHints).toContain("fake_device_security_popup");
    expect(evidence.riskHints).toContain("apk_install");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("asks_to_install_apk");
    expect(score.level).toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("ложное предупреждение безопасности");
    expect(explanation).toContain("Ничего не устанавливайте");
    expect(explanation).toContain("App Store/Play Market");
  });

  it("flags APK court-summons screenshots as malicious-file evidence", () => {
    const evidence = fallbackImageIntelligence(
      "https://chaqiruvsud.click IIBB CHAQIRUVI_669.pdf.apk Hurmatli Djo! SUDga chaqirilgansiz! Biriktirilgan hujjat bilan tanishib chiqing!",
    );

    expect(evidence.visualCategory).toBe("apk_prompt");
    expect(evidence.riskHints).toContain("apk_install");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("asks_to_install_apk");
    expect(reasons).toContain("threatens_legal_action");
    expect(score.level).toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("повесткой");
    expect(explanation).toContain("Не открывайте и не устанавливайте");
  });

  it("flags fake Telegram deletion/verification screenshots without giveaway wording", () => {
    const evidence = fallbackImageIntelligence(
      "Запрос на удаление учётной записи. Мы получили запрос на удаление учётной записи Telegram. Если это были не вы, отмените действие в приложении, нажав кнопку ниже. t.me/verification_login_service_bot?startapp=abc",
    );

    expect(evidence.riskHints).toContain("telegram_account_takeover");
    expect(evidence.riskHints).not.toContain("giveaway_or_prize_actions");
    expect(evidence.riskHints).not.toContain("fake_captcha_or_voting");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("telegram_account_takeover_phishing");
    expect(score.level).toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("фишинг для угона Telegram");
    expect(explanation).toContain("Настройки > Устройства");
    expect(explanation).not.toContain("NFT/Stars");
    expect(explanation).not.toContain("розыгрыш");
  });

  it("flags fake UZ Telegram freeze profile screenshots as account takeover", () => {
    const evidence = fallbackImageIntelligence(
      [
        "Teiegram был(а) недавно",
        "Teiegram Не в контактах",
        "Страна телефона Узбекистан",
        "Регистрация Январь 2026",
        "Не официальный аккаунт",
        "Hurmatli foydalanuvchi, sizning hisobingizga noma'lum qurilmadan kirish qilinganligi aniqlandi va xavfsizlik nuqtai nazaridan majburan muzlatib qo'yildi.",
        "Shaxsiy tasdiqlashingizni 11 soat ichida yakunlash uchun quyidagi havolani bosing; aks holda hisobingiz butunlay muzlatib qo'yildi.",
        "https://example-login.shop Telegram Web",
      ].join("\n"),
    );

    expect(evidence.riskHints).toContain("telegram_account_takeover");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("telegram_account_takeover_phishing");
    expect(score.level).toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("фишинг для угона Telegram");
    expect(explanation).toContain("Настройки > Устройства");
  });

  it("redacts sensitive digits in model output", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Назовите SMS-код 123456 и карту 4111 1111 1111 1111",
      visualCategory: "chat_screenshot",
      confidence: "high",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: ["otp_or_secret", "card_data"],
      summary: "Просят код 123456 и карту 4111 1111 1111 1111.",
    });

    expect(evidence?.text).not.toContain("123456");
    expect(evidence?.text).not.toContain("4111 1111 1111 1111");
    expect(evidence?.summary).not.toContain("123456");
    expect(evidence?.summary).not.toContain("4111 1111 1111 1111");
    expect(evidence?.text).toContain("••••");
    expect(evidence?.summary).toContain("••••");
  });

  it("falls back deterministically when model JSON is invalid", () => {
    const evidence = sanitizeImageIntelligence("This is not JSON");
    expect(evidence).toBeNull();

    const fallback = fallbackImageIntelligence(
      "QR kodni skanerlang va tizimga kiring, tasdiqlash kodini yuboring",
    );
    const { reasons } = scoreImageEvidence(fallback);
    expect(reasons).toContain("asks_to_scan_qr");
    expect(reasons).toContain("asks_for_sms_code");
  });

  it("does not treat a model refusal to read the image as usable evidence", () => {
    const evidence = sanitizeImageIntelligence({
      text: "I could not read or recognize the text in this blurry image.",
      visualCategory: "unknown",
      confidence: "low",
      qr: { present: true, visibleUrl: null, purpose: "unknown" },
      riskHints: [],
      summary: "The screenshot is too blurry to extract details.",
    });

    expect(evidence).not.toBeNull();
    expect(hasUsableImageEvidence(evidence!)).toBe(false);
  });

  it("keeps a visible QR URL usable even when the image text is weak", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Not readable",
      visualCategory: "unknown",
      confidence: "low",
      qr: { present: true, visibleUrl: "https://example.com/menu", purpose: "unknown" },
      riskHints: [],
      summary: null,
    });

    expect(evidence).not.toBeNull();
    expect(hasUsableImageEvidence(evidence!)).toBe(true);
  });

  it("keeps decoded QR values in the image check input", () => {
    const evidence = fallbackImageIntelligence("QR-код для меню");
    const merged = mergeDecodedQrEvidence(evidence, {
      values: ["https://kapitalbank.uz.evil.top/login"],
      urls: ["https://kapitalbank.uz.evil.top/login"],
    });

    expect(merged.qr.present).toBe(true);
    expect(merged.qr.visibleUrl).toBe("https://kapitalbank.uz.evil.top/login");
    expect(hasUsableImageEvidence(merged)).toBe(true);

    const input = buildImageCheckInput(merged);
    expect(input).toContain("Decoded QR URL/value: https://kapitalbank.uz.evil.top/login");
  });

  it("does not let a category-only benign image context force a safe verdict", () => {
    const evidence = sanitizeImageIntelligence({
      text: null,
      visualCategory: "delivery_sms",
      confidence: "high",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: [],
      summary: "Looks like a delivery SMS.",
    });

    expect(evidence).not.toBeNull();
    expect(isBenignImageContext(evidence!)).toBe(true);
    expect(isEvidenceBackedBenignImageContext(evidence!)).toBe(false);
  });

  it("keeps readable delivery screenshots eligible for a safe no-reasons verdict", () => {
    const evidence = fallbackImageIntelligence(
      "Delivery order 106894935 is ready for pickup at the parcel point.",
    );

    expect(evidence.visualCategory).toBe("delivery_sms");
    expect(isEvidenceBackedBenignImageContext(evidence)).toBe(true);
  });

  it("tells the user which benign QR domains were actually decoded", () => {
    const evidence = fallbackImageIntelligence("Меню ресторана. QR-код для акций и бронирования.");
    const merged = mergeDecodedQrEvidence(evidence, {
      values: [
        "https://chenson.uz/loyalty",
        "https://chenson.uz/",
        "https://chenson.uz/locations",
        "https://t.me/chensonuz_bot",
      ],
      urls: [
        "https://chenson.uz/loyalty",
        "https://chenson.uz/",
        "https://chenson.uz/locations",
        "https://t.me/chensonuz_bot",
      ],
    });

    const explanation = buildImageUserExplanation(merged, "unknown", "ru");

    expect(explanation).toContain("QR прочитан");
    expect(explanation).toContain("chenson.uz/loyalty");
    expect(explanation).toContain("t.me/chensonuz_bot");
    expect(explanation).toContain("Я не вижу входа, оплаты, SMS-кода");
  });

  it("does not claim pixel decoding when only a visible URL near a menu QR is known", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Меню ресторана. QR-код для акций и бронирования.",
      visualCategory: "restaurant_menu_qr",
      confidence: "high",
      qr: { present: true, visibleUrl: "https://chenson.uz/menu", purpose: "menu" },
      riskHints: [],
      summary: "Похоже на ресторанное меню.",
    });

    expect(evidence).not.toBeNull();
    const explanation = buildImageUserExplanation(evidence!, "unknown", "ru");

    expect(explanation).toContain("Адрес рядом с QR/на изображении");
    expect(explanation).toContain("chenson.uz/menu");
    expect(explanation).toContain("Сам QR по пикселям не подтверждён");
    expect(explanation).not.toContain("QR прочитан");
  });

  it("does not echo sensitive Telegram login QR tokens in the user explanation", () => {
    const evidence = fallbackImageIntelligence("Быстрый вход по QR-коду. Подключить устройство.");
    const merged = mergeDecodedQrEvidence(evidence, {
      values: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
      urls: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
    });
    const { score } = scoreImageEvidence(merged);
    const explanation = buildImageUserExplanation(merged, score.level, "ru");

    expect(explanation).toContain("QR прочитан");
    expect(explanation).toContain("Telegram login QR (token hidden)");
    expect(explanation).not.toContain("SECRET_TOKEN_SHOULD_NOT_LEAK");
    expect(explanation).toContain("Не сканируйте QR");

    const input = buildImageCheckInput(merged);
    expect(input).toContain("tg://login?token=[hidden]");
    expect(input).not.toContain("SECRET_TOKEN_SHOULD_NOT_LEAK");
    expect(merged.qr.visibleUrl).toBe("tg://login?token=[hidden]");
  });

  it("uses decoded QR protocols to classify login, authenticator and payment QR values", () => {
    const login = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
      urls: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
    });
    const authenticator = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["otpauth://totp/GitHub:user@example.com?secret=AUTH_SECRET_SHOULD_NOT_LEAK"],
      urls: [],
    });
    const payment = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["https://payme.uz/checkout/invoice?id=123456"],
      urls: ["https://payme.uz/checkout/invoice?id=123456"],
    });

    for (const evidence of [login, authenticator, payment]) {
      expect(evidence.visualCategory).toBe("qr_login_or_payment");
      expect(["login", "payment"]).toContain(evidence.qr.purpose);

      const { reasons, score } = scoreImageEvidence(evidence);
      expect(reasons).toContain("asks_to_scan_qr");
      expect(score.level).toBe("high_risk");
    }

    expect(login.riskHints).toContain("qr_login");
    expect(authenticator.riskHints).toContain("qr_login");
    expect(payment.riskHints).toContain("qr_payment");
    expect(buildImageCheckInput(authenticator)).not.toContain("AUTH_SECRET_SHOULD_NOT_LEAK");
    expect(buildImageCheckInput(authenticator)).toContain("secret=[hidden]");
  });

  it("redacts decoded Wi-Fi passwords and labeled recovery phrases", () => {
    const wifi = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["WIFI:T:WPA;S:VictimHome;P:correct-horse-battery-staple;;"],
      urls: [],
    });
    const mnemonic = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: [
        "Seed phrase: abandon ability able about above absent absorb abstract absurd abuse access accident",
      ],
      urls: [],
    });
    const labeledPassword = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["Password: secret-passphrase"],
      urls: [],
    });
    const separatedOtp = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["OTP: 1 2 3 4 5 6"],
      urls: [],
    });
    const escapedWifi = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: [String.raw`WIFI:T:WPA;S:VictimHome;P:secret\;password;;`],
      urls: [],
    });
    const localizedPassword = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["Пароль: секретная-фраза"],
      urls: [],
    });

    expect(wifi.qr.decodedValues?.[0]).toContain("S:VictimHome");
    expect(wifi.qr.decodedValues?.[0]).toContain("P:[hidden]");
    expect(wifi.riskHints).toContain("otp_or_secret");
    expect(buildImageCheckInput(wifi)).not.toContain("correct-horse-battery-staple");
    expect(mnemonic.qr.decodedValues?.[0]).toContain("Seed phrase: [hidden]");
    expect(mnemonic.riskHints).toContain("otp_or_secret");
    expect(buildImageCheckInput(mnemonic)).not.toContain(
      "abandon ability able about above absent absorb abstract absurd abuse access accident",
    );
    expect(buildImageCheckInput(labeledPassword)).toContain("Password: [hidden]");
    expect(buildImageCheckInput(labeledPassword)).not.toContain("secret-passphrase");
    expect(buildImageCheckInput(separatedOtp)).toContain("OTP: [hidden]");
    expect(buildImageCheckInput(separatedOtp)).not.toContain("1 2 3 4 5 6");
    expect(buildImageCheckInput(escapedWifi)).toContain("P:[hidden]");
    expect(buildImageCheckInput(escapedWifi)).not.toContain(String.raw`secret\;password`);
    expect(buildImageCheckInput(localizedPassword)).toContain("Пароль: [hidden]");
    expect(buildImageCheckInput(localizedPassword)).not.toContain("секретная-фраза");
  });

  it("preserves non-secret decoded QR controls", () => {
    const wifi = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["WIFI:T:nopass;S:PublicLibrary;;"],
      urls: [],
    });
    const menu = mergeDecodedQrEvidence(fallbackImageIntelligence("QR"), {
      values: ["https://chenson.uz/menu"],
      urls: ["https://chenson.uz/menu"],
    });

    expect(wifi.qr.decodedValues?.[0]).toBe("WIFI:T:nopass;S:PublicLibrary;;");
    expect(wifi.riskHints).not.toContain("otp_or_secret");
    expect(buildImageCheckInput(menu)).toContain("https://chenson.uz/menu");
  });

  it("builds decoded-only evidence only for actionable QR values", () => {
    const login = buildDecodedQrOnlyImageEvidence({
      values: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
      urls: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
    });
    const payment = buildDecodedQrOnlyImageEvidence({
      values: ["https://payme.uz/checkout/invoice?id=123456"],
      urls: ["https://payme.uz/checkout/invoice?id=123456"],
    });
    const menu = buildDecodedQrOnlyImageEvidence({
      values: ["https://chenson.uz/menu"],
      urls: ["https://chenson.uz/menu"],
    });
    const suspiciousUrl = buildDecodedQrOnlyImageEvidence({
      values: ["https://kapitalbank.uz.evil.top/login"],
      urls: ["https://kapitalbank.uz.evil.top/login"],
    });

    expect(login?.riskHints).toContain("qr_login");
    expect(login?.qr.purpose).toBe("login");
    expect(payment?.riskHints).toContain("qr_payment");
    expect(payment?.qr.purpose).toBe("payment");
    expect(menu).toBeNull();
    expect(suspiciousUrl).toBeNull();
  });

  it("builds a calm user explanation for benign QR menu images", () => {
    const evidence = fallbackImageIntelligence("Меню ресторана. QR-код для акций и бронирования.");
    const explanation = buildImageUserExplanation(evidence, "unknown", "ru");

    expect(explanation).toContain("QR виден, но сам код надёжно не прочитан");
    expect(explanation).toContain("Я не вижу входа, оплаты, SMS-кода");
    expect(explanation).toContain("код");
  });

  it("surfaces Telegram casino/free-spins screenshots as promo risk evidence", () => {
    const evidence = fallbackImageIntelligence(
      "orno.tut\nTwin стартовый бонус 100 фриспинов. Хочешь с крипты пополнить? От 150% до 200% и 150 фриспинов. Все акции по ссылке: Ссылка на Твин. Вход на сайт без VPN.",
    );

    expect(evidence.visualCategory).toBe("casino_or_betting_promo");
    expect(evidence.riskHints).toContain("casino_bonus_or_free_spins");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("crypto_casino_bonus_funnel");
    expect(reasons).toContain("gambling_prediction_promo");
    expect(score.level).toBe("suspicious");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("фриспины");
    expect(explanation).toContain("пополнению баланса");
    expect(explanation).not.toContain("Я проверил видимый текст");
  });

  it("surfaces Stars/NFT spin or lucky-draw posts without inventing captcha", () => {
    const evidence = fallbackImageIntelligence(
      "От меня подары на Loyalty с Black фоном всего за 12 Звёзд. Лучшая лудка с дорогими NFT и спином за 12 STARS. 777",
    );

    expect(evidence.visualCategory).toBe("crypto_giveaway_or_nft");
    expect(evidence.riskHints).toContain("giveaway_or_prize_actions");
    expect(evidence.riskHints).not.toContain("fake_captcha_or_voting");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("giveaway_engagement_bait");
    expect(reasons).not.toContain("fake_captcha_or_voting");
    expect(score.level).toBe("suspicious");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("NFT/Stars");
    expect(explanation).toContain("спин");
  });

  it("surfaces public voting contest domains as high-risk voting gates", () => {
    const evidence = fallbackImageIntelligence(
      "Зайдите проголосуйте! https://voting.blockchain-life.com Со сцены когда пойду забирать статуэтку, какую речь сказать?",
    );

    expect(evidence.visualCategory).toBe("crypto_giveaway_or_nft");
    expect(evidence.riskHints).toContain("fake_captcha_or_voting");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("fake_captcha_or_voting");
    expect(score.level).toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("голосование");
    expect(explanation).toContain("Telegram-кода");
  });

  it("surfaces NFT or Stars giveaway screenshots with voting/captcha gates", () => {
    const evidence = fallbackImageIntelligence(
      'TON Знаток. Разыгрываем 3 RANDOM NFT из "Банка подарков" через 48 часов. Из условий только: пройти капчу, 3 реакции, проголосовать за @TonZnatok.',
    );

    expect(evidence.visualCategory).toBe("crypto_giveaway_or_nft");
    expect(evidence.riskHints).toContain("fake_captcha_or_voting");
    expect(evidence.riskHints).toContain("giveaway_or_prize_actions");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("giveaway_engagement_bait");
    expect(reasons).toContain("fake_captcha_or_voting");
    expect(score.level).toBe("high_risk");
  });

  it("surfaces task-reward Telegram campaign screenshots", () => {
    const evidence = fallbackImageIntelligence(
      "Punk City Battle Royale. Reward Pool: 30 000 USD. Campaign participants collect points on the leaderboard to be among winners.",
    );

    expect(evidence.visualCategory).toBe("telegram_promo_post");
    expect(evidence.riskHints).toContain("task_reward_or_engagement");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("task_reward_engagement_bait");
    expect(score.level).toBe("suspicious");
  });

  it("surfaces wallet urgency screenshots without inventing wallet reputation", () => {
    const evidence = fallbackImageIntelligence(
      "HOT Updates: Rhea Finance is back online after a security incident. Users have a 24-hour grace period to settle open positions before the liquidation bot is reactivated. Manage in HOT Wallet Earn tab.",
    );

    expect(evidence.visualCategory).toBe("wallet_or_defi_action");
    expect(evidence.riskHints).toContain("wallet_or_defi_urgency");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("wallet_action_urgency");
    expect(score.level).toBe("suspicious");
  });

  it("surfaces TON referral earning screenshots", () => {
    const evidence = fallbackImageIntelligence(
      "Help friends find a match for Valentine's Day. Earn 1 TON per invited friend. Find your referral link and send it to friends.",
    );

    expect(evidence.visualCategory).toBe("telegram_promo_post");
    expect(evidence.riskHints).toContain("ton_referral_or_earning");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toContain("ton_referral_earning_scheme");
    expect(score.level).toBe("suspicious");
  });

  it("surfaces private Telegram invite screenshots without storing the invite code", () => {
    const evidence = fallbackImageIntelligence(
      "Join my private Telegram chat for details: https://t.me/+SecretInvite12345",
    );

    expect(evidence.text).not.toContain("SecretInvite12345");
    expect(evidence.riskHints).toContain("telegram_invite_or_private_link");

    const { input, reasons, score } = scoreImageEvidence(evidence);
    expect(input).toContain("private Telegram invite link");
    expect(input).not.toContain("SecretInvite12345");
    expect(reasons).toContain("suspicious_invite_link");
    expect(score.level).toBe("suspicious");

    const explanation = buildImageUserExplanation(evidence, score.level, "en");
    expect(explanation).toContain("invite link to a private Telegram chat");
    expect(explanation).toContain("I cannot inspect what is inside");
  });

  it.each([
    "t.me/+SecretInvite12345",
    "telegram.me/+SecretInvite12345",
    "t.me/joinchat/SecretInvite12345",
    "telegram.me/joinchat/SecretInvite12345",
    "https://telegram.me/joinchat/SecretInvite12345",
  ])("masks an OCR-observed private invite while retaining its risk signal: %s", (value) => {
    const evidence = fallbackImageIntelligence(`Join my private Telegram chat: ${value}`);
    const { input, reasons, score } = scoreImageEvidence(evidence);

    expect(input).not.toContain("SecretInvite12345");
    expect(evidence.riskHints).toContain("telegram_invite_or_private_link");
    expect(reasons).toContain("suspicious_invite_link");
    expect(score.level).toBe("suspicious");
  });

  it.each([
    "tg://join?invite=SecretInvite12345",
    "t.me/+SecretInvite12345",
    "telegram.me/joinchat/SecretInvite12345",
  ])("masks a pixel-decoded private invite while retaining its risk signal: %s", (value) => {
    const evidence = buildDecodedQrOnlyImageEvidence({ values: [value], urls: [value] });

    expect(evidence).not.toBeNull();
    const { input, reasons, score } = scoreImageEvidence(evidence!);
    expect(input).not.toContain("SecretInvite12345");
    expect(evidence!.riskHints).toContain("telegram_invite_or_private_link");
    expect(reasons).toContain("suspicious_invite_link");
    expect(score.level).toBe("suspicious");
  });

  it("does not turn ordinary Telegram news/product posts into scam promo reasons", () => {
    const news = fallbackImageIntelligence(
      "Just News. Supreme Court expected to release ruling on tariffs on January 14th. @just",
    );
    const product = fallbackImageIntelligence(
      "Trending Apps. Pavel Durov is actively using Telegram Apps Center to keep up-to-date with fresh trending apps in Games, Web3, Management and other categories.",
    );

    expect(news.visualCategory).toBe("news_or_channel_post");
    expect(product.visualCategory).toBe("news_or_channel_post");

    for (const evidence of [news, product]) {
      const { reasons, score } = scoreImageEvidence(evidence);
      expect(reasons).not.toContain("crypto_casino_bonus_funnel");
      expect(reasons).not.toContain("fake_captcha_or_voting");
      expect(reasons).not.toContain("task_reward_engagement_bait");
      expect(reasons).not.toContain("wallet_action_urgency");
      expect(reasons).not.toContain("ton_referral_earning_scheme");
      expect(score.level).not.toBe("high_risk");
    }
  });

  it("reads Telegram native profile screenshots without turning profile fields into a verdict", () => {
    const evidence = fallbackImageIntelligence(
      "Alina R. PlankaHub\nНе в контактах\nСтрана телефона 🇺🇸 USA\nРегистрация Январь 2026 г.\nНе официальный аккаунт\nПользователь обновил имя 19 дней назад\nПользователь обновил фотографию 19 дней назад",
    );

    expect(evidence.visualCategory).toBe("telegram_profile_card");
    expect(evidence.riskHints).toEqual([]);
    expect(isBenignImageContext(evidence)).toBe(true);
    expect(isEvidenceBackedBenignImageContext(evidence)).toBe(false);

    const { input, reasons, score } = scoreImageEvidence(evidence);
    expect(input).toContain("скрин профиля Telegram");
    expect(input).toContain("Страна телефона");
    expect(reasons).toEqual([]);
    expect(score.level).not.toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("По скриншоту профиля видно");
    expect(explanation).toContain("Страна телефона");
    expect(explanation).toContain("Регистрация");
    expect(explanation).toContain("можно подделать");
    expect(explanation).toContain("не доказательство скама");
  });

  it("explains visible investment/free-access messages on Telegram profile screenshots conservatively", () => {
    const evidence = fallbackImageIntelligence(
      "Alina R. PlankaHub\nНе в контактах\nСтрана телефона 🇺🇸 USA\nРегистрация Январь 2026 г.\nНе официальный аккаунт\nПользователь обновил имя 19 дней назад\nПривет, меня зовут Алина, я менеджер Planka Hub. Мы собрали платформу, где фаундеры получают менторов, AI инструменты и доступ к инвесторам — всё бесплатно. Уже 260+ человек внутри. Тебе было бы интересно узнать подробнее?",
    );

    expect(evidence.visualCategory).toBe("telegram_profile_card");
    expect(evidence.riskHints).toEqual([]);

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons).toEqual([]);
    expect(score.level).not.toBe("high_risk");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("По скриншоту профиля видно");
    expect(explanation).toContain("В видимом сообщении есть повод для осторожности");
    expect(explanation).toContain("инвестиции/доход/AI-инструменты");
    expect(explanation).toContain("бесплатный доступ");
    expect(explanation).toContain("не доказательство скама");
  });

  it("keeps model-unknown Telegram profile screenshots as profile cards", () => {
    const evidence = sanitizeImageIntelligence({
      text: "Не в контактах\nСтрана телефона USA\nРегистрация Январь 2026 г.\nНе официальный аккаунт",
      visualCategory: "unknown",
      confidence: "medium",
      qr: { present: false, visibleUrl: null, purpose: "unknown" },
      riskHints: [],
      summary: "Скрин профиля Telegram",
    });

    expect(evidence?.visualCategory).toBe("telegram_profile_card");
    expect(buildImageUserExplanation(evidence!, "unknown", "ru")).toContain("скриншоту");
  });

  it("still escalates Telegram profile screenshots when the visible message asks for a code", () => {
    const evidence = fallbackImageIntelligence(
      "Страна телефона USA\nРегистрация Январь 2026 г.\nНе официальный аккаунт\nПопросили отправить SMS-код подтверждения",
    );

    expect(evidence.visualCategory).toBe("telegram_profile_card");
    expect(evidence.riskHints).toContain("otp_or_secret");

    const { reasons, score } = scoreImageEvidence(evidence);
    expect(reasons.length).toBeGreaterThan(0);
    expect(score.level).toBe("high_risk");
  });

  it("explains ordinary Telegram promo posts without a generic risk wall", () => {
    const evidence = fallbackImageIntelligence(
      "Уже 600+ каналов на бирже. Добавьте свой Telegram-канал сейчас, чтобы не пропустить первые рекламные размещения.",
    );
    const { reasons, score } = scoreImageEvidence(evidence);

    expect(evidence.visualCategory).toBe("telegram_promo_post");
    expect(reasons).toEqual([]);
    expect(score.level).toBe("unknown");

    const explanation = buildImageUserExplanation(evidence, score.level, "ru");
    expect(explanation).toContain("Telegram-пост");
    expect(explanation).toContain("не вижу запроса кода");
    expect(explanation).not.toContain("Я проверил видимый текст");
  });
});
