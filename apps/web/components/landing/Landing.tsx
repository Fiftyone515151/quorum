"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HERO, MODES, HOW_IT_WORKS, TESTIMONIALS } from "./data";

interface Persona { name: string; avatar?: string }

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel text-brand leading-[1.7] ${className}`}>{children}</span>;
}

export default function Landing() {
  const [personas, setPersonas] = useState<Persona[]>([]);

  useEffect(() => {
    fetch("/api/personas")
      .then((r) => r.json())
      .then((d) => setPersonas([...(d.defaults ?? []), ...(d.stars ?? [])]))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-navy">
      {/* Nav */}
      <nav className="sticky top-0 z-20 border-b border-navy/10 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <img src="/brand/lockup.png" alt="Quorum" className="h-7 w-auto sm:h-8" />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-navy/60 sm:inline">Sign in to unlock the full experience.</span>
            <Link href="/login" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
              Sign in
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 pb-12 pt-16 text-center">
        <h1 className="max-w-3xl text-balance">
          <Pixel className="text-2xl sm:text-4xl">{HERO.question}</Pixel>
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-navy/80">{HERO.intro}</p>
        <p className="max-w-3xl text-sm leading-relaxed text-navy/55">{HERO.secondPerson}</p>
      </header>

      {/* Four mode boxes, edge to edge */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 bg-brand px-6 py-7 text-white ring-1 ring-white/15">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <span>{m.emoji}</span>
              <span>{m.name}</span>
            </div>
            <p className="text-[15px] font-medium leading-relaxed text-white">{m.blurb}</p>
          </div>
        ))}
      </section>
      <div className="flex justify-center py-6">
        <a href="#features" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark">
          See the full features
          <span className="transition group-hover:translate-x-0.5 group-hover:translate-y-0.5">↘</span>
        </a>
      </div>

      {/* Features */}
      <section id="features" className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-16 scroll-mt-16">
        <h2 className="text-center">
          <Pixel className="text-xs sm:text-sm">{HERO.secondPerson}</Pixel>
        </h2>
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {MODES.map((m) => (
            <div key={m.id} className="flex flex-col gap-4 rounded-xl border border-navy/15 bg-white p-6">
              <div className="text-center text-lg font-semibold text-navy">
                <span className="mr-2">{m.emoji}</span>{m.name}
              </div>
              <div>
                <p className="font-pixel text-[10px] text-brand">Summary</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/80">{m.summary}</p>
              </div>
              <div>
                <p className="font-pixel text-[10px] text-brand">Output</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/80">{m.output}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Multiagent */}
      <section id="multiagent" className="bg-brand-tint scroll-mt-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-16">
          <div className="flex flex-col items-center gap-3 text-center">
            <Pixel className="text-base sm:text-xl">SIMULATING THE VC ROOM</Pixel>
            <p className="max-w-2xl text-sm leading-relaxed text-navy/70">
              Our multi-agent harness gives each investor a functional seat and a distinct character, so the panel
              argues like a real firm — not one averaged voice.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Pixel className="text-[11px]">PERSONA LIBRARY</Pixel>
            <div className="flex gap-5 overflow-x-auto pb-3">
              {(personas.length ? personas : Array.from({ length: 8 }).map(() => ({ name: "…", avatar: "🧠" }))).map((p, i) => (
                <div key={i} className="flex w-20 shrink-0 flex-col items-center gap-2">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-brand/30 bg-white text-2xl shadow-sm">
                    {p.avatar ?? "🧠"}
                  </div>
                  <span className="text-center text-xs leading-tight text-navy/80">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="rounded-xl border border-navy/10 bg-white p-5">
                <Pixel className="text-base">{s.step}</Pixel>
                <p className="mt-2 font-semibold text-navy">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/70">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback" className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-16 scroll-mt-16">
        <h2 className="text-center">
          <Pixel className="text-base sm:text-xl">REAL FEEDBACK FROM USERS</Pixel>
        </h2>
        <div className="flex flex-col gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.role} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">
                {t.initials}
              </div>
              <div className="flex flex-col gap-1">
                <blockquote className="text-sm leading-relaxed text-navy/85">“{t.quote}”</blockquote>
                <span className="text-xs font-medium text-brand">{t.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <footer className="border-t border-navy/10 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-12 text-center">
          <Pixel className="text-sm sm:text-base">{HERO.question}</Pixel>
          <Link href="/login" className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
            Sign in to get started
          </Link>
          <span className="text-xs text-navy/40">© {new Date().getFullYear()} Quorum</span>
        </div>
      </footer>
    </div>
  );
}
