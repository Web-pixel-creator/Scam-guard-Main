export const UNICORN_STUDIO_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";

const SCRIPT_SRC_DIRECTIVE_RE = /(^|;\s*)script-src\s+([^;]+)/;

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

// Public iframe runtime. frame-ancestors is intentionally broader than the main
// site because this route is the embeddable partner widget; partner allow-list
// enforcement belongs in a follow-up once partners are known.
export const EMBED_CHECK_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-elem 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://storage.googleapis.com",
  "frame-ancestors 'self' https: http://localhost:* http://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
