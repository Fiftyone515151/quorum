"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Run { id: string; mode: string; status: string; createdAt: string; companyId: string; companyName: string }
const MODE_LABEL: Record<string, string> = { screening: "🎯 Screening", ic: "⚖️ IC", board: "🛠️ Board", tea: "🍵 Tea" };

export default function HistoryPage() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    fetch("/api/runs").then((r) => r.json()).then((d) => setRuns(d.runs ?? []));
  }, []);

  if (!runs) return <p className="text-muted">Loading…</p>;

  const groups: Record<string, { name: string; runs: Run[] }> = {};
  for (const r of runs) {
    (groups[r.companyId] ??= { name: r.companyName, runs: [] }).runs.push(r);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">History</h1>
        <Link href="/" className="btn-ghost ml-auto">Back to home</Link>
      </div>

      {runs.length === 0 && <p className="text-sm text-muted">No runs yet.</p>}

      {Object.entries(groups).map(([cid, g]) => (
        <section key={cid} className="flex flex-col gap-2">
          <p className="label">{g.name}</p>
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line">
            {g.runs.map((r) => (
              <Link key={r.id} href={`/session/${r.id}`} className="flex items-center gap-3 bg-surface px-4 py-3 hover:bg-white/5">
                <span className="text-sm text-white">{MODE_LABEL[r.mode] ?? r.mode}</span>
                <span className="label ml-auto">{r.status}</span>
                <span className="label text-muted">{new Date(r.createdAt).toLocaleString()}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
