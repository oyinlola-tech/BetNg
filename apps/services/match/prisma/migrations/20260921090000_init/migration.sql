-- CreateEnum
CREATE TYPE "league_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "team_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('SCHEDULED', 'BETTING_OPEN', 'BETTING_CLOSED', 'IN_PLAY', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "country" VARCHAR(60) NOT NULL,
    "sport" VARCHAR(32) NOT NULL DEFAULT 'football',
    "status" "league_status" NOT NULL DEFAULT 'ACTIVE',
    "stagger_seconds" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "short_name" VARCHAR(12) NOT NULL,
    "code" VARCHAR(4) NOT NULL,
    "city" VARCHAR(60) NOT NULL DEFAULT '',
    "stadium" VARCHAR(80) NOT NULL DEFAULT '',
    "color_primary" VARCHAR(7) NOT NULL DEFAULT '#1F2937',
    "color_secondary" VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
    "status" "team_status" NOT NULL DEFAULT 'ACTIVE',
    "strength" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defence" INTEGER NOT NULL,
    "midfield" INTEGER NOT NULL,
    "goalkeeping" INTEGER NOT NULL,
    "pace" INTEGER NOT NULL,
    "finishing" INTEGER NOT NULL,
    "possession" INTEGER NOT NULL,
    "form" INTEGER NOT NULL DEFAULT 0,
    "home_advantage" INTEGER NOT NULL DEFAULT 55,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 1,
    "matchday" INTEGER NOT NULL,
    "home_team_id" UUID NOT NULL,
    "away_team_id" UUID NOT NULL,
    "kickoff_at" TIMESTAMPTZ(3) NOT NULL,
    "betting_closes_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "fixture_id" UUID NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'SCHEDULED',
    "lifecycle" VARCHAR(32) NOT NULL DEFAULT 'FIXTURE_CREATED',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "revealed_sequence" INTEGER NOT NULL DEFAULT 0,
    "betting_opened_at" TIMESTAMPTZ(3),
    "betting_closed_at" TIMESTAMPTZ(3),
    "simulation_started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "settled_at" TIMESTAMPTZ(3),
    "voided_at" TIMESTAMPTZ(3),
    "failure_reason" VARCHAR(240),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_transitions" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "from_state" VARCHAR(32),
    "to_state" VARCHAR(32) NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" VARCHAR(80) NOT NULL,
    "reason" VARCHAR(240),

    CONSTRAINT "match_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_code_key" ON "leagues"("code");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_slug_key" ON "leagues"("slug");

-- CreateIndex
CREATE INDEX "teams_league_id_idx" ON "teams"("league_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_league_id_code_key" ON "teams"("league_id", "code");

-- CreateIndex
CREATE INDEX "fixtures_league_id_season_matchday_idx" ON "fixtures"("league_id", "season", "matchday");

-- CreateIndex
CREATE INDEX "fixtures_kickoff_at_idx" ON "fixtures"("kickoff_at");

-- CreateIndex
CREATE INDEX "fixtures_betting_closes_at_idx" ON "fixtures"("betting_closes_at");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_league_id_season_matchday_home_team_id_away_team_i_key" ON "fixtures"("league_id", "season", "matchday", "home_team_id", "away_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_fixture_id_key" ON "matches"("fixture_id");

-- CreateIndex
CREATE INDEX "matches_lifecycle_idx" ON "matches"("lifecycle");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "match_transitions_match_id_at_idx" ON "match_transitions"("match_id", "at");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_fixture_id_fkey" FOREIGN KEY ("fixture_id") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_transitions" ADD CONSTRAINT "match_transitions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

