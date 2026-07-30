# Deploy Quorum on your own Linux server

Everything (web + worker + Postgres + Redis) runs on one server. No paid cloud
database needed.

## 1. Prepare the server (once)

Install Docker + the Compose plugin + git:

```bash
# Debian/Ubuntu
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out and back in
git --version || sudo apt-get install -y git
```

## 2. Get the code onto the server

Either `git clone` your repo, or copy the `quorum/` folder up with `scp`/`rsync`:

```bash
rsync -av --exclude node_modules --exclude .next ./quorum/ user@YOUR_SERVER:/opt/quorum/
```

## 3. Set your API keys

On the server, in `/opt/quorum`:

```bash
cp .env.example .env
nano .env
# fill in:
#   QWEN_API_KEY=...
#   DEEPSEEK_API_KEY=...
# (leave DATABASE_URL / REDIS_URL as-is — the prod compose overrides them)
```

## 4. Launch the whole stack — one command

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This will:
1. start Postgres + Redis,
2. run the DB schema push + seed the 27 preset personas (one-shot `migrate` service),
3. start the web app and the worker.

The app is now at `http://YOUR_SERVER_IP:3000`.

## 5. Logs / status / update

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f web worker

# after pulling new code:
docker compose -f docker-compose.prod.yml up -d --build
```

## 6. Domain + HTTPS (optional but recommended)

Point a domain's A record at the server, then put Nginx in front to add TLS and
proxy to port 3000. Minimal Nginx site:

```nginx
server {
  server_name quorum.yourdomain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_buffering off;              # important: don't buffer the SSE stream
    proxy_read_timeout 3600s;        # allow long discussion streams
  }
}
```

Then run `certbot --nginx -d quorum.yourdomain.com` for a free Let's Encrypt cert.

`proxy_buffering off` + a long `proxy_read_timeout` matter because the live
discussion is delivered over a Server-Sent-Events stream.
