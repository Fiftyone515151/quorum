"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";

interface Preview { badge: string; tone: "good" | "warn" | "bad" | "neutral"; line: string }
interface Run { id: string; mode: string; status: string; createdAt: string; companyId: string; companyName: string; preview: Preview }

const MODE: Record<string, { icon: string; label: string }> = {
  screening: { icon: "🎯", label: "Screening" },
  ic: { icon: "⚖️", label: "Investment Committee" },
  board: { icon: "🛠️", label: "Board" },
  tea: { icon: "🍵", label: "Founder Tea" },
};

const TONE: Record<Preview["tone"], string> = {
  good: "bg-emerald-400/10 text-emerald-400",
  warn: "bg-amber-400/10 text-amber-400",
  bad: "bg-red-400/10 text-red-400",
  neutral: "bg-white/5 text-muted",
};

function HistoryPageInner() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    fetch("/api/runs").then((r) => r.json()).then((d) => setRuns(d.runs ?? []));
  }, []);

  async function del(id: string) {
    if (!confirm("Delete this session? This can't be undone.")) return;
    const res = await fetch(`/api/runs/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Could not delete this session.");
      return;
    }
    setRuns((rs) => (rs ? rs.filter((r) => r.id !== id) : rs));
  }

  if (!runs) return <p className="text-muted">Loading…</p>;

  const groups: Record<string, { name: string; runs: Run[] }> = {};
  for (const r of runs) {
    (groups[r.companyId] ??= { name: r.companyName, runs: [] }).runs.push(r);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">History</h1>
        <Link href="/" className="btn-ghost ml-auto">Back to home</Link>
      </div>

      {runs.length === 0 && <p className="text-sm text-muted">No sessions yet.</p>}

      {Object.entries(groups).map(([cid, g]) => (
        <section key={cid} className="flex flex-col gap-3">
          <p className="label">{g.name}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.runs.map((r) => {
              const m = MODE[r.mode] ?? { icon: "•", label: r.mode };
              return (
                <div key={r.id} className="card flex items-start gap-3 p-4 transition-colors hover:border-accent">
                  <Link href={`/session/${r.id}`} className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{m.icon}</span>
                      <span className="truncate text-sm font-medium text-white">{m.label}</span>
                      <span className={`ml-auto shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${TONE[r.preview.tone]}`}>
                        {r.preview.badge}
                      </span>
                    </div>
                    {r.preview.line && (
                      <p className="line-clamp-2 text-xs leading-relaxed text-muted">{r.preview.line}</p>
                    )}
                    <span className="label text-muted">{new Date(r.createdAt).toLocaleString()}</span>
                  </Link>
                  <button
                    onClick={() => del(r.id)}
                    aria-label="Delete session"
                    className="shrink-0 text-muted hover:text-brass"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppShell>
      <HistoryPageInner />
    </AppShell>
  );
}
