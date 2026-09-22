-- The teams a run was played with, so an audit can replay it from its seed.
-- Runs recorded before this column existed stay NULL and are not replayable.

ALTER TABLE simulation.simulation_runs ADD COLUMN inputs jsonb;
