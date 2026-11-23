export const MEDIA_PROVIDER_CONSENT_TTL_MS = 10 * 60 * 1000;
export const MEDIA_PROVIDER_CONSENT_CANCEL_CALLBACK = "media_consent:cancel";

export type MediaProviderKind = "image" | "voice" | "report_image";

export type MediaProviderConsentCallback =
  | { action: "allow"; kind: MediaProviderKind }
  | { action: "cancel" };

const KINDS: readonly MediaProviderKind[] = ["image", "voice", "report_image"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function isMediaProviderReportFlowId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function mediaProviderConsentCallback(kind: MediaProviderKind): string {
  return `media_consent:${kind}`;
}

export function parseMediaProviderConsentCallback(
  value: string,
): MediaProviderConsentCallback | null {
  if (value === MEDIA_PROVIDER_CONSENT_CANCEL_CALLBACK) return { action: "cancel" };
  if (!value.startsWith("media_consent:")) return null;
  const kind = value.slice("media_consent:".length);
  return KINDS.includes(kind as MediaProviderKind)
    ? { action: "allow", kind: kind as MediaProviderKind }
    : null;
}
