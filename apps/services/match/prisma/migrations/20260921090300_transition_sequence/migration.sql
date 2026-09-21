-- DropIndex
DROP INDEX "match_transitions_match_id_at_idx";

-- AlterTable
ALTER TABLE "match_transitions" ADD COLUMN     "sequence" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "match_transitions_sequence_key" ON "match_transitions"("sequence");

-- CreateIndex
CREATE INDEX "match_transitions_match_id_sequence_idx" ON "match_transitions"("match_id", "sequence");

