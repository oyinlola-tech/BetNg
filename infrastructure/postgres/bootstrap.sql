-- Idempotent. One database, one schema and one login per owning service.
-- A service writes only its own schema and may read every schema (betng_reader).
-- `-v dbname=betng_test` builds an identical database for tests.
-- Passwords are local development defaults; a deployment supplies its own.

\set ON_ERROR_STOP on
SET client_min_messages = warning;
\if :{?dbname}
\else
  \set dbname betng
\endif

SELECT format('CREATE DATABASE %I', :'dbname') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'dbname')\gexec

DO $$
DECLARE
  service text;
BEGIN
  FOREACH service IN ARRAY ARRAY['match','odds','simulation','risk','betting','wallet','settlement','identity','analytics'] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'betng_' || service) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', 'betng_' || service, 'betng_' || service || '_local');
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'betng_reader') THEN
    CREATE ROLE betng_reader NOLOGIN;
  END IF;

  -- Operations logins: backups read everything, the metrics exporter reads statistics only.
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'betng_backup') THEN
    CREATE ROLE betng_backup LOGIN PASSWORD 'betng_backup_local';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'betng_monitor') THEN
    CREATE ROLE betng_monitor LOGIN PASSWORD 'betng_monitor_local' CONNECTION LIMIT 5;
  END IF;
END
$$;

GRANT pg_read_all_data TO betng_backup;
GRANT pg_monitor TO betng_monitor;

-- Shadow databases for `prisma migrate dev`.
SELECT format('CREATE DATABASE %I OWNER %I', 'betng_' || s || '_shadow', 'betng_' || s)
FROM unnest(ARRAY['match','betting','wallet','settlement','identity']) AS s
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'betng_' || s || '_shadow')\gexec

\connect :dbname
SET client_min_messages = warning;

REVOKE ALL ON SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  service text;
BEGIN
  FOREACH service IN ARRAY ARRAY['match','odds','simulation','risk','betting','wallet','settlement','identity'] LOOP
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', service, 'betng_' || service);
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO betng_reader', service);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO betng_reader', service);
    EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON TABLES TO betng_reader', 'betng_' || service, service);
    EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path = %I', 'betng_' || service, current_database(), service);
  END LOOP;

  FOREACH service IN ARRAY ARRAY['match','odds','simulation','risk','betting','wallet','settlement','identity','analytics'] LOOP
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), 'betng_' || service);
    EXECUTE format('GRANT betng_reader TO %I', 'betng_' || service);
  END LOOP;
END
$$;

-- Session limits for service logins in this database. Set once; an operator's later value is kept.
DO $$
DECLARE
  service text;
  setting text;
  value text;
BEGIN
  FOREACH service IN ARRAY ARRAY['match','odds','simulation','risk','betting','wallet','settlement','identity','analytics'] LOOP
    FOREACH setting IN ARRAY ARRAY['statement_timeout','idle_in_transaction_session_timeout'] LOOP
      value := CASE
        WHEN setting = 'idle_in_transaction_session_timeout' THEN '60s'
        WHEN service = 'analytics' THEN '300s'
        ELSE '60s'
      END;
      IF NOT EXISTS (
        SELECT FROM pg_db_role_setting s
        JOIN pg_roles r ON r.oid = s.setrole
        JOIN pg_database d ON d.oid = s.setdatabase
        WHERE r.rolname = 'betng_' || service
          AND d.datname = current_database()
          AND EXISTS (SELECT FROM unnest(s.setconfig) AS c WHERE c LIKE setting || '=%')
      ) THEN
        EXECUTE format('ALTER ROLE %I IN DATABASE %I SET %I = %L', 'betng_' || service, current_database(), setting, value);
      END IF;
    END LOOP;
  END LOOP;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO betng_backup, betng_monitor', current_database());
END
$$;
