// The tables betting reads from other schemas, with exactly the §8 columns. Created by the superuser in the
// dedicated test database only; in `betng` they belong to the match, odds and identity services.
export const FIXTURE_SCHEMA: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS match.leagues (
     id uuid PRIMARY KEY, name text NOT NULL, code text NOT NULL, slug text NOT NULL, country text NOT NULL,
     sport text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS match.teams (
     id uuid PRIMARY KEY, league_id uuid NOT NULL, name text NOT NULL, short_name text NOT NULL, code text NOT NULL,
     city text NOT NULL, stadium text NOT NULL, color_primary text NOT NULL, color_secondary text NOT NULL,
     strength int NOT NULL, attack int NOT NULL, defence int NOT NULL, midfield int NOT NULL, goalkeeping int NOT NULL,
     pace int NOT NULL, finishing int NOT NULL, possession int NOT NULL, form int NOT NULL, home_advantage int NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS match.fixtures (
     id uuid PRIMARY KEY, league_id uuid NOT NULL, season text NOT NULL, matchday int NOT NULL,
     home_team_id uuid NOT NULL, away_team_id uuid NOT NULL, kickoff_at timestamptz NOT NULL,
     betting_closes_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS match.matches (
     id uuid PRIMARY KEY, fixture_id uuid NOT NULL UNIQUE, status text NOT NULL, lifecycle text NOT NULL,
     home_score int NOT NULL DEFAULT 0, away_score int NOT NULL DEFAULT 0, revealed_sequence int NOT NULL DEFAULT 0,
     completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS odds.markets (
     id uuid PRIMARY KEY, match_id uuid NOT NULL, type text NOT NULL, line numeric(4,1), status text NOT NULL,
     odds_version int NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS odds.market_selections (
     id uuid PRIMARY KEY, market_id uuid NOT NULL, match_id uuid NOT NULL, code text NOT NULL, label text NOT NULL,
     probability numeric(9,6) NOT NULL, odds numeric(8,2) NOT NULL, sort_order int NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS identity.shops (
     id uuid PRIMARY KEY, code text NOT NULL, name text NOT NULL, address text NOT NULL, phone text NOT NULL,
     email text NOT NULL, status text NOT NULL, owner_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS identity.cashiers (
     id uuid PRIMARY KEY, shop_id uuid NOT NULL, username text NOT NULL, display_name text NOT NULL, role text NOT NULL,
     status text NOT NULL, last_active_at timestamptz, created_at timestamptz NOT NULL DEFAULT now())`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA match TO betng_reader`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA odds TO betng_reader`,
  `GRANT SELECT ON ALL TABLES IN SCHEMA identity TO betng_reader`,
];
