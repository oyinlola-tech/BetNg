#!/usr/bin/env bash
# Consistent logical backup of one database: custom-format dump (gzip level 6), per-table row counts taken
# from the same snapshot, roles without passwords, a manifest and SHA256SUMS. Connection comes from libpq
# variables (PGHOST, PGPORT, PGUSER, PGPASSWORD or PGPASSFILE).
#
#   BACKUP_DATABASE        database to dump (default betng)
#   BACKUP_DIR             destination directory (default /backups)
#   BACKUP_SCHEMAS         comma-separated schemas; empty dumps the whole database
#   BACKUP_RETENTION_DAYS  completed backups older than this are removed (default 14; the newest is always kept)
#   BACKUP_GLOBALS         true|false, dump roles and tablespaces without passwords (default true)
#   BACKUP_UPLOAD_HOOK     executable run as `hook <backup-dir>` after a backup completes

set -Eeuo pipefail
umask 077

database="${BACKUP_DATABASE:-betng}"
backup_root="${BACKUP_DIR:-/backups}"
schemas="${BACKUP_SCHEMAS:-}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"
globals="${BACKUP_GLOBALS:-true}"
upload_hook="${BACKUP_UPLOAD_HOOK:-}"

log() { printf '%s pg-backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
fail() { log "ERROR: $*"; exit 1; }

[[ "${database}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "BACKUP_DATABASE must be a plain identifier"
[[ -z "${schemas}" || "${schemas}" =~ ^[A-Za-z_][A-Za-z0-9_]*(,[A-Za-z_][A-Za-z0-9_]*)*$ ]] \
  || fail "BACKUP_SCHEMAS must be a comma-separated list of plain identifiers"
[[ "${retention_days}" =~ ^[0-9]+$ ]] || fail "BACKUP_RETENTION_DAYS must be a whole number"
[[ "${globals}" == true || "${globals}" == false ]] || fail "BACKUP_GLOBALS must be true or false"
[[ -z "${upload_hook}" || -x "${upload_hook}" ]] || fail "BACKUP_UPLOAD_HOOK is not an executable file"
for tool in pg_dump pg_dumpall psql sha256sum gzip; do
  command -v "${tool}" >/dev/null || fail "${tool} is not installed"
done

mkdir -p "${backup_root}"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="${backup_root}/${database}-${stamp}"
work="${final}.partial"
[[ ! -e "${final}" && ! -e "${work}" ]] || fail "${final} already exists"
mkdir "${work}"

psql_pid=""
cleanup() {
  local status=$?
  if [[ -n "${psql_pid}" ]] && kill -0 "${psql_pid}" 2>/dev/null; then
    kill "${psql_pid}" 2>/dev/null || true
  fi
  if (( status != 0 )); then
    rm -rf "${work}"
    log "backup failed; partial output removed"
  fi
}
trap cleanup EXIT

# One REPEATABLE READ transaction exports the snapshot pg_dump uses and counts rows in that same snapshot.
coproc PSQL { exec psql -X -q -A -t -v ON_ERROR_STOP=1 -d "${database}" 2>&1; }
# shellcheck disable=SC2153 # set by coproc
psql_pid="${PSQL_PID}"

sql() { printf '%s\n' "$1" >&"${PSQL[1]}"; }
read_until_marker() {
  local line
  while IFS= read -r -t 3600 line <&"${PSQL[0]}"; do
    [[ "${line}" == "__betng_done__" ]] && return 0
    printf '%s\n' "${line}"
  done
  fail "lost the snapshot session"
}

sql "SET statement_timeout = 0;"
sql "SET idle_in_transaction_session_timeout = 0;"
sql "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"
sql "SELECT pg_export_snapshot();"
sql '\echo __betng_done__'
snapshot="$(read_until_marker)"
[[ "${snapshot}" =~ ^[0-9A-F]+-[0-9A-F]+-[0-9]+$ ]] || fail "could not export a snapshot: ${snapshot}"

schema_args=()
schema_filter="n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_%'"
if [[ -n "${schemas}" ]]; then
  IFS=',' read -r -a schema_list <<<"${schemas}"
  for schema in "${schema_list[@]}"; do schema_args+=(--schema="${schema}"); done
  schema_filter="n.nspname = ANY (string_to_array('${schemas}', ','))"
fi

log "dumping ${database} (snapshot ${snapshot})"
pg_dump --dbname="${database}" --format=custom --compress=gzip:6 --snapshot="${snapshot}" \
  --no-sync "${schema_args[@]}" --file="${work}/${database}.dump"

sql "SELECT format('SELECT %L || ''|'' || count(*) FROM %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r', 'p') AND ${schema_filter}
      ORDER BY n.nspname, c.relname \\gexec"
sql '\echo __betng_done__'
read_until_marker >"${work}/rowcounts.txt"
grep -qvE '^[^|]+\|[0-9]+$' "${work}/rowcounts.txt" && fail "row count query failed"
sql "COMMIT;"
sql '\q'
wait "${psql_pid}" || true
psql_pid=""

if [[ "${globals}" == true ]]; then
  pg_dumpall --globals-only --no-role-passwords | gzip -6 >"${work}/globals.sql.gz"
fi

server_version="$(psql -X -A -t -d "${database}" -c 'SHOW server_version')"
{
  printf 'database=%s\n' "${database}"
  printf 'created_at=%s\n' "${stamp}"
  printf 'schemas=%s\n' "${schemas:-*}"
  printf 'server_version=%s\n' "${server_version}"
  printf 'pg_dump_version=%s\n' "$(pg_dump --version)"
  printf 'tables=%s\n' "$(wc -l <"${work}/rowcounts.txt" | tr -d ' ')"
} >"${work}/MANIFEST"

(cd "${work}" && sha256sum -- * >SHA256SUMS)
mv "${work}" "${final}"
log "completed ${final} ($(du -sh "${final}" | cut -f1))"

if [[ -n "${upload_hook}" ]]; then
  log "running upload hook"
  "${upload_hook}" "${final}"
fi

if (( retention_days > 0 )); then
  newest="$(find "${backup_root}" -mindepth 1 -maxdepth 1 -type d -name "${database}-*" ! -name '*.partial' | sort | tail -n 1)"
  find "${backup_root}" -mindepth 1 -maxdepth 1 -type d -name "${database}-*" ! -name '*.partial' \
    -mtime "+${retention_days}" ! -path "${newest}" -print0 |
    while IFS= read -r -d '' old; do
      [[ -f "${old}/SHA256SUMS" ]] || continue
      rm -rf -- "${old}"
      log "removed expired ${old}"
    done
  find "${backup_root}" -mindepth 1 -maxdepth 1 -type d -name "${database}-*.partial" -mmin +1440 -exec rm -rf -- {} +
fi
