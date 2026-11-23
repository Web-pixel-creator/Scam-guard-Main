import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lang } from "@/lib/i18n";

const h = vi.hoisted(() => ({ rpc: vi.fn(), randomUUID: vi.fn(), timingSafeEqual: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: h.rpc } }));
vi.mock("node:crypto", async (importActual) => {
  const actual = await importActual<typeof import("node:crypto")>();
  h.randomUUID.mockImplementation(actual.randomUUID);
  h.timingSafeEqual.mockImplementation(actual.timingSafeEqual);
  return { ...actual, randomUUID: h.randomUUID, timingSafeEqual: h.timingSafeEqual };
});

import {
  consumeWebOcrTicket,
  issueWebOcrTicket,
  validateWebOcrTicket,
  type WebOcrTicketClaim,
} from "./web-ocr-ticket.server";

const NOW = 1_791_504_000_000;
const TTL = 600_000;
const ID = "963b2c4d-48dc-4e7d-9ead-2891c7b0a107";
const DIGEST = "a1".repeat(32);
const OTHER_DIGEST = "b2".repeat(32);
const PEPPER = "synthetic-ocr-active-pepper";
const ERROR = "ocr_operation_unavailable";
const CLAIM: WebOcrTicketClaim = { id: ID, issuedAtMs: NOW, expiresAtMs: NOW + TTL };

function signed(fields: string[], pepper = PEPPER): string {
  const payload = fields.join(".");
  const signature = createHmac("sha256", pepper)
    .update(`web-ocr-ticket-v1:${payload}`)
    .digest("hex");
  return `${payload}.${signature}`;
}

function validFields(): string[] {
  return ["v1", ID, String(NOW), String(NOW + TTL), "ru", DIGEST];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("HASH_PEPPER_SECRET", "");
  vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", "v3");
  vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", PEPPER);
  vi.stubEnv("HASH_PEPPER_PREVIOUS_VERSION", "");
  vi.stubEnv("HASH_PEPPER_PREVIOUS_SECRET", "");
  h.rpc.mockReset().mockResolvedValue({ data: true, error: null });
  h.randomUUID.mockClear();
  h.timingSafeEqual.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network denied");
    }),
  );
});

afterEach(() => {
  try {
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  }
});

describe("server-issued image-bound Web OCR tickets", () => {
  it.each(["ru", "uz", "en"] as const)(
    "issues and validates exact canonical %s fields",
    async (lang) => {
      h.randomUUID.mockReturnValueOnce(ID);
      const ticket = await issueWebOcrTicket(DIGEST, lang);
      const fields = validFields();
      fields[4] = lang;
      expect(ticket).toBe(signed(fields));
      expect(ticket).toBe(ticket.toLowerCase());
      await expect(validateWebOcrTicket(ticket, DIGEST, lang)).resolves.toEqual(CLAIM);
      expect(h.randomUUID).toHaveBeenCalledTimes(1);
      expect(h.timingSafeEqual).toHaveBeenCalledTimes(1);
      expect(h.timingSafeEqual.mock.calls[0].map((value: Buffer) => value.length)).toEqual([
        32, 32,
      ]);
      expect(h.rpc).not.toHaveBeenCalled();
      expect(ticket).not.toContain(PEPPER);
    },
  );

  it("uses a new server-generated UUID for the same image and no issuance RPC", async () => {
    const first = await issueWebOcrTicket(DIGEST, "ru");
    const second = await issueWebOcrTicket(DIGEST, "ru");
    expect(first.split(".")[1]).not.toBe(second.split(".")[1]);
    expect(h.randomUUID).toHaveBeenCalledTimes(2);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("keeps UUID generation independent of the signing pepper", async () => {
    h.randomUUID.mockReturnValueOnce(ID).mockReturnValueOnce(ID);
    const first = await issueWebOcrTicket(DIGEST, "ru");
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "different-synthetic-pepper");
    const second = await issueWebOcrTicket(DIGEST, "ru");
    expect(first.split(".").slice(0, 6)).toEqual(second.split(".").slice(0, 6));
    expect(first.split(".")[6]).not.toBe(second.split(".")[6]);
  });

  it("invalidates outstanding tickets after active rotation even when the old key is retained", async () => {
    const ticket = await issueWebOcrTicket(DIGEST, "ru");
    vi.stubEnv("HASH_PEPPER_PREVIOUS_VERSION", "v3");
    vi.stubEnv("HASH_PEPPER_PREVIOUS_SECRET", PEPPER);
    vi.stubEnv("HASH_PEPPER_ACTIVE_VERSION", "v4");
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "rotated-synthetic-pepper");
    await expect(validateWebOcrTicket(ticket, DIGEST, "ru")).rejects.toThrow(ERROR);
    const replacement = await issueWebOcrTicket(DIGEST, "ru");
    await expect(validateWebOcrTicket(replacement, DIGEST, "ru")).resolves.toMatchObject({
      issuedAtMs: NOW,
    });
  });

  it.each([
    "",
    "a".repeat(63),
    "a".repeat(65),
    "A".repeat(64),
    "g".repeat(64),
    ` ${DIGEST}`,
    `${DIGEST}\n`,
    null,
    123,
  ])("rejects noncanonical digest %j", async (digest) => {
    await expect(issueWebOcrTicket(digest as string, "ru")).rejects.toThrow(ERROR);
    await expect(
      validateWebOcrTicket(signed(validFields()), digest as string, "ru"),
    ).rejects.toThrow(ERROR);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each(["RU", "fr", "", "en ", null])(
    "rejects unsupported/noncanonical language %j",
    async (lang) => {
      await expect(issueWebOcrTicket(DIGEST, lang as Lang)).rejects.toThrow(ERROR);
      await expect(
        validateWebOcrTicket(signed(validFields()), DIGEST, lang as Lang),
      ).rejects.toThrow(ERROR);
    },
  );

  it.each([NaN, Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid or overflowing issuance clock %s",
    async (now) => {
      vi.spyOn(Date, "now").mockReturnValue(now);
      await expect(issueWebOcrTicket(DIGEST, "ru")).rejects.toThrow(ERROR);
    },
  );

  it.each([NOW - 1, NOW + TTL, NOW + TTL + 1, NaN, Infinity, 0, 1.5])(
    "rejects ticket with invalid/backward/expired clock %s",
    async (now) => {
      vi.spyOn(Date, "now").mockReturnValue(now);
      await expect(validateWebOcrTicket(signed(validFields()), DIGEST, "ru")).rejects.toThrow(
        ERROR,
      );
    },
  );

  it.each([NOW, NOW + TTL - 1])("accepts the exact valid time boundary %s", async (now) => {
    vi.setSystemTime(now);
    await expect(validateWebOcrTicket(signed(validFields()), DIGEST, "ru")).resolves.toEqual(CLAIM);
  });

  it.each([
    [0, "v2"],
    [1, ID.toUpperCase()],
    [1, "00000000-0000-0000-0000-000000000000"],
    [1, ID.replace("-4e7d-", "-7e7d-")],
    [1, ID.replace("-9ead-", "-7ead-")],
    [2, `0${NOW}`],
    [2, "+1791504000000"],
    [2, "1e12"],
    [2, "1791504000000.0"],
    [2, "0"],
    [2, "9007199254740992"],
    [3, String(NOW + TTL - 1)],
    [3, String(NOW + TTL + 1)],
    [3, String(NOW)],
    [4, "RU"],
    [4, "en"],
    [5, OTHER_DIGEST],
    [5, DIGEST.toUpperCase()],
  ] as const)(
    "rejects a correctly signed invalid/binding field %s=%s",
    async (index, replacement) => {
      const fields = validFields();
      fields[index] = replacement;
      await expect(validateWebOcrTicket(signed(fields), DIGEST, "ru")).rejects.toThrow(ERROR);
    },
  );

  it.each([0, 1, 2, 3, 4, 5, 6])(
    "rejects field tampering without a new signature (field %s)",
    async (index) => {
      const fields = signed(validFields()).split(".");
      const replacements = [
        "v2",
        "863b2c4d-48dc-4e7d-9ead-2891c7b0a107",
        String(NOW - 1),
        String(NOW + TTL - 1),
        "en",
        OTHER_DIGEST,
        "0".repeat(64),
      ];
      fields[index] = replacements[index];
      await expect(validateWebOcrTicket(fields.join("."), DIGEST, "ru")).rejects.toThrow(ERROR);
    },
  );

  it.each(["", "v1", "x".repeat(207), null, 123])(
    "rejects malformed/overlong ticket %j",
    async (ticket) => {
      await expect(validateWebOcrTicket(ticket as string, DIGEST, "ru")).rejects.toThrow(ERROR);
    },
  );

  it.each([
    "leading",
    "trailing",
    "extra",
    "uppercase-signature",
    "short-signature",
    "nonhex-signature",
  ])("rejects noncanonical serialization: %s", async (kind) => {
    const ticket = signed(validFields());
    const fields = ticket.split(".");
    if (kind === "uppercase-signature") fields[6] = fields[6].toUpperCase();
    if (kind === "short-signature") fields[6] = fields[6].slice(1);
    if (kind === "nonhex-signature") fields[6] = "g".repeat(64);
    const malformed =
      kind === "leading"
        ? ` ${ticket}`
        : kind === "trailing"
          ? `${ticket}\n`
          : kind === "extra"
            ? `${ticket}.extra`
            : fields.join(".");
    await expect(validateWebOcrTicket(malformed, DIGEST, "ru")).rejects.toThrow(ERROR);
  });

  it("checks both image and language binding", async () => {
    const ticket = await issueWebOcrTicket(DIGEST, "ru");
    await expect(validateWebOcrTicket(ticket, OTHER_DIGEST, "ru")).rejects.toThrow(ERROR);
    await expect(validateWebOcrTicket(ticket, DIGEST, "en")).rejects.toThrow(ERROR);
  });

  it("rejects another HMAC domain and returns immutable validated metadata only", async () => {
    const fields = validFields();
    const payload = fields.join(".");
    const wrong = createHmac("sha256", PEPPER).update(payload).digest("hex");
    await expect(validateWebOcrTicket(`${payload}.${wrong}`, DIGEST, "ru")).rejects.toThrow(ERROR);
    const claim = await validateWebOcrTicket(signed(fields), DIGEST, "ru");
    expect(Object.isFrozen(claim)).toBe(true);
    expect(Object.keys(claim).sort()).toEqual(["expiresAtMs", "id", "issuedAtMs"]);
  });

  it.each(["issue", "validate"] as const)(
    "rechecks expiry after async MAC work: %s",
    async (operation) => {
      vi.spyOn(Date, "now")
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(operation === "issue" ? NOW : NOW + TTL)
        .mockReturnValue(NOW + TTL);
      const promise =
        operation === "issue"
          ? issueWebOcrTicket(DIGEST, "ru")
          : validateWebOcrTicket(signed(validFields()), DIGEST, "ru");
      await expect(promise).rejects.toThrow(ERROR);
    },
  );

  it.each(["issue", "validate"] as const)(
    "rejects a backward clock step during MAC work even inside the validity window: %s",
    async (operation) => {
      const now = vi.spyOn(Date, "now");
      if (operation === "issue") now.mockReturnValueOnce(NOW);
      now.mockReturnValueOnce(NOW + 100).mockReturnValue(NOW + 50);
      const promise =
        operation === "issue"
          ? issueWebOcrTicket(DIGEST, "ru")
          : validateWebOcrTicket(signed(validFields()), DIGEST, "ru");
      await expect(promise).rejects.toThrow(ERROR);
    },
  );

  it("sanitizes missing configuration and cryptographic failures without logging", async () => {
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", "");
    await expect(issueWebOcrTicket(DIGEST, "ru")).rejects.toThrow(/^ocr_operation_unavailable$/u);
    await expect(validateWebOcrTicket(signed(validFields()), DIGEST, "ru")).rejects.toThrow(
      /^ocr_operation_unavailable$/u,
    );
    vi.stubEnv("HASH_PEPPER_ACTIVE_SECRET", PEPPER);
    vi.spyOn(crypto.subtle, "sign").mockRejectedValueOnce(
      new Error("synthetic-private-crypto-error"),
    );
    await expect(issueWebOcrTicket(DIGEST, "ru")).rejects.toThrow(/^ocr_operation_unavailable$/u);
  });
});

describe("one-attempt Web OCR ticket consume adapter", () => {
  it("uses only UUID and immutable numeric times in the exact RPC", async () => {
    const claim = await validateWebOcrTicket(signed(validFields()), DIGEST, "ru");
    await expect(consumeWebOcrTicket(claim)).resolves.toBeUndefined();
    expect(h.rpc).toHaveBeenCalledExactlyOnceWith("claim_web_ocr_ticket", {
      p_ticket_id: ID,
      p_issued_at_ms: NOW,
      p_expires_at_ms: NOW + TTL,
    });
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain(DIGEST);
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain(PEPPER);
  });

  it("denies a duplicate claim without retrying or minting a replacement", async () => {
    h.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await consumeWebOcrTicket(CLAIM);
    await expect(consumeWebOcrTicket(CLAIM)).rejects.toThrow(ERROR);
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.randomUUID).not.toHaveBeenCalled();
  });

  it.each([
    null,
    undefined,
    {},
    { data: true },
    { data: true, error: undefined },
    { data: true, error: false },
    { data: true, error: { message: "private diagnostic" } },
    { data: false, error: null },
    { data: null, error: null },
    { data: "true", error: null },
    { data: 1, error: null },
    { data: [true], error: null },
    { data: { claimed: true }, error: null },
  ])("denies malformed, unsuccessful or uncertain receipt %j with one call", async (receipt) => {
    h.rpc.mockResolvedValueOnce(receipt);
    await expect(consumeWebOcrTicket(CLAIM)).rejects.toThrow(/^ocr_operation_unavailable$/u);
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.randomUUID).not.toHaveBeenCalled();
  });

  it("does not retry an ambiguous lost committed response or expose its diagnostic", async () => {
    h.rpc.mockRejectedValueOnce(new Error(`lost committed response ${PEPPER} ${DIGEST}`));
    await expect(consumeWebOcrTicket(CLAIM)).rejects.toThrow(/^ocr_operation_unavailable$/u);
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.randomUUID).not.toHaveBeenCalled();
  });

  it("revalidates expiry after validation before touching the RPC", async () => {
    const claim = await validateWebOcrTicket(signed(validFields()), DIGEST, "ru");
    vi.setSystemTime(NOW + TTL);
    await expect(consumeWebOcrTicket(claim)).rejects.toThrow(ERROR);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([NOW + TTL, NOW - 1, NaN])(
    "denies expired/backward/invalid time after an exact successful RPC receipt (%s)",
    async (receivedAt) => {
      h.rpc.mockImplementationOnce(async () => {
        vi.spyOn(Date, "now").mockReturnValue(receivedAt);
        return { data: true, error: null };
      });
      await expect(consumeWebOcrTicket(CLAIM)).rejects.toThrow(ERROR);
      expect(h.rpc).toHaveBeenCalledTimes(1);
      expect(h.randomUUID).not.toHaveBeenCalled();
    },
  );

  it("checks the original immutable deadline even if the caller mutates its input during RPC", async () => {
    const claim = { ...CLAIM };
    h.rpc.mockImplementationOnce(async () => {
      claim.issuedAtMs += TTL;
      claim.expiresAtMs += TTL;
      vi.setSystemTime(NOW + TTL);
      return { data: true, error: null };
    });
    await expect(consumeWebOcrTicket(claim)).rejects.toThrow(ERROR);
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it("denies a backward step during RPC even if the ticket is still unexpired", async () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(NOW + 100)
      .mockReturnValue(NOW + 50);
    await expect(consumeWebOcrTicket(CLAIM)).rejects.toThrow(ERROR);
    expect(h.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    null,
    {},
    { ...CLAIM, id: ID.toUpperCase() },
    { ...CLAIM, issuedAtMs: NOW + 1 },
    { ...CLAIM, expiresAtMs: NOW + TTL + 1 },
    { ...CLAIM, issuedAtMs: NaN },
    { ...CLAIM, expiresAtMs: Infinity },
    { ...CLAIM, issuedAtMs: String(NOW) },
  ])("denies invalid claim %j before any RPC", async (claim) => {
    await expect(consumeWebOcrTicket(claim as WebOcrTicketClaim)).rejects.toThrow(ERROR);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("denies backward time before the consume RPC", async () => {
    vi.setSystemTime(NOW - 1);
    await expect(consumeWebOcrTicket(CLAIM)).rejects.toThrow(ERROR);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
