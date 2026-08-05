"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HERO } from "@/components/landing/data";
import { validatePassword, PASSWORD_RULE } from "@/lib/password";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const input =
    "rounded-lg border border-navy/15 bg-white p-3 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-brand";

  async function submit() {
    setError(null);
    if (mode === "register") {
      const v = validatePassword(password);
      if (!v.ok) return setError(v.error);
      if (password !== confirm) return setError("Passwords do not match.");
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { email, password, name } : { email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-navy">
      <div className="px-6 py-4">
        <Link href="/">
          <img src="/brand/lockup.png" alt="Quorum" className="h-8 w-auto" />
        </Link>
      </div>

      <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 pb-16 pt-6">
        <p className="text-center">
          <span className="font-pixel text-[11px] leading-[1.7] text-brand sm:text-xs">{HERO.secondPerson}</span>
        </p>

        <div className="flex w-full flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-navy">
            {mode === "login" ? "Sign in" : "Create account"}
          </h1>

          {mode === "register" && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={input} />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className={input} />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            onKeyDown={(e) => e.key === "Enter" && mode === "login" && submit()}
            className={input}
          />
          {mode === "register" && (
            <>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                placeholder="Confirm password"
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className={input}
              />
              <p className="text-xs leading-relaxed text-navy/50">{PASSWORD_RULE}</p>
            </>
          )}

          {error && <p className="text-sm text-brand-dark">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="text-xs text-navy/60 underline hover:text-brand"
          >
            {mode === "login" ? "No account? Register" : "Have an account? Sign in"}
          </button>
        </div>

        <p className="text-center text-xs text-navy/40">The interface is in English; replies follow your startup's language.</p>
      </div>
    </div>
  );
}
