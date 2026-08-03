// Standalone (no imports) so it stays trivially unit-testable.

/** Default: abort an LLM call if no bytes arrive for this long. */
export const LLM_IDLE_TIMEOUT_MS = 60_000;

export interface InactivityTimer {
  /** Abort signal to hand to fetch(); fires on idle timeout or parent abort. */
  signal: AbortSignal;
  /** Call whenever progress is made (e.g. a chunk arrives) to reset the idle clock. */
  touch(): void;
  /** Stop the timer and detach the parent listener. */
  clear(): void;
  /** True if the abort was caused by the idle timeout (vs. the parent signal). */
  timedOut(): boolean;
}

/**
 * Build an AbortSignal that fires when no `touch()` happens within `ms`, or when
 * an optional `parent` signal aborts. Used to bound streaming LLM calls so a hung
 * provider can't wedge a run forever.
 */
export function inactivityTimeout(ms: number, parent?: AbortSignal): InactivityTimer {
  const ctrl = new AbortController();
  let out = false;
  let handle: ReturnType<typeof setTimeout> | undefined;

  const fire = () => {
    out = true;
    ctrl.abort();
  };
  const touch = () => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(fire, ms);
  };
  const onParent = () => ctrl.abort();

  if (parent) {
    if (parent.aborted) ctrl.abort();
    else parent.addEventListener("abort", onParent, { once: true });
  }
  touch();

  return {
    signal: ctrl.signal,
    touch,
    clear: () => {
      if (handle) clearTimeout(handle);
      parent?.removeEventListener("abort", onParent);
    },
    timedOut: () => out,
  };
}
