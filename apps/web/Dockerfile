# Build context = repo root (monorepo). Build with:
#   docker build -f apps/web/Dockerfile -t quorum-web .
FROM node:20-bookworm

RUN corepack enable
WORKDIR /app

# install deps (whole workspace, so workspace packages resolve)
COPY . .
RUN pnpm install --no-frozen-lockfile

# prisma client + next build
RUN pnpm --filter @quorum/db generate
RUN pnpm --filter @quorum/web build

EXPOSE 3000
# On start: sync schema + seed presets (both idempotent), then serve.
CMD sh -c "pnpm --filter @quorum/db exec prisma db push --skip-generate && pnpm --filter @quorum/db exec tsx prisma/seed.ts && pnpm --filter @quorum/web start"
