import { randomUUID } from "node:crypto";
import type { ProviderName, RunContext } from "../../types.js";
import type { EngineIO } from "../../events.js";
import { generateStructured } from "../../providers.js";
import { composeSystemPrompt, languageDirective } from "../../personas/prompt.js";
import { CAPS } from "../dimensions.js";
import { zTeaTurn, zTeaReframe, zTeaExtraction, type TeaResult } from "../schema.js";

function providerFor(i: number): ProviderName {
  return i % 2 === 0 ? "qwen" : "deepseek";
}

/** §6.4 — the only real multi-round, shared-context discussion. Clues only, never a conclusion. */
export async function runTea(ctx: RunContext, io: EngineIO): Promise<TeaResult> {
  let seq = 0;
  const emit = async (actor: string, name: string, segment: string, content: string, avatar?: string) => {
    await io.emit({ type: "turn.completed", id: randomUUID(), actor, actorName: name, avatar, segment, seq: seq++, content });
  };

  type T = { name: string; content: string };
  const transcript: T[] = [];
  const count: Record<string, number> = {};
  ctx.panel.forEach((p) => (count[p.id] = 0));

  const opener = ctx.company.topic?.trim()
    ? ctx.company.topic
    : `Let's talk openly about ${ctx.company.name} — no agenda, just interesting angles.`;
  await io.emit({ type: "segment", segment: "S1", label: "S1 · Opening" });
  await emit("founder", "Founder", "S1", opener, "🙋");
  transcript.push({ name: "Founder", content: opener });

  await io.emit({ type: "segment", segment: "S2", label: "S2 · Discussion" });
  const maxTurns = CAPS.tea_max_turns;

  for (let turn = 0; turn < maxTurns; turn++) {
    // founder interjections (non-blocking)
    if (io.drainInterjections) {
      const pending = await io.drainInterjections();
      for (const m of pending) {
        transcript.push({ name: "Founder", content: m.content });
        await emit("founder", "Founder", "S2", m.content, "🙋");
      }
    }

    // periodic reframe to avoid circling
    if (turn > 0 && turn % CAPS.tea_round_gap === 0) {
      try {
        const rf = await generateStructured({
          provider: "deepseek",
          system: `You are the host of a founder chat — a catalyst, never a concluder. Toss in ONE fresh angle to reignite the conversation. ${languageDirective(ctx.company)}`,
          user: `Recent talk:\n${transcript.slice(-6).map((t) => `${t.name}: ${t.content}`).join("\n")}\nOutput JSON: {"angle":"a new provocative angle, one sentence"}`,
          schema: zTeaReframe, maxTokens: 200,
        });
        transcript.push({ name: "Host", content: rf.angle });
        await emit("host", "Host", "S2", rf.angle, "🎙️");
      } catch { /* skip */ }
    }

    // anti-hog: pick the least-heard persona
    const persona = ctx.panel.slice().sort((a, b) => count[a.id] - count[b.id])[0];
    count[persona.id]++;
    const recent = transcript.slice(-8).map((t) => `${t.name}: ${t.content}`).join("\n");
    const out = await generateStructured({
      provider: providerFor(ctx.panel.indexOf(persona)),
      system: composeSystemPrompt(persona, "tea", ctx.company),
      user: `Open discussion (you may build on others, riff, or digress). React to the recent talk in 1-3 sentences — surface an angle, don't conclude.\nRecent:\n${recent}\nOutput JSON: {"content":"..."}`,
      schema: zTeaTurn, maxTokens: 300,
    });
    transcript.push({ name: persona.name, content: out.content });
    await emit(persona.id, persona.name, "S2", out.content, persona.avatar);
  }

  // S3 · extraction (clues only)
  await io.emit({ type: "segment", segment: "S3", label: "S3 · Take-aways (clues, not conclusions)" });
  const ex = await generateStructured({
    provider: "deepseek",
    system: `You extract from a free-form founder chat. NEVER produce a conclusion, recommendation, or final takeaway — only clues: themes, surprising angles, open questions, and unresolved disagreements (shown as-is, not reconciled). ${languageDirective(ctx.company)}`,
    user: `Discussion:\n${transcript.map((t) => `${t.name}: ${t.content}`).join("\n")}\nOutput JSON: {"theme_map":["..."],"surprising_angles":["the most non-obvious angles"],"open_questions":["questions, not tasks"],"unresolved_disagreements":[{"point":"...","sides":["side A","side B"]}]}`,
    schema: zTeaExtraction, maxTokens: 1200,
  });
  const result: TeaResult = {
    theme_map: ex.theme_map,
    surprising_angles: ex.surprising_angles,
    open_questions: ex.open_questions,
    unresolved_disagreements: ex.unresolved_disagreements,
  };
  await io.emit({ type: "result", mode: "tea", payload: result });
  return result;
}
