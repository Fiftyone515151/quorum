"use client";

import { useState } from "react";

const DIM_LABEL: Record<string, string> = {
  team: "Team", market: "Market", product: "Product",
  traction: "Traction", moat: "Moat", business_model: "Business model",
};

const meta = "text-[11px] font-semibold uppercase tracking-[0.16em] text-navy/45";
const body = "text-sm leading-relaxed text-navy/80";

export function ScreeningPanel({ r }: { r: any }) {
  const color = r.outcome === "ADVANCE" ? "text-emerald-600" : r.outcome === "WATCH" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-5">
        <div className="flex items-baseline gap-2">
          <span className={`text-5xl font-bold tabular-nums ${color}`}>{r.score}</span>
          <span className="text-lg text-navy/40">/ 100</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={`text-xl font-semibold ${color}`}>{r.outcome}{r.route ? ` → ${r.route}` : ""}</span>
          <span className={meta}>spike {r.spike} · divergence {r.divergence}</span>
        </div>
      </div>

      {r.dimension_scores?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={meta}>Dimension scorecard <span className="normal-case tracking-normal">(weighted for this stage)</span></p>
          {r.dimension_scores.map((d: any) => {
            const pct = d.score ? Math.round((d.score / 10) * 100) : 0;
            const bar = !d.covered ? "bg-navy/15" : d.score >= 9 ? "bg-emerald-500" : d.score <= 4 ? "bg-red-500" : "bg-brand";
            return (
              <div key={d.dimension} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-navy/80">{DIM_LABEL[d.dimension] ?? d.dimension}</span>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-navy/10">
                  <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-navy">{d.covered ? d.score : "—"}</span>
                <span className={`${meta} w-10 shrink-0 text-right`}>{d.weight}%</span>
              </div>
            );
          })}
          <p className="text-xs text-navy/45">Green = spike (≥9) · red = weak (≤4) · grey = not covered</p>
        </div>
      )}

      <p className={body}>{r.reason}</p>
      {r.dealbreaker && <p className="text-sm text-red-600"><strong>Dealbreaker:</strong> {r.dealbreaker}</p>}
      {r.crux?.length > 0 && (
        <div><p className={`${meta} mb-1`}>Crux — must answer</p>
          <ul className="list-disc pl-5 text-sm leading-relaxed text-navy/65">{r.crux.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>
      )}
      {r.coverage_gaps?.length > 0 && <p className="text-xs text-amber-700">Uncovered dimensions: {r.coverage_gaps.join(", ")}</p>}

      {r.by_role?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={meta}>Per-role scores</p>
          {r.by_role.map((b: any, i: number) => (
            <div key={i} className="rounded-xl border border-navy/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-navy">{b.role}</span>
                <span className={`${meta} ml-auto`}>{b.dimension_scores?.map((s: any) => `${s.dimension} ${s.score}`).join(" · ")}</span>
              </div>
              {b.reason && <p className="mt-1 text-sm text-navy/60">{b.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ICPanel({ r }: { r: any }) {
  const color = r.verdict === "INVEST" ? "text-emerald-600" : r.verdict === "CONDITIONAL" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex flex-col gap-4">
      <span className={`text-3xl font-bold ${color}`}>{r.verdict}</span>
      <p className={body}>{r.rationale}</p>
      {r.crux && <p className="text-sm text-navy/65"><span className={meta}>Crux</span> {r.crux}</p>}
      {r.conditions?.length > 0 && (
        <div><p className={`${meta} mb-1`}>Conditions</p>
          <ul className="list-disc pl-5 text-sm text-navy/65">{r.conditions.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul></div>
      )}
      {r.dissent && <p className="text-sm text-amber-700"><span className={meta}>Strongest dissent</span> {r.dissent}</p>}
      {r.by_role?.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={meta}>Positions</p>
          {r.by_role.map((b: any, i: number) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-navy/10 p-3">
              <span className="text-sm font-semibold text-navy">{b.role}</span>
              <span className={`${meta} ${b.stance === "invest" ? "text-emerald-600" : b.stance === "pass" ? "text-red-600" : "text-amber-600"}`}>{b.stance}</span>
              <span className="text-xs text-navy/55">{b.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BoardPanel({ r }: { r: any }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-lg font-semibold text-navy">Priority action list</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(r.coverage_snapshot ?? {}).map(([axis, ok]) => (
          <span key={axis} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
            {ok ? "✓" : "✗"} {axis}
          </span>
        ))}
      </div>
      {r.gaps?.length > 0 && <p className="text-xs text-amber-700">Coverage gaps: {r.gaps.join(", ")}</p>}
      <div className="flex flex-col gap-2">
        {r.action_list?.map((a: any, i: number) => (
          <div key={i} className="rounded-xl border border-navy/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-tint px-2 py-0.5 text-xs font-bold text-brand">{a.priority_score}</span>
              <span className={meta}>{a.axis}</span>
              {a.founder_status && <span className={meta}>{a.founder_status}</span>}
              <span className={`${meta} ml-auto`}>severity {a.severity}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-navy/75">{a.suggestion}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeaPanel({ r }: { r: any }) {
  const Section = ({ label, items }: { label: string; items: string[] }) => items?.length ? (
    <div><p className={`${meta} mb-1`}>{label}</p><ul className="list-disc pl-5 text-sm leading-relaxed text-navy/65">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
  ) : null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm italic text-navy/50">Clues, not conclusions.</p>
      {r.surprising_angles?.length > 0 && <Section label="Surprising angles" items={r.surprising_angles} />}
      <Section label="Theme map" items={r.theme_map} />
      <Section label="Open questions" items={r.open_questions} />
      {r.unresolved_disagreements?.length > 0 && (
        <div><p className={`${meta} mb-1`}>Unresolved disagreements</p>
          <ul className="flex flex-col gap-1 text-sm text-navy/65">
            {r.unresolved_disagreements.map((d: any, i: number) => <li key={i}><strong className="text-navy">{d.point}:</strong> {(d.sides ?? []).join(" ↔ ")}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export function BoardFounderForm({ payload, onSubmit }: { payload: any; onSubmit: (r: any[]) => void }) {
  const [resp, setResp] = useState<Record<string, { status: string; note?: string }>>({});
  const items = payload.items ?? [];
  const set = (id: string, status: string) => setResp((s) => ({ ...s, [id]: { ...s[id], status } }));
  const note = (id: string, value: string) => setResp((s) => ({ ...s, [id]: { ...s[id], note: value } }));
  const options = [["already_doing", "Already doing"], ["added_context", "Add context"], ["unaware", "Hadn't thought of it"]];
  return (
    <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/40 p-5">
      <p className="font-pixel text-xs leading-[1.7] text-amber-700">FOUNDER · RESPOND TO EACH ITEM</p>
      <div className="mt-4 flex flex-col gap-3">
        {items.map((item: any) => (
          <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3">
            <p className="text-sm leading-relaxed text-navy/75"><span className={meta}>{item.axis}</span> {item.suggestion}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map(([value, label]) => (
                <button key={value} onClick={() => set(item.id, value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${resp[item.id]?.status === value ? "bg-brand text-white" : "border border-navy/15 bg-white text-navy/60 hover:border-brand hover:text-brand"}`}>
                  {label}
                </button>
              ))}
              {resp[item.id]?.status === "added_context" && (
                <input value={resp[item.id]?.note ?? ""} onChange={(e) => note(item.id, e.target.value)} placeholder="Add context…"
                  className="min-w-48 flex-1 rounded-lg border border-navy/15 px-3 py-1.5 text-xs text-navy outline-none focus:border-brand" />
              )}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onSubmit(items.map((item: any) => ({ id: item.id, status: resp[item.id]?.status ?? "unaware", note: resp[item.id]?.note })))}
        className="mt-4 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
        Submit responses
      </button>
    </div>
  );
}
