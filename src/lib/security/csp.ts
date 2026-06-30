export const UNICORN_STUDIO_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";

const SCRIPT_SRC_DIRECTIVE_RE = /(^|;\s*)script-src\s+([^;]+)/;
const EMBED_DEV_FRAME_ANCESTORS = ["http://localhost:*", "http://127.0.0.1:*"] as const;

// Keep script-src strict: TanStack/Vite app code is loaded from self, and the
// optional Unicorn background loads from one pinned CDN URL. Inline style
// attributes are scoped to style-src-attr because the app uses React style
// props for small dynamic values; inline <style> blocks are not broadly allowed.
export const DEFAULT_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${UNICORN_STUDIO_SCRIPT_SRC}`,
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-elem 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://storage.googleapis.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function addScriptNonceToContentSecurityPolicy(policy: string, nonce: string): string {
  const trimmedNonce = nonce.trim();
  if (!trimmedNonce) return policy;

  const nonceSource = `'nonce-${trimmedNonce}'`;
  return policy.replace(SCRIPT_SRC_DIRECTIVE_RE, (match, prefix: string, sources: string) => {
    if (sources.split(/\s+/).includes(nonceSource)) return match;
    return `${prefix}script-src ${nonceSource} ${sources}`;
  });
}

const EMBED_CHECK_BASE_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-elem 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://storage.googleapis.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
] as const;

export function parseEmbedFrameAncestorAllowlist(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const allowed = new Set<string>();
  for (const value of raw.split(/[\s,]+/)) {
    const normalized = normalizeEmbedFrameAncestorSource(value);
    if (normalized) allowed.add(normalized);
  }
  return Array.from(allowed);
}

export function buildEmbedCheckContentSecurityPolicy(
  allowedFrameAncestors: readonly string[] = [],
): string {
  const normalizedAllowed = new Set<string>();
  for (const source of allowedFrameAncestors) {
    const normalized = normalizeEmbedFrameAncestorSource(source);
    if (normalized) normalizedAllowed.add(normalized);
  }

  const frameAncestors = ["'self'", ...normalizedAllowed, ...EMBED_DEV_FRAME_ANCESTORS].join(" ");

  return [...EMBED_CHECK_BASE_CONTENT_SECURITY_POLICY, `frame-ancestors ${frameAncestors}`].join(
    "; ",
  );
}

function normalizeEmbedFrameAncestorSource(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed === "http://localhost:*" || trimmed === "http://127.0.0.1:*") return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.username || url.password) return null;
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const EMBED_CHECK_CONTENT_SECURITY_POLICY = buildEmbedCheckContentSecurityPolicy();
