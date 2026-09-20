-- CreateEnum
CREATE TYPE "match_status" AS ENUM ('SCHEDULED', 'BETTING_OPEN', 'BETTING_CLOSED', 'IN_PLAY', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "match_event_type" AS ENUM ('KICK_OFF', 'GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'HALF_TIME', 'FULL_TIME');

-- CreateEnum
CREATE TYPE "match_side" AS ENUM ('HOME', 'AWAY');

-- CreateTable
CREATE TABLE "leagues" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "country" VARCHAR(60) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "short_name" VARCHAR(8) NOT NULL,
    "strength" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" UUID NOT NULL,
    "league_id" UUID NOT NULL,
    "matchday" INTEGER NOT NULL,
    "home_team_id" UUID NOT NULL,
    "away_team_id" UUID NOT NULL,
    "kickoff_at" TIMESTAMP(3) NOT NULL,
    "betting_closes_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL,
    "fixture_id" UUID NOT NULL,
    "status" "match_status" NOT NULL DEFAULT 'SCHEDULED',
    "home_score" INTEGER,
    "away_score" INTEGER,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "type" "match_event_type" NOT NULL,
    "minute" INTEGER NOT NULL,
    "side" "match_side",
    "description" VARCHAR(240) NOT NULL,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leagues_code_key" ON "leagues"("code");

-- CreateIndex
CREATE INDEX "teams_league_id_idx" ON "teams"("league_id");

-- CreateIndex
CREATE INDEX "fixtures_betting_closes_at_idx" ON "fixtures"("betting_closes_at");

-- CreateIndex
CREATE UNIQUE INDEX "fixtures_league_id_matchday_home_team_id_away_team_id_key" ON "fixtures"("league_id", "matchday", "home_team_id", "away_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_fixture_id_key" ON "matches"("fixture_id");

-- CreateIndex
CREATE INDEX "matches_status_idx" ON "matches"("status");

-- CreateIndex
CREATE INDEX "match_events_match_id_minute_idx" ON "match_events"("match_id", "minute");

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
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
