"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HERO, MODES, LAYERS, PRINCIPLE, HOW_IT_WORKS, TESTIMONIALS } from "./data";

interface Persona { name: string; avatar?: string }

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel text-brand leading-[1.7] ${className}`}>{children}</span>;
}

const NAV_LINKS = [
  { href: "#hero", label: "About" },
  { href: "#features", label: "Features" },
  { href: "#multiagent", label: "Multi-agent" },
  { href: "#feedback", label: "Feedback" },
];

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
      <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl items-center px-6 py-3">
          <img src="/brand/lockup.png" alt="Quorum" className="h-9 w-auto sm:h-12" />
          <div className="absolute left-1/2 hidden -translate-x-1/2 gap-8 text-sm font-medium text-navy/70 md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="transition hover:text-brand">{l.label}</a>
            ))}
          </div>
          <Link href="/login" className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
            Sign in
          </Link>
        </div>
      </nav>

      {/* First screen: hero + mode boxes + CTA, vertically centered */}
      <section id="hero" className="flex min-h-[calc(100dvh-4rem)] scroll-mt-16 flex-col justify-center gap-8 py-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <h1 className="text-balance"><Pixel className="text-2xl sm:text-4xl">{HERO.question}</Pixel></h1>
          <p className="text-balance"><Pixel className="text-2xl sm:text-4xl">{HERO.tagline}</Pixel></p>
          <p className="mt-2 max-w-2xl text-lg leading-relaxed text-navy/80">{HERO.intro}</p>
          <p className="max-w-2xl text-lg leading-relaxed text-navy/80">{HERO.secondPerson}</p>
        </div>

        {/* Four mode boxes, with side whitespace */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <div key={m.id} className="flex flex-col gap-2 rounded-xl bg-brand px-5 py-6 text-white">
              <div className="flex items-center gap-2">
                <span className="text-lg">{m.emoji}</span>
                <Pixel className="text-xs text-white sm:text-sm">{m.name}</Pixel>
              </div>
              <p className="text-[15px] font-medium leading-relaxed text-white">{m.blurb}</p>
            </div>
          ))}
        </div>

        {/* CTA under the boxes */}
        <div className="flex flex-col items-center gap-3">
          <Link href="/login" className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark">
            Sign in to get started
          </Link>
          <a href="#features" className="group inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-dark">
            See the full features
            <span className="transition group-hover:translate-x-0.5 group-hover:translate-y-0.5">↘</span>
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto flex min-h-screen max-w-6xl scroll-mt-16 flex-col justify-center gap-8 px-6 py-16">
        <h2 className="text-center"><Pixel className="text-xs sm:text-sm">{HERO.secondPerson}</Pixel></h2>
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {MODES.map((m) => (
            <div key={m.id} className="flex flex-col gap-4 rounded-xl border border-navy/15 bg-white p-6">
              <div className="text-center">
                <span className="mr-2">{m.emoji}</span>
                <Pixel className="text-sm sm:text-base">{m.name}</Pixel>
              </div>
              <div>
                <Pixel className="text-[10px]">How it works</Pixel>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-navy/80 marker:text-brand">
                  {m.happens.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
              <div>
                <Pixel className="text-[10px]">What you get</Pixel>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-navy/80 marker:text-brand">
                  {m.get.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Multi-agent */}
      <section id="multiagent" className="min-h-screen scroll-mt-16 bg-brand-tint">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-6 px-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <Pixel className="text-base sm:text-xl">SIMULATING THE VC ROOM</Pixel>
            <p className="max-w-2xl text-sm leading-relaxed text-navy/70">
              Our multi-agent harness gives each investor a functional seat and a distinct character, so the panel
              argues like a real firm — not one averaged voice.
            </p>
          </div>

          {/* Function × Character = a persona */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            <div className="flex-1 rounded-xl border border-navy/10 bg-white p-4 sm:max-w-xs">
              <Pixel className="text-[10px]">{LAYERS[0].title}</Pixel>
              <p className="mt-2 text-sm leading-relaxed text-navy/75">{LAYERS[0].body}</p>
            </div>
            <span className="self-center font-pixel text-lg text-brand">×</span>
            <div className="flex-1 rounded-xl border border-navy/10 bg-white p-4 sm:max-w-xs">
              <Pixel className="text-[10px]">{LAYERS[1].title}</Pixel>
              <p className="mt-2 text-sm leading-relaxed text-navy/75">{LAYERS[1].body}</p>
            </div>
            <span className="self-center font-pixel text-lg text-brand">=</span>
            <div className="flex items-center justify-center rounded-xl bg-navy px-5 py-4 text-center text-sm font-semibold text-white sm:max-w-[140px]">
              a distinct investor
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Pixel className="text-[11px]">PERSONA LIBRARY</Pixel>
            <div className="flex gap-5 overflow-x-auto pb-2">
              {(personas.length ? personas : Array.from({ length: 8 }).map(() => ({ name: "…", avatar: "🧠" }))).map((p, i) => (
                <div key={i} className="flex w-20 shrink-0 flex-col items-center gap-2">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-brand/30 bg-white text-2xl shadow-sm">
                    {p.avatar ?? "🧠"}
                  </div>
                  <span className="text-center text-xs leading-tight text-navy/80">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-brand px-6 py-6 text-center text-white">
            <p className="font-pixel text-base leading-[1.7] sm:text-2xl">{PRINCIPLE.head}</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white">{PRINCIPLE.body}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="rounded-xl border border-navy/10 bg-white p-4">
                <Pixel className="text-base">{s.step}</Pixel>
                <p className="mt-1 font-semibold text-navy">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/70">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback" className="mx-auto flex min-h-screen max-w-4xl scroll-mt-16 flex-col justify-center gap-8 px-6 py-16">
        <h2 className="text-center"><Pixel className="text-base sm:text-xl">REAL FEEDBACK FROM USERS</Pixel></h2>
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

      {/* Footer */}
      <footer className="border-t border-navy/10 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-xs text-navy/40">© {new Date().getFullYear()} Quorum</div>
      </footer>
    </div>
  );
}
