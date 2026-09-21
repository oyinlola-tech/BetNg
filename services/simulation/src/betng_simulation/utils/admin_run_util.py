from __future__ import annotations

from uuid import UUID

from ..dtos import AdminRunScore, AdminSimulationRun
from ..interfaces import AdminRunRecord, MatchView

CANCELLED_STATUS = "CANCELLED"
CANCELLED_NOTE = "Cancelled by an operator."


def to_admin_run(record: AdminRunRecord, match: MatchView | None) -> AdminSimulationRun:
    run = record.run
    revealed = match is not None and match.result_revealed
    score = (
        AdminRunScore(home=record.home_goals, away=record.away_goals)
        if revealed and record.home_goals is not None and record.away_goals is not None
        else None
    )
    error = run.failure_reason
    if run.status == CANCELLED_STATUS:
        error = f"{CANCELLED_NOTE} {error}" if error else CANCELLED_NOTE

    return AdminSimulationRun.model_validate(
        {
            "id": UUID(run.id),
            "match_id": UUID(run.match_id),
            "status": record.admin_status,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "events": record.event_count,
            "score": score,
            "seed": run.seed,
            "model_version": run.model_version,
            "configuration_version": run.configuration_version,
            "attempt": run.attempt,
            "match_label": f"{run.home_team_name} v {run.away_team_name}",
            "league_name": match.league_name if match is not None else "",
            "error": error,
        }
    )
