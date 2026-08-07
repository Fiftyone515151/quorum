import { randomUUID } from "node:crypto";
import type { ProviderName, RunContext, RiskAxis } from "../../types.js";
import type { EngineIO } from "../../events.js";
import { generateStructured } from "../../providers.js";
import { composeSystemPrompt, languageDirective } from "../../personas/prompt.js";
import { RISK_AXES, RISK_AXIS_LABELS, FOUNDER_MULTIPLIER } from "../dimensions.js";
import { zBoardItems, zBoardClusters, type BoardResult } from "../schema.js";

function providerFor(i: number): ProviderName {
  return i % 2 === 0 ? "qwen" : "deepseek";
}

interface Item {
  id: string;
  suggestion: string;
  axis: string;
  severity: number;
  director: string;
  founder_status?: string | null;
  note?: string;
}

/** §3 deterministic ranking. */
export function rankBoardItems(items: Item[], coveredAxes: Set<string>): BoardResult {
  const action_list = items
    .map((it) => {
      const mult = FOUNDER_MULTIPLIER[it.founder_status ?? "null"] ?? 1.0;
      return {
        suggestion: it.suggestion,
        axis: it.axis,
        severity: it.severity,
        founder_status: it.founder_status ?? null,
        priority_score: Math.round(it.severity * mult * 100) / 100,
        rationale: `severity ${it.severity} × founder(${it.founder_status ?? "n/a"}) ${mult}`,
      };
    })
    .sort((a, b) => b.priority_score - a.priority_score);

  const coverage_snapshot: Record<string, boolean> = {};
  for (const a of RISK_AXES) coverage_snapshot[a] = coveredAxes.has(a);
  const gaps = RISK_AXES.filter((a) => !coveredAxes.has(a)) as string[];
  return { action_list, coverage_snapshot, gaps };
}

/** §6.3 state machine. */
export async function runBoard(ctx: RunContext, io: EngineIO): Promise<BoardResult> {
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
  const founderContext: string[] = [];
  const receiveFounder = async (segment: string) => {
    const messages = io.waitIfPaused ? await io.waitIfPaused() : [];
    for (const message of messages) {
      founderContext.push(message.content);
      await emitInstant("founder", "Founder", segment, message.content, undefined, "🙋");
    }
  };

  // S1 · each director proposes items within their own risk axes. Board is
  // intentionally sequential so a founder interjection can shape later turns.
  await io.emit({ type: "segment", segment: "S1", label: "S1 · Director recommendations" });
  const items: Item[] = [];
  for (let idx = 0; idx < ctx.panel.length; idx++) {
    const persona = ctx.panel[idx];
    if (persona.riskAxes.length === 0) continue; // generalist/chair without axes: skip proposing
    await receiveFounder("S1");
    const axesList = persona.riskAxes.map((a) => `${a} (${RISK_AXIS_LABELS[a]})`).join(", ");
    const turn = await startTurn(persona.id, persona.name, "S1", persona.avatar);
    const out = await generateStructured({
      provider: providerFor(idx),
      system: composeSystemPrompt(persona, "board", ctx.company),
      user: `As a board director, raise concrete improvement items ONLY within your risk axes: ${axesList}.
${founderContext.length ? `Founder context from this meeting:\n${founderContext.map((x) => `- ${x}`).join("\n")}\n` : ""}
Output JSON: {"items":[{"suggestion":"concrete action","axis":"<one of: capital|team|market|growth|product>","severity":1-5}]}
Write prose in the language of the BP.`,
      schema: zBoardItems,
    });
    const mine = out.items
      .filter((x) => persona.riskAxes.includes(x.axis as RiskAxis))
      .map((x) => ({ id: randomUUID().slice(0, 8), suggestion: x.suggestion, axis: x.axis, severity: x.severity, director: persona.name }));
    items.push(...mine);
    await completeTurn(turn, mine.map((m) => `• [${m.axis}] ${m.suggestion} (severity ${m.severity})`).join("\n"), { items: mine });
  }

  // S2 · coverage check (code + host phrasing of gaps)
  await io.emit({ type: "segment", segment: "S2", label: "S2 · Coverage check" });
  await receiveFounder("S2");
  const coveredAxes = new Set<string>();
  ctx.panel.forEach((p) => p.riskAxes.forEach((a) => coveredAxes.add(a)));
  const gaps = RISK_AXES.filter((a) => !coveredAxes.has(a));
  if (gaps.length) {
    await emitInstant("host", "Chair", "S2", `Coverage gaps — no director is watching: ${gaps.map((a) => RISK_AXIS_LABELS[a as RiskAxis]).join(", ")}`, { gaps }, "🎙️");
  }

  // S3 · founder responds to each item (UI, blocking) — the core of board's priority logic
  if (io.waitForFounder && items.length) {
    await io.emit({ type: "segment", segment: "S3", label: "S3 · Founder responds" });
    const resp = await io.waitForFounder("board_items", {
      items: items.map((it) => ({ id: it.id, suggestion: it.suggestion, axis: it.axis, severity: it.severity, director: it.director })),
    });
    const map: Record<string, { status: string; note?: string }> = {};
    for (const r of (resp?.responses ?? [])) map[r.id] = { status: r.status, note: r.note };
    for (const it of items) {
      const r = map[it.id];
      if (r) { it.founder_status = r.status; it.note = r.note; }
    }
    await emitInstant("founder", "Founder", "S3", `Responded to ${Object.keys(map).length} items.`, { responses: resp?.responses }, "🙋");
  }

  // S5 · dedup/cluster (host) then rank (code). (S4 severity re-estimate folded in via founder multiplier.)
  await io.emit({ type: "segment", segment: "S5", label: "S5 · Prioritized action list" });
  await receiveFounder("S5");
  let finalItems = items;
  if (items.length > 3) {
    try {
      const clustered = await generateStructured({
        provider: "deepseek",
        system: `You merge near-duplicate board recommendations that share the same risk axis. Keep the higher severity. ${languageDirective(ctx.company)}`,
        user: `Items:\n${items.map((it) => `[${it.id}] axis=${it.axis} sev=${it.severity} founder=${it.founder_status ?? "n/a"}: ${it.suggestion}`).join("\n")}${founderContext.length ? `\nFounder context:\n${founderContext.map((x) => `- ${x}`).join("\n")}` : ""}\nOutput JSON: {"clusters":[{"merged_suggestion":"...","axis":"...","severity":1-5,"source_ids":["id1","id2"]}]}`,
        schema: zBoardClusters, maxTokens: 900,
      });
      if (clustered.clusters.length) {
        finalItems = clustered.clusters.map((c) => {
          const srcs = items.filter((it) => c.source_ids.includes(it.id));
          const fs = srcs.map((s) => s.founder_status).find((x) => x === "unaware") ?? srcs[0]?.founder_status ?? null;
          return { id: randomUUID().slice(0, 8), suggestion: c.merged_suggestion, axis: c.axis, severity: c.severity, director: srcs.map((s) => s.director).join(", "), founder_status: fs };
        });
      }
    } catch { /* fall back to raw items */ }
  }

  const result = rankBoardItems(finalItems, coveredAxes);
  await io.emit({ type: "result", mode: "board", payload: result });
  return result;
}
