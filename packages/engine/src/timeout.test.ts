import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inactivityTimeout } from "./timeout";

describe("inactivityTimeout (LLM hang guard)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("aborts after the idle period and reports timedOut()", () => {
    const t = inactivityTimeout(1000);
    expect(t.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(t.signal.aborted).toBe(true);
    expect(t.timedOut()).toBe(true);
    t.clear();
  });

  it("touch() resets the idle clock so progress keeps the request alive", () => {
    const t = inactivityTimeout(1000);
    vi.advanceTimersByTime(900);
    t.touch();
    vi.advanceTimersByTime(900);
    expect(t.signal.aborted).toBe(false); // still alive because we touched
    vi.advanceTimersByTime(100);
    expect(t.signal.aborted).toBe(true);
    t.clear();
  });

  it("clear() stops the timer from ever firing", () => {
    const t = inactivityTimeout(1000);
    t.clear();
    vi.advanceTimersByTime(5000);
    expect(t.signal.aborted).toBe(false);
    expect(t.timedOut()).toBe(false);
  });

  it("propagates a parent abort but does NOT flag it as a timeout", () => {
    const parent = new AbortController();
    const t = inactivityTimeout(10_000, parent.signal);
    parent.abort();
    expect(t.signal.aborted).toBe(true);
    expect(t.timedOut()).toBe(false);
    t.clear();
  });

  it("is already aborted when constructed from an already-aborted parent", () => {
    const parent = new AbortController();
    parent.abort();
    const t = inactivityTimeout(10_000, parent.signal);
    expect(t.signal.aborted).toBe(true);
    t.clear();
  });
});
