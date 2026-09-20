-- Invariants a bet must never violate, enforced by the database.

-- A bet must risk something.
ALTER TABLE "bets" ADD CONSTRAINT "bets_stake_positive" CHECK ("stake" > 0);

-- Odds at or below 1.0 can never return a profit, so a slip priced there is
-- a pricing bug rather than an offer.
ALTER TABLE "bets"
  ADD CONSTRAINT "bets_total_odds_above_one" CHECK ("total_odds" > 1);

-- A winning slip returns at least the stake. This is what catches a payout
-- computed from the wrong odds before it is ever owed.
ALTER TABLE "bets"
  ADD CONSTRAINT "bets_payout_covers_stake"
  CHECK ("potential_payout" >= "stake");

ALTER TABLE "bets"
  ADD CONSTRAINT "bets_currency_iso4217" CHECK ("currency" ~ '^[A-Z]{3}$');

-- A settled bet has a settlement time, and an unsettled one does not. The
-- two columns cannot disagree about whether the bet is resolved.
ALTER TABLE "bets"
  ADD CONSTRAINT "bets_settled_at_matches_status" CHECK (
    ("status" = 'PENDING' AND "settled_at" IS NULL)
    OR ("status" <> 'PENDING' AND "settled_at" IS NOT NULL)
  );

ALTER TABLE "bet_selections"
  ADD CONSTRAINT "bet_selections_odds_above_one" CHECK ("odds" > 1);
