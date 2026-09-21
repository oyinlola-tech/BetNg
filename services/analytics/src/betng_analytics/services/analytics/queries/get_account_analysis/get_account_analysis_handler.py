from __future__ import annotations

from betng_service_kit import QueryHandler

from .....constants import AnalyticsQueryType
from .....dtos import AccountAnalysis
from .....errors import SubjectNotFoundError
from .....interfaces import AnalyticsReader
from .....utils import operator_result
from .get_account_analysis_query import GetAccountAnalysisQuery


class GetAccountAnalysisHandler(
    QueryHandler[GetAccountAnalysisQuery, AccountAnalysis]
):
    message_type = AnalyticsQueryType.GET_ACCOUNT_ANALYSIS

    def __init__(self, reader: AnalyticsReader) -> None:
        self._reader = reader

    async def execute(self, message: GetAccountAnalysisQuery) -> AccountAnalysis:
        row = await self._reader.account(
            message.kind, message.subject_id, message.window
        )

        if row is None:
            raise SubjectNotFoundError(message.kind.lower(), message.subject_id)

        contribution = operator_result(row["settled_stake"], row["payout"])

        return AccountAnalysis(
            subject_kind=message.kind,
            subject_id=message.subject_id,
            label=row["label"],
            bets=row["bets"],
            pending_bets=row["pending_bets"],
            wins=row["winning_bets"],
            losses=row["losing_bets"],
            voids=row["void_bets"],
            stake=row["stake"],
            # A cashier's payout is what they paid over the counter, which
            # need not be on tickets they sold; the contribution below is
            # always about the bets the subject accepted or placed.
            payout=row.get("payout_processed", row["payout"]),
            net_result=-contribution,
            operator_contribution=contribution,
            commission=row.get("commission"),
            transactions=row.get("transactions"),
        )
