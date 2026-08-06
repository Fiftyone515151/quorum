"use client";

import { useEffect, useRef, useState } from "react";
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

type FieldDef =
  | { kind: "scalar"; name: "name" | "topic" | "stage"; label: string; type: "text" | "textarea" | "select"; hint: string }
  | { kind: "profile"; key: ProfileKey; label: string; hint: string };

const FIELDS: FieldDef[] = [
  { kind: "scalar", name: "name", label: "Name", type: "text", hint: "Your startup's name." },
  { kind: "scalar", name: "topic", label: "One-liner", type: "textarea", hint: "What you do, in one line." },
  { kind: "scalar", name: "stage", label: "Stage", type: "select", hint: "Your fundraising stage." },
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

// Reusable centered confirmation modal.
function ConfirmModal({
  message, cancelLabel, confirmLabel, onCancel, onConfirm, confirmClass,
}: { message: string; cancelLabel: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; confirmClass: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-navy/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="text-center text-sm leading-relaxed text-navy/80">{message}</p>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
            {cancelLabel}
          </button>
          <button onClick={onConfirm} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileClient({
  initialCompanies, initialSelectedId, backHref, backLabel,
}: { initialCompanies: CompanyLite[]; initialSelectedId: string | null; backHref: string; backLabel: string }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<CompanyLite[]>(initialCompanies);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? initialCompanies[0]?.id ?? null);
  const [creating, setCreating] = useState<boolean>(initialCompanies.length === 0);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const selected = companies.find((c) => c.id === selectedId) ?? null;

  // Warn on browser refresh/close when there are unsaved edits.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // Route a navigation through the unsaved-changes guard.
  function guard(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  function select(id: string) {
    setCreating(false);
    setSelectedId(id);
    setDirty(false);
    document.cookie = `quorum_active_company=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }

  return (
    <div className="flex min-h-screen bg-white font-sans text-navy">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col gap-2 border-r border-navy/10 p-4">
        <button onClick={() => guard(() => router.push(backHref))} className="mb-2 self-start text-sm font-medium text-navy/60 transition hover:text-brand">
          {backLabel}
        </button>
        <button
          onClick={() => guard(() => setCreating(true))}
          className={`flex items-center gap-2 rounded-lg border border-brand px-3 py-2 text-sm font-semibold transition ${creating ? "bg-brand text-white" : "text-brand hover:bg-brand-tint"}`}
        >
          <span className="text-base leading-none">+</span> New startup
        </button>
        <div className="mt-2 flex flex-col gap-1 overflow-y-auto">
          {companies.map((c) => (
            <button key={c.id} onClick={() => guard(() => select(c.id))}
              className={`truncate rounded-lg px-3 py-2 text-left text-sm transition ${!creating && c.id === selectedId ? "bg-brand-tint font-semibold text-brand" : "text-navy/80 hover:bg-navy/5"}`}>
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
              onDirtyChange={setDirty}
              onChange={(c) => { setCompanies((cs) => cs.map((x) => (x.id === c.id ? c : x))); setDirty(false); }}
              onDeleted={(id) => {
                const rest = companies.filter((c) => c.id !== id);
                setCompanies(rest); setDirty(false);
                if (rest[0]) select(rest[0].id); else setCreating(true);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </main>

      {/* Unsaved-changes guard */}
      {pending && (
        <ConfirmModal
          message="You have unsaved changes. Exit anyway? All edits will be lost."
          cancelLabel="Back to editing"
          confirmLabel="Confirm exit"
          confirmClass="border border-brand bg-white text-brand hover:bg-brand-tint"
          onCancel={() => setPending(null)}
          onConfirm={() => { const run = pending; setPending(null); setDirty(false); run?.(); }}
        />
      )}
    </div>
  );
}

// ── View / edit an existing startup ─────────────────────────────────────────
function ProfileView({
  company, onChange, onDeleted, onDirtyChange,
}: { company: CompanyLite; onChange: (c: CompanyLite) => void; onDeleted: (id: string) => void; onDirtyChange: (d: boolean) => void }) {
  const [draft, setDraft] = useState<CompanyLite>({ ...company, profile: { ...company.profile } });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function serialize(c: CompanyLite): string {
    const prof: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.profile ?? {})) if (v?.trim()) prof[k] = v.trim();
    return JSON.stringify({ name: c.name.trim(), topic: (c.topic ?? "").trim(), stage: c.stage, profile: prof });
  }
  const dirty = serialize(draft) !== serialize(company);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);

  function fieldId(f: FieldDef) { return f.kind === "scalar" ? f.name : `profile:${f.key}`; }
  function rawOf(f: FieldDef): string {
    if (f.kind === "scalar") return f.name === "stage" ? draft.stage : ((draft[f.name] as string) ?? "");
    return draft.profile?.[f.key] ?? "";
  }
  function displayOf(f: FieldDef): string {
    if (f.kind === "scalar") return f.name === "stage" ? (STAGE_LABEL[draft.stage] ?? draft.stage) : ((draft[f.name] as string) ?? "");
    return draft.profile?.[f.key] ?? "";
  }
  function setValue(f: FieldDef, v: string) {
    setDraft((d) => {
      if (f.kind === "scalar") return { ...d, [f.name]: v };
      return { ...d, profile: { ...d.profile, [f.key]: v } };
    });
  }
  function toggleOpen(f: FieldDef) {
    const id = fieldId(f);
    setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function save() {
    setError(null);
    if (!draft.name.trim()) return setError("Name can't be empty.");
    setBusy(true);
    const profile: Record<string, string> = {};
    for (const [k, v] of Object.entries(draft.profile ?? {})) if (v?.trim()) profile[k] = v.trim();
    const res = await fetch(`/api/companies/${company.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name.trim(), topic: draft.topic ?? "", stage: draft.stage, profile }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); return setError(typeof d.error === "string" ? d.error : "Save failed."); }
    onChange({ ...draft, name: draft.name.trim(), topic: (draft.topic ?? "").trim(), profile });
    setOpen(new Set());
  }

  async function doDelete() {
    setConfirmDelete(false);
    const res = await fetch(`/api/companies/${company.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(company.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1><Pixel className="text-lg sm:text-xl">Startup Profile</Pixel></h1>

      <div className="flex flex-col divide-y divide-navy/10 rounded-2xl border border-navy/10">
        {FIELDS.map((f) => {
          const id = fieldId(f);
          const isOpen = open.has(id);
          const value = displayOf(f);
          return (
            <div key={id} className="flex gap-3 p-4">
              <button onClick={() => toggleOpen(f)} aria-label={`Edit ${f.label}`} className="mt-0.5 shrink-0 text-navy/40 transition hover:text-brand">
                <PencilIcon />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand sm:text-base">{f.label}</p>
                {isOpen ? (
                  <div className="mt-1.5">
                    {f.kind === "scalar" && f.type === "select" ? (
                      <select value={rawOf(f)} onChange={(e) => setValue(f, e.target.value)}
                        className="rounded-lg border border-navy/15 bg-white p-2 text-sm text-navy outline-none focus:border-brand">
                        {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    ) : f.kind === "scalar" && f.type === "text" ? (
                      <input value={rawOf(f)} onChange={(e) => setValue(f, e.target.value)} autoFocus placeholder={f.hint}
                        className="w-full rounded-lg border border-navy/15 bg-white p-2 text-sm text-navy outline-none focus:border-brand" />
                    ) : (
                      <textarea value={rawOf(f)} onChange={(e) => setValue(f, e.target.value)} rows={3} autoFocus placeholder={f.hint}
                        className="w-full resize-y rounded-lg border border-navy/15 bg-white p-2 text-sm text-navy outline-none focus:border-brand" />
                    )}
                  </div>
                ) : (
                  <p className={`mt-0.5 whitespace-pre-wrap break-words text-sm ${value ? "text-navy/90" : "italic text-navy/35"}`}>
                    {value || f.hint}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && <p className="text-sm text-brand-dark">{error}</p>}

      {/* Save (left) / Delete (right), aligned with the box edges */}
      <div className="flex items-center justify-between">
        <button onClick={save} disabled={busy || !dirty}
          className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setConfirmDelete(true)}
          className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
          Delete startup
        </button>
      </div>

      {/* Documents */}
      <DocumentsBlock companyId={company.id} />

      {confirmDelete && (
        <ConfirmModal
          message={`Delete "${company.name}" and all its meetings? This can't be undone.`}
          cancelLabel="Cancel"
          confirmLabel="Delete"
          confirmClass="bg-red-600 text-white hover:bg-red-700"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={doDelete}
        />
      )}
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
    try { const r = await fetch(`/api/documents?companyId=${companyId}`); const d = await r.json(); setDocs(d.documents ?? []); }
    catch { setDocs([]); }
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
              <button onClick={() => remove(d.id)} disabled={busy} aria-label="Delete file" className="shrink-0 text-navy/40 transition hover:text-red-600 disabled:opacity-40">✕</button>
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
  const [attached, setAttached] = useState<{ fileName: string; text: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const setP = (k: string) => (e: any) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  async function attachFiles(files: FileList) {
    setError(null); setUploading(true);
    try {
      const added: { fileName: string; text: string }[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? `Could not read ${file.name}`);
        added.push({ fileName: file.name, text: d.content });
      }
      setAttached((a) => [...a, ...added]);
    } catch (e: any) { setError(e.message); } finally { setUploading(false); }
  }
  const removeAttached = (i: number) => setAttached((a) => a.filter((_, idx) => idx !== i));

  async function create() {
    setError(null);
    if (!name.trim()) return setError("Name is required.");
    setBusy(true);
    const cleanProfile: Record<string, string> = {};
    for (const [k, v] of Object.entries(profile)) if (v.trim()) cleanProfile[k] = v.trim();
    const res = await fetch("/api/companies", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, topic, stage, profile: cleanProfile, documents: attached }),
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
        <a href="/onboarding?add=1" className="text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-dark">Prefer the guided chat? →</a>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-brand">Name *</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Startup name" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-brand">One-liner</span>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What you do, in one line" className={input} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-brand">Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)} className={input}>
            {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-brand">{FOUNDER_TEAM_LABEL}</span>
          <textarea value={profile.founderTeam ?? ""} onChange={setP("founderTeam")} rows={2} className={`${input} resize-y`} placeholder="Team composition, or the founder's background if solo." />
        </label>
        {PROFILE_QUESTIONS.map((q) => (
          <label key={q.key} className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-brand">{q.label}</span>
            <textarea value={profile[q.key] ?? ""} onChange={setP(q.key)} rows={2} className={`${input} resize-y`} placeholder={q.question} />
          </label>
        ))}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-brand">Documents (optional)</span>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) attachFiles(e.dataTransfer.files); }}
            className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-navy/20 bg-navy/[0.02] px-4 py-6 text-center text-sm text-navy/50 transition hover:border-brand hover:bg-brand-tint/40"
          >
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown" className="hidden" disabled={uploading}
              onChange={(e) => e.target.files?.length && attachFiles(e.target.files)} />
            <span className="text-lg">⬆️</span>
            <span>{uploading ? "Reading files…" : "Click to upload or drag & drop"}</span>
            <span className="text-xs text-navy/40">PDF · DOCX · TXT · MD</span>
          </label>
          {attached.map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-navy/10 px-3 py-2 text-sm">
              <button onClick={() => removeAttached(i)} aria-label="Remove file" className="shrink-0 text-navy/40 transition hover:text-red-600">✕</button>
              <span className="text-brand">📄</span>
              <span className="min-w-0 flex-1 truncate text-navy/90">{a.fileName}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-brand-dark">{error}</p>}
      <div className="flex gap-2">
        <button onClick={create} disabled={busy || uploading}
          className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40">
          {busy ? "Creating…" : "Create startup"}
        </button>
        <button onClick={onCancel} className="rounded-lg bg-navy/10 px-4 py-2.5 text-sm font-semibold text-navy/70 transition hover:bg-navy/15">
          Cancel
        </button>
      </div>
    </div>
  );
}
