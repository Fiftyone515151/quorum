"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RunPreview } from "@/lib/runSummary";

interface Run {
  id: string; mode: string; status: string; createdAt: string;
  companyId: string; companyName: string; preview: RunPreview;
}

const MODE_NAME: Record<string, string> = {
  screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea",
};
const TONE_TEXT: Record<RunPreview["tone"], string> = {
  good: "text-emerald-600", warn: "text-amber-600", bad: "text-red-600", neutral: "text-navy/60",
};

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel leading-[1.7] text-brand ${className}`}>{children}</span>;
}

function HistoryCard({ r, onOpen, onDelete }: { r: Run; onOpen: () => void; onDelete: () => void }) {
  const outcome = (
    <span className={`text-sm font-semibold ${TONE_TEXT[r.preview.tone]}`}>
      {r.mode === "screening" && r.preview.score != null && <>Score {r.preview.score} · </>}
      {r.mode === "board" ? "View report" : r.mode === "tea" ? "View summary" : r.preview.badge}
    </span>
  );
  return (
    <div className="group relative cursor-pointer rounded-xl border border-brand/50 p-4 transition hover:border-brand" onClick={onOpen}>
      <Pixel className="text-[11px] sm:text-xs">{MODE_NAME[r.mode] ?? r.mode}</Pixel>
      <p className="mt-1.5 text-xs text-navy/40">{new Date(r.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>
      <div className="mt-2">{outcome}</div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete meeting"
        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-navy/20 bg-white text-xs text-navy/50 transition hover:border-brand hover:text-brand group-hover:flex"
      >
        ✕
      </button>
    </div>
  );
}

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    fetch("/api/runs").then((r) => r.json()).then((d) => setRuns(d.runs ?? [])).catch(() => setRuns([]));
  }, []);

  async function del(id: string) {
    if (!confirm("Delete this meeting? You can restore it from Settings for 30 days.")) return;
    const res = await fetch(`/api/runs/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error ?? "Could not delete this meeting."); return; }
    setRuns((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));
  }

  function open(id: string) { window.location.href = `/session/${id}`; }

  const groups: Record<string, { name: string; runs: Run[] }> = {};
  for (const r of runs ?? []) (groups[r.companyId] ??= { name: r.companyName, runs: [] }).runs.push(r);

  return (
    <div className="min-h-screen bg-white font-sans text-navy">
      {/* Top bar */}
      <div className="mx-auto flex max-w-5xl items-center px-6 py-3">
        <Link href="/"><img src="/brand/lockup.png" alt="Quorum" className="h-9 w-auto sm:h-12" /></Link>
        <Link href="/" aria-label="Exit" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-navy/50 transition hover:bg-navy/5 hover:text-navy">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </Link>
      </div>
      <div className="border-b border-navy/10" />

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-1">
          <Pixel className="text-xl sm:text-2xl">History Meetings</Pixel>
          <p className="text-xs text-navy/40">Deleted meetings can be restored from Settings, kept for up to 30 days.</p>
        </div>

        {runs === null ? (
          <p className="text-sm text-navy/40">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-navy/50">No meetings yet — <Link href="/" className="text-brand underline">start one</Link>.</p>
        ) : (
          Object.entries(groups).map(([cid, g]) => (
            <section key={cid} className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-navy/60">{g.name}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {g.runs.map((r) => <HistoryCard key={r.id} r={r} onOpen={() => open(r.id)} onDelete={() => del(r.id)} />)}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
