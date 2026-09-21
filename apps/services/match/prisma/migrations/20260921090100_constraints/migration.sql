-- Constraints Prisma's schema language cannot express.

ALTER TABLE "matches"
  ADD CONSTRAINT "matches_lifecycle_check" CHECK ("lifecycle" IN (
    'FIXTURE_CREATED', 'MARKETS_CREATED', 'ODDS_PUBLISHED', 'BETTING_OPEN', 'BETTING_ACTIVE',
    'BETTING_CLOSED', 'SIMULATION_STARTED', 'RESULT_GENERATED', 'EVENTS_PUBLISHED',
    'MATCH_FINISHED', 'SETTLEMENT_STARTED', 'SETTLEMENT_COMPLETED', 'SIMULATION_FAILED',
    'SETTLEMENT_FAILED', 'VOIDED'
  )),
  ADD CONSTRAINT "matches_score_check" CHECK (
    ("home_score" IS NULL AND "away_score" IS NULL)
    OR ("home_score" >= 0 AND "away_score" >= 0)
  ),
  ADD CONSTRAINT "matches_revealed_sequence_check" CHECK ("revealed_sequence" >= 0),
  ADD CONSTRAINT "matches_failure_count_check" CHECK ("failure_count" >= 0);

ALTER TABLE "fixtures"
  ADD CONSTRAINT "fixtures_distinct_teams_check" CHECK ("home_team_id" <> "away_team_id"),
  ADD CONSTRAINT "fixtures_betting_window_check" CHECK ("betting_closes_at" <= "kickoff_at"),
  ADD CONSTRAINT "fixtures_season_check" CHECK ("season" >= 1),
  ADD CONSTRAINT "fixtures_matchday_check" CHECK ("matchday" >= 1);

ALTER TABLE "teams"
  ADD CONSTRAINT "teams_ratings_check" CHECK (
    "strength" BETWEEN 0 AND 100 AND "attack" BETWEEN 0 AND 100 AND "defence" BETWEEN 0 AND 100
    AND "midfield" BETWEEN 0 AND 100 AND "goalkeeping" BETWEEN 0 AND 100 AND "pace" BETWEEN 0 AND 100
    AND "finishing" BETWEEN 0 AND 100 AND "possession" BETWEEN 0 AND 100
    AND "home_advantage" BETWEEN 0 AND 100
  ),
  ADD CONSTRAINT "teams_form_check" CHECK ("form" BETWEEN -10 AND 10);

ALTER TABLE "leagues"
  ADD CONSTRAINT "leagues_stagger_check" CHECK ("stagger_seconds" >= 0);

-- The transition log is evidence: rows are appended, never rewritten or removed.
CREATE FUNCTION "match_transitions_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'match_transitions is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "match_transitions_no_update"
  BEFORE UPDATE OR DELETE ON "match_transitions"
  FOR EACH ROW EXECUTE FUNCTION "match_transitions_append_only"();
