-- BetNG database ownership.
--
-- Each data-owning service gets its own database and its own login. A
-- service connects to one database and has no credentials for any other,
-- which is what makes the ownership boundary enforceable rather than a
-- convention someone eventually breaks under deadline.
--
--   match       → betng_match       leagues, teams, fixtures, matches, events
--   betting     → betng_betting     bets and their selections
--   wallet      → betng_wallet      wallets and the transaction ledger
--   settlement  → betng_settlement  settlement records
--
-- The gateway, event, simulation, odds and risk services own no data and
-- appear here at all.
--
-- These passwords belong to a local container holding simulated data. They
-- are not secrets, and nothing here is reachable beyond the developer's
-- machine. A real deployment supplies its own through the environment.

CREATE ROLE betng_match LOGIN PASSWORD 'betng_match_local';
CREATE ROLE betng_betting LOGIN PASSWORD 'betng_betting_local';
CREATE ROLE betng_wallet LOGIN PASSWORD 'betng_wallet_local';
CREATE ROLE betng_settlement LOGIN PASSWORD 'betng_settlement_local';

CREATE DATABASE betng_betting OWNER betng_betting;
CREATE DATABASE betng_wallet OWNER betng_wallet;
CREATE DATABASE betng_settlement OWNER betng_settlement;

-- Created last: the compose health check waits on this one, so its
-- existence means every database above it already exists.
CREATE DATABASE betng_match OWNER betng_match;

-- The development superuser keeps access to every database so `pnpm
-- db:migrate` and a developer's psql session work without four logins.
GRANT ALL PRIVILEGES ON DATABASE betng_match TO betng;
GRANT ALL PRIVILEGES ON DATABASE betng_betting TO betng;
GRANT ALL PRIVILEGES ON DATABASE betng_wallet TO betng;
GRANT ALL PRIVILEGES ON DATABASE betng_settlement TO betng;
