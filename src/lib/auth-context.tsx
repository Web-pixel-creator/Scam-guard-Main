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
let sessionLoaded = false;
let rolesFor: string | null = null;
let rolesRequestId = 0;
let rolesLoading = false;
const listeners = new Set<() => void>();

function update(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function syncLoading() {
  const nextLoading = !sessionLoaded || rolesLoading;
  if (state.loading !== nextLoading) update({ loading: nextLoading });
}

function applySession(session: Session | null): Promise<void> {
  const uid = session?.user?.id ?? null;
  update({ session, user: session?.user ?? null });

  if (!uid) {
    rolesRequestId += 1;
    rolesFor = null;
    rolesLoading = false;
    update({ isAdmin: false, loading: !sessionLoaded });
    return Promise.resolve();
  }

  if (uid === rolesFor) {
    syncLoading();
    return Promise.resolve();
  }

  const requestId = ++rolesRequestId;
  rolesFor = uid;
  rolesLoading = true;
  update({ loading: true });

  return Promise.resolve(supabase.from("user_roles").select("role").eq("user_id", uid))
    .then(({ data, error }) => {
      if (requestId !== rolesRequestId || rolesFor !== uid) return;
      rolesLoading = false;
      if (error) {
        // Clear cached uid so the next auth event or reload can retry instead
        // of permanently locking out an admin after a transient query failure.
        rolesFor = null;
        update({ isAdmin: false, loading: !sessionLoaded });
        return;
      }
      update({
        isAdmin: !!data?.some((r) => r.role === "admin"),
        loading: !sessionLoaded,
      });
    })
    .catch(() => {
      if (requestId !== rolesRequestId || rolesFor !== uid) return;
      rolesFor = null;
      rolesLoading = false;
      update({ isAdmin: false, loading: !sessionLoaded });
    });
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    void applySession(session);
  });
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      sessionLoaded = true;
      return applySession(data.session);
    })
    .catch(() => {
      sessionLoaded = true;
      rolesLoading = false;
      update({ loading: false });
    });
}

/** Reset module-scoped auth store state between isolated unit tests. */
export function __resetAuthStateForTests(): void {
  state = INITIAL;
  started = false;
  sessionLoaded = false;
  rolesFor = null;
  rolesRequestId = 0;
  rolesLoading = false;
  listeners.clear();
}

export function __startAuthForTests(): void {
  start();
}

export function __getAuthStateForTests(): AuthState {
  return state;
}

export function __subscribeAuthForTests(listener: () => void): () => void {
  return subscribe(listener);
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
