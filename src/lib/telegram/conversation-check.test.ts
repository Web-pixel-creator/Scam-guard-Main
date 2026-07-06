import { describe, expect, it } from "vitest";
import {
  appendConversationMessage,
  buildConversationLastCheckSnapshot,
  buildConversationResultText,
  createConversationDraft,
  isConversationCancelPhrase,
  isConversationDonePhrase,
  MAX_CONVERSATION_MESSAGES,
} from "@/lib/telegram/conversation-check";

describe("Telegram Conversation Check v1", () => {
  it("detects a romance-to-investment pressure chain without storing raw text", () => {
    const now = new Date("2026-07-01T10:00:00Z");
    let draft = createConversationDraft(now);
    const first = appendConversationMessage(draft, "Привет, я скучаю и хочу быть вместе", now);
    expect(first.ok).toBe(true);
    draft = first.ok ? first.draft : draft;

    const second = appendConversationMessage(
      draft,
      "У меня есть crypto investment, внеси USDT и получишь доход",
      new Date("2026-07-01T10:01:00Z"),
    );
    expect(second.ok).toBe(true);
    draft = second.ok ? second.draft : draft;

    expect(draft.strongestLevel).toBe("suspicious");
    expect(draft.stageCounts.romance_pivot).toBeGreaterThan(0);
    expect(draft.stageCounts.investment_pitch).toBeGreaterThan(0);
    expect(draft.pressureFlags).toContain("relationship_trust");
    expect(draft.pressureFlags).toContain("promised_profit");
    expect(JSON.stringify(draft)).not.toContain("USDT");
  });

  it("flags a bank-code chain as high risk and keeps only safe reason metadata", () => {
    let draft = createConversationDraft();
    for (const text of [
      "Это служба безопасности банка, сейчас заблокируем карту",
      "Назовите шесть цифр из SMS 123456 для подтверждения",
    ]) {
      const appended = appendConversationMessage(draft, text);
      expect(appended.ok).toBe(true);
      draft = appended.ok ? appended.draft : draft;
    }

    expect(draft.strongestLevel).toBe("high_risk");
    expect(draft.requestedActions).toContain("say_code");
    expect(draft.reasonCounts.asks_for_sms_code).toBe(1);
    const persisted = JSON.stringify(draft);
    expect(persisted).not.toContain("123456");
    expect(persisted).not.toContain("служба безопасности");

    const result = buildConversationResultText(draft, "ru");
    expect(result).toContain("высокий риск");
    expect(result).toContain("назвать код");
    expect(result).toContain("Не называйте код");
  });

  it("flags user-retold code requests in conversation mode", () => {
    let draft = createConversationDraft();
    for (const text of ["Мне пишет незнакомый человек", "Он хочет SMS-код"]) {
      const appended = appendConversationMessage(draft, text);
      expect(appended.ok).toBe(true);
      draft = appended.ok ? appended.draft : draft;
    }

    expect(draft.strongestLevel).toBe("high_risk");
    expect(draft.requestedActions).toContain("say_code");
    expect(draft.reasonCounts.asks_for_sms_code).toBe(1);

    const result = buildConversationResultText(draft, "ru");
    expect(result).toContain("высокий риск");
    expect(result).toContain("назвать код");
    expect(result).toContain("просят SMS-код");
    expect(result).toContain("Не называйте код");
    expect(result).not.toContain("явной просьбы к действию пока нет");
    expect(result).not.toContain("опасных просьб в явном виде не найдено");
  });

  it.each(["They need the SMS code", "U kod so'rayapti"])(
    "flags retold code requests across supported languages: %s",
    (text) => {
      let draft = createConversationDraft();
      const appended = appendConversationMessage(draft, text);
      expect(appended.ok).toBe(true);
      draft = appended.ok ? appended.draft : draft;

      expect(draft.strongestLevel).toBe("high_risk");
      expect(draft.requestedActions).toContain("say_code");
      expect(draft.reasonCounts.asks_for_sms_code).toBe(1);
    },
  );

  it("recognizes done/cancel phrases and enforces the message cap", () => {
    expect(isConversationDonePhrase("готово")).toBe(true);
    expect(isConversationDonePhrase("done")).toBe(true);
    expect(isConversationCancelPhrase("отмена")).toBe(true);
    expect(isConversationCancelPhrase("cancel")).toBe(true);

    let draft = createConversationDraft();
    for (let i = 0; i < MAX_CONVERSATION_MESSAGES; i += 1) {
      const appended = appendConversationMessage(draft, `message ${i}`);
      expect(appended.ok).toBe(true);
      draft = appended.ok ? appended.draft : draft;
    }

    const overflow = appendConversationMessage(draft, "one more");
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.reason).toBe("too_many");
  });

  it("builds a safe last-check snapshot after analysis", () => {
    let draft = createConversationDraft();
    const appended = appendConversationMessage(
      draft,
      "Переведите деньги на безопасный счет прямо сейчас",
    );
    expect(appended.ok).toBe(true);
    draft = appended.ok ? appended.draft : draft;

    const snapshot = buildConversationLastCheckSnapshot(draft, new Date("2026-07-01T10:05:00Z"));
    expect(snapshot).toMatchObject({
      level: "high_risk",
      type: "text",
      context: "generic",
      reasons: ["asks_to_transfer_to_safe_account"],
      at: "2026-07-01T10:05:00.000Z",
    });
  });
});
