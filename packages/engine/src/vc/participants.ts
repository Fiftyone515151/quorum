// Panel selection validation. Standalone + pure so it's unit-testable and
// reusable between the API route and any future callers.

export const MIN_PANELISTS = 4;
export const MAX_PANELISTS = 6;

/** Return the set of ids that appear more than once, in first-seen order. */
export function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dups.add(id);
    else seen.add(id);
  }
  return [...dups];
}

export type ParticipantsCheck = { ok: true } | { ok: false; error: string };

/** Validate a chosen panel: size bounds + no duplicate personas. */
export function validateParticipants(ids: string[]): ParticipantsCheck {
  if (ids.length < MIN_PANELISTS) return { ok: false, error: `Select at least ${MIN_PANELISTS} panelists.` };
  if (ids.length > MAX_PANELISTS) return { ok: false, error: `Select at most ${MAX_PANELISTS} panelists.` };
  const dups = findDuplicates(ids);
  if (dups.length) return { ok: false, error: `Duplicate panelists selected: ${dups.join(", ")}` };
  return { ok: true };
}
