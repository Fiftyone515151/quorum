"use client";

import { PROFILE_QUESTIONS } from "@/lib/profile";

const STAGES = ["pre_seed", "seed", "A"];

/** Flat blank form (A fields + upload + the 9 profile answers). */
export const emptyStartupForm: Record<string, string> = {
  name: "", topic: "", bp: "", bpFileName: "", stage: "seed", fundingCurrency: "USD", valuation: "", roundSize: "",
  ...Object.fromEntries(PROFILE_QUESTIONS.map((q) => [q.key, ""])),
};

/** Company row (with its profile JSON) -> flat form. */
export function companyToForm(c: any): Record<string, string> {
  return { ...emptyStartupForm, ...c, ...(c?.profile ?? {}) };
}

/** Flat form -> request body with the profile answers nested. */
export function toCompanyBody(form: any) {
  const profile: Record<string, string> = {};
  for (const q of PROFILE_QUESTIONS) profile[q.key] = form[q.key] ?? "";
  return {
    name: form.name, topic: form.topic, bp: form.bp, bpFileName: form.bpFileName,
    stage: form.stage, fundingCurrency: form.fundingCurrency, valuation: form.valuation, roundSize: form.roundSize,
    profile,
  };
}

/** The full startup intake form fields (A basics + optional B/C Q&A + upload).
 *  Shared by onboarding and the edit dialog so the two never drift. */
export default function StartupFields({
  form, setForm, onUpload,
}: { form: any; setForm: (fn: any) => void; onUpload: (f: File) => void }) {
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));
  const input = "rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent";

  return (
    <div className="flex flex-col gap-3">
      <input value={form.name ?? ""} onChange={set("name")} placeholder="Startup name *" className={input} />
      <input value={form.topic ?? ""} onChange={set("topic")} placeholder="One-liner — what do you do? *" className={input} />

      <div className="flex flex-wrap gap-2">
        <select value={form.stage ?? "seed"} onChange={set("stage")} className="rounded-lg border border-line bg-ink p-2 text-sm text-white">
          {STAGES.map((s) => <option key={s} value={s}>{s === "A" ? "Series A" : s}</option>)}
        </select>
        <input value={form.fundingCurrency ?? ""} onChange={set("fundingCurrency")} placeholder="Currency" className="w-24 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
        <input value={form.valuation ?? ""} onChange={set("valuation")} placeholder="Valuation" className="w-32 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
        <input value={form.roundSize ?? ""} onChange={set("roundSize")} placeholder="Round size" className="w-32 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-ink p-3 text-sm hover:border-accent">
        <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        {form.bpFileName || form.bp ? (
          <>
            <span className="text-accent">📄</span>
            <span className="truncate text-white">{form.bpFileName || "Document on file"}</span>
            <span className="label text-muted ml-auto shrink-0">Replace</span>
          </>
        ) : (
          <>
            <span className="text-muted">Upload a document (optional)</span>
            <span className="label text-muted ml-auto shrink-0">.pdf .docx .txt .md</span>
          </>
        )}
      </label>

      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-muted hover:text-white">
          Tell the panel more <span className="label">optional · sharper evaluation</span>
        </summary>
        <div className="flex flex-col gap-3 p-3 pt-1">
          {PROFILE_QUESTIONS.map((q) => (
            <label key={q.key} className="flex flex-col gap-1">
              <span className="label text-muted">{q.label}</span>
              <textarea value={form[q.key] ?? ""} onChange={set(q.key)} placeholder={q.question}
                className="min-h-[60px] rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
