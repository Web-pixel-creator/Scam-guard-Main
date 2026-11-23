import { describe, expect, it } from "vitest";
import { emptyEmbedDraft, embedCheckReducer as reduce } from "./embed-check-state";
import { reportedBankSms } from "./risk/reported-bank-sms";
import { filterAdvice } from "./telegram/advice-filter";

describe("embed request ownership", () => {
  it.each(["meta", "error"] as const)(
    "ignores an old %s before and after a newer response, including A→B→A",
    (kind) => {
      const a = reduce(emptyEmbedDraft, { type: "edit", text: "draft A" });
      const pending = reduce(a, { type: "start", revision: a.revision });
      const b = reduce(pending, { type: "edit", text: "draft B" });
      expect(b.outcome.kind).toBe("idle");
      const again = reduce(b, { type: "edit", text: "draft A" });
      const newer = reduce(again, { type: "start", revision: again.revision });
      const late = {
        type: "finish",
        revision: a.revision,
        outcome: { kind, message: "outdated" },
      } as const;
      expect(reduce(newer, late)).toBe(newer);
      const done = reduce(newer, {
        type: "finish",
        revision: again.revision,
        outcome: { kind: "meta", message: "current" },
      });
      expect(done.outcome).toEqual({ kind: "meta", message: "current" });
      expect(reduce(done, late)).toBe(done);
    },
  );
});

describe("source of the bank handoff in the widget", () => {
  it.each([
    "В SMS от имени банка просят продиктовать код из SMS.",
    "Bank nomidan SMS keldi. SMS kodimni aytishimni so‘rashdi.",
    "Банк номидан СМС келди. СМС кодимни айтишимни сўрашди.",
    "A text claiming to be from my bank asks me to share a code.",
  ])("recognizes the reported bank message, not the host: %s", (input) =>
    expect(reportedBankSms(input)).toBe("code"),
  );
  it.each([
    "Это не SMS от банка. Позвонил оператор и попросил код.",
    "СМС от банка о зачислении. Оператор просит код из SMS.",
    "My mobile operator asked for my code. I also use a banking app.",
    "Bank nomidan SMS kelmadi. Operator SMS kodini aytishni so‘radi.",
    "A text from my bank confirmed a payment. A caller asked for my code.",
  ])("does not infer that an unrelated code request was from a bank: %s", (input) =>
    expect(reportedBankSms(input)).toBeNull(),
  );
  it("does not add a bank handoff for a neutral notice, carrier command or an unreported source", () => {
    const hint = { reportedBankSms: "code" as const };
    expect(filterAdvice("unknown", [], "en", hint)).toEqual([]);
    expect(filterAdvice("suspicious", ["asks_for_sms_code"], "en")).not.toEqual(
      expect.arrayContaining([expect.stringContaining("banking app")]),
    );
    expect(
      filterAdvice(
        "high_risk",
        ["operator_requests_dial_code", "asks_for_sms_code"],
        "en",
        hint,
      )[0],
    ).toMatch(/^Do not dial/);
    expect(
      filterAdvice("high_risk", ["impersonates_operator", "asks_for_sms_code"], "en", hint).join(
        " ",
      ),
    ).not.toContain("banking app");
  });
  it("keeps higher-priority safety advice ahead of a handoff", () => {
    expect(
      filterAdvice("high_risk", ["authority_coerced_dangerous_act", "asks_for_sms_code"], "en", {
        reportedBankSms: "code",
      })[0],
    ).toMatch(/^Do not carry out the dangerous task/);
  });
});
