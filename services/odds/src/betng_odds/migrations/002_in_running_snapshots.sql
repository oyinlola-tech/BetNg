-- In-running repricing writes a snapshot naming the event that moved the price,
-- so a settled dispute can point at the goal or dismissal the odds answered.
ALTER TABLE odds.odds_snapshots
    DROP CONSTRAINT IF EXISTS odds_snapshots_reason_check;

ALTER TABLE odds.odds_snapshots
    ADD CONSTRAINT odds_snapshots_reason_check CHECK (reason IN (
        'INITIAL', 'ADMIN_REPRICE', 'STATUS_CHANGE',
        'GOAL', 'RED_CARD', 'HALF_TIME', 'SECOND_HALF'));
