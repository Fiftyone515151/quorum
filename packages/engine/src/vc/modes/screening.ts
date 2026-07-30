import { randomUUID } from "node:crypto";
import type { Dimension, ProviderName, ResolvedPersona, RunContext } from "../../types.js";
import type { EngineIO } from "../../events.js";
import { generateStructured } from "../../providers.js";
import { composeSystemPrompt, languageDirective } from "../../personas/prompt.js";
import { DIMENSION_LABELS, STAGE_WEIGHTS, THRESHOLDS, CAPS } from "../dimensions.js";
import { zScreeningRole, zScreeningRebuttal, zScreeningCrux, type ScreeningRole, type ScreeningResult } from "../schema.js";

function providerFor(i: number): ProviderName {
  return i % 2 === 0 ? "qwen" : "deepseek";
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function stddev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

interface RoleScored {
  persona: ResolvedPersona;
  out: ScreeningRole;
  perRoleMean: number;
}

/** §1 deterministic outcome — the "no averaging" logic lives here. */
export function decideScreeningOutcome(input: {
  stage: RunContext["stage"];
  scored: RoleScored[];
  crux: string[];
}): ScreeningResult {
  const { stage, scored, crux } = input;
  const weights = STAGE_WEIGHTS[stage];

  // dimension aggregation: mean of roles eligible for that dimension
  const dimScore: Partial<Record<Dimension, number>> = {};
  const coverageGaps: Dimension[] = [];
  for (const d of Object.keys(weights) as Dimension[]) {
    const contributors: number[] = [];
    for (const r of scored) {
      const s = r.out.scores.find((x) => x.dimension === d);
      if (s && r.persona.dimensions.includes(d)) contributors.push(s.score);
    }
    if (contributors.length === 0) coverageGaps.push(d);
    else dimScore[d] = mean(contributors);
  }

  const covered = (Object.keys(dimScore) as Dimension[]);
  const W = covered.reduce((acc, d) => acc + weights[d], 0) || 1;
  const composite = (covered.reduce((acc, d) => acc + dimScore[d]! * weights[d], 0) / W) * 10; // 10–100
  const spike = covered.length ? Math.max(...covered.map((d) => dimScore[d]!)) : 0; // 1–10
  const anyFatal = scored.some((r) => r.out.is_fatal);
  const anyInterest = scored.some((r) => r.out.will_advance);
  const divergence = stddev(scored.map((r) => r.perRoleMean));

  const by_role = scored.map((r) => ({
    role: r.persona.name,
    dimension_scores: r.out.scores.map((s) => ({ dimension: s.dimension, score: s.score })),
    reason: r.out.scores.map((s) => s.reason).filter(Boolean).join("；") || (r.out.is_fatal ? r.out.fatal_reason : ""),
  }));
  const dealbreaker = scored.find((r) => r.out.is_fatal)?.out.fatal_reason ?? null;

  const dimension_scores = (Object.keys(weights) as Dimension[]).map((d) => ({
    dimension: d,
    score: dimScore[d] !== undefined ? Math.round(dimScore[d]! * 10) / 10 : null,
    weight: weights[d],
    covered: dimScore[d] !== undefined,
  }));

  const base = {
    score: Math.round(composite),
    spike: Math.round(spike * 10) / 10,
    divergence: Math.round(divergence * 100) / 100,
    crux,
    dimension_scores,
    by_role,
    coverage_gaps: coverageGaps as string[],
  };

  // gates → tiers (first match wins)
  if (anyFatal)
    return { outcome: "PASS", route: null, reason: `Dealbreaker: ${dealbreaker}`, dealbreaker, ...base };
  if (!anyInterest)
    return { outcome: "PASS", route: null, reason: "No interest — no one wants to keep looking", dealbreaker: null, ...base };
  if (composite >= THRESHOLDS.T_high || spike >= THRESHOLDS.T_spike)
    return { outcome: "ADVANCE", route: "Investment Committee", reason: "No fatal flaw, has interest, meets the bar or has a spike", dealbreaker: null, ...base };
  if (composite >= THRESHOLDS.T_mid)
    return { outcome: "WATCH", route: null, reason: "No fatal flaw, has interest, mid score — worth a re-look", dealbreaker: null, ...base };
  return { outcome: "PASS", route: null, reason: "Below bar", dealbreaker: null, ...base };
}

/** §6.1 state machine. */
export async function runScreening(ctx: RunContext, io: EngineIO): Promise<ScreeningResult> {
  let seq = 0;
  const emitTurn = async (
    actor: string,
    actorName: string,
    segment: string,
    content: string,
    fields?: unknown,
    avatar?: string
  ) => {
    const id = randomUUID();
    await io.emit({ type: "turn.completed", id, actor, actorName, avatar, segment, seq: seq++, content, fields });
  };

  // S1 · independent scoring (parallel, back-to-back)
  await io.emit({ type: "segment", segment: "S1", label: "S1 · Independent scoring" });
  const scored: RoleScored[] = await Promise.all(
    ctx.panel.map(async (persona, i) => {
      const dimList = persona.dimensions.map((d) => DIMENSION_LABELS[d]).join("、") || "（无专属维度，可综合评一到两项）";
      const out = await generateStructured({
        provider: providerFor(i),
        system: composeSystemPrompt(persona, "screening", ctx.company),
        user: `Score independently (do not look at others' opinions). Score ONLY the dimensions you own: ${dimList}.
Output JSON: {"scores":[{"dimension":"<one of: team|market|product|traction|moat|business_model>","score":1-10,"reason":"one-line rationale"}],"is_fatal":bool,"fatal_reason":"if fatal, explain else empty string","will_advance":bool}
will_advance = whether you'd let it into the next round (low bar: willing to keep looking). Write prose in the language of the BP.`,
        schema: zScreeningRole,
      });
      // keep only scores within this role's dimensions
      out.scores = out.scores.filter((s) => persona.dimensions.includes(s.dimension as Dimension));
      const perRoleMean = mean(out.scores.map((s) => s.score));
      const summary =
        out.scores.map((s) => `${DIMENSION_LABELS[s.dimension as Dimension] ?? s.dimension}: ${s.score} — ${s.reason}`).join("\n") +
        (out.is_fatal ? `\n⚠️ Fatal: ${out.fatal_reason}` : "") +
        `\nAdvance: ${out.will_advance ? "yes" : "no"}`;
      await emitTurn(persona.id, persona.name, "S1", summary, out, persona.avatar);
      return { persona, out, perRoleMean };
    })
  );

  // S2 · aggregate (code)
  await io.emit({ type: "segment", segment: "S2", label: "S2 · Aggregate" });

  // S3 · pick disagreement points (code)
  const weights = STAGE_WEIGHTS[ctx.stage];
  const dimDisagreement: { d: Dimension; gap: number; hi: RoleScored; lo: RoleScored }[] = [];
  for (const d of Object.keys(weights) as Dimension[]) {
    const withScore = scored
      .map((r) => ({ r, s: r.out.scores.find((x) => x.dimension === d)?.score }))
      .filter((x) => typeof x.s === "number") as { r: RoleScored; s: number }[];
    if (withScore.length < 2) continue;
    const hi = withScore.reduce((a, b) => (b.s > a.s ? b : a));
    const lo = withScore.reduce((a, b) => (b.s < a.s ? b : a));
    const gap = hi.s - lo.s;
    if (gap >= THRESHOLDS.D_min) dimDisagreement.push({ d, gap, hi: hi.r, lo: lo.r });
  }
  dimDisagreement.sort((a, b) => b.gap - a.gap);
  const points = dimDisagreement.slice(0, CAPS.screening_disagreement_points);

  // S4 · clash on disagreement points
  if (points.length) {
    await io.emit({ type: "segment", segment: "S4", label: "S4 · Focus on disagreements" });
    for (const pt of points) {
      for (const side of [pt.hi, pt.lo]) {
        const other = side === pt.hi ? pt.lo : pt.hi;
        const otherScore = other.out.scores.find((x) => x.dimension === pt.d);
        const rb = await generateStructured({
          provider: providerFor(ctx.panel.indexOf(side.persona)),
          system: composeSystemPrompt(side.persona, "screening", ctx.company),
          user: `On the ${DIMENSION_LABELS[pt.d]} dimension, ${other.persona.name} scored ${otherScore?.score} — reason: "${otherScore?.reason}". Respond in <=60 words: hold or revise your judgment. Write in the language of the BP. Output JSON: {"rebuttal":"..."}`,
          schema: zScreeningRebuttal,
          maxTokens: 300,
        });
        await emitTurn(side.persona.id, side.persona.name, "S4", rb.rebuttal, { dimension: pt.d }, side.persona.avatar);
      }
    }
  }

  // S5 · crux (host, LLM)
  await io.emit({ type: "segment", segment: "S5", label: "S5 · Crux" });
  const transcript = scored
    .map((r) => `${r.persona.name}：${r.out.scores.map((s) => `${s.dimension} ${s.score}`).join(", ")}${r.out.is_fatal ? ` [致命:${r.out.fatal_reason}]` : ""}`)
    .join("\n");
  const cruxOut = await generateStructured({
    provider: "deepseek",
    system: `You are the screening Chair (host): neutral, you don't score and don't decide. Read the scores and disagreements, then do exactly two things: distill the 2-3 crux questions that MUST be answered to advance, plus a one-line divergence summary. ${languageDirective(ctx.company)}`,
    user: `Company: ${ctx.company.name}\nScore overview:\n${transcript}\nOutput JSON: {"crux":["q1","q2"],"divergence_summary":"one line"}`,
    schema: zScreeningCrux,
    maxTokens: 500,
  });
  await emitTurn("host", "Chair", "S5", `Crux (must answer):\n- ${cruxOut.crux.join("\n- ")}\n\nDivergence: ${cruxOut.divergence_summary}`, cruxOut);

  // S6 · decide (code)
  const result = decideScreeningOutcome({ stage: ctx.stage, scored, crux: cruxOut.crux });
  // S7 · emit result
  await io.emit({ type: "result", mode: "screening", payload: result });
  return result;
}
