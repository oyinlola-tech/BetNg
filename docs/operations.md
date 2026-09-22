# Operations

How to run the BetNG platform in production mode on a single Docker host, and how to keep it healthy.
Everything here drives `infrastructure/docker/docker-compose.yml`. The frontend images are covered in
[deployment.md](deployment.md) and [security-headers.md](security-headers.md).

## 1. Layout

| Profile         | Services                                                                 | Published ports                  |
| --------------- | ------------------------------------------------------------------------ | -------------------------------- |
| _(none)_        | postgres, redis                                                          | `127.0.0.1:55432`, `127.0.0.1:56379` |
| `platform`      | migrate (one-shot), gateway, match, betting, wallet, settlement, event, identity, simulation, odds, risk, analytics, edge | edge `80`, `443` only |
| `frontend`      | web, tv, shop, admin                                                     | loopback `8420`-`8450`           |
| `observability` | prometheus, postgres-exporter, redis-exporter, loki, alloy, grafana     | grafana `127.0.0.1:3900`         |
| `backup`        | backup (one-shot `pg-backup.sh`)                                         | none                             |
| `acme`          | certbot (one-shot)                                                       | none                             |

Networks:

- `backend` is `internal: true`. It carries service-to-service traffic, PostgreSQL, Redis and the metric scrapes.
  Nothing on it can reach the internet.
- `edge` connects the edge proxy to the gateway, the event service and the frontends.
- `observability` connects Grafana, Loki, Alloy and Prometheus.

No application container publishes a port. The gateway and the event service are reachable only through the
edge (SEC-15).

Every platform container runs with a read-only root filesystem and a `noexec` tmpfs at `/tmp`. Each one drops all
capabilities, sets `no-new-privileges`, runs as a non-root user and has CPU, memory and pid limits. Each one has a
healthcheck (`/health`), rotated json-file logs (5 × 10 MB) and `restart: unless-stopped`. Services start only
after the dependencies they need report healthy. The migrate job has to finish successfully before any
TypeScript service starts. The stop grace period (30 s) is longer than `SHUTDOWN_TIMEOUT_MS` (15 s), so in-flight
requests drain before the container is killed.

## 2. Images

| Image                  | Dockerfile                               | Build args                                   |
| ---------------------- | ---------------------------------------- | -------------------------------------------- |
| `betng-<service>`      | `infrastructure/docker/node.Dockerfile`   | `SERVICE` (gateway, match, betting, wallet, settlement, event, identity), `PORT` |
| `betng-migrate`        | `node.Dockerfile`, `--target migrate`     | none                                         |
| `betng-<service>`      | `infrastructure/docker/python.Dockerfile` | `SERVICE` (simulation, odds, risk, analytics), `PORT` |

- **TypeScript.** `pnpm fetch` fills the store from the lockfile. A filtered `--frozen-lockfile` install then
  builds only the service and its workspace dependencies, and generates the Prisma client. The runtime stage gets
  a clean `--prod` install and the compiled `dist/`. It has no source, no source maps, no `.d.ts` files and no npm,
  npx, corepack or yarn. It runs `node dist/server.js` as uid 1000 with `NODE_ENV=production`.
- **Migrate.** This image has the Prisma CLI and the migrations. Its only job is `prisma migrate deploy` for the
  five Prisma services, run as uid 1000.
- **Python.** Dependencies are pinned by `infrastructure/docker/python-constraints.txt` and installed into
  `/opt/venv`. pip is removed and bytecode is precompiled. It runs as uid 10001.

Base images are pinned by version and digest. To update one, change the tag and the digest together.

## 3. Production run

### 3.1 Secrets and configuration

Keep configuration outside the repository, owned by root, mode `0600`:

```
/etc/betng/platform.env      compose interpolation: tokens, database passwords, domain, ports
/etc/betng/env/common.env    settings every service reads (optional)
/etc/betng/env/<service>.env provider keys and service settings, e.g. wallet.env (optional)
/etc/betng/tls/              fullchain.pem, privkey.pem, chain.pem
/etc/betng/secrets/internal_service_token   INTERNAL_SERVICE_TOKEN again, for Prometheus
```

Prometheus runs with a read-only root filesystem, so compose mounts the token from a file (`INTERNAL_SERVICE_TOKEN_FILE`)
rather than from the environment. Write it without a trailing newline, readable by uid 65534 only:

```sh
install -d -m 0750 -o root -g 65534 /etc/betng/secrets
printf '%s' "$INTERNAL_SERVICE_TOKEN" > /etc/betng/secrets/internal_service_token
chown root:65534 /etc/betng/secrets/internal_service_token && chmod 0440 /etc/betng/secrets/internal_service_token
```

`platform.env` must set at least the following. Generate each secret with `openssl rand -hex 32`:

```sh
NODE_ENV=production
INTERNAL_SERVICE_TOKEN=<random>
SIMULATION_SEED_SECRET=<random>
POSTGRES_PASSWORD=<random>
REDIS_PASSWORD=<random hex>        # the services' REDIS_URL is built from it; PLATFORM_REDIS_URL overrides
MATCH_DB_PASSWORD=<random>          # and BETTING_, WALLET_, SETTLEMENT_, IDENTITY_,
                                    # SIMULATION_, ODDS_, RISK_, ANALYTICS_DB_PASSWORD
BACKUP_PGPASSWORD=<random>
MONITOR_PGPASSWORD=<random>
GRAFANA_ADMIN_PASSWORD=<random>
EDGE_DOMAIN=example.com
CORS_ORIGINS=https://example.com,https://www.example.com,https://admin.example.com,https://shop.example.com,https://tv.example.com
FRONTEND_API_URL=https://api.example.com
FRONTEND_WS_URL=wss://live.example.com/live
FRONTEND_API_ORIGIN=https://api.example.com
FRONTEND_WS_ORIGIN=wss://live.example.com
FRONTEND_ALLOW_INSECURE_ORIGINS=false
```

Unset database passwords fall back to the local development defaults from `bootstrap.sql`. A production
`platform.env` has to set every one of them. The bootstrap creates roles with those local passwords, so after the
first start rotate each role to the value in `platform.env`:

```sh
docker exec -it betng-postgres psql -U betng -d postgres \
  -c "ALTER ROLE betng_match PASSWORD '<MATCH_DB_PASSWORD>'"   # repeat per role, betng_backup and betng_monitor
```

Each service container receives only its own database URL. Only simulation receives `SIMULATION_SEED_SECRET`.
Values set in `docker-compose.yml` take precedence over the env files. Never pass secrets as build arguments.

**Docker secrets.** Prometheus reads the internal token from the compose secret above
(`/run/secrets/internal_service_token`), not from its environment. Grafana (`GF_*__FILE`) and PostgreSQL
(`POSTGRES_PASSWORD_FILE`) accept `_FILE` variants the same way. The application services read their settings from
environment variables. For them, keep secrets in the `0600` env files above. `docker inspect` shows a container's
environment, so access to the Docker socket is equivalent to root and has to be restricted the same way.

### 3.2 Start, update, stop

```sh
C="docker compose --env-file /etc/betng/platform.env -f infrastructure/docker/docker-compose.yml"
$C --profile platform --profile frontend build
$C --profile platform --profile frontend up -d            # migrate runs first, then the services, then the edge
$C --profile platform ps                                  # every service "healthy"
$C --profile platform logs -f gateway
$C --profile platform --profile frontend up -d --build    # rolling update per changed image
$C --profile platform --profile frontend down             # keeps volumes
```

Set `SEED_DEMO_DATA=false` and `LOG_VERIFICATION_CODES=false` in `common.env` for anything reachable from the internet.

### 3.3 Database logins and pools

| Login                                    | Use                                        | Limits (set once by `bootstrap.sql`)                       |
| ---------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `betng_<service>`                        | the service, writes its own schema         | `statement_timeout` 60 s (analytics 300 s), `idle_in_transaction_session_timeout` 60 s |
| `betng_backup`                           | `pg_dump`, member of `pg_read_all_data`    | none                                                       |
| `betng_monitor`                          | postgres-exporter, member of `pg_monitor`  | 5 connections                                              |
| `POSTGRES_USER` (superuser)              | bootstrap, restores, emergencies only      | none                                                       |

The bootstrap sets the timeouts only when a login has no value for them yet. To tune a timeout, run
`ALTER ROLE betng_x IN DATABASE betng SET statement_timeout = '…'` and later bootstrap runs keep that value. A
migration that needs longer than 60 s must raise the timeout for that one run and then restore it.

Each instance of a TypeScript service opens a node-postgres pool of up to 10 connections. Each Python service
opens a psycopg pool of up to 10. With one instance of each, the nine database services can use 90 connections.
The compose file raises `max_connections` to 200. The formula to keep within that is:

```
Σ (instances × pool size) + 10 (backup, exporter, migrate, operators) ≤ max_connections − 10 (superuser reserve)
```

Before scaling a service beyond two instances, add PgBouncer in transaction mode or reduce the pool size. The
Grafana panel "PostgreSQL connections by login" and the `PostgresConnectionsHigh` and `PostgresIdleInTransaction`
rules show pool exhaustion and leaks.

## 4. TLS edge

`infrastructure/edge/` holds the configuration for `nginxinc/nginx-unprivileged`. It runs as uid 101 with a
read-only root filesystem and listens on 8080/8443, which are published as 80/443. The server names are built from
`EDGE_DOMAIN`:

| Host                             | Upstream                   | Notes                                                                                                                                               |
| -------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.<domain>`                   | `gateway:3000`             | 256 KB body limit. 30 r/s per IP (burst 60) and 10 r/min on `*/auth/*`. `/metrics`, `/ready`, `/rpc` and `/internal` return 404. Sends HSTS, `nosniff`, `DENY` and `no-store`. |
| `live.<domain>`                  | `event:3008`, `/live` only | WebSocket upgrade, 1 h read timeout, 16 connections per IP. Every other path returns 404.                                                           |
| `<domain>`, `www.<domain>`       | `web:8080`                 | The frontend container sets its own security headers.                                                                                               |
| `admin.`, `shop.`, `tv.<domain>` | `admin`, `shop`, `tv`      | The same.                                                                                                                                           |

- **TLS.** TLS 1.2 and 1.3 only, with ECDHE AEAD ciphers (the Mozilla intermediate profile without DHE). Session
  tickets are off, HTTP/2 is on and HSTS is set for two years. OCSP stapling is on and uses `chain.pem`. Let's
  Encrypt stopped publishing OCSP URLs in 2025, so with its certificates nginx logs `ssl_stapling ignored` and
  carries on. Stapling works with CAs that still run OCSP.
- **Unknown hosts.** The TLS handshake is refused (`ssl_reject_handshake`). On port 80 the connection is closed
  (444).
- **HTTP.** Port 80 answers `/.well-known/acme-challenge/` from the `edge-acme` volume and redirects everything
  else to HTTPS.
- **Client address.** The edge overwrites `X-Forwarded-For` and `X-Real-IP` with the client address, so the gateway
  (`GATEWAY_TRUST_PROXY=1`) and the event service (`EVENT_TRUSTED_PROXY_HOPS=1`) trust exactly one hop. A client
  cannot forge either header. If a load balancer sits in front of the edge, list its addresses in
  `infrastructure/edge/real-ip.conf` (`set_real_ip_from`). The edge then takes the client address from the load
  balancer's header, and the hop count stays 1. Traffic that reaches a loopback-published port through Docker's
  userland proxy arrives from the bridge gateway address. Public traffic on the host interface keeps its source
  address (iptables DNAT). To keep it on every path, set `"userland-proxy": false` in `/etc/docker/daemon.json`.
- **Timeouts.** Connect 5 s, read and send 30 s, client header and body 10 s. `proxy_next_upstream off`, so a
  non-idempotent request is never retried.
- **Logs.** One JSON line per request with the path but no query string (tokens travel in queries), the request
  id, the upstream and its timing.

### 4.1 Certificates (Let's Encrypt)

One certificate covers all seven names. `EDGE_CERTS_DIR` (default `/etc/betng/tls`) must contain
`fullchain.pem`, `privkey.pem` and `chain.pem`, and uid 101 must be able to read them:

```sh
install -d -m 0750 -o root -g 101 /etc/betng/tls
$C --profile platform up -d edge                      # serves the HTTP-01 challenge on :80
$C --profile acme run --rm certbot certonly --webroot -w /var/www/acme \
  -d example.com -d www.example.com -d api.example.com -d live.example.com \
  -d admin.example.com -d shop.example.com -d tv.example.com \
  --email ops@example.com --agree-tos --no-eff-email \
  --deploy-hook 'for f in fullchain chain privkey; do install -m 0640 -g 101 "$RENEWED_LINEAGE/$f.pem" /etc/betng/tls/; done'
$C --profile platform exec edge nginx -s reload
```

The first start needs a certificate before nginx will start. Put a temporary self-signed one in place (below),
issue the real one, then reload. Renew twice a day from the host's cron:

```cron
17 3,15 * * * cd /opt/betng && docker compose --env-file /etc/betng/platform.env -f infrastructure/docker/docker-compose.yml --profile acme run --rm certbot renew --quiet && docker compose --env-file /etc/betng/platform.env -f infrastructure/docker/docker-compose.yml --profile platform exec -T edge nginx -s reload
```

### 4.2 Local check with a self-signed certificate

Never commit a key. Generate the certificate into a temporary directory:

```sh
T="$(mktemp -d)"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 7 \
  -subj "/CN=betng.localhost" -addext "subjectAltName=DNS:betng.localhost,DNS:*.betng.localhost" \
  -keyout "$T/privkey.pem" -out "$T/fullchain.pem"
cp "$T/fullchain.pem" "$T/chain.pem"; chmod 0644 "$T"/*.pem
EDGE_CERTS_DIR="$T" EDGE_BIND_ADDRESS=127.0.0.1 EDGE_HTTP_PORT=18080 EDGE_HTTPS_PORT=18443 \
  docker compose --env-file .env -f infrastructure/docker/docker-compose.yml --profile platform up -d
curl --cacert "$T/fullchain.pem" --resolve api.betng.localhost:18443:127.0.0.1 https://api.betng.localhost:18443/health
```

## 5. Backups and restore

`scripts/backup/pg-backup.sh` writes one directory per run, `<BACKUP_DIR>/betng-<UTC stamp>/`:

| File             | Content                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `betng.dump`     | `pg_dump --format=custom --compress=gzip:6` of the whole database, or of `BACKUP_SCHEMAS` |
| `rowcounts.txt`  | the row count of every table, taken in the same snapshot as the dump                     |
| `globals.sql.gz` | roles and tablespaces, without passwords                                                 |
| `MANIFEST`       | database, time, server and pg_dump versions                                              |
| `SHA256SUMS`     | checksums of all of the above                                                            |

The script exports a `REPEATABLE READ` snapshot and gives it to `pg_dump`, then counts rows in that same snapshot.
The dump is transactionally consistent and the counts match it exactly. Files are created with mode `0600`. A run
builds in `*.partial` and renames it only on success. Completed backups older than `BACKUP_RETENTION_DAYS` (14) are
removed, but the newest is always kept. `BACKUP_UPLOAD_HOOK` names an executable that is called with the backup
directory, for example one that runs `rclone copy` or `aws s3 cp --sse`. The dump contains personal data, so store
it on encrypted storage with restricted access.

Daily run from the host's cron (the backup container runs as uid 70):

```sh
install -d -m 0700 -o 70 -g 70 /var/backups/betng
```
```cron
30 2 * * * cd /opt/betng && docker compose --env-file /etc/betng/platform.env -f infrastructure/docker/docker-compose.yml --profile backup run --rm backup >> /var/log/betng-backup.log 2>&1
```

### 5.1 Restore drill (monthly, and after any change to the schema or the scripts)

`scripts/backup/pg-restore.sh` checks the checksums and restores into a **new** database (default
`betng_restore_check`). With `--verify` it compares every table's row count with `rowcounts.txt` and, on success,
drops `betng_restore_check`. It refuses a database that already exists, and `postgres` and the templates.

```sh
docker run --rm --network betng_backend -e PGHOST=postgres -e PGUSER=betng -e PGPASSWORD \
  -v "$PWD/scripts/backup:/opt/betng/backup:ro" -v /var/backups/betng:/backups:ro \
  --entrypoint bash postgres:17.11-alpine /opt/betng/backup/pg-restore.sh --verify /backups/betng-<stamp>
```

The run ends with `verified <n> tables, <m> rows match the backup`.

### 5.2 Disaster recovery

On a new server:

1. Start postgres. The bootstrap creates the roles and an empty `betng`, so drop `betng` or restore beside it.
2. Run `pg-restore.sh --target betng /backups/betng-<stamp>`.
3. Run `pnpm db:bootstrap` (idempotent) to restore the role settings and grants.
4. Rotate the role passwords.
5. Start the platform. The migrate job reports "No pending migrations".

To switch an existing server, restore beside the live database as `betng_new`, verify, stop the platform, rename
the two databases with `ALTER DATABASE … RENAME`, and start the platform again.

### 5.3 Point-in-time recovery

Daily dumps bound data loss to 24 hours. To shorten that, add continuous WAL archiving with
[pgBackRest](https://pgbackrest.org) or WAL-G, writing to object storage:

```
wal_level = replica
archive_mode = on
archive_command = 'pgbackrest --stanza=betng archive-push %p'
archive_timeout = 60
```

Take a weekly full backup and daily incrementals. To recover, restore the base backup and set
`recovery_target_time` in the restore command. Recovery is then to any second inside the retention window, with at
most `archive_timeout` of loss. Drill it the same way: restore to a scratch instance and compare row counts.
Logical dumps (above) stay the portable, version-independent copy.

## 6. Monitoring

```sh
GRAFANA_ADMIN_PASSWORD=… $C --profile platform --profile observability up -d
ssh -L 3900:127.0.0.1:3900 host     # Grafana listens on loopback only
```

- **Prometheus** (`prom/prometheus:v3.14.0`, retention `PROMETHEUS_RETENTION` = 15d, no published port) scrapes
  `/metrics` on the seven TypeScript services by DNS name and port. It sends `x-betng-internal-token` from the
  mounted secret, and a service answers 404 without it. It also scrapes postgres-exporter (`betng_monitor`),
  redis-exporter, Loki and Alloy. Alert rules are in `infrastructure/observability/prometheus/rules.yml`:
  `TargetDown`, `HighErrorRate` (> 5 % 5xx), `HighLatencyP95` (> 1 s), `PostgresConnectionsHigh` (> 80 %) and
  `PostgresIdleInTransaction`.
- **Grafana** (`grafana/grafana:13.2.2`). The datasources and the "BetNG services" dashboard are provisioned
  read-only. The dashboard shows request rate, 5xx share and p95 latency by service, target health, database
  connections by login, and error logs. Sign-up, anonymous access, telemetry and update checks are off. The
  container refuses to start without `GRAFANA_ADMIN_PASSWORD`. Set `GRAFANA_COOKIE_SECURE=true` and
  `GRAFANA_ROOT_URL` when Grafana is served over TLS.
- **Loki** (`grafana/loki:3.7.8`) keeps logs for 30 days on the filesystem. **Alloy** (`grafana/alloy:v1.19.2`)
  tails Docker's json-file logs from `/var/lib/docker/containers` through a read-only mount, with no Docker socket.
  It labels each line with `service` and `level` from the services' JSON logs and with `container`. It runs as root
  with no capabilities, because those files belong to root. With rootless Docker or a different data root, set
  `DOCKER_CONTAINERS_DIR`.

Useful queries: `{service="wallet", level="error"}` in Loki, and
`sum by (service, route) (rate(http_requests_total{status=~"5.."}[5m]))` in Prometheus. An external uptime check
should poll `https://api.<domain>/health`.

## 7. Incidents

1. **Establish scope.** Check `$C --profile platform ps` for unhealthy services, the Grafana dashboard for the
   error rate and latency by service, and Loki for `{level="error"}` filtered by the `requestId` from a failing
   response. The request id appears in the edge log, the gateway log and the error envelope.
2. **Contain.** To stop taking bets, stop the betting service (`$C stop betting`). The gateway then answers 503
   and money stays where it is. Settlement and wallet are idempotent, so stopping them delays work and loses
   none. Never edit ledger or result rows by hand: results are immutable and the remedy for a bad match is a
   voided match.
3. **Abuse.** Add addresses to `GATEWAY_IP_BLOCKLIST` (gateway env file) and recreate the gateway (`$C up -d gateway`; a plain restart keeps the old environment). Tighten the
   `GATEWAY_RATE_*` rules or the edge `limit_req` zones.
4. **Credential exposure.** Rotate `INTERNAL_SERVICE_TOKEN` in `platform.env` and recreate the whole platform (`up -d --force-recreate`).
   Services with different tokens reject each other, so restart all of them together. Rotate a database password
   with `ALTER ROLE` first, then update the env file and recreate that service. `SIMULATION_SEED_SECRET` changes
   future seeds only. Rotate it if it leaked, because a leaked seed secret lets anyone compute results before
   kick-off.
5. **Data loss or corruption.** Stop writers, take a fresh backup of the current state, and follow 5.2. Restore
   beside the live database, never over it.
6. **Afterwards.** Record a timeline, the root cause and the follow-up changes. Run a restore drill if the incident
   touched data.
