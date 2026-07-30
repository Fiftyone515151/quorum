# Build context = repo root (monorepo). Build with:
#   docker build -f apps/orchestrator/Dockerfile -t quorum-worker .
FROM node:20-bookworm

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @quorum/db generate

CMD ["pnpm", "--filter", "@quorum/orchestrator", "start"]
