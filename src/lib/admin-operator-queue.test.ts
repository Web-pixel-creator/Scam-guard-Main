import { describe, expect, it } from "vitest";
import {
  operatorQueuePriority,
  operatorQueueSummary,
  sortOperatorQueueReports,
  type OperatorQueueReport,
} from "./admin-operator-queue";

function report(overrides: Partial<OperatorQueueReport>): OperatorQueueReport {
  return {
    id: "report",
    status: "new",
    created_at: "2026-06-30T08:00:00.000Z",
    target_report_count: 1,
    target_check_reason_codes: [],
    ...overrides,
  };
}

describe("operatorQueuePriority", () => {
  it("marks high scoring latest checks as review-next", () => {
    const priority = operatorQueuePriority(
      report({
        target_check_risk_level: "high_risk",
        target_check_risk_score: 86,
        target_check_reason_codes: ["asks_for_sms_code", "uses_urgency"],
        target_check_created_at: "2026-06-30T09:00:00.000Z",
      }),
    );

    expect(priority.band).toBe("review_next");
    expect(priority.score).toBeGreaterThanOrEqual(58);
    expect(priority.reasonCount).toBe(2);
  });

  it("raises repeated targets with suspicious evidence", () => {
    const priority = operatorQueuePriority(
      report({
        target_report_count: 2,
        target_check_risk_level: "suspicious",
        target_check_risk_score: 42,
        target_check_reason_codes: ["suspicious_link"],
      }),
    );

    expect(priority.band).toBe("review_next");
    expect(priority.signals).toBe(2);
  });

  it("separates single reports without check context into needs-context", () => {
    const priority = operatorQueuePriority(report({ target_check_risk_level: null }));

    expect(priority.band).toBe("needs_context");
    expect(priority.signals).toBe(1);
    expect(priority.reasonCount).toBe(0);
  });

  it("does not treat null risk score as saved check context", () => {
    const priority = operatorQueuePriority(
      report({
        target_check_risk_level: null,
        target_check_risk_score: null,
      }),
    );

    expect(priority.band).toBe("needs_context");
    expect(priority.score).toBe(12);
  });
});

describe("sortOperatorQueueReports", () => {
  const oldLow = report({
    id: "old-low",
    created_at: "2026-06-29T08:00:00.000Z",
    target_check_risk_level: "unknown",
    target_check_risk_score: 10,
  });
  const newLow = report({
    id: "new-low",
    created_at: "2026-06-30T10:00:00.000Z",
    target_check_risk_level: "unknown",
    target_check_risk_score: 10,
  });
  const olderHigh = report({
    id: "older-high",
    created_at: "2026-06-28T10:00:00.000Z",
    target_check_risk_level: "high_risk",
    target_check_risk_score: 88,
  });

  it("sorts priority mode by review value before age", () => {
    expect(
      sortOperatorQueueReports([oldLow, newLow, olderHigh], "priority").map((r) => r.id),
    ).toEqual(["older-high", "new-low", "old-low"]);
  });

  it("keeps newest mode as a recency sort", () => {
    expect(
      sortOperatorQueueReports([oldLow, olderHigh, newLow], "newest").map((r) => r.id),
    ).toEqual(["new-low", "old-low", "older-high"]);
  });
});

describe("operatorQueueSummary", () => {
  it("counts review-next, context gaps, and repeated targets", () => {
    const summary = operatorQueueSummary([
      report({
        id: "high",
        target_check_risk_level: "high_risk",
        target_check_risk_score: 90,
      }),
      report({ id: "gap", target_check_risk_level: null }),
      report({
        id: "repeat",
        target_report_count: 3,
        target_check_risk_level: "unknown",
        target_check_risk_score: 20,
      }),
    ]);

    expect(summary).toEqual({
      total: 3,
      reviewNext: 1,
      needsContext: 1,
      repeatedTargets: 1,
    });
  });
});
