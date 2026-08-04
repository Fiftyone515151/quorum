"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email, password, name } : { email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      router.push(mode === "register" ? "/onboarding" : "/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-6 grid max-w-4xl gap-10 md:mt-14 md:grid-cols-2">
      {/* intro (placeholder landing) */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚖️</span>
          <span className="font-mono text-xl font-semibold text-white">Quorum</span>
        </div>
        <h2 className="text-2xl font-semibold leading-snug text-white">
          A simulated VC panel for fundraising founders.
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Save your startup once, then convene a panel of investor personas to pressure-test it —
          any time, from every angle. Quorum uses real VC decision logic (no voting, no averaging)
          to turn the discussion into something you can act on.
        </p>
        <div className="flex flex-col gap-2 text-sm text-muted">
          {[
            ["🎯", "Screening", "fast triage — the reason you'd get a no, and the questions to answer"],
            ["⚖️", "Investment Committee", "an adversarial invest / pass verdict"],
            ["🛠️", "Board", "a post-investment priority list across the ways startups fail"],
            ["🍵", "Founder Tea", "open, divergent discussion — angles you hadn't considered"],
          ].map(([e, t, d]) => (
            <div key={t} className="flex gap-2">
              <span>{e}</span>
              <span><span className="text-white">{t}</span> — {d}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Replies follow your BP's language; the interface is in English.</p>
      </div>

      {/* auth form */}
      <div className="flex flex-col gap-4 md:mt-10">
      <h1 className="text-xl font-semibold text-white">{mode === "login" ? "Sign in" : "Create account"}</h1>

      {mode === "register" && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)"
          className="rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
      )}
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email"
        className="rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Password (min 6)"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />

      {error && <p className="text-sm text-brass">{error}</p>}
      <button onClick={submit} disabled={busy} className="btn-primary">
        {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
      <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }} className="text-xs text-muted underline hover:text-white">
        {mode === "login" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
      </div>
    </div>
  );
}
