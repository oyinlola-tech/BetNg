-- Risk schema: versioned limits, every stake decision, and the exposure
-- snapshot taken when a match closes. Money is BIGINT kobo throughout.

CREATE TABLE risk.risk_limits (
    version                      integer     PRIMARY KEY CHECK (version >= 1),
    min_stake                    bigint      NOT NULL CHECK (min_stake >= 1),
    max_stake_per_bet            bigint      NOT NULL CHECK (max_stake_per_bet >= min_stake),
    max_payout_per_bet           bigint      NOT NULL CHECK (max_payout_per_bet >= 1),
    max_liability_per_selection  bigint      NOT NULL CHECK (max_liability_per_selection >= 1),
    max_liability_per_market     bigint      NOT NULL CHECK (max_liability_per_market >= 1),
    max_liability_per_match      bigint      NOT NULL CHECK (max_liability_per_match >= 1),
    active                       boolean     NOT NULL DEFAULT false,
    created_at                   timestamptz NOT NULL DEFAULT now(),
    created_by                   text        NOT NULL,
    reason                       text        NOT NULL
);

-- At most one version is in force.
CREATE UNIQUE INDEX risk_limits_one_active ON risk.risk_limits (active) WHERE active;

CREATE TABLE risk.risk_decisions (
    id               uuid          PRIMARY KEY,
    request_id       text          NOT NULL,
    actor_kind       text          NOT NULL CHECK (actor_kind IN ('CUSTOMER', 'CASHIER')),
    actor_id         uuid          NOT NULL,
    shop_id          uuid,
    stake_requested  bigint        NOT NULL CHECK (stake_requested >= 1),
    total_odds       numeric(12,2) NOT NULL,
    decision         text          NOT NULL CHECK (decision IN ('ACCEPT', 'LIMIT', 'REJECT')),
    reason           text          NOT NULL CHECK (reason IN (
                         'WITHIN_LIMIT', 'STAKE_LIMIT', 'PAYOUT_LIMIT', 'EXPOSURE_LIMIT',
                         'MARKET_CLOSED', 'MARKET_SUSPENDED', 'STAKE_BELOW_MINIMUM',
                         'INVALID_SELECTION')),
    max_stake        bigint        NOT NULL CHECK (max_stake >= 0),
    legs             jsonb         NOT NULL,
    limits_version   integer       NOT NULL REFERENCES risk.risk_limits (version),
    created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX risk_decisions_created_at ON risk.risk_decisions (created_at);
CREATE INDEX risk_decisions_request_id ON risk.risk_decisions (request_id);

CREATE TABLE risk.exposure_freezes (
    match_id   uuid        PRIMARY KEY,
    frozen_at  timestamptz NOT NULL DEFAULT now(),
    snapshot   jsonb       NOT NULL
);

-- Play-money defaults, in kobo: min stake N50, max stake N500,000, max payout
-- N20,000,000, liability caps N15m / N30m / N60m per selection / market / match.
INSERT INTO risk.risk_limits (
    version, min_stake, max_stake_per_bet, max_payout_per_bet,
    max_liability_per_selection, max_liability_per_market, max_liability_per_match,
    active, created_by, reason
)
SELECT 1, 5000, 50000000, 2000000000, 1500000000, 3000000000, 6000000000,
       true, 'system', 'Initial play-money limits'
WHERE NOT EXISTS (SELECT 1 FROM risk.risk_limits);
