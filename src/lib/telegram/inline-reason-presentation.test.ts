import { describe, expect, it } from "vitest";
import { evaluateText, evaluateUrl, REASON_LABELS, type ReasonCode } from "@/lib/risk/rules";
import {
  collectResultReasonCodesForPresentation,
  INLINE_REASON_POLICY,
  presentInlineReason,
} from "@/lib/telegram/inline-reason-presentation";

const ALL_REASONS = Object.keys(REASON_LABELS) as ReasonCode[];
const FORBIDDEN_USER_FACING_JARGON =
  /(?:deterministic|deterministik|детерминирован\w*|(?:a\s+)?rule\s+found|правил\w*.{0,20}нашл\w*|qoida.{0,20}topdi)/iu;

describe("Inline reason presentation policy", () => {
  it("exhaustively covers every ReasonCode with RU/UZ/EN evidence and limitations", () => {
    expect(Object.keys(INLINE_REASON_POLICY).sort()).toEqual([...ALL_REASONS].sort());

    for (const reason of ALL_REASONS) {
      const policy = INLINE_REASON_POLICY[reason];
      expect(Number.isFinite(policy.priority), reason).toBe(true);

      for (const lang of ["ru", "uz", "en"] as const) {
        const presented = presentInlineReason([reason], lang);
        expect(presented?.reason).toBe(reason);
        expect(presented?.evidence.trim().length, `${reason}:${lang}:evidence`).toBeGreaterThan(10);
        expect(presented?.limitation.trim().length, `${reason}:${lang}:limitation`).toBeGreaterThan(
          10,
        );
        expect(presented?.text).toContain(REASON_LABELS[reason][lang]);
        expect(presented?.text, `${reason}:${lang}:jargon`).not.toMatch(
          FORBIDDEN_USER_FACING_JARGON,
        );
      }
    }
  });

  it("selects stronger evidence by explicit policy instead of array order", () => {
    const presented = presentInlineReason(
      ["valid_uz_phone", "weird_domain", "external_phishing_url"],
      "en",
    );

    expect(presented?.reason).toBe("external_phishing_url");
    expect(presented?.evidence).toMatch(/external reputation/i);
  });

  it("ranks an explicit physical-violence threat ahead of account-risk signals", () => {
    const presented = presentInlineReason(
      ["asks_for_sms_code", "threatens_physical_violence", "impersonates_bank"],
      "ru",
    );

    expect(presented?.reason).toBe("threatens_physical_violence");
    expect(presented?.evidence).toMatch(/физическ|угрожают приехать/iu);
  });

  it("breaks equal-priority ties deterministically", () => {
    const forward = presentInlineReason(["asks_for_sms_code", "asks_for_otp"], "en");
    const reverse = presentInlineReason(["asks_for_otp", "asks_for_sms_code"], "en");

    expect(forward?.reason).toBe(reverse?.reason);
  });

  it("explains the actual weird-domain heuristic without inventing a brand comparison", () => {
    const presented = presentInlineReason(["weird_domain"], "ru");

    expect(INLINE_REASON_POLICY.weird_domain.evidence).toBe("url_structure");
    expect(presented?.evidence).toMatch(/доменное окончание|IP-адрес|ошибку формата/i);
    expect(presented?.evidence).not.toMatch(/вариантами брендов|сравнен/i);
    expect(presented?.limitation).toMatch(/не доказ/i);
    expect(presented?.text).not.toMatch(/владелец подтвержд[её]н|проверили владельца/i);
  });

  it("describes OneID/government phishing as a visible text pattern, not a domain check", () => {
    const presented = presentInlineReason(["oneid_government_phishing"], "ru");

    expect(INLINE_REASON_POLICY.oneid_government_phishing).toMatchObject({
      evidence: "text_pattern",
      limitation: "signal_not_proof",
    });
    expect(presented?.evidence).toMatch(/видимом тексте.*OneID.*госуслуг/i);
    expect(presented?.evidence).not.toMatch(/структура домена|вариантами брендов/i);
    expect(presented?.limitation).toMatch(/не доказывает/i);
  });

  it("keeps real detector output aligned with the presentation method", () => {
    const domainReasons = evaluateUrl("https://ordinary.xyz");
    const oneIdReasons = evaluateText("Обновите данные OneID для заявки");

    expect(domainReasons).toContain("weird_domain");
    expect(oneIdReasons).toContain("oneid_government_phishing");
    expect(presentInlineReason(domainReasons, "ru")?.evidence).toMatch(
      /доменное окончание|IP-адрес|ошибку формата/i,
    );
    expect(presentInlineReason(domainReasons, "ru")?.evidence).not.toMatch(/вариантами брендов/i);
    expect(presentInlineReason(oneIdReasons, "ru")?.evidence).toMatch(/видимом тексте/i);
    expect(presentInlineReason(oneIdReasons, "ru")?.evidence).not.toMatch(/структура домена/i);
  });

  it("limits an official-directory match to the exact visible identifier", () => {
    const presented = presentInlineReason(["verified_official"], "en");

    expect(presented?.evidence).toMatch(/exact.*directory/i);
    expect(presented?.limitation).toMatch(/surrounding message/i);
    expect(presented?.text).not.toMatch(/person.*verified|message.*safe/i);
  });

  it("collects official-directory and moderated-report metadata before ranking", () => {
    expect(
      collectResultReasonCodesForPresentation({
        reasons: ["valid_uz_phone"],
        verifiedContact: {
          orgName: "Example Bank",
          orgType: "bank",
          source: "https://example.test",
          display: "1000",
          contactType: "short_code",
          verificationLevel: "high",
          description: "Test fixture",
        },
        knownReports: 3,
        phoneReputation: {
          source: "ishonch_guard_moderated_reports",
          confirmedReportCount: 3,
          confidence: "medium",
          riskLevel: "suspicious",
          publicScope: "confirmed_moderated_reports_only",
        },
      }),
    ).toEqual(["known_reported", "verified_official", "valid_uz_phone"]);
  });

  it("drops hosted-platform context when a stronger result reason exists", () => {
    expect(
      collectResultReasonCodesForPresentation({
        reasons: ["hosted_app_platform", "weird_domain"],
        verifiedContact: null,
        knownReports: 0,
        phoneReputation: null,
      }),
    ).toEqual(["weird_domain"]);
  });

  it("ignores an unknown legacy reason instead of breaking presentation", () => {
    expect(
      collectResultReasonCodesForPresentation({
        reasons: ["legacy_reason" as ReasonCode, "weird_domain"],
        verifiedContact: null,
        knownReports: 0,
        phoneReputation: null,
      }),
    ).toEqual(["weird_domain"]);
  });
});
