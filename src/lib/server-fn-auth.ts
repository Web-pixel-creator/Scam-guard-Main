import { createMiddleware } from "@tanstack/react-start";

// Replaces the generated attachSupabaseAuth in start.ts with the same bearer
// token for signed-in admins. Public visitors have no stored Supabase session,
// so their checks no longer load the Supabase client or read a session first;
// the client arrives in its own chunk only when a session exists.
const SESSION_KEY = /^sb-.+-auth-token$/u;

export function hasStoredSupabaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && SESSION_KEY.test(key)) return true;
    }
  } catch {
    // Storage is blocked: Supabase cannot have persisted a session either.
  }
  return false;
}

export const attachSupabaseAuthWhenSignedIn = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (!hasStoredSupabaseSession()) return next();
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
