"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startDemoTour } from "@/components/tour/GuidedTour";

// Simulated sign-in: a pre-filled login card plays a short "signing you in"
// beat while the backend mints a throwaway demo account with Relay pre-loaded.
export default function DemoLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false); // guard the dev double-mount from minting two accounts

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const theater = new Promise((r) => setTimeout(r, 1600));
    (async () => {
      try {
        const res = await fetch("/api/demo/login", { method: "POST" });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Could not start the demo.");
        await theater;
        startDemoTour();
        router.push("/");
        router.refresh();
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [router]);

  const input = "w-full rounded-lg border border-navy/15 bg-navy/[0.03] p-3 text-sm text-navy/70";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 font-sans text-navy">
      <div className="w-full max-w-sm rounded-2xl border-2 border-brand bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <img src="/brand/lockup.png" alt="Quorum" className="h-12 w-auto" />
          <span className="font-pixel text-[10px] leading-[1.7] text-brand">LIVE DEMO</span>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-brand">Email</span>
            <input value="founder@relay.demo" disabled className={input} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-brand">Password</span>
            <input value="••••••••••" type="text" disabled className={input} />
          </label>
        </div>

        {error ? (
          <div className="mt-6 flex flex-col gap-3 text-center">
            <p className="text-sm leading-relaxed text-brand-dark">{error}</p>
            <Link href="/login" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
              Sign up free instead
            </Link>
            <Link href="/" className="text-xs text-navy/40 underline underline-offset-2 hover:text-navy/70">← Back to the landing page</Link>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Signing you in as Relay's founder…
          </div>
        )}

        <p className="mt-4 text-center text-xs leading-relaxed text-navy/40">
          A sandbox account with a sample startup, ready to pitch a real AI investor panel.
        </p>
      </div>
    </div>
  );
}
