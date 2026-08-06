"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROFILE_QUESTIONS, FOUNDER_TEAM_LABEL, type ProfileKey } from "@/lib/profile";

export interface CompanyLite {
  id: string;
  name: string;
  topic: string | null;
  stage: string;
  profile: Record<string, string>;
}

interface Doc { id: string; fileName: string; ext: string }

const STAGES = [
  { value: "pre_seed", label: "Pre-seed" },
  { value: "angel", label: "Angel" },
  { value: "seed", label: "Seed" },
  { value: "A", label: "Series A" },
];
const STAGE_LABEL: Record<string, string> = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));

// The questionnaire fields, in order. `scalar` fields live on the company;
// `profile` fields live inside company.profile.
type FieldDef =
  | { kind: "scalar"; name: "name" | "topic" | "stage"; label: string; type: "text" | "textarea" | "select"; hint?: string }
  | { kind: "profile"; key: ProfileKey; label: string; hint?: string };

const FIELDS: FieldDef[] = [
  { kind: "scalar", name: "name", label: "Name", type: "text" },
  { kind: "scalar", name: "topic", label: "One-liner", type: "textarea", hint: "What you do, in one line." },
  { kind: "scalar", name: "stage", label: "Stage", type: "select" },
  { kind: "profile", key: "founderTeam", label: FOUNDER_TEAM_LABEL, hint: "Team composition, or the founder's background if solo." },
  ...PROFILE_QUESTIONS.map((q) => ({ kind: "profile" as const, key: q.key, label: q.label, hint: q.question })),
];

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel leading-[1.7] text-brand ${className}`}>{children}</span>;
}
function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export default function ProfileClient({ initialCompanies }: { initialCompanies: CompanyLite[] }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyLite[]>(initialCompanies);
  const [selectedId, setSelectedId] = useState<string | null>(initialCompanies[0]?.id ?? null);
  const [creating, setCreating] = useState<boolean>(initialCompanies.length === 0);

  const selected = companies.find((c) => c.id === selectedId) ?? null;

  function select(id: string) {
    setCreating(false);
    setSelectedId(id);
    document.cookie = `quorum_active_company=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }

  return (
    <div className="flex min-h-screen bg-white font-sans text-navy">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col gap-2 border-r border-navy/10 p-4">
        <Link href="/" className="mb-2 text-sm font-medium text-navy/60 transition hover:text-brand">← Home</Link>
        <button
          onClick={() => setCreating(true)}
          className={`flex items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold transition ${creating ? "bg-brand text-white" : "text-brand hover:bg-brand-tint"}`}
        >
          <span className="text-base leading-none">+</span> New startup
        </button>
        <div className="mt-2 flex flex-col gap-1 overflow-y-auto">
          {companies.map((c) => (
            <button
              key={c.id}
              onClick={() => select(c.id)}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm transition ${!creating && c.id === selectedId ? "bg-brand-tint font-semibold text-brand" : "text-navy/80 hover:bg-navy/5"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-2xl">
          {creating ? (
            <CreateForm
              onCancel={() => selected && setCreating(false)}
              onCreated={(c) => { setCompanies((cs) => [c, ...cs]); select(c.id); router.refresh(); }}
            />
          ) : selected ? (
            <ProfileView
              key={selected.id}
              company={selected}
              onChange={(c) => setCompanies((cs) => cs.map((x) => (x.id === c.id ? c : x)))}
              onDeleted={(id) => {
                const rest = companies.filter((c) => c.id !== id);
                setCompanies(rest);
                if (rest[0]) select(rest[0].id);
                else setCreating(true);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

// ── View / edit an existing startup ─────────────────────────────────────────
function ProfileView({
  company, onChange, onDeleted,
}: { company: CompanyLite; onChange: (c: CompanyLite) => void; onDeleted: (id: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function valueOf(f: FieldDef): string {
    if (f.kind === "scalar") return f.name === "stage" ? (STAGE_LABEL[company.stage] ?? company.stage) : (company[f.name] ?? "");
    return company.profile?.[f.key] ?? "";
  }
  function rawOf(f: FieldDef): string {
    if (f.kind === "scalar") return f.name === "stage" ? company.stage : (company[f.name] ?? "");
    return company.profile?.[f.key] ?? "";
  }
  function fieldId(f: FieldDef): string {
    return f.kind === "scalar" ? f.name : `profile:${f.key}`;
  }

  function startEdit(f: FieldDef) {
    setError(null);
    setEditing(fieldId(f));
    setDraft(rawOf(f));
  }

  async function save(f: FieldDef) {
    setError(null);
    const val = draft.trim();
    if (f.kind === "scalar" && f.name === "name" && !val) return setError("Name can't be empty.");
    setBusy(true);
    let body: any;
    let optimistic: CompanyLite;
    if (f.kind === "scalar") {
      body = { [f.name]: val };
      optimistic = { ...company, [f.name]: val };
    } else {
      const profile = { ...(company.profile ?? {}) };
      if (val) profile[f.key] = val; else delete profile[f.key];
      body = { profile };
      optimistic = { ...company, profile };
    }
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(typeof d.error === "string" ? d.error : "Save failed."); }
    onChange(optimistic);
    setEditing(null);
  }

  async function remove() {
    if (!window.confirm(`Delete "${company.name}" and all its meetings? This can't be undone.`)) return;
    const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(company.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1><Pixel className="text-lg sm:text-xl">Startup Profile</Pixel></h1>

      <div className="flex flex-col divide-y divide-navy/10 rounded-2xl border border-navy/10">
        {FIELDS.map((f) => {
          const id = fieldId(f);
          const isEditing = editing === id;
          const display = valueOf(f);
          return (
            <div key={id} className="flex gap-3 p-4">
              <button
                onClick={() => (isEditing ? setEditing(null) : startEdit(f))}
                aria-label={`Edit ${f.label}`}
                className="mt-0.5 shrink-0 text-navy/40 transition hover:text-brand"
              >
                <PencilIcon />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-navy/60">{f.label}</p>
                {isEditing ? (
                  <div className="mt-1.5 flex flex-col gap-2">
                    {f.kind === "scalar" && f.type === "select" ? (
                      <select value={draft} onChange={(e) => setDraft(e.target.value)}
                        className="rounded-lg border border-navy/15 bg-white p-2 text-sm text-navy outline-none focus:border-brand">
                        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    ) : f.kind === "scalar" && f.type === "text" ? (
                      <input value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
                        className="rounded-lg border border-navy/15 bg-white p-2 text-sm text-navy outline-none focus:border-brand" />
                    ) : (
                      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus
                        className="resize-y rounded-lg border border-navy/15 bg-white p-2 text-sm text-navy outline-none focus:border-brand" />
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => save(f)} disabled={busy}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
                        {busy ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditing(null)} disabled={busy}
                        className="rounded-lg bg-navy/10 px-3 py-1.5 text-xs font-semibold text-navy/70 transition hover:bg-navy/15">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`mt-0.5 whitespace-pre-wrap break-words text-sm ${display ? "text-navy/90" : "text-navy/35"}`}>
                    {display || "Not set yet"}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-brand-dark">{error}</p>}

      {/* Document library */}
      <DocumentsBlock companyId={company.id} />

      {/* Delete startup */}
      <button onClick={remove}
        className="self-start rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">
        Delete startup
      </button>
    </div>
  );
}

// ── Document library block (reuses /api/documents) ──────────────────────────
function DocumentsBlock({ companyId }: { companyId: string }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const r = await fetch(`/api/documents?companyId=${companyId}`);
      const d = await r.json();
      setDocs(d.documents ?? []);
    } catch { setDocs([]); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  async function upload(files: FileList) {
    setError(null); setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append("file", file); fd.append("companyId", companyId);
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Could not upload ${file.name}`);
      }
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setDocs((d) => d?.filter((x) => x.id !== id) ?? d);
  }

  return (
    <div className="flex flex-col gap-3">
      <Pixel className="text-sm sm:text-base">Documents</Pixel>
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-navy/20 bg-navy/[0.02] px-4 py-6 text-center text-sm text-navy/50 transition hover:border-brand hover:bg-brand-tint/40"
      >
        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown" className="hidden"
          disabled={busy} onChange={(e) => e.target.files?.length && upload(e.target.files)} />
        <span className="text-lg">⬆️</span>
        <span>{busy ? "Working…" : "Click to upload or drag & drop"}</span>
        <span className="text-xs text-navy/40">PDF · DOCX · TXT · MD</span>
      </label>

      {error && <p className="text-xs text-brand-dark">{error}</p>}

      <div className="flex flex-col gap-2">
        {docs === null ? (
          <p className="text-sm text-navy/40">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-navy/40">No files yet.</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-navy/10 px-3 py-2 text-sm">
              <button onClick={() => remove(d.id)} disabled={busy} aria-label="Delete file"
                className="shrink-0 text-navy/40 transition hover:text-red-600 disabled:opacity-40">✕</button>
              <span className="text-brand">📄</span>
              <span className="min-w-0 flex-1 truncate text-navy/90">{d.fileName}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Create a new startup (form mode) ────────────────────────────────────────
function CreateForm({ onCreated, onCancel }: { onCreated: (c: CompanyLite) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [stage, setStage] = useState("seed");
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setP = (k: string) => (e: any) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  async function create() {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    const cleanProfile: Record<string, string> = {};
    for (const [k, v] of Object.entries(profile)) if (v.trim()) cleanProfile[k] = v.trim();
    const res = await fetch("/api/companies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, topic, stage, profile: cleanProfile }),
    });
    const d = await res.json();
    setBusy(false);
    if (!res.ok) return setError(typeof d.error === "string" ? d.error : "Could not create startup.");
    onCreated({ id: d.company.id, name: d.company.name, topic: d.company.topic, stage: d.company.stage, profile: (d.company.profile as any) ?? {} });
  }

  const input = "rounded-lg border border-navy/15 bg-white p-2.5 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-brand";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1><Pixel className="text-lg sm:text-xl">New startup</Pixel></h1>
        <Link href="/onboarding?add=1" className="text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-dark">
          Prefer the guided chat? →
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy/60">Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Startup name" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy/60">One-liner</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What you do, in one line" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy/60">Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={input}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-navy/60">{FOUNDER_TEAM_LABEL}</span>
          <textarea value={profile.founderTeam ?? ""} onChange={setP("founderTeam")} rows={2} className={`${input} resize-y`}
            placeholder="Team composition, or the founder's background if solo." />
        </label>
        {PROFILE_QUESTIONS.map((q) => (
          <label key={q.key} className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-navy/60">{q.label}</span>
            <textarea value={profile[q.key] ?? ""} onChange={setP(q.key)} rows={2} className={`${input} resize-y`} placeholder={q.question} />
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-brand-dark">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
          {busy ? "Creating…" : "Create startup"}
        </button>
        <button onClick={onCancel}
          className="rounded-lg bg-navy/10 px-4 py-2.5 text-sm font-semibold text-navy/70 transition hover:bg-navy/15">
          Cancel
        </button>
      </div>
      <p className="text-xs text-navy/40">You can upload business plans and documents after creating the startup.</p>
    </div>
  );
}
