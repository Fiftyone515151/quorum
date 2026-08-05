// Compact one-line preview of a run's outcome, shared by the history API and
// the home page's meeting cards.
export type Tone = "good" | "warn" | "bad" | "neutral";
export interface RunPreview { badge: string; tone: Tone; line: string; score?: number }

export function summarize(mode: string, result: any, status: string): RunPreview {
  if (!result) {
    if (status === "failed") return { badge: "Failed", tone: "bad", line: "This run did not finish." };
    if (status === "awaiting_founder") return { badge: "Awaiting you", tone: "warn", line: "Waiting for your input." };
    return { badge: status === "done" ? "Done" : "In progress", tone: "neutral", line: "" };
  }
  const tri = (v: string): Tone => (v === "ADVANCE" || v === "INVEST" ? "good" : v === "WATCH" || v === "CONDITIONAL" ? "warn" : "bad");
  if (mode === "screening") return { badge: result.outcome, tone: tri(result.outcome), line: result.reason ?? "", score: result.score };
  if (mode === "ic") return { badge: result.verdict, tone: tri(result.verdict), line: result.rationale ?? "" };
  if (mode === "board") {
    const n = result.action_list?.length ?? 0;
    return { badge: `${n} action${n === 1 ? "" : "s"}`, tone: "neutral", line: result.action_list?.[0]?.suggestion ?? "" };
  }
  if (mode === "tea") {
    const n = result.theme_map?.length ?? 0;
    return { badge: `${n} theme${n === 1 ? "" : "s"}`, tone: "neutral", line: result.theme_map?.[0] ?? result.surprising_angles?.[0] ?? "" };
  }
  return { badge: status, tone: "neutral", line: "" };
}
