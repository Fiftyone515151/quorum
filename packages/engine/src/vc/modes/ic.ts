import { randomUUID } from "node:crypto";
import type { ProviderName, ResolvedPersona, RunContext } from "../../types.js";
import type { EngineIO } from "../../events.js";
import { generateStructured } from "../../providers.js";
import { composeSystemPrompt, languageDirective } from "../../personas/prompt.js";
import { CAPS } from "../dimensions.js";
import {
  zICRole, zChampionCase, zDissentCase, zICCrux, zRebuttal, zICJudgment,
  type ICRole, type ICResult,
} from "../schema.js";

function providerFor(i: number): ProviderName {
  return i % 2 === 0 ? "qwen" : "deepseek";
}

interface RoleOut {
  persona: ResolvedPersona;
  out: ICRole;
  idx: number;
}

/** §2 deterministic verdict — champion / fatal / crux, no vote, no average. */
export function decideICVerdict(input: {
  roles: RoleOut[];
  champion: RoleOut | null;
  fatalResolved: boolean;
  crux: string;
  cruxResolved: boolean;
  dissent: string;
}): ICResult {
  const { roles, champion, fatalResolved, crux, cruxResolved, dissent } = input;
  const anyFatal = roles.some((r) => r.out.is_fatal);
  const by_role = roles.map((r) => ({ role: r.persona.name, stance: r.out.stance, reason: r.out.reason }));

  if (!champion)
    return { verdict: "PASS", rationale: "No one was willing to champion this — a lukewarm consensus 'yes' is a death sentence.", crux, conditions: [], by_role, dissent };
  if (anyFatal && !fatalResolved) {
    const fr = roles.find((r) => r.out.is_fatal)?.out.fatal_reason ?? "";
    return { verdict: "PASS", rationale: `An unresolved dealbreaker: ${fr}`, crux, conditions: [], by_role, dissent };
  }
  if (cruxResolved)
    return { verdict: "INVEST", rationale: "Backed by a champion, no unresolved dealbreaker, and the crux was resolved in the debate.", crux, conditions: [], by_role, dissent };
  return { verdict: "CONDITIONAL", rationale: "Backed with no unresolved dealbreaker, but the crux remains open.", crux, conditions: crux ? [crux] : [], by_role, dissent };
}

/** §6.2 state machine. */
export async function runIC(ctx: RunContext, io: EngineIO): Promise<ICResult> {
  let seq = 0;
  const startTurn = async (actor: string, actorName: string, segment: string, avatar?: string) => {
    const turn = { id: randomUUID(), actor, actorName, avatar, segment, turnOrder: seq++ };
    await io.emit({ type: "turn.start", ...turn, seq: turn.turnOrder });
    return turn;
  };
  const completeTurn = async (turn: Awaited<ReturnType<typeof startTurn>>, content: string, fields?: unknown) => {
    await io.emit({ type: "turn.completed", ...turn, seq: turn.turnOrder, turnOrder: turn.turnOrder, content, fields });
  };
  const emitInstant = async (actor: string, name: string, segment: string, content: string, fields?: unknown, avatar?: string) => {
    const turn = await startTurn(actor, name, segment, avatar);
    await completeTurn(turn, content, fields);
  };
  const priorCrux = ctx.inherited?.crux?.length ? `\nInherited crux from screening: ${ctx.inherited.crux.join("; ")}` : "";

  // S1 · positions (parallel)
  await io.emit({ type: "segment", segment: "S1", label: "S1 · Positions" });
  const roles: RoleOut[] = await Promise.all(
    ctx.panel.map(async (persona, idx) => {
      const turn = await startTurn(persona.id, persona.name, "S1", persona.avatar);
      const out = await generateStructured({
        provider: providerFor(idx),
        system: composeSystemPrompt(persona, "ic", ctx.company),
        user: `State your position on investing.${priorCrux}
Output JSON: {"stance":"invest|pass|conditional","conviction":1-5,"will_champion":bool,"is_fatal":bool,"fatal_reason":"if a dealbreaker, explain else empty","reason":"one-line justification"}
will_champion = are you willing to stake your name and make the case FOR investing. Write prose in the language of the BP.`,
        schema: zICRole,
      });
      await completeTurn(turn, `Stance: ${out.stance} · conviction ${out.conviction}${out.will_champion ? " · will champion" : ""}\n${out.reason}${out.is_fatal ? `\n⚠️ Fatal: ${out.fatal_reason}` : ""}`, out);
      return { persona, out, idx };
    })
  );

  // S2 · select champion (code)
  const champions = roles.filter((r) => r.out.will_champion);
  let champion: RoleOut | null = null;
  if (champions.length) {
    const maxConv = Math.max(...champions.map((r) => r.out.conviction));
    const top = champions.filter((r) => r.out.conviction === maxConv);
    champion = top.find((r) => r.persona.stance === "optimist") ?? top[0];
  }
  if (!champion) {
    await emitInstant("host", "Chair", "S2", "No one is willing to champion this. The committee passes — no meeting needed.", undefined, "🎙️");
    const result = decideICVerdict({ roles, champion: null, fatalResolved: false, crux: "", cruxResolved: false, dissent: "" });
    await io.emit({ type: "result", mode: "ic", payload: result });
    return result;
  }

  // S3 · champion statement
  await io.emit({ type: "segment", segment: "S3", label: "S3 · Champion makes the case" });
  const championTurn = await startTurn(champion.persona.id, champion.persona.name, "S3", champion.persona.avatar);
  const championCase = await generateStructured({
    provider: providerFor(champion.idx),
    system: composeSystemPrompt(champion.persona, "ic", ctx.company),
    user: `You are the CHAMPION. Make the strongest case FOR investing (3-5 sentences).${priorCrux} Output JSON: {"case_for":"..."}`,
    schema: zChampionCase, maxTokens: 600,
  });
  await completeTurn(championTurn, championCase.case_for, { role: "champion" });

  // S4 · select dissenter (code) — most negative / else highest-conviction opponent / else skeptic
  const opponents = roles.filter((r) => r.persona.id !== champion!.persona.id);
  const rank = (r: RoleOut) => (r.out.stance === "pass" ? 2 : r.out.stance === "conditional" ? 1 : 0) * 10 + r.out.conviction;
  let dissenter = opponents.slice().sort((a, b) => rank(b) - rank(a))[0];
  if (dissenter && dissenter.out.stance === "invest") {
    dissenter = opponents.find((r) => r.persona.stance === "skeptic") ?? dissenter;
  }

  // S5 · dissent
  await io.emit({ type: "segment", segment: "S5", label: "S5 · Structured dissent" });
  const dissentTurn = await startTurn(dissenter.persona.id, dissenter.persona.name, "S5", dissenter.persona.avatar);
  const dissent = await generateStructured({
    provider: providerFor(dissenter.idx),
    system: composeSystemPrompt(dissenter.persona, "ic", ctx.company),
    user: `You are the DESIGNATED DISSENTER — your only job is to kill this deal. Make the strongest kill case (3-5 sentences) and name the single most dangerous flaw. Output JSON: {"kill_case":"...","candidate_fatal":"the one flaw most likely to be fatal"}`,
    schema: zDissentCase, maxTokens: 600,
  });
  await completeTurn(dissentTurn, dissent.kill_case, { role: "dissenter", candidate_fatal: dissent.candidate_fatal });

  // S6 · host defines crux
  await io.emit({ type: "segment", segment: "S6", label: "S6 · Crux" });
  const cruxTurn = await startTurn("host", "Chair", "S6", "🎙️");
  const cruxOut = await generateStructured({
    provider: "deepseek",
    system: `You are the IC Chair (host): neutral, you don't decide. From the champion's case and the dissent, distill the 1-2 crux questions that decide life or death. ${languageDirective(ctx.company)}`,
    user: `Champion: ${championCase.case_for}\nDissent: ${dissent.kill_case}\nOutput JSON: {"crux":["q1"]}`,
    schema: zICCrux, maxTokens: 300,
  });
  const cruxText = cruxOut.crux.join(" / ");
  await completeTurn(cruxTurn, `Crux: ${cruxText}`, cruxOut);

  // S7 · attack loop (<= 2 rounds)
  await io.emit({ type: "segment", segment: "S7", label: "S7 · Attack & defense" });
  let exchange = "";
  for (let r = 0; r < CAPS.ic_attack_rounds; r++) {
    const championRebuttalTurn = await startTurn(champion.persona.id, champion.persona.name, "S7", champion.persona.avatar);
    const champRb = await generateStructured({
      provider: providerFor(champion.idx),
      system: composeSystemPrompt(champion.persona, "ic", ctx.company),
      user: `Defend against the dissent and resolve the crux: "${cruxText}". <=70 words, language of the BP. Output JSON: {"rebuttal":"..."}`,
      schema: zRebuttal, maxTokens: 300,
    });
    await completeTurn(championRebuttalTurn, champRb.rebuttal, { round: r + 1, role: "champion" });
    const dissenterRebuttalTurn = await startTurn(dissenter.persona.id, dissenter.persona.name, "S7", dissenter.persona.avatar);
    const disRb = await generateStructured({
      provider: providerFor(dissenter.idx),
      system: composeSystemPrompt(dissenter.persona, "ic", ctx.company),
      user: `Rebut the champion. Is the crux "${cruxText}" actually resolved? <=70 words. Output JSON: {"rebuttal":"..."}`,
      schema: zRebuttal, maxTokens: 300,
    });
    await completeTurn(dissenterRebuttalTurn, disRb.rebuttal, { round: r + 1, role: "dissenter" });
    exchange += `\nR${r + 1} champion: ${champRb.rebuttal}\nR${r + 1} dissenter: ${disRb.rebuttal}`;
  }

  // S8 · host semantic judgment (the only semantic call)
  await io.emit({ type: "segment", segment: "S8", label: "S8 · Ruling" });
  const anyFatal = roles.some((r) => r.out.is_fatal);
  const fatalList = roles.filter((r) => r.out.is_fatal).map((r) => r.out.fatal_reason).join("; ");
  const rulingTurn = await startTurn("host", "Chair", "S8", "🎙️");
  const judgment = await generateStructured({
    provider: "deepseek",
    system: `You are the IC Chair, ruling on what the debate settled. Be strict. ${languageDirective(ctx.company)}`,
    user: `Crux: ${cruxText}\nRaised fatal flaws: ${anyFatal ? fatalList : "none"}\nAttack/defense:${exchange}\nOutput JSON: {"fatal_resolved":bool (did the champion answer the fatal flaws; true if there were none),"crux":"the crux in one line","crux_resolved":bool}`,
    schema: zICJudgment, maxTokens: 400,
  });
  await completeTurn(rulingTurn, `Fatal resolved: ${judgment.fatal_resolved ? "yes" : "no"} · Crux resolved: ${judgment.crux_resolved ? "yes" : "no"}`, judgment);

  // S9 · verdict (code)
  const result = decideICVerdict({
    roles, champion,
    fatalResolved: anyFatal ? judgment.fatal_resolved : true,
    crux: judgment.crux || cruxText,
    cruxResolved: judgment.crux_resolved,
    dissent: dissent.kill_case,
  });
  await io.emit({ type: "result", mode: "ic", payload: result });
  return result;
}
