from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import OperatorPeriod, OperatorReconciliation, OperatorSummary
from .....interfaces import AnalyticsReader
from .....utils import now, rate, to_iso, to_iso_or_none
from ...mappers import to_source_figures
from ...session_ids import custom_session_id
from .get_operator_summary_query import GetOperatorSummaryQuery


class GetOperatorSummaryHandler(
    QueryHandler[GetOperatorSummaryQuery, OperatorReconciliation]
):
    message_type = AnalyticsQueryType.GET_OPERATOR_SUMMARY

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetOperatorSummaryQuery) -> OperatorReconciliation:
        window = message.scope.window
        row = await self._reader.operator(message.scope)
        generated_at = now()

        bets = to_source_figures(row, "bets")
        settlements = to_source_figures(row, "settlements")
        ledger = to_source_figures(row, "ledger")

        starts_at = window.start or row["first_placed_at"] or generated_at

        return OperatorReconciliation(
            summary=OperatorSummary(
                period=OperatorPeriod(
                    id=custom_session_id(starts_at, window.end or generated_at),
                    kind="CUSTOM",
                    # A live window is never a closed accounting period.
                    status="OPEN",
                    starts_at=to_iso(starts_at),
                    ends_at=to_iso_or_none(window.end),
                ),
                gross_stakes=bets.gross_stakes,
                gross_payouts=bets.gross_payouts,
                operator_result=bets.operator_result,
                operator_result_rate=rate(bets.operator_result, bets.gross_stakes),
                settled_bets=bets.settled_bets,
                void_bets=bets.void_bets,
                refunded_stakes=bets.refunded_stakes,
            ),
            bets=bets,
            settlements=settlements,
            ledger=ledger,
            reconciled=bets == settlements == ledger,
            generated_at=to_iso(generated_at),
        )
