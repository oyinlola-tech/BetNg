from __future__ import annotations

from typing import Final


class RiskQuery:
    """Query types the risk service handles.

    Risk analysis is a read: it inspects accepted stakes and reports. It
    changes no state, and it has no command side at all — which is what
    makes "risk cannot alter a bet or a result" a property of the wiring.
    """

    EVALUATE_EXPOSURE: Final = "risk.evaluateExposure"


class RiskProcedure:
    CALCULATE_EXPOSURE: Final = "risk.calculateExposure"
    CALCULATE_LIABILITY: Final = "risk.calculateLiability"
