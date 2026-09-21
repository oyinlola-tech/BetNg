-- The un-keyed string a run's seed was derived from. The key itself is never stored.

ALTER TABLE simulation.simulation_runs ADD COLUMN seed_material text;

UPDATE simulation.simulation_runs
SET seed_material = match_id::text || ':' || model_version || ':' || configuration_version::text;

ALTER TABLE simulation.simulation_runs ALTER COLUMN seed_material SET NOT NULL;
