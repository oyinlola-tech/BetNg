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
END
$$;

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
