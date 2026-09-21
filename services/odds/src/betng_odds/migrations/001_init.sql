-- The odds schema: pricing configuration, markets, selections and the
-- append-only snapshot history. Every row is keyed by match and market, never
-- by user: a price is a property of the market.

CREATE TABLE odds.pricing_configurations (
    version     integer PRIMARY KEY CHECK (version >= 1),
    margins     jsonb NOT NULL,
    min_odds    numeric(8, 2) NOT NULL CHECK (min_odds > 1),
    max_odds    numeric(8, 2) NOT NULL CHECK (max_odds <= 1000),
    active      boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  text NOT NULL,
    reason      text NOT NULL,
    CHECK (max_odds > min_odds)
);

CREATE UNIQUE INDEX pricing_configurations_one_active
    ON odds.pricing_configurations (active)
    WHERE active;

INSERT INTO odds.pricing_configurations
    (version, margins, min_odds, max_odds, active, created_by, reason)
SELECT
    1,
    '{"MATCH_RESULT": 0.07, "DOUBLE_CHANCE": 0.07, "OVER_UNDER": 0.06,
      "BOTH_TEAMS_TO_SCORE": 0.06, "GOAL_SPREAD": 0.07,
      "CORRECT_SCORE": 0.15}'::jsonb,
    1.01,
    500,
    true,
    'system',
    'Initial pricing configuration'
WHERE NOT EXISTS (SELECT 1 FROM odds.pricing_configurations);

CREATE TABLE odds.markets (
    id                          uuid PRIMARY KEY,
    match_id                    uuid NOT NULL,
    type                        text NOT NULL CHECK (type IN (
                                    'MATCH_RESULT', 'DOUBLE_CHANCE', 'OVER_UNDER',
                                    'BOTH_TEAMS_TO_SCORE', 'CORRECT_SCORE',
                                    'GOAL_SPREAD')),
    line                        numeric(4, 1),
    status                      text NOT NULL DEFAULT 'OPEN' CHECK (status IN (
                                    'OPEN', 'SUSPENDED', 'CLOSED', 'SETTLED',
                                    'VOID')),
    odds_version                integer NOT NULL DEFAULT 1 CHECK (odds_version >= 1),
    sort_order                  smallint NOT NULL,
    pricing_version             integer NOT NULL
                                    REFERENCES odds.pricing_configurations (version),
    model_version               text NOT NULL,
    model_configuration_version integer NOT NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    UNIQUE NULLS NOT DISTINCT (match_id, type, line)
);

CREATE INDEX markets_status_idx ON odds.markets (status);

CREATE TABLE odds.market_selections (
    id           uuid PRIMARY KEY,
    market_id    uuid NOT NULL REFERENCES odds.markets (id) ON DELETE CASCADE,
    match_id     uuid NOT NULL,
    code         text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 32),
    label        text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 64),
    probability  numeric(9, 6) NOT NULL CHECK (probability BETWEEN 0 AND 1),
    odds         numeric(8, 2) NOT NULL CHECK (odds > 1),
    sort_order   smallint NOT NULL,
    UNIQUE (market_id, code)
);

CREATE INDEX market_selections_match_idx ON odds.market_selections (match_id);

CREATE TABLE odds.odds_snapshots (
    id            uuid PRIMARY KEY,
    market_id     uuid NOT NULL REFERENCES odds.markets (id),
    match_id      uuid NOT NULL,
    odds_version  integer NOT NULL CHECK (odds_version >= 1),
    reason        text NOT NULL CHECK (reason IN (
                      'INITIAL', 'ADMIN_REPRICE', 'STATUS_CHANGE')),
    status        text NOT NULL,
    prices        jsonb NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (market_id, odds_version)
);

CREATE INDEX odds_snapshots_match_idx ON odds.odds_snapshots (match_id);

CREATE FUNCTION odds.reject_snapshot_mutation() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION 'odds.odds_snapshots is append-only (% rejected)', TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER odds_snapshots_immutable
    BEFORE UPDATE OR DELETE ON odds.odds_snapshots
    FOR EACH ROW EXECUTE FUNCTION odds.reject_snapshot_mutation();

CREATE TRIGGER odds_snapshots_no_truncate
    BEFORE TRUNCATE ON odds.odds_snapshots
    FOR EACH STATEMENT EXECUTE FUNCTION odds.reject_snapshot_mutation();
