-- BetNG database bootstrap. Idempotent: safe on an empty server and on one that already ran it.
--
-- One authoritative database, `betng`, with one schema per owning service. The rule the grants encode:
--   a service WRITES only its own schema, and may READ every schema.
-- Reads cross schemas because risk, settlement and analytics must see the whole book; writes never do,
-- so every table still has exactly one service that can change it.
--
--   match       leagues, teams, fixtures, matches, lifecycle transitions
--   odds        markets, market_selections, odds_snapshots, pricing configuration
--   simulation  simulation_runs, match_results, match_events, model configuration
--   risk        risk_limits, risk_decisions
--   betting     bets, bet_selections, tickets
--   wallet      wallet_accounts, wallet_transactions
--   settlement  settlements, operator_periods, operator_ledger, commission_ledger
--   identity    customers, admin_users, shops, cashiers, sessions, audit_logs, platform_settings
--   (analytics owns nothing: it is a read-only view over the rest)
--
-- Run with psql as the server superuser (scripts/db-bootstrap.sh does). The passwords are local development
-- defaults for a container of simulated data; a deployment supplies its own.

-- `-v dbname=betng_test` builds an identical database for the integration tests.

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

-- Prisma's `migrate dev` needs a throwaway database per Prisma-managed service.
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
