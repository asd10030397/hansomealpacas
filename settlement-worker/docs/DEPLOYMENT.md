# Deployment instructions

Target hosts: **Railway**, **Render**, **Fly.io**, or any Docker/VPS.  
**Do not** deploy this worker to Vercel serverless.

## 1. Build locally

```bash
cd settlement-worker
npm install
npm test
npm run build
```

## 2. Railway (recommended)

Create **two** services from the same repo directory `settlement-worker/`:

### Service A — Testnet

1. New service → Docker (`Dockerfile`)  
2. Set env from `.env.testnet.example`  
3. Generate domain or private networking for health checks  
4. Health path: `/healthz`  
5. Deploy and confirm logs: `worker_boot`, `tick_ok`  

### Service B — Mainnet (dry-run first)

1. Separate service (do not clone Testnet env)  
2. Env from `.env.mainnet.example` with **`DRY_RUN=1`**  
3. Health port `8081` (or Railway `PORT` mapped to `HEALTH_PORT`)  
4. Do **not** set `MAINNET_LIVE_ACK` until GO  

`railway.toml` is a starting point; override env in the dashboard.

## 3. Render

- Type: **Background Worker** (or Web Service if you need HTTP health)  
- Docker deploy  
- Two services = two env groups  

If using Background Worker without HTTP, keep a side Web Service or switch to Web Service so `/healthz` is reachable.

## 4. Fly.io

```bash
# From settlement-worker/
fly apps create hansome-settle-testnet
fly apps create hansome-settle-mainnet
fly secrets set -a hansome-settle-testnet <KEY>=<VAL> ...
fly deploy -a hansome-settle-testnet
```

Use separate apps, volumes optional (prefer Redis REST for state).

## 5. VPS (systemd)

```bash
npm run build
# /etc/systemd/system/hansome-settle-testnet.service
```

```ini
[Unit]
Description=HANSOME settlement worker (testnet)
After=network.target

[Service]
WorkingDirectory=/opt/hansome/settlement-worker
EnvironmentFile=/opt/hansome/settlement-worker/.env.testnet
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now hansome-settle-testnet
curl -s localhost:8080/healthz
```

## 6. Health checks

```bash
curl -s http://HOST:PORT/healthz | jq .
curl -s http://HOST:PORT/readyz | jq .
```

Expect `ok: true` after the first successful tick.

## 7. Order of rollout

1. Unit tests green  
2. Testnet worker `DRY_RUN=1`  
3. Testnet worker `DRY_RUN=0` for ≥1 full day settle  
4. Mainnet worker `DRY_RUN=1` only  
5. Mainnet live only after explicit GO (see Mainnet runbook)  
