import { describe, expect, it } from "vitest";
import {
  buildEmergencyFollowUpText,
  classifyEmergencyFollowUp,
  withPanicContextData,
} from "@/lib/telegram/emergency";

const now = new Date("2026-06-05T12:00:00.000Z");
const recent = new Date("2026-06-05T11:30:00.000Z");
const expired = new Date("2026-06-05T08:00:00.000Z");

describe("Emergency Copilot v2 follow-up routing", () => {
  it("routes short next-step questions to the last panic scenario", () => {
    const context = withPanicContextData({}, 2, recent);

    expect(classifyEmergencyFollowUp("Что еще посоветуешь?", context, now)).toEqual({
      action: "more",
      panicId: 2,
    });
  });

  it("routes bank-number requests to verified contact guidance", () => {
    const context = withPanicContextData({}, 4, recent);

    expect(classifyEmergencyFollowUp("дай номер банка", context, now)).toEqual({
      action: "contacts",
      panicId: 4,
    });
  });

  it("does not intercept suspicious payloads that should be risk-checked", () => {
    const context = withPanicContextData({}, 2, recent);

    expect(
      classifyEmergencyFollowUp("Проверь https://kapitalbank.uz.evil.com", context, now),
    ).toBeNull();
    expect(classifyEmergencyFollowUp("+998 90 123 45 67", context, now)).toBeNull();
    expect(classifyEmergencyFollowUp("код 123456", context, now)).toBeNull();
  });

  it("expires old panic context", () => {
    const context = withPanicContextData({}, 4, expired);

    expect(classifyEmergencyFollowUp("дай номер банка", context, now)).toBeNull();
  });

  it("formats elder-friendly trusted-person guidance", () => {
    const text = buildEmergencyFollowUpText("trusted_person", 6, "ru");

    expect(text).toContain("Позовите человека");
    expect(text).toContain("побудь со мной");
    expect(text).toContain("Не пересылайте SMS-код");
  });

  it("formats callback contact guidance without trusting caller-provided numbers", () => {
    const text = buildEmergencyFollowUpText("contacts", 4, "ru");

    expect(text).toContain("Официальный обратный звонок");
    expect(text).toContain("Не звоните по номеру");
    expect(text).toContain("1340");
  });
});
