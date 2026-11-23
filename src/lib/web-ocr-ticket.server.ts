import { randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Lang } from "@/lib/i18n";
import { hashIdentifier } from "@/lib/risk/hash";

export interface WebOcrTicketClaim {
  readonly id: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
}

const TICKET_TTL_MS = 600_000;
const MAC_DOMAIN = "web-ocr-ticket-v1:";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DIGEST_RE = /^[0-9a-f]{64}$/u;
const TIMESTAMP_RE = /^[1-9][0-9]{0,15}$/u;
// v1 + UUID + two safe-integer timestamps + lang + digest + MAC + six dots.
const MAX_TICKET_LENGTH = 206;

function unavailable(): Error {
  return new Error("ocr_operation_unavailable");
}

function validLanguage(value: unknown): value is Lang {
  return value === "ru" || value === "uz" || value === "en";
}

function assertBinding(imageDigest: string, lang: Lang): void {
  if (typeof imageDigest !== "string" || !DIGEST_RE.test(imageDigest) || !validLanguage(lang)) {
    throw unavailable();
  }
}

function assertCurrentClaim(claim: WebOcrTicketClaim, notBeforeMs?: number): number {
  const now = Date.now();
  if (
    !claim ||
    typeof claim.id !== "string" ||
    !UUID_RE.test(claim.id) ||
    !Number.isSafeInteger(claim.issuedAtMs) ||
    claim.issuedAtMs <= 0 ||
    !Number.isSafeInteger(claim.expiresAtMs) ||
    claim.expiresAtMs - claim.issuedAtMs !== TICKET_TTL_MS ||
    !Number.isSafeInteger(now) ||
    now <= 0 ||
    now < claim.issuedAtMs ||
    (notBeforeMs !== undefined && now < notBeforeMs) ||
    now >= claim.expiresAtMs
  ) {
    throw unavailable();
  }
  return now;
}

/** Issues only a signed capability; no claim row, image or digest is persisted. */
export async function issueWebOcrTicket(imageDigest: string, lang: Lang): Promise<string> {
  try {
    assertBinding(imageDigest, lang);
    const issuedAtMs = Date.now();
    const claim = { id: randomUUID(), issuedAtMs, expiresAtMs: issuedAtMs + TICKET_TTL_MS };
    const observedAtMs = assertCurrentClaim(claim);
    const payload = `v1.${claim.id}.${claim.issuedAtMs}.${claim.expiresAtMs}.${lang}.${imageDigest}`;
    // Every payload field is already canonical lowercase. hashIdentifier reads
    // configured secrets per invocation and returns ONLY the active write HMAC.
    const signature = await hashIdentifier(MAC_DOMAIN + payload);
    if (!DIGEST_RE.test(signature)) throw unavailable();
    assertCurrentClaim(claim, observedAtMs);
    return `${payload}.${signature}`;
  } catch {
    throw unavailable();
  }
}

/** Active-key verification only: rotating the active pepper invalidates old tickets. */
export async function validateWebOcrTicket(
  ticket: string,
  imageDigest: string,
  lang: Lang,
): Promise<WebOcrTicketClaim> {
  try {
    assertBinding(imageDigest, lang);
    if (typeof ticket !== "string" || ticket.length > MAX_TICKET_LENGTH) throw unavailable();
    const fields = ticket.split(".");
    if (fields.length !== 7) throw unavailable();
    const [version, id, issued, expires, ticketLang, digest, signature] = fields;
    if (
      version !== "v1" ||
      !UUID_RE.test(id) ||
      !TIMESTAMP_RE.test(issued) ||
      !TIMESTAMP_RE.test(expires) ||
      !validLanguage(ticketLang) ||
      ticketLang !== lang ||
      !DIGEST_RE.test(digest) ||
      digest !== imageDigest ||
      !DIGEST_RE.test(signature)
    ) {
      throw unavailable();
    }
    const claim = { id, issuedAtMs: Number(issued), expiresAtMs: Number(expires) };
    if (String(claim.issuedAtMs) !== issued || String(claim.expiresAtMs) !== expires) {
      throw unavailable();
    }
    const observedAtMs = assertCurrentClaim(claim);
    const payload = fields.slice(0, 6).join(".");
    const expected = await hashIdentifier(MAC_DOMAIN + payload);
    if (
      !DIGEST_RE.test(expected) ||
      !timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
    ) {
      throw unavailable();
    }
    // Hashing is async: expiry or a backward clock step during it fails closed.
    assertCurrentClaim(claim, observedAtMs);
    return Object.freeze(claim);
  } catch {
    throw unavailable();
  }
}

/** Burn once immediately before provider admission; uncertainty never permits transfer. */
export async function consumeWebOcrTicket(claim: WebOcrTicketClaim): Promise<void> {
  try {
    const consumed = Object.freeze({
      id: claim.id,
      issuedAtMs: claim.issuedAtMs,
      expiresAtMs: claim.expiresAtMs,
    });
    const observedAtMs = assertCurrentClaim(consumed);
    const receipt = await (supabaseAdmin as unknown as SupabaseClient).rpc("claim_web_ocr_ticket", {
      p_ticket_id: consumed.id,
      p_issued_at_ms: consumed.issuedAtMs,
      p_expires_at_ms: consumed.expiresAtMs,
    });
    if (receipt?.data !== true || receipt.error !== null) throw unavailable();
    // A committed claim can be burned while its receipt is delayed. Never let
    // receipt latency extend local admission beyond its immutable deadline.
    assertCurrentClaim(consumed, observedAtMs);
  } catch {
    // Never log the signed ticket, digest, image, driver diagnostic or credentials.
    throw unavailable();
  }
}
