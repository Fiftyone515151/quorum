# Quorum

A multi-persona roundtable deliberation engine. Assemble up to 5 personas (historical
figures, functional archetypes, or your own), pick one of four goals, and watch them
deliberate — the result is a decision, a scorecard, an improvement list, or a synthesis.

## Architecture

```
apps/web           Next.js (App Router) — UI, CRUD API, SSE stream endpoint
apps/orchestrator  Node worker — the deterministic deliberation loop
packages/engine    Framework-agnostic core — personas, goals, discussion, synthesizer, providers
packages/db        Prisma schema + client (Postgres)
```

- **Deterministic orchestration** (rounds, turn order via bid+arbiter, vote tally, score
  averaging, termination, interjection routing, cross-session memory) lives in code — not
  in an LLM. The only LLM role beyond the personas is the **Synthesizer** (DeepSeek), which
  runs once at the end to write the natural-language output.
- **Providers**: Qwen + DeepSeek via their OpenAI-compatible endpoints. Personas are routed
  across both providers to avoid homogeneity; the Synthesizer is always DeepSeek.
- **Streaming**: the worker publishes turn events to Redis; the web forwards them to the
  browser over SSE.

## The four goals

| Goal | Strategy | Result | Interjection |
|------|----------|--------|--------------|
| Decision | structured, forced final vote (3 or 5 personas) | verdict + split tally + kill criteria | no |
| Screen & Score | structured, converge to average | scorecard 0–100 | no |
| Improve | freeform critique | prioritized improvement list | yes |
| Open Discussion | freeform A2A | synthesis (preserves dissent) | yes |

## Setup

Prereqs: Node ≥ 20, pnpm, Docker (for Postgres + Redis).

```bash
# 1. install
pnpm install

# 2. env — copy and fill in your keys
cp .env.example .env
#   set QWEN_API_KEY and DEEPSEEK_API_KEY

# 3. infra (Postgres + Redis)
pnpm infra:up

# 4. database
pnpm db:generate
pnpm db:push
pnpm db:seed        # loads the 27 preset personas (20 historical + 7 archetypes)

# 5. run (two processes — use two terminals, or `pnpm dev` for both)
pnpm dev:orchestrator
pnpm dev:web
```

Open http://localhost:3000 → **New session**.

## Notes

- Auth (email + Google via Auth.js) is scoped for M4; the demo runs anonymously.
- PDF export = browser print for now; QR / share links are on the roadmap.
- Cross-session iteration (`parentRunId`) loads the previous transcript + result + materials
  into the personas' context so they comment on what changed.
