"""Service-local records.

The wire shapes live in ``dtos`` and mirror ``@betng/contracts``; these are
the typed rows behind them.
"""

from .odds_type import (
    AuditEntry,
    ConfigurationRecord,
    MarketRecord,
    MatchInfo,
    PublishOutcome,
    SelectionExposure,
    SelectionRecord,
    SnapshotRecord,
)

__all__ = [
    "AuditEntry",
    "ConfigurationRecord",
    "MarketRecord",
    "MatchInfo",
    "PublishOutcome",
    "SelectionExposure",
    "SelectionRecord",
    "SnapshotRecord",
]
