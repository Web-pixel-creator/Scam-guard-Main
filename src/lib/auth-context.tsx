import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

// Admin-only session state. It lives in this module, started by the first
// useAuth() call, instead of a provider in the root layout: the Supabase
// client then loads with the login/admin chunks and not on public pages.
const signOut = async () => {
  await supabase.auth.signOut();
};
const INITIAL: AuthState = { user: null, session: null, loading: true, isAdmin: false, signOut };

let state = INITIAL;
let started = false;
let rolesFor: string | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function applySession(session: Session | null) {
  update({ session, user: session?.user ?? null });
  const uid = session?.user?.id ?? null;
  if (uid === rolesFor) return;
  rolesFor = uid;
  if (!uid) {
    update({ isAdmin: false });
    return;
  }
  void supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .then(({ data }) => {
      // A newer session may have replaced this one while the roles loaded.
      if (rolesFor === uid) update({ isAdmin: !!data?.some((r) => r.role === "admin") });
    });
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => applySession(session));
  void supabase.auth.getSession().then(({ data }) => {
    applySession(data.session);
    update({ loading: false });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuth(): AuthState {
  useEffect(start, []);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );
}
