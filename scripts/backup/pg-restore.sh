#!/usr/bin/env bash
# Restores a pg-backup.sh backup into a new database and, with --verify, compares every table's row count
# with the counts recorded in the backup's snapshot. Connection comes from libpq variables; the login needs
# CREATEDB (and superuser to restore ownership).
#
#   pg-restore.sh [--verify] [--keep] [--target NAME] [--no-owner] [--jobs N] BACKUP_DIR
#
#   --target    database to create (default betng_restore_check); it must not exist yet
#   --verify    compare row counts after the restore
#   --keep      keep the target after --verify (by default a verified betng_restore_check is dropped)
#   --no-owner  restore without ownership and grants (a server whose roles differ)
#
# Restoring over an existing database is deliberately unsupported: restore beside it, check, then switch.

set -Eeuo pipefail
umask 077

target="betng_restore_check"
verify=false
keep=false
owner_args=()
jobs=2

log() { printf '%s pg-restore: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
fail() { log "ERROR: $*"; exit 1; }
usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//' >&2; exit 2; }

while (( $# > 0 )); do
  case "$1" in
    --target) target="${2:-}"; shift 2 ;;
    --verify) verify=true; shift ;;
    --keep) keep=true; shift ;;
    --no-owner) owner_args=(--no-owner --no-privileges); shift ;;
    --jobs) jobs="${2:-}"; shift 2 ;;
    -h | --help) usage ;;
    --*) fail "unknown option $1" ;;
    *) break ;;
  esac
done
(( $# == 1 )) || usage
backup="${1%/}"

[[ "${target}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "--target must be a plain identifier"
[[ "${jobs}" =~ ^[1-9][0-9]?$ ]] || fail "--jobs must be 1-99"
case "${target}" in
  postgres | template0 | template1) fail "refusing to restore into ${target}" ;;
esac
[[ -f "${backup}/SHA256SUMS" && -f "${backup}/MANIFEST" ]] || fail "${backup} is not a pg-backup.sh backup"

source_db="$(sed -n 's/^database=//p' "${backup}/MANIFEST")"
[[ "${source_db}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || fail "MANIFEST has no valid database name"
dump="${backup}/${source_db}.dump"

log "checking checksums"
(cd "${backup}" && sha256sum -c SHA256SUMS >/dev/null) || fail "checksum mismatch; the backup is damaged"
pg_restore --list "${dump}" >/dev/null || fail "pg_restore cannot read ${dump}"

exists="$(psql -X -A -t -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${target}'")"
[[ -z "${exists}" ]] || fail "database ${target} already exists; choose another --target or drop it first"

created=false
cleanup() {
  local status=$?
  if (( status != 0 )) && [[ "${created}" == true ]]; then
    log "restore failed; ${target} is left in place for inspection"
  fi
}
trap cleanup EXIT

log "creating ${target}"
psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE \"${target}\" TEMPLATE template0 ENCODING 'UTF8'"
created=true

log "restoring ${dump} into ${target}"
pg_restore --dbname="${target}" --exit-on-error --jobs="${jobs}" "${owner_args[@]}" "${dump}"

if [[ "${verify}" == true ]]; then
  log "verifying row counts"
  actual="$(mktemp)"
  while IFS='|' read -r table _; do
    schema="${table%%.*}"
    relation="${table#*.}"
    count="$(psql -X -A -t -v ON_ERROR_STOP=1 -d "${target}" \
      -c "SELECT count(*) FROM \"${schema//\"/\"\"}\".\"${relation//\"/\"\"}\"")" || fail "cannot count ${table}"
    printf '%s|%s\n' "${table}" "${count}"
  done <"${backup}/rowcounts.txt" >"${actual}"

  if ! diff -u "${backup}/rowcounts.txt" "${actual}" >&2; then
    rm -f "${actual}"
    fail "row counts differ from the backup snapshot; ${target} kept for inspection"
  fi
  tables="$(wc -l <"${actual}" | tr -d ' ')"
  rows="$(awk -F'|' '{ total += $2 } END { print total + 0 }' "${actual}")"
  rm -f "${actual}"
  log "verified ${tables} tables, ${rows} rows match the backup"

  if [[ "${keep}" == false && "${target}" == "betng_restore_check" ]]; then
    psql -X -q -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE \"${target}\""
    log "dropped ${target}"
  fi
fi

log "done"
