ALTER TABLE "fixtures"
  ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'SCHEDULER',
  ADD CONSTRAINT "fixtures_source_check" CHECK ("source" IN ('SCHEDULER', 'ADMIN'));

ALTER TABLE "matches"
  ADD COLUMN "home_strength" JSONB,
  ADD COLUMN "away_strength" JSONB;
