# Deployment

## Frontend containers

`infrastructure/docker/web.Dockerfile` builds one image per browser app. The build context is the repository root,
and `APP` selects `web`, `tv`, `shop` or `admin`.

- **Build stage** (`node:24-alpine`): `pnpm fetch` → `pnpm install --frozen-lockfile` for the app and its workspace
  dependencies → builds the shared packages (contracts, client-sdk, design-tokens, brand, ui-core) →
  `vite build` with `VITE_APP_ENV=production` (or `staging`). The stage then checks the result. It fails if the
  bundle references `VITE_DATA_SOURCE`, `createMock`, `betng-demo` or `demo@betng.test`, and it runs `scripts/check-public-env.mjs` against
  the app's `dist/`. Last, it hashes the inline code in `index.html` for the CSP.
- **Runtime stage** (`nginxinc/nginx-unprivileged:1.29-alpine`): runs as uid 101, listens only on 8080 and works with
  a read-only root filesystem. Its only writable path is `/tmp` (a tmpfs), which holds the rendered headers, the pid
  and the temp files. It has a `HEALTHCHECK` on `GET /healthz`.

```sh
docker build -f infrastructure/docker/web.Dockerfile \
  --build-arg APP=web \
  --build-arg VITE_API_URL=https://api.example.com \
  --build-arg VITE_WS_URL=wss://live.example.com/live \
  -t betng-frontend-web .

docker run --read-only --tmpfs /tmp:uid=101,gid=101,mode=0700 \
  --cap-drop ALL --security-opt no-new-privileges:true -p 8080:8080 \
  -e BETNG_API_ORIGIN=https://api.example.com \
  -e BETNG_WS_ORIGIN=wss://live.example.com \
  betng-frontend-web
```

Put TLS in front of port 8080 (load balancer or ingress). HSTS only takes effect over HTTPS.

### Build arguments (public, baked into the bundle)

`VITE_APP_ENV` (default `production`), `VITE_API_URL`, `VITE_WS_URL`, `VITE_REALTIME_TRANSPORT`,
`VITE_REALTIME_AUTH`, `VITE_AUTH_TRANSPORT`, `VITE_REQUEST_TIMEOUT_MS`, `VITE_FEATURE_FLAGS`, `VITE_LOG_LEVEL`,
`VITE_SITE_URL`, `VITE_UPLOAD_HOSTS`, `VITE_CHECKOUT_HOSTS`. Everything in a `VITE_` variable ships to every browser.
Never pass a secret as a build argument. `apps/<app>/.env.example` documents each variable.

### Runtime environment (CSP)

`BETNG_API_ORIGIN` and `BETNG_WS_ORIGIN` are required. `BETNG_UPLOAD_ORIGINS`, `BETNG_CHECKOUT_ORIGINS`,
`BETNG_IMG_ORIGINS` and `BETNG_ALLOW_INSECURE_ORIGINS` are optional. [security-headers.md](security-headers.md)
describes each one. The container refuses to start on an invalid value and prints nothing but the reason.

### Local compose

```sh
docker compose --env-file .env -f infrastructure/docker/docker-compose.yml --profile frontend up --build -d
```

| App   | URL                   |
| ----- | --------------------- |
| web   | http://127.0.0.1:8420 |
| tv    | http://127.0.0.1:8430 |
| shop  | http://127.0.0.1:8440 |
| admin | http://127.0.0.1:8450 |

Ports are bound to loopback and can be overridden with `WEB_PUBLISHED_PORT`, `TV_PUBLISHED_PORT`,
`SHOP_PUBLISHED_PORT` and `ADMIN_PUBLISHED_PORT`. Each service runs read-only with a `/tmp` tmpfs,
`cap_drop: ALL`, `no-new-privileges`, and limits of 0.5 CPU, 128 MB and 64 pids.

Defaults point at the local platform (`http://localhost:3000`, `ws://localhost:3008`) with
`BETNG_ALLOW_INSECURE_ORIGINS=true`. Override them with `FRONTEND_API_URL`, `FRONTEND_WS_URL`,
`FRONTEND_API_ORIGIN`, `FRONTEND_WS_ORIGIN` and the other `FRONTEND_*` variables. For the gateway to answer these
origins, add them to `CORS_ORIGINS` in `.env`.

## CI workflows (`.github/workflows`)

Every workflow uses least-privilege `permissions` (`contents: read` unless a job needs more), a concurrency group,
and actions pinned to full commit SHAs.

| Workflow         | Trigger                           | Jobs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`         | PR, push to main                  | `lint` (`pnpm lint:frontend`); `typecheck` (ui-web and the five clients); `unit` (`vitest --project unit packages`); `service-tests` (`vitest --project unit apps` against Postgres and Redis service containers); `dom` (`vitest --project dom`); `build` (production builds and the development-data grep, dist uploaded); `public-env` (after `build`: `scripts/check-public-env.mjs`); `e2e` (Playwright, which starts the Vite dev servers with `VITE_DATA_SOURCE=mock`, so no platform is needed); `python` (`python-install.sh` then `python-check.sh`) |
| `security.yml`   | PR, push to main, weekly          | `pnpm audit --prod` (reports only, never fails); CodeQL `javascript-typescript` (`security-extended`); gitleaks over full history (checksum-verified binary, reviewed false positives in `.gitleaksignore`); Trivy filesystem scan (HIGH and CRITICAL reported, fails on CRITICAL)                                                                                                                                                                                                                                                                    |
| `containers.yml` | PR (frontend paths), push to main | `build-scan`: builds the four images with no push, boots each read-only and checks the headers, then a Trivy image scan that fails on CRITICAL. `publish` (push to main only, `packages: write`): rebuilds with the production variables, scans again, and pushes `ghcr.io/<owner>/<repo>/frontend-<app>:sha-<commit>` with provenance and an SBOM                                                                                                                                                                                                    |
| `deploy.yml`     | `workflow_dispatch` only          | `verify`: the SHA must be on main and have successful `ci.yml` and `containers.yml` push runs. `deploy` (environment `production`): retags `sha-<commit>` as `production` for each app                                                                                                                                                                                                                                                                                                                                                                |

Repository **variables** (public values, not secrets) used by `publish`: `FRONTEND_API_URL` (https), `FRONTEND_WS_URL`
(wss), and optionally `FRONTEND_SITE_URL`, `FRONTEND_AUTH_TRANSPORT`, `FRONTEND_UPLOAD_HOSTS` and
`FRONTEND_CHECKOUT_HOSTS`. `publish` fails if the first two are missing or not TLS.

## Approval gate

Nothing deploys on push. A deploy is a manual `Deploy` run with a full commit SHA. It proceeds only if that commit is
on main and CI and Containers both passed for it. The `deploy` job uses the `production` environment. In
Settings → Environments → `production`, configure **required reviewers**, turn on **prevent self-review**, and limit
deployment branches to `main`. Once that is set, GitHub holds the job until a reviewer approves it. The hosting
platform pulls `frontend-<app>:production`. Roll back by running `Deploy` again with the previous SHA.
