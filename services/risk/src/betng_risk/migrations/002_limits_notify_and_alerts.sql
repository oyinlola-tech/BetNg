-- Every replica drops its cached limits the moment any version change commits.
CREATE OR REPLACE FUNCTION risk.notify_limits_changed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify('risk_limits_changed', '');
    RETURN NULL;
END;
$$;

CREATE TRIGGER risk_limits_changed
AFTER INSERT OR UPDATE OR DELETE OR TRUNCATE ON risk.risk_limits
FOR EACH STATEMENT EXECUTE FUNCTION risk.notify_limits_changed();

-- One row per threshold currently crossed; the insert that creates it is the
-- one that alerts, and the row is dropped once the exposure falls back.
CREATE TABLE risk.exposure_alerts (
    scope          text        NOT NULL CHECK (scope IN ('MARKET', 'MATCH')),
    scope_id       uuid        NOT NULL,
    threshold      integer     NOT NULL CHECK (threshold IN (80, 100)),
    match_id       uuid        NOT NULL,
    exposure       bigint      NOT NULL,
    limit_amount   bigint      NOT NULL CHECK (limit_amount >= 1),
    limits_version integer     NOT NULL,
    crossed_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (scope, scope_id, threshold)
);

CREATE INDEX exposure_alerts_match_id ON risk.exposure_alerts (match_id);
