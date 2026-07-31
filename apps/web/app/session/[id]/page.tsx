"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const DIM_LABEL: Record<string, string> = {
  team: "Team", market: "Market", product: "Product",
  traction: "Traction", moat: "Moat", business_model: "Business model",
};

type Feed =
  | { kind: "segment"; id: string; label: string }
  | { kind: "turn"; id: string; actor: string; actorName: string; avatar?: string; segment: string; content: string; fields?: any }
  | { kind: "notice"; id: string; text: string };

interface RunData {
  id: string; mode: string; status: string; stage: string;
  companySnapshot: { name: string; stage: string; valuation?: string; roundSize?: string };
  roles: { persona: { id: string; name: string; avatar?: string } }[];
  turns: any[];
  result: any;
}

const MODE_LABEL: Record<string, string> = { screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea" };

export default function RunPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [run, setRun] = useState<RunData | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState("running");
  const [awaitFounder, setAwaitFounder] = useState<any>(null);
  const [teaMsg, setTeaMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  async function sendFounder(body: any) {
    await fetch(`/api/runs/${id}/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function deleteRun() {
    if (!confirm("Delete this session? This can't be undone.")) return;
    await fetch(`/api/runs/${id}`, { method: "DELETE" });
    router.push("/");
  }

  function nameMap(r: RunData | null): Record<string, { name: string; avatar?: string }> {
    const m: Record<string, { name: string; avatar?: string }> = { host: { name: "Host" }, founder: { name: "Founder", avatar: "🙋" } };
    r?.roles.forEach((x) => (m[x.persona.id] = { name: x.persona.name, avatar: x.persona.avatar }));
    return m;
  }

  async function syncFromDb() {
    const d = await fetch(`/api/runs/${id}`).then((r) => r.json());
    if (!d.run) return;
    const nm = nameMap(d.run);
    setRun(d.run); setStatus(d.run.status); setResult(d.run.result ?? null);
    setFeed(
      d.run.turns.map((t: any) => ({
        kind: "turn" as const, id: t.id, actor: t.actor,
        actorName: nm[t.actor]?.name ?? t.actor, avatar: nm[t.actor]?.avatar,
        segment: t.segment, content: t.content, fields: t.fields,
      }))
    );
  }

  useEffect(() => { syncFromDb(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    const es = new EventSource(`/api/runs/${id}/stream`);
    es.onmessage = (e) => {
      let ev: any; try { ev = JSON.parse(e.data); } catch { return; }
      switch (ev.type) {
        case "segment": setFeed((f) => [...f, { kind: "segment", id: `seg-${ev.segment}-${f.length}`, label: ev.label ?? ev.segment }]); break;
        case "turn.completed":
          setFeed((f) => [...f, { kind: "turn", id: ev.id, actor: ev.actor, actorName: ev.actorName, avatar: ev.avatar, segment: ev.segment, content: ev.content, fields: ev.fields }]);
          if (ev.actor === "founder") setAwaitFounder(null); // founder step answered
          break;
        case "await_founder": setAwaitFounder({ kind: ev.kind, ...(ev.payload as any) }); break;
        case "notice": setFeed((f) => [...f, { kind: "notice", id: crypto.randomUUID(), text: ev.text }]); break;
        case "result": setResult(ev.payload); break;
        case "status": setStatus(ev.status); break;
        case "run.failed": setFeed((f) => [...f, { kind: "notice", id: crypto.randomUUID(), text: `⚠️ ${ev.error}` }]); break;
        case "run.completed": es.close(); syncFromDb(); break;
      }
    };
    es.onerror = () => {};
    return () => es.close();
    /* eslint-disable-next-line */
  }, [id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [feed, result]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="label">{MODE_LABEL[run?.mode ?? ""] ?? run?.mode}</span>
        <span className={`label ${status === "running" ? "text-accent" : status === "failed" ? "text-brass" : ""}`}>● {status}</span>
        <button onClick={() => window.print()} className="btn-ghost ml-auto">Export PDF</button>
      </div>
      <h1 className="text-xl font-semibold text-white">
        {run?.companySnapshot?.name}
        {run?.companySnapshot?.stage && <span className="label ml-2">{run.companySnapshot.stage}</span>}
      </h1>

      <div className="card flex flex-col divide-y divide-line">
        {feed.map((i) => {
          if (i.kind === "segment") return <div key={i.id} className="bg-ink/40 px-4 py-1.5"><span className="label">— {i.label} —</span></div>;
          if (i.kind === "notice") return <div key={i.id} className="px-4 py-1.5 text-center text-xs text-muted">{i.text}</div>;
          const isHost = i.actor === "host";
          return (
            <div key={i.id} className={`flex gap-3 px-4 py-3 ${isHost ? "bg-accent/5" : ""}`}>
              <span className="text-lg">{i.avatar ?? (isHost ? "🎙️" : "🧠")}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{i.actorName}</span>
                  {i.fields?.is_fatal && <span className="label text-brass">FATAL</span>}
                  {typeof i.fields?.will_advance === "boolean" && <span className="label">{i.fields.will_advance ? "advance ✓" : "no advance"}</span>}
                </div>
                <p className="whitespace-pre-wrap text-sm text-[#d6e0db]">{i.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* founder interaction */}
      {awaitFounder?.kind === "board_items" && status === "awaiting_founder" && (
        <BoardFounderForm payload={awaitFounder} onSubmit={(responses) => { sendFounder({ kind: "board_items", responses }); setAwaitFounder(null); }} />
      )}
      {run?.mode === "tea" && status === "running" && (
        <div className="flex gap-2">
          <input value={teaMsg} onChange={(e) => setTeaMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && teaMsg.trim()) { sendFounder({ content: teaMsg }); setTeaMsg(""); } }}
            placeholder="Jump in (founder)…" className="flex-1 rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
          <button onClick={() => { if (teaMsg.trim()) { sendFounder({ content: teaMsg }); setTeaMsg(""); } }} className="btn-primary">Send</button>
        </div>
      )}

      {result && run?.mode === "screening" && <ScreeningPanel r={result} />}
      {result && run?.mode === "ic" && <ICPanel r={result} />}
      {result && run?.mode === "board" && <BoardPanel r={result} />}
      {result && run?.mode === "tea" && <TeaPanel r={result} />}

      {(status === "done" || status === "failed") && (
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <span className="label text-accent">✓ Result saved</span>
          <button onClick={deleteRun} className="btn-ghost ml-auto text-muted hover:text-brass">Delete session</button>
          <Link href="/" className="btn-primary">Save &amp; back to home</Link>
        </div>
      )}
    </div>
  );
}

function ScreeningPanel({ r }: { r: any }) {
  const color = r.outcome === "ADVANCE" ? "text-accent" : r.outcome === "WATCH" ? "text-brass" : "text-red-400";
  return (
    <div className="card border-accent/40 p-5">
      <p className="label mb-3 text-accent">Result · Screening</p>

      {/* headline: big composite score + outcome */}
      <div className="mb-4 flex flex-wrap items-end gap-5">
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-bold tabular-nums ${color}`}>{r.score}</span>
          <span className="text-lg text-muted">/ 100</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={`text-xl font-semibold ${color}`}>{r.outcome}{r.route ? ` → ${r.route}` : ""}</span>
          <span className="label">spike {r.spike} · divergence {r.divergence}</span>
        </div>
      </div>

      {/* per-dimension weighted scorecard */}
      {r.dimension_scores?.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          <p className="label">Dimension scorecard <span className="text-muted">(weighted for this stage)</span></p>
          {r.dimension_scores.map((d: any) => {
            const pct = d.score ? Math.round((d.score / 10) * 100) : 0;
            const bar = !d.covered ? "bg-line" : d.score >= 9 ? "bg-accent" : d.score <= 4 ? "bg-red-400/70" : "bg-muted";
            return (
              <div key={d.dimension} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-white">{DIM_LABEL[d.dimension] ?? d.dimension}</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-white">{d.covered ? d.score : "—"}</span>
                <span className="label w-10 shrink-0 text-right">{d.weight}%</span>
              </div>
            );
          })}
          <p className="text-xs text-muted">Green = spike (≥9) · red = weak (≤4) · grey = no one covered it</p>
        </div>
      )}

      <p className="text-sm text-[#d6e0db]">{r.reason}</p>
      {r.dealbreaker && <p className="mt-2 text-sm text-brass">Dealbreaker: {r.dealbreaker}</p>}
      {r.crux?.length > 0 && (
        <div className="mt-3"><p className="label mb-1">Crux — must answer</p>
          <ul className="list-disc pl-5 text-sm text-muted">{r.crux.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>
      )}
      {r.coverage_gaps?.length > 0 && <p className="mt-2 text-xs text-brass">Uncovered dimensions: {r.coverage_gaps.join(", ")}</p>}
      <div className="mt-4 flex flex-col gap-2">
        <p className="label">Per-role scores</p>
        {r.by_role?.map((b: any, i: number) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2"><span className="text-sm font-medium text-white">{b.role}</span>
              <span className="label ml-auto">{b.dimension_scores?.map((s: any) => `${s.dimension} ${s.score}`).join(" · ")}</span></div>
            {b.reason && <p className="mt-1 text-sm text-muted">{b.reason}</p>}
          </div>
        ))}
      </div>
      {r.outcome === "ADVANCE" && <p className="mt-4 text-xs text-muted">Next step: take it to the Investment Committee.</p>}
    </div>
  );
}

function ICPanel({ r }: { r: any }) {
  const color = r.verdict === "INVEST" ? "text-accent" : r.verdict === "CONDITIONAL" ? "text-brass" : "text-red-400";
  return (
    <div className="card border-accent/40 p-5">
      <p className="label mb-3 text-accent">Result · Investment Committee</p>
      <span className={`text-3xl font-bold ${color}`}>{r.verdict}</span>
      <p className="mt-2 text-sm text-[#d6e0db]">{r.rationale}</p>
      {r.crux && <p className="mt-2 text-sm text-muted"><span className="label">Crux</span> {r.crux}</p>}
      {r.conditions?.length > 0 && (
        <div className="mt-2"><p className="label mb-1">Conditions</p>
          <ul className="list-disc pl-5 text-sm text-muted">{r.conditions.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>
      )}
      {r.dissent && <p className="mt-2 text-sm text-brass"><span className="label text-brass">Strongest dissent</span> {r.dissent}</p>}
      <div className="mt-4 flex flex-col gap-2">
        <p className="label">Positions</p>
        {r.by_role?.map((b: any, i: number) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-line p-2 px-3">
            <span className="text-sm text-white">{b.role}</span>
            <span className={`label ${b.stance === "invest" ? "text-accent" : b.stance === "pass" ? "text-brass" : ""}`}>{b.stance}</span>
            <span className="text-xs text-muted">{b.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardPanel({ r }: { r: any }) {
  return (
    <div className="card border-accent/40 p-5">
      <p className="label mb-3 text-accent">Result · Board — priority action list</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(r.coverage_snapshot ?? {}).map(([axis, ok]) => (
          <span key={axis} className={`label ${ok ? "text-accent" : "text-brass"}`}>{ok ? "✓" : "✗"} {axis}</span>
        ))}
      </div>
      {r.gaps?.length > 0 && <p className="mb-3 text-xs text-brass">Coverage gaps (no one watching): {r.gaps.join(", ")}</p>}
      <div className="flex flex-col gap-2">
        {r.action_list?.map((a: any, i: number) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="flex items-center gap-2">
              <span className="label text-accent">{a.priority_score}</span>
              <span className="label">{a.axis}</span>
              {a.founder_status && <span className="label text-muted">{a.founder_status}</span>}
              <span className="label ml-auto">sev {a.severity}</span>
            </div>
            <p className="mt-1 text-sm text-[#d6e0db]">{a.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeaPanel({ r }: { r: any }) {
  const Section = ({ label, items }: { label: string; items: string[] }) =>
    items?.length ? (
      <div><p className="label mb-1">{label}</p><ul className="list-disc pl-5 text-sm text-muted">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
    ) : null;
  return (
    <div className="card border-accent/40 p-5">
      <p className="label mb-3 text-accent">Result · Founder Tea — clues (no conclusion)</p>
      <div className="flex flex-col gap-3">
        {r.surprising_angles?.length > 0 && (
          <div><p className="label mb-1 text-accent">Surprising angles</p>
            <ul className="list-disc pl-5 text-sm text-[#d6e0db]">{r.surprising_angles.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
        )}
        <Section label="Theme map" items={r.theme_map} />
        <Section label="Open questions" items={r.open_questions} />
        {r.unresolved_disagreements?.length > 0 && (
          <div><p className="label mb-1">Unresolved disagreements</p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {r.unresolved_disagreements.map((d: any, i: number) => <li key={i}><span className="text-white">{d.point}:</span> {(d.sides ?? []).join(" ↔ ")}</li>)}
            </ul></div>
        )}
      </div>
    </div>
  );
}

function BoardFounderForm({ payload, onSubmit }: { payload: any; onSubmit: (r: any[]) => void }) {
  const [resp, setResp] = useState<Record<string, { status: string; note?: string }>>({});
  const items = payload.items ?? [];
  const set = (id: string, status: string) => setResp((s) => ({ ...s, [id]: { ...s[id], status } }));
  const note = (id: string, note: string) => setResp((s) => ({ ...s, [id]: { ...s[id], note } }));
  const OPTS = [["already_doing", "Already doing"], ["added_context", "Add context"], ["unaware", "Hadn't thought of it"]];
  return (
    <div className="card border-brass/50 p-5">
      <p className="label mb-3 text-brass">Founder — respond to each item</p>
      <div className="flex flex-col gap-3">
        {items.map((it: any) => (
          <div key={it.id} className="rounded-lg border border-line p-3">
            <p className="text-sm text-[#d6e0db]"><span className="label mr-2">{it.axis}</span>{it.suggestion}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTS.map(([v, lbl]) => (
                <button key={v} onClick={() => set(it.id, v)}
                  className={`rounded px-2 py-1 text-xs ${resp[it.id]?.status === v ? "bg-accent text-ink" : "border border-line text-muted"}`}>{lbl}</button>
              ))}
              {resp[it.id]?.status === "added_context" && (
                <input onChange={(e) => note(it.id, e.target.value)} placeholder="context…" className="flex-1 rounded border border-line bg-ink px-2 py-1 text-xs text-white outline-none focus:border-accent" />
              )}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onSubmit(items.map((it: any) => ({ id: it.id, status: resp[it.id]?.status ?? "unaware", note: resp[it.id]?.note })))}
        className="btn-primary mt-4">Submit responses</button>
    </div>
  );
}
