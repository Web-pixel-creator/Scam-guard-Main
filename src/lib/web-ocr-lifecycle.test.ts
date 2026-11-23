import { describe, expect, it } from "vitest";
import { createWebOcrLifecycle } from "./web-ocr-lifecycle";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("per-component Web OCR lifecycle (not mounted DOM evidence)", () => {
  it("requires a completed local read before consent can claim an attempt", () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    expect(lifecycle.claimOcr(selection)).toBeNull();
    expect(lifecycle.completeRead(selection)).toBe(true);
    expect(lifecycle.claimOcr(selection)).not.toBeNull();
  });

  it("synchronously admits one same-render double invocation before either promise settles", async () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    lifecycle.completeRead(selection);
    const response = deferred<string>();
    let transfers = 0;
    const submit = async () => {
      const attempt = lifecycle.claimOcr(selection);
      if (!attempt) return;
      transfers += 1;
      await response.promise;
      lifecycle.finishAttempt(attempt);
    };
    const first = submit();
    const second = submit();
    expect(transfers).toBe(1);
    response.resolve("redacted text");
    await Promise.all([first, second]);
    expect(transfers).toBe(1);
  });

  it("does not rearm a completed or failed attempt for an old button callback", () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    lifecycle.completeRead(selection);
    const attempt = lifecycle.claimOcr(selection)!;
    expect(lifecycle.finishAttempt(attempt)).toBe(true);
    expect(lifecycle.finishAttempt(attempt)).toBe(false);
    expect(lifecycle.claimOcr(selection)).toBeNull();
    expect(lifecycle.completeRead(selection)).toBe(false);
  });

  it("requires separate consent for each new selection, including the same file selected again", () => {
    const lifecycle = createWebOcrLifecycle();
    const first = lifecycle.startSelection()!;
    lifecycle.completeRead(first);
    lifecycle.claimOcr(first);
    const second = lifecycle.startSelection()!;
    expect(second).not.toBe(first);
    expect(lifecycle.claimOcr(first)).toBeNull();
    expect(lifecycle.claimOcr(second)).toBeNull();
    lifecycle.completeRead(second);
    expect(lifecycle.claimOcr(first)).toBeNull();
    expect(lifecycle.claimOcr(second)).not.toBeNull();
  });

  it("ignores a late read success after a newer selection finishes", async () => {
    const lifecycle = createWebOcrLifecycle();
    const first = lifecycle.startSelection()!;
    const read = deferred<string>();
    const staged: string[] = [];
    const firstRead = read.promise.then((value) => {
      if (lifecycle.completeRead(first)) staged.push(value);
    });
    const second = lifecycle.startSelection()!;
    if (lifecycle.completeRead(second)) staged.push("second");
    read.resolve("first");
    await firstRead;
    expect(staged).toEqual(["second"]);
  });

  it("does not let a stale read failure clear the newer screenshot", async () => {
    const lifecycle = createWebOcrLifecycle();
    const first = lifecycle.startSelection()!;
    const read = deferred<string>();
    let errors = 0;
    const firstRead = read.promise.catch(() => {
      if (!lifecycle.isCurrentSelection(first)) return;
      errors += 1;
      lifecycle.clear();
    });
    const second = lifecycle.startSelection()!;
    lifecycle.completeRead(second);
    read.reject(new Error("synthetic read failure"));
    await firstRead;
    expect(errors).toBe(0);
    expect(lifecycle.isCurrentSelection(second)).toBe(true);
  });

  it("cancellation invalidates pending reads before an abort callback settles", async () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    const read = deferred<string>();
    let errors = 0;
    const settled = read.promise.catch(() => {
      if (lifecycle.isCurrentSelection(selection)) errors += 1;
    });
    lifecycle.clear();
    read.reject(new Error("synthetic abort"));
    await settled;
    expect(errors).toBe(0);
    expect(lifecycle.completeRead(selection)).toBe(false);
    expect(lifecycle.claimOcr(selection)).toBeNull();
  });

  it.each(["success", "failure"] as const)(
    "ignores stale OCR %s and finally without unlocking a newer attempt",
    async (outcome) => {
      const lifecycle = createWebOcrLifecycle();
      const first = lifecycle.startSelection()!;
      lifecycle.completeRead(first);
      const firstAttempt = lifecycle.claimOcr(first)!;
      const response = deferred<string>();
      const effects: string[] = [];
      const pending = response.promise
        .then(() => {
          if (lifecycle.isCurrentAttempt(firstAttempt)) effects.push("success");
        })
        .catch(() => {
          if (lifecycle.isCurrentAttempt(firstAttempt)) effects.push("failure");
        })
        .finally(() => {
          if (lifecycle.finishAttempt(firstAttempt)) effects.push("unlock");
        });
      const second = lifecycle.startSelection()!;
      lifecycle.completeRead(second);
      const secondAttempt = lifecycle.claimOcr(second)!;
      if (outcome === "success") response.resolve("old text");
      else response.reject(new Error("synthetic provider failure"));
      await pending;
      expect(effects).toEqual([]);
      expect(lifecycle.isCurrentAttempt(secondAttempt)).toBe(true);
      expect(lifecycle.claimOcr(second)).toBeNull();
    },
  );

  it("cancellation invalidates an OCR result without claiming to recall its transfer", () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    lifecycle.completeRead(selection);
    const attempt = lifecycle.claimOcr(selection)!;
    lifecycle.clear();
    expect(lifecycle.isCurrentAttempt(attempt)).toBe(false);
    expect(lifecycle.finishAttempt(attempt)).toBe(false);
  });

  it.each(["result", "meta", "failure"] as const)(
    "ignores all stale OCR-backed check %s effects without clearing a newer selection",
    async (outcome) => {
      const lifecycle = createWebOcrLifecycle();
      const first = lifecycle.startSelection()!;
      lifecycle.completeRead(first);
      const response = deferred<void>();
      const effects: string[] = [];
      const checking = response.promise
        .then(() => {
          if (!lifecycle.isCurrentSelection(first)) return;
          effects.push(outcome, "onResult");
          lifecycle.clear();
        })
        .catch(() => {
          if (!lifecycle.isCurrentSelection(first)) return;
          effects.push("log", "error");
        });
      const second = lifecycle.startSelection()!;
      lifecycle.completeRead(second);
      if (outcome === "failure") response.reject(new Error("synthetic check failure"));
      else response.resolve();
      await checking;
      expect(effects).toEqual([]);
      expect(lifecycle.isCurrentSelection(second)).toBe(true);
    },
  );

  it("allows current check completion to clear its own screenshot", () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    lifecycle.completeRead(selection);
    lifecycle.finishAttempt(lifecycle.claimOcr(selection)!);
    expect(lifecycle.isCurrentSelection(selection)).toBe(true);
    lifecycle.clear();
    expect(lifecycle.isCurrentSelection(selection)).toBe(false);
  });

  it("blocks all stale operations after unmount", () => {
    const lifecycle = createWebOcrLifecycle();
    const selection = lifecycle.startSelection()!;
    lifecycle.completeRead(selection);
    const attempt = lifecycle.claimOcr(selection)!;
    lifecycle.dispose();
    expect(lifecycle.startSelection()).toBeNull();
    expect(lifecycle.completeRead(selection)).toBe(false);
    expect(lifecycle.isCurrentSelection(selection)).toBe(false);
    expect(lifecycle.claimOcr(selection)).toBeNull();
    expect(lifecycle.isCurrentAttempt(attempt)).toBe(false);
    expect(lifecycle.finishAttempt(attempt)).toBe(false);
  });

  it("supports StrictMode setup after cleanup without reviving old work", () => {
    const lifecycle = createWebOcrLifecycle();
    const first = lifecycle.startSelection()!;
    lifecycle.completeRead(first);
    const firstAttempt = lifecycle.claimOcr(first)!;
    lifecycle.dispose();
    lifecycle.activate();
    const second = lifecycle.startSelection()!;
    expect(lifecycle.completeRead(first)).toBe(false);
    expect(lifecycle.isCurrentAttempt(firstAttempt)).toBe(false);
    expect(lifecycle.completeRead(second)).toBe(true);
    expect(lifecycle.claimOcr(second)).not.toBeNull();
  });
});
