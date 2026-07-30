# Deploy Quorum on Railway

Railway gives you a free `*.up.railway.app` URL with HTTPS — no domain of your own
needed — and runs the full architecture (web + worker + Postgres + Redis) unchanged.

You'll create **one project** with **four things**: a Postgres plugin, a Redis
plugin, a **web** service, and a **worker** service. The two app services build from
the Dockerfiles already in this repo.

---

## 0. Put the code on GitHub (once)

Railway deploys from a GitHub repo. From the `quorum/` folder:

```bash
git init
git add .
git commit -m "Quorum"
# create an empty repo on github.com, then:
git remote add origin https://github.com/YOU/quorum.git
git push -u origin main
```

## 1. Create the project + databases

1. Go to railway.app → **New Project** → **Deploy from GitHub repo** → pick your repo.
2. In the project, click **+ New** → **Database** → **Add PostgreSQL**.
3. Click **+ New** → **Database** → **Add Redis**.

Railway now exposes `${{Postgres.DATABASE_URL}}` and `${{Redis.REDIS_URL}}` for you to
reference.

## 2. Configure the **web** service

The first service Railway created from your repo will be the web app.

- **Settings → Build**
  - Builder: **Dockerfile**
  - Dockerfile Path: `apps/web/Dockerfile`
  - Root Directory: `/`
- **Settings → Deploy → Pre-Deploy Command** (runs migrations + seeds once per deploy):
  ```
  pnpm --filter @quorum/db exec prisma db push --skip-generate && pnpm --filter @quorum/db exec tsx prisma/seed.ts
  ```
- **Variables** (Settings → Variables):
  ```
  DATABASE_URL     = ${{Postgres.DATABASE_URL}}
  REDIS_URL        = ${{Redis.REDIS_URL}}
  QWEN_API_KEY     = <your key>
  DEEPSEEK_API_KEY = <your key>
  AUTH_SECRET      = <run: openssl rand -base64 32>
  ```
- **Settings → Networking → Generate Domain** → you get `something.up.railway.app`.

## 3. Add the **worker** service

- Project → **+ New** → **GitHub Repo** → same repo (this creates a second service).
- **Settings → Build**
  - Builder: **Dockerfile**
  - Dockerfile Path: `apps/orchestrator/Dockerfile`
  - Root Directory: `/`
- **Variables**:
  ```
  DATABASE_URL = ${{Postgres.DATABASE_URL}}
  REDIS_URL    = ${{Redis.REDIS_URL}}
  QWEN_API_KEY = <your key>
  DEEPSEEK_API_KEY = <your key>
  ```
- No domain needed (it's a background worker).

## 4. Deploy

Railway builds and deploys on every push to `main`. After the first deploy:

- Open the web service's generated URL → you're live.
- Check the worker's **Deploy Logs**; you should see
  `[orchestrator] listening on quorum:jobs`.

## Updating

```bash
git add . && git commit -m "update" && git push
```
Railway rebuilds and redeploys both services automatically.

## Notes

- The web app binds to Railway's `$PORT` automatically.
- Cost: Railway's free/trial credit covers a small deployment; Postgres + Redis +
  two services will use a modest amount. No paid database service required.
- The only per-use cost is your Qwen / DeepSeek API usage.
