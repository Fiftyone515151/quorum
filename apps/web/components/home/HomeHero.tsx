"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RunPreview } from "@/lib/runSummary";
import FileLibraryPanel from "./FileLibraryPanel";

interface CompanyLite { id: string; name: string; stage: string }
interface ActiveCompany { id: string; name: string; stage: string; topic: string | null }
interface Meeting { id: string; mode: string; createdAt: string; preview: RunPreview }

const MODES = [
  { id: "screening", name: "Screening", emoji: "🎯", blurb: "Fast triage — the reason you'd get a no." },
  { id: "ic", name: "Investment Committee", emoji: "⚖️", blurb: "An adversarial invest / pass verdict." },
  { id: "board", name: "Board", emoji: "🛠️", blurb: "A post-investment priority list." },
  { id: "tea", name: "Founder Tea", emoji: "🍵", blurb: "Open, divergent discussion." },
] as const;

const MODE_NAME: Record<string, string> = {
  screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea",
};
const TONE_TEXT: Record<RunPreview["tone"], string> = {
  good: "text-emerald-600", warn: "text-amber-600", bad: "text-red-600", neutral: "text-navy/60",
};
const STAGE_LABEL: Record<string, string> = { pre_seed: "Pre-seed", seed: "Seed", A: "Series A" };

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel leading-[1.7] text-brand ${className}`}>{children}</span>;
}

function ToolboxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Z" />
      <path d="M8 9V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v3" />
      <path d="M3 13h18" />
    </svg>
  );
}

export default function HomeHero({
  companies, active, meetings,
}: { companies: CompanyLite[]; active: ActiveCompany; meetings: Meeting[] }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [fileLibOpen, setFileLibOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const [list, setList] = useState(meetings);
  const [busy, setBusy] = useState(false);

  function go(href: string) { setMenuOpen(false); setSwitchOpen(false); router.push(href); }

  function switchTo(id: string) {
    document.cookie = `quorum_active_company=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
    setSwitchOpen(false);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await fetch(`/api/runs/${deleteTarget.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Could not delete this meeting.");
      return;
    }
    setList((l) => l.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  const MENU_SECTIONS: { href: string; label: string }[][] = [
    MODES.map((m) => ({ href: `/new?mode=${m.id}`, label: `${m.emoji}  ${m.name}` })),
    [{ href: "/profile", label: "Startup Profile" }],
    [{ href: "/history", label: "History Meetings" }],
    [{ href: "/settings", label: "Settings" }],
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-navy">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
        <img src="/brand/lockup.png" alt="Quorum" className="h-9 w-auto sm:h-12" />

        <div className="relative">
          <button
            onClick={() => { setMenuOpen((v) => !v); setSwitchOpen(false); }}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-navy/60 transition hover:bg-navy/5 hover:text-navy"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-navy/10 bg-white py-1 shadow-lg">
                {MENU_SECTIONS.map((section, si) => (
                  <div key={si} className={si > 0 ? "border-t border-navy/10" : ""}>
                    {section.map((item) => (
                      <button key={item.href} onClick={() => go(item.href)}
                        className="block w-full px-4 py-2 text-left text-sm text-navy/80 transition hover:bg-brand-tint hover:text-brand">
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="border-t border-navy/10">
                  <button onClick={logout} className="block w-full px-4 py-2 text-left text-sm text-navy/50 transition hover:bg-navy/5">Sign out</button>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => go("/settings")}
          className="ml-auto flex items-center gap-2 rounded-lg bg-navy/5 px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-navy/10"
        >
          <ToolboxIcon /> Settings
        </button>
      </div>
      <div className="border-b border-navy/10" />

      {/* ── Body: left 2/3, right 1/3 ──────────────────────────── */}
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-6 lg:grid-cols-3">
        {/* Left 2/3 */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Pixel className="text-lg sm:text-xl">Start From Here!</Pixel>
            <span className="text-xl text-brand">↓</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => go(`/new?mode=${m.id}`)}
                className="flex flex-col gap-2 rounded-xl bg-brand px-5 py-6 text-left text-white transition hover:bg-brand-dark">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{m.emoji}</span>
                  <Pixel className="text-xs text-white sm:text-sm">{m.name}</Pixel>
                </div>
                <p className="text-[15px] font-medium leading-relaxed text-white/95">{m.blurb}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-navy/10" />

          <Pixel className="text-lg sm:text-xl">History Meetings</Pixel>

          {list.length === 0 ? (
            <p className="text-sm text-navy/50">No meetings yet — start one above.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {list.map((m) => (
                <MeetingCard key={m.id} m={m} onOpen={() => router.push(`/session/${m.id}`)}
                  onDelete={() => setDeleteTarget(m)} onArrow={() => router.push("/history")} />
              ))}
            </div>
          )}
        </div>

        {/* Right 1/3 */}
        <div className="relative">
          <div className="flex flex-col gap-4 rounded-2xl border border-navy/10 p-5">
            <div className="flex items-center gap-2">
              <Pixel className="text-base sm:text-lg">Startup Profile</Pixel>
              <div className="group relative ml-auto">
                <button
                  onClick={() => setSwitchOpen((v) => !v)}
                  aria-label="Add or switch startup"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-brand/40 text-brand transition hover:bg-brand hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4" /><path d="M4 7h16" /><path d="m16 21 4-4-4-4" /><path d="M20 17H4" /></svg>
                </button>
                {!switchOpen && (
                  <span className="pointer-events-none absolute right-0 top-9 z-20 whitespace-nowrap rounded-md bg-navy px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
                    Add or switch startup
                  </span>
                )}
                {switchOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setSwitchOpen(false)} />
                    <div className="absolute right-0 top-9 z-20 max-h-64 w-56 overflow-y-auto rounded-xl border border-navy/10 bg-white py-1 shadow-lg">
                      {companies.map((c) => (
                        <button key={c.id} onClick={() => switchTo(c.id)}
                          className={`block w-full truncate px-4 py-2 text-left text-sm transition hover:bg-brand-tint hover:text-brand ${c.id === active.id ? "font-semibold text-brand" : "text-navy/80"}`}>
                          {c.name}
                        </button>
                      ))}
                      <div className="mt-1 border-t border-navy/10">
                        <button onClick={() => go("/onboarding?add=1")} className="block w-full px-4 py-2 text-left text-sm font-medium text-brand transition hover:bg-brand-tint">
                          + Add New Startup
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <dl className="flex flex-col gap-2 text-sm">
              <ProfileRow label="Name" value={active.name} />
              <ProfileRow label="Stage" value={STAGE_LABEL[active.stage] ?? active.stage} />
              <ProfileRow label="Topic" value={active.topic || "—"} />
            </dl>

            <button
              onClick={() => setFileLibOpen(true)}
              className="mx-auto rounded-lg border border-brand bg-brand-tint px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              Document library
            </button>

            <button onClick={() => go("/profile")} className="text-center text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-dark">
              View or edit more startup details
            </button>
          </div>

          {fileLibOpen && (
            <FileLibraryPanel companyId={active.id} onClose={() => setFileLibOpen(false)} />
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ──────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-navy/40 px-4" onClick={() => !busy && setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-center"><Pixel className="text-sm sm:text-base">Notification</Pixel></p>
            <p className="mt-4 text-center text-sm leading-relaxed text-navy/80">
              Delete this meeting? You can recover it from Settings within 30 days.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={confirmDelete} disabled={busy}
                className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button onClick={() => setDeleteTarget(null)} disabled={busy}
                className="flex-1 rounded-lg bg-navy/10 px-4 py-2.5 text-sm font-semibold text-navy/70 transition hover:bg-navy/15 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-navy/60">{label}:</dt>
      <dd className="min-w-0 break-words text-navy/90">{value}</dd>
    </div>
  );
}

function MeetingCard({
  m, onOpen, onDelete, onArrow,
}: { m: Meeting; onOpen: () => void; onDelete: () => void; onArrow: () => void }) {
  const outcome = (
    <span className={`text-sm font-semibold ${TONE_TEXT[m.preview.tone]}`}>
      {m.mode === "screening" && m.preview.score != null && <>Score {m.preview.score} · </>}
      {m.mode === "board" ? "View report" : m.mode === "tea" ? "View summary" : m.preview.badge}
    </span>
  );
  return (
    <div className="group relative cursor-pointer rounded-xl border border-brand/50 p-4 transition hover:border-brand" onClick={onOpen}>
      <Pixel className="text-[11px] sm:text-xs">{MODE_NAME[m.mode] ?? m.mode}</Pixel>
      <p className="mt-1.5 text-xs text-navy/40">{new Date(m.createdAt).toLocaleDateString()}</p>
      <div className="mt-2">{outcome}</div>

      {/* hover controls */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Delete meeting"
        className="absolute right-2 top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-navy/20 bg-white text-xs text-navy/50 transition hover:border-brand hover:text-brand group-hover:flex"
      >
        ✕
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onArrow(); }}
        aria-label="Open in History Meetings"
        className="absolute bottom-2 right-2 hidden text-brand transition hover:text-brand-dark group-hover:block"
      >
        ↗
      </button>
    </div>
  );
}
