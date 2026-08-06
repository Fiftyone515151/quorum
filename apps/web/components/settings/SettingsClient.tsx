"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PASSWORD_RULE, validatePassword } from "@/lib/password";
import type { RunPreview } from "@/lib/runSummary";

interface DeletedRun {
  id: string; mode: string; createdAt: string; deletedAt: string; companyName: string; preview: RunPreview;
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

function initials(name: string, email: string): string {
  const src = name.trim() || email;
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase();
}

function daysAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  return d <= 0 ? "today" : d === 1 ? "1 day ago" : `${d} days ago`;
}

export default function SettingsClient({ name: initialName, email }: { name: string; email: string }) {
  const router = useRouter();

  // Profile: name
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [nameBusy, setNameBusy] = useState(false);

  // Password
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);

  // Recently deleted
  const [deleted, setDeleted] = useState<DeletedRun[] | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/runs?deleted=1").then((r) => r.json()).then((d) => setDeleted(d.runs ?? [])).catch(() => setDeleted([]));
  }, []);

  async function saveName() {
    setNameBusy(true);
    const res = await fetch("/api/user", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    });
    setNameBusy(false);
    if (res.ok) { setSavedName(name); router.refresh(); }
  }

  async function changePassword() {
    setPwError(null);
    const v = validatePassword(next);
    if (!v.ok) return setPwError(v.error);
    if (next !== confirm) return setPwError("New passwords do not match.");
    setPwBusy(true);
    const res = await fetch("/api/user/password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    const d = await res.json().catch(() => ({}));
    setPwBusy(false);
    if (!res.ok) return setPwError(d.error ?? "Could not change password.");
    setPwDone(true);
    setCur(""); setNext(""); setConfirm("");
    setTimeout(() => { setPwOpen(false); setPwDone(false); }, 1200);
  }

  async function restore(id: string) {
    setRowBusy(id);
    const res = await fetch(`/api/runs/${id}/restore`, { method: "POST" });
    setRowBusy(null);
    if (res.ok) { setDeleted((l) => l?.filter((r) => r.id !== id) ?? l); router.refresh(); }
  }

  async function purge(id: string) {
    if (!confirmWindow("Permanently delete this meeting? This can't be undone.")) return;
    setRowBusy(id);
    const res = await fetch(`/api/runs/${id}?permanent=1`, { method: "DELETE" });
    setRowBusy(null);
    if (res.ok) setDeleted((l) => l?.filter((r) => r.id !== id) ?? l);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const input =
    "rounded-lg border border-navy/15 bg-white p-2.5 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-brand";

  return (
    <div className="min-h-screen bg-white px-6 py-6 font-sans text-navy">
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm font-medium text-navy/60 transition hover:text-brand">← Home</Link>
        </div>
        <h1><Pixel className="text-lg sm:text-xl">Settings</Pixel></h1>

        {/* Profile */}
        <section className="flex flex-col gap-4 rounded-2xl border border-navy/10 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-semibold text-white">
              {initials(savedName, email)}
            </div>
            <p className="text-sm text-navy/50">Your account</p>
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-navy/60">Username</label>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={`${input} flex-1`} />
              <button onClick={saveName} disabled={nameBusy || name.trim() === savedName.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
                {nameBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-navy/60">Email</label>
            <p className="rounded-lg bg-navy/5 p-2.5 text-sm text-navy/70">{email}</p>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-navy/60">Password</label>
            <div className="flex items-center gap-2">
              <p className="flex-1 rounded-lg bg-navy/5 p-2.5 text-sm tracking-widest text-navy/70">••••••••••</p>
              <button onClick={() => { setPwOpen((v) => !v); setPwError(null); setPwDone(false); }}
                className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white">
                Change password
              </button>
            </div>
            {pwOpen && (
              <div className="mt-2 flex flex-col gap-2 rounded-lg border border-navy/10 bg-brand-tint/40 p-3">
                <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" className={input} />
                <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password" className={input} />
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={input} />
                <p className="text-xs leading-relaxed text-navy/50">{PASSWORD_RULE}</p>
                {pwError && <p className="text-xs text-brand-dark">{pwError}</p>}
                {pwDone && <p className="text-xs text-emerald-600">Password updated.</p>}
                <button onClick={changePassword} disabled={pwBusy}
                  className="self-start rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
                  {pwBusy ? "Updating…" : "Update password"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Recently deleted */}
        <section className="flex flex-col gap-4 rounded-2xl border border-navy/10 p-5">
          <div>
            <Pixel className="text-sm sm:text-base">Recently deleted</Pixel>
            <p className="mt-1 text-xs text-navy/50">Deleted meetings are kept for 30 days.</p>
          </div>
          {deleted === null ? (
            <p className="text-sm text-navy/40">Loading…</p>
          ) : deleted.length === 0 ? (
            <p className="text-sm text-navy/40">No deleted meetings.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {deleted.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border border-navy/10 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-navy">{MODE_NAME[r.mode] ?? r.mode}</span>
                      <span className="truncate text-xs text-navy/50">· {r.companyName}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-navy/40">
                      deleted {daysAgo(r.deletedAt)}
                      {r.preview.badge && <span className={`ml-2 font-medium ${TONE_TEXT[r.preview.tone]}`}>{r.preview.badge}</span>}
                    </p>
                  </div>
                  <button onClick={() => restore(r.id)} disabled={rowBusy === r.id}
                    className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
                    Restore
                  </button>
                  <button onClick={() => purge(r.id)} disabled={rowBusy === r.id}
                    className="shrink-0 text-xs text-navy/40 transition hover:text-red-600 disabled:opacity-40">
                    Delete permanently
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Sign out */}
        <button onClick={logout}
          className="self-start rounded-lg border border-navy/15 px-4 py-2 text-sm font-semibold text-navy/70 transition hover:border-red-500 hover:text-red-600">
          Sign out
        </button>
      </div>
    </div>
  );
}

// Small wrapper so the confirm() call is easy to stub/replace later.
function confirmWindow(msg: string): boolean {
  return typeof window === "undefined" ? true : window.confirm(msg);
}
