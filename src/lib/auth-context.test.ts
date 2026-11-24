import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

type RolesResult = { data: Array<{ role: string }> | null; error: unknown };
type AuthListener = (event: string, session: Session | null) => void;

const hoisted = vi.hoisted(() => ({
  authListener: null as AuthListener | null,
  getSessionMock: vi.fn<() => Promise<{ data: { session: Session | null } }>>(),
  rolesQueryMock: vi.fn<() => Promise<RolesResult>>(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthListener) => {
        hoisted.authListener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: () => hoisted.getSessionMock(),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: () => ({
      select: () => ({
        eq: () => hoisted.rolesQueryMock(),
      }),
    }),
  },
}));

import {
  __getAuthStateForTests,
  __resetAuthStateForTests,
  __startAuthForTests,
  __subscribeAuthForTests,
} from "./auth-context";

function fakeSession(id: string): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    user: { id, email: "admin@example.com" } as Session["user"],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  __resetAuthStateForTests();
  hoisted.authListener = null;
  hoisted.getSessionMock.mockReset();
  hoisted.rolesQueryMock.mockReset();
});

describe("auth-context admin role loading race guard", () => {
  it("keeps loading=true until user_roles resolves so /admin never flashes access denied", async () => {
    const rolesDeferred = deferred<RolesResult>();
    hoisted.getSessionMock.mockResolvedValue({ data: { session: fakeSession("admin-1") } });
    hoisted.rolesQueryMock.mockReturnValue(rolesDeferred.promise);

    const observed: Array<{ loading: boolean; isAdmin: boolean; hasUser: boolean }> = [];
    const unsubscribe = __subscribeAuthForTests(() => {
      const snap = __getAuthStateForTests();
      observed.push({ loading: snap.loading, isAdmin: snap.isAdmin, hasUser: !!snap.user });
    });

    __startAuthForTests();
    await flushMicrotasks();

    // Session is known, but user_roles is still in flight -> must stay loading=true.
    expect(__getAuthStateForTests().user?.id).toBe("admin-1");
    expect(__getAuthStateForTests().loading).toBe(true);
    expect(__getAuthStateForTests().isAdmin).toBe(false);

    // No intermediate snapshot with { loading: false, isAdmin: false, hasUser: true }.
    expect(observed.some((s) => s.hasUser && !s.loading && !s.isAdmin)).toBe(false);

    rolesDeferred.resolve({ data: [{ role: "admin" }], error: null });
    await flushMicrotasks();

    expect(__getAuthStateForTests().loading).toBe(false);
    expect(__getAuthStateForTests().isAdmin).toBe(true);
    expect(hoisted.rolesQueryMock).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("deduplicates user_roles fetch when INITIAL_SESSION fires before getSession resolves", async () => {
    const sessionDeferred = deferred<{ data: { session: Session | null } }>();
    const rolesDeferred = deferred<RolesResult>();
    hoisted.getSessionMock.mockReturnValue(sessionDeferred.promise);
    hoisted.rolesQueryMock.mockReturnValue(rolesDeferred.promise);

    __startAuthForTests();
    hoisted.authListener?.("INITIAL_SESSION", fakeSession("admin-2"));
    await flushMicrotasks();

    sessionDeferred.resolve({ data: { session: fakeSession("admin-2") } });
    await flushMicrotasks();

    expect(hoisted.rolesQueryMock).toHaveBeenCalledTimes(1);
    expect(__getAuthStateForTests().loading).toBe(true);

    rolesDeferred.resolve({ data: [{ role: "admin" }], error: null });
    await flushMicrotasks();

    expect(__getAuthStateForTests().loading).toBe(false);
    expect(__getAuthStateForTests().isAdmin).toBe(true);
  });

  it("retries user_roles on the next auth event after a transient query error", async () => {
    hoisted.getSessionMock.mockResolvedValue({ data: { session: fakeSession("admin-3") } });
    hoisted.rolesQueryMock
      .mockResolvedValueOnce({ data: null, error: { message: "network_timeout" } })
      .mockResolvedValueOnce({ data: [{ role: "admin" }], error: null });

    __startAuthForTests();
    await flushMicrotasks();

    expect(__getAuthStateForTests().loading).toBe(false);
    expect(__getAuthStateForTests().isAdmin).toBe(false);

    hoisted.authListener?.("TOKEN_REFRESHED", fakeSession("admin-3"));
    await flushMicrotasks();

    expect(hoisted.rolesQueryMock).toHaveBeenCalledTimes(2);
    expect(__getAuthStateForTests().loading).toBe(false);
    expect(__getAuthStateForTests().isAdmin).toBe(true);
  });

  it("ignores stale role responses if the user signs out while user_roles is in flight", async () => {
    const rolesDeferred = deferred<RolesResult>();
    hoisted.getSessionMock.mockResolvedValue({ data: { session: fakeSession("admin-4") } });
    hoisted.rolesQueryMock.mockReturnValue(rolesDeferred.promise);

    __startAuthForTests();
    await flushMicrotasks();

    hoisted.authListener?.("SIGNED_OUT", null);
    await flushMicrotasks();

    rolesDeferred.resolve({ data: [{ role: "admin" }], error: null });
    await flushMicrotasks();

    expect(__getAuthStateForTests().user).toBeNull();
    expect(__getAuthStateForTests().isAdmin).toBe(false);
    expect(__getAuthStateForTests().loading).toBe(false);
  });
});
