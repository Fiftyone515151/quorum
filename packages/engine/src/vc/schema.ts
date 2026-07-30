import { z } from "zod";

/** A string field that tolerates missing/null from the LLM, coercing to "". */
const zstr = () => z.string().nullish().transform((v) => v ?? "");
const zbool = () => z.boolean().nullish().transform((v) => v ?? false);

// ---------- Screening ----------
export const zScreeningRole = z.object({
  scores: z
    .array(z.object({ dimension: z.string(), score: z.number().min(1).max(10), reason: zstr() }))
    .nullish()
    .transform((v) => v ?? []),
  is_fatal: zbool(),
  fatal_reason: zstr(),
  will_advance: zbool(),
});
export type ScreeningRole = z.infer<typeof zScreeningRole>;

export const zScreeningRebuttal = z.object({ rebuttal: zstr() });
export const zScreeningCrux = z.object({
  crux: z.array(z.string()).nullish().transform((v) => v ?? []),
  divergence_summary: zstr(),
});

export interface ScreeningResult {
  outcome: "ADVANCE" | "WATCH" | "PASS";
  route: "Investment Committee" | null;
  reason: string;
  score: number;
  spike: number;
  divergence: number;
  crux: string[];
  /** Aggregated per-dimension scores (1-10) with stage weight — the scorecard view. */
  dimension_scores: { dimension: string; score: number | null; weight: number; covered: boolean }[];
  by_role: { role: string; dimension_scores: { dimension: string; score: number }[]; reason: string }[];
  dealbreaker: string | null;
  coverage_gaps: string[];
}

// ---------- IC ----------
export const zICRole = z.object({
  stance: z.enum(["invest", "pass", "conditional"]),
  conviction: z.number().min(1).max(5),
  will_champion: zbool(),
  is_fatal: zbool(),
  fatal_reason: zstr(),
  reason: zstr(),
});
export type ICRole = z.infer<typeof zICRole>;

export const zChampionCase = z.object({ case_for: zstr() });
export const zDissentCase = z.object({ kill_case: zstr(), candidate_fatal: zstr() });
export const zICCrux = z.object({ crux: z.array(z.string()).min(1).max(2) });
export const zRebuttal = z.object({ rebuttal: zstr() });
export const zFounderQuestion = z.object({ question: zstr() });
export const zICJudgment = z.object({
  fatal_resolved: zbool(),
  crux: zstr(),
  crux_resolved: zbool(),
});

export interface ICResult {
  verdict: "INVEST" | "CONDITIONAL" | "PASS";
  rationale: string;
  crux: string;
  conditions: string[];
  by_role: { role: string; stance: string; reason: string }[];
  dissent: string;
}

// ---------- Board ----------
export const zBoardItems = z.object({
  items: z
    .array(z.object({ suggestion: zstr(), axis: z.string(), severity: z.number().min(1).max(5) }))
    .nullish()
    .transform((v) => v ?? []),
});
export const zBoardGapPrompts = z.object({
  gap_prompts: z.array(z.object({ axis: z.string(), prompt: zstr() })).nullish().transform((v) => v ?? []),
});
export const zBoardClusters = z.object({
  clusters: z
    .array(
      z.object({
        merged_suggestion: zstr(),
        axis: z.string(),
        severity: z.number().min(1).max(5),
        source_ids: z.array(z.string()).nullish().transform((v) => v ?? []),
      })
    )
    .nullish()
    .transform((v) => v ?? []),
});

export interface BoardResult {
  action_list: {
    suggestion: string;
    axis: string;
    priority_score: number;
    severity: number;
    founder_status: string | null;
    rationale: string;
  }[];
  coverage_snapshot: Record<string, boolean>;
  gaps: string[];
}

// ---------- Tea ----------
export const zTeaTurn = z.object({ content: zstr() });
export const zTeaReframe = z.object({ angle: zstr() });
export const zTeaExtraction = z.object({
  theme_map: z.array(z.string()).nullish().transform((v) => v ?? []),
  surprising_angles: z.array(z.string()).nullish().transform((v) => v ?? []),
  open_questions: z.array(z.string()).nullish().transform((v) => v ?? []),
  unresolved_disagreements: z
    .array(z.object({ point: zstr(), sides: z.array(z.string()).nullish().transform((v) => v ?? []) }))
    .nullish()
    .transform((v) => v ?? []),
});

export interface TeaResult {
  theme_map: string[];
  surprising_angles: string[];
  open_questions: string[];
  unresolved_disagreements: { point: string; sides: string[] }[];
}
