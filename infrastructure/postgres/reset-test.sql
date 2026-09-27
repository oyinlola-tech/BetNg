-- Empties every table of one service test database. The schema and the migration history stay.
-- Refuses a database that is not named betng_test_<service>, and leaves one alone while another session is using it.

\set ON_ERROR_STOP on
SET client_min_messages = warning;
SET lock_timeout = '10s';

DO $$
BEGIN
  IF current_database() !~ '^betng_test_[a-z]+$' THEN
    RAISE EXCEPTION '% is not a service test database; nothing was reset.', current_database();
  END IF;
END
$$;

SELECT EXISTS (
  SELECT FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend'
) AS busy \gset

\if :busy
  \echo :DBNAME 'is in use by another session; left as it is.'
  \quit
\endif

BEGIN;

-- The append-only and no-truncate triggers guard production rows; a test database is emptied past them.
SET LOCAL session_replication_role = replica;

SELECT format('TRUNCATE %s RESTART IDENTITY', string_agg(format('%I.%I', schemaname, tablename), ', '))
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema') AND tablename <> '_prisma_migrations'
HAVING count(*) > 0 \gexec

COMMIT;
