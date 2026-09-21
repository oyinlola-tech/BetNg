-- Simulation schema: versioned model parameters, runs, and the immutable
-- result and timeline of every match.

CREATE TABLE simulation.model_configurations (
    version       integer     PRIMARY KEY CHECK (version >= 1),
    model_version text        NOT NULL CHECK (char_length(model_version) BETWEEN 1 AND 40),
    params        jsonb       NOT NULL,
    active        boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    created_by    text        NOT NULL,
    reason        text        NOT NULL
);

CREATE UNIQUE INDEX model_configurations_one_active
    ON simulation.model_configurations (active)
    WHERE active;

CREATE TABLE simulation.simulation_runs (
    id                    uuid        PRIMARY KEY,
    match_id              uuid        NOT NULL,
    status                text        NOT NULL
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    model_version         text        NOT NULL,
    configuration_version integer     NOT NULL
        REFERENCES simulation.model_configurations (version),
    seed                  text        NOT NULL,
    attempt               integer     NOT NULL CHECK (attempt >= 1),
    started_at            timestamptz NOT NULL DEFAULT now(),
    completed_at          timestamptz,
    failure_reason        text,
    home_team_id          uuid        NOT NULL,
    home_team_name        text        NOT NULL,
    away_team_id          uuid        NOT NULL,
    away_team_name        text        NOT NULL,
    retry_requested_at    timestamptz,
    retry_requested_by    text,
    operator_reason       text
);

-- The lock. A match has at most one run that is in flight or finished, so a
-- second worker's insert waits here for the first to commit and then yields.
CREATE UNIQUE INDEX simulation_runs_one_live_run_per_match
    ON simulation.simulation_runs (match_id)
    WHERE status IN ('RUNNING', 'COMPLETED');

CREATE INDEX simulation_runs_match_id ON simulation.simulation_runs (match_id, attempt);
CREATE INDEX simulation_runs_started_at ON simulation.simulation_runs (started_at DESC);

CREATE TABLE simulation.match_results (
    match_id              uuid          PRIMARY KEY,
    simulation_id         uuid          NOT NULL UNIQUE
        REFERENCES simulation.simulation_runs (id),
    home_goals            integer       NOT NULL CHECK (home_goals >= 0),
    away_goals            integer       NOT NULL CHECK (away_goals >= 0),
    winner                text          NOT NULL CHECK (winner IN ('HOME', 'AWAY', 'DRAW')),
    winning_gap           integer       NOT NULL,
    home_xg               numeric(8, 4) NOT NULL CHECK (home_xg >= 0),
    away_xg               numeric(8, 4) NOT NULL CHECK (away_xg >= 0),
    seed                  text          NOT NULL,
    model_version         text          NOT NULL,
    configuration_version integer       NOT NULL
        REFERENCES simulation.model_configurations (version),
    stats                 jsonb         NOT NULL,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    -- The winner and the gap are functions of the score; a row that disagrees
    -- with its own score cannot be stored.
    CONSTRAINT match_results_gap_derived
        CHECK (winning_gap = abs(home_goals - away_goals)),
    CONSTRAINT match_results_winner_derived
        CHECK (
            (winner = 'HOME' AND home_goals > away_goals)
            OR (winner = 'AWAY' AND away_goals > home_goals)
            OR (winner = 'DRAW' AND home_goals = away_goals)
        )
);

CREATE TABLE simulation.match_events (
    id               uuid    PRIMARY KEY,
    match_id         uuid    NOT NULL REFERENCES simulation.match_results (match_id),
    simulation_id    uuid    NOT NULL REFERENCES simulation.simulation_runs (id),
    sequence         integer NOT NULL CHECK (sequence >= 1),
    minute           integer NOT NULL CHECK (minute BETWEEN 0 AND 120),
    type             text    NOT NULL
        CHECK (type IN (
            'KICK_OFF', 'GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION',
            'CORNER', 'HALF_TIME', 'SECOND_HALF', 'FULL_TIME'
        )),
    side             text    CHECK (side IN ('HOME', 'AWAY')),
    player           text,
    secondary_player text,
    score_home       integer NOT NULL CHECK (score_home >= 0),
    score_away       integer NOT NULL CHECK (score_away >= 0),
    description      text    NOT NULL CHECK (char_length(description) <= 240),
    UNIQUE (match_id, sequence)
);

CREATE FUNCTION simulation.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '%.% is immutable: % is not allowed',
        TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER match_results_immutable
    BEFORE UPDATE OR DELETE ON simulation.match_results
    FOR EACH ROW EXECUTE FUNCTION simulation.reject_mutation();

CREATE TRIGGER match_results_no_truncate
    BEFORE TRUNCATE ON simulation.match_results
    FOR EACH STATEMENT EXECUTE FUNCTION simulation.reject_mutation();

CREATE TRIGGER match_events_immutable
    BEFORE UPDATE OR DELETE ON simulation.match_events
    FOR EACH ROW EXECUTE FUNCTION simulation.reject_mutation();

CREATE TRIGGER match_events_no_truncate
    BEFORE TRUNCATE ON simulation.match_events
    FOR EACH STATEMENT EXECUTE FUNCTION simulation.reject_mutation();

-- A configuration version is never edited: only its `active` flag may change.
CREATE FUNCTION simulation.protect_configuration() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'simulation.model_configurations rows cannot be deleted'
            USING ERRCODE = 'restrict_violation';
    END IF;

    IF NEW.version IS DISTINCT FROM OLD.version
        OR NEW.model_version IS DISTINCT FROM OLD.model_version
        OR NEW.params IS DISTINCT FROM OLD.params
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.reason IS DISTINCT FROM OLD.reason
    THEN
        RAISE EXCEPTION 'a stored configuration version cannot be edited'
            USING ERRCODE = 'restrict_violation';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER model_configurations_protected
    BEFORE UPDATE OR DELETE ON simulation.model_configurations
    FOR EACH ROW EXECUTE FUNCTION simulation.protect_configuration();
