/** Client-instance identities only: no image/hash/persistence or server claim. */
export type WebOcrSelection = Readonly<{ kind: "selection" }>;
export type WebOcrAttempt = Readonly<{ selection: WebOcrSelection }>;

/**
 * Synchronous screenshot lifecycle admission for one mounted component.
 * It cannot prevent a separate HTTP retry or recall an already-sent image.
 */
export function createWebOcrLifecycle() {
  let active = true;
  let selection: WebOcrSelection | null = null;
  let phase: "reading" | "ready" | "consumed" | null = null;
  let attempt: WebOcrAttempt | null = null;

  function clear() {
    selection = null;
    phase = null;
    attempt = null;
  }

  return {
    activate() {
      active = true;
    },
    dispose() {
      active = false;
      clear();
    },
    clear,
    startSelection(): WebOcrSelection | null {
      if (!active) return null;
      clear();
      selection = Object.freeze({ kind: "selection" });
      phase = "reading";
      return selection;
    },
    isCurrentSelection(candidate: WebOcrSelection): boolean {
      return active && selection === candidate;
    },
    completeRead(candidate: WebOcrSelection): boolean {
      if (!active || selection !== candidate || phase !== "reading") return false;
      phase = "ready";
      return true;
    },
    claimOcr(candidate: WebOcrSelection): WebOcrAttempt | null {
      if (!active || selection !== candidate || phase !== "ready") return null;
      phase = "consumed";
      attempt = Object.freeze({ selection: candidate });
      return attempt;
    },
    isCurrentAttempt(candidate: WebOcrAttempt): boolean {
      return active && attempt === candidate;
    },
    finishAttempt(candidate: WebOcrAttempt): boolean {
      if (!active || attempt !== candidate) return false;
      attempt = null;
      // Remain consumed: finishing must not rearm an old consent callback.
      return true;
    },
  };
}
