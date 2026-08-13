import { describe, expect, it } from "vitest";
import {
  REPORT_CALLBACK_BINDING_TTL_MS,
  REPORT_NO_VALUE_CALLBACK,
  REPORT_RETRY_CALLBACK,
  REPORT_SKIP_CALLBACK,
  matchesReportCallbackBinding,
  withReportCallbackBinding,
} from "@/lib/telegram/report-flow";

const NOW = new Date("2026-08-13T08:00:00.000Z");

function bindingData(at: string) {
  return {
    chatScope: { chatId: 55, chatType: "private" },
    reportCallbackBinding: {
      messageId: 101,
      action: REPORT_SKIP_CALLBACK,
      scenario: "report_city" as const,
      at,
    },
  };
}

describe("report callback binding TTL", () => {
  it("records an injectable timestamp without dropping the existing chat scope", () => {
    const data = withReportCallbackBinding(
      { chatScope: { chatId: 55, chatType: "private" }, description: "redacted" },
      101,
      REPORT_SKIP_CALLBACK,
      "report_city",
      NOW,
    );

    expect(data).toEqual({
      chatScope: { chatId: 55, chatType: "private" },
      description: "redacted",
      reportCallbackBinding: {
        messageId: 101,
        action: REPORT_SKIP_CALLBACK,
        scenario: "report_city",
        at: NOW.toISOString(),
      },
    });
  });

  it("accepts only the bound message, action, and report step while the prompt is current", () => {
    const data = bindingData(NOW.toISOString());

    expect(matchesReportCallbackBinding(data, 101, REPORT_SKIP_CALLBACK, "report_city", NOW)).toBe(
      true,
    );
    expect(matchesReportCallbackBinding(data, 102, REPORT_SKIP_CALLBACK, "report_city", NOW)).toBe(
      false,
    );
    expect(
      matchesReportCallbackBinding(data, 101, REPORT_NO_VALUE_CALLBACK, "report_city", NOW),
    ).toBe(false);
    expect(
      matchesReportCallbackBinding(data, 101, REPORT_SKIP_CALLBACK, "report_scamType", NOW),
    ).toBe(false);
  });

  it("accepts the exact TTL boundary and rejects a binding one millisecond older", () => {
    const boundary = new Date(NOW.getTime() - REPORT_CALLBACK_BINDING_TTL_MS).toISOString();
    const expired = new Date(NOW.getTime() - REPORT_CALLBACK_BINDING_TTL_MS - 1).toISOString();

    expect(
      matchesReportCallbackBinding(
        bindingData(boundary),
        101,
        REPORT_SKIP_CALLBACK,
        "report_city",
        NOW,
      ),
    ).toBe(true);
    expect(
      matchesReportCallbackBinding(
        bindingData(expired),
        101,
        REPORT_SKIP_CALLBACK,
        "report_city",
        NOW,
      ),
    ).toBe(false);
  });

  it.each(["", "0", "2026-08-13", "not-a-date", "2026-13-40T99:99:99Z"])(
    "fails closed for malformed binding time %j",
    (at) => {
      expect(
        matchesReportCallbackBinding(
          bindingData(at),
          101,
          REPORT_SKIP_CALLBACK,
          "report_city",
          NOW,
        ),
      ).toBe(false);
    },
  );

  it("fails closed for a future binding timestamp", () => {
    const future = new Date(NOW.getTime() + 1).toISOString();

    expect(
      matchesReportCallbackBinding(
        bindingData(future),
        101,
        REPORT_SKIP_CALLBACK,
        "report_city",
        NOW,
      ),
    ).toBe(false);
  });

  it("fails closed for missing metadata and an invalid current clock", () => {
    expect(matchesReportCallbackBinding({}, 101, REPORT_RETRY_CALLBACK, "report_amount", NOW)).toBe(
      false,
    );
    expect(
      matchesReportCallbackBinding(
        bindingData(NOW.toISOString()),
        101,
        REPORT_SKIP_CALLBACK,
        "report_city",
        new Date(Number.NaN),
      ),
    ).toBe(false);
  });
});
