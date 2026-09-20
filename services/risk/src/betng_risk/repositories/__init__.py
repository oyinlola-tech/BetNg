"""Concrete implementations of the risk analysis contract.

The risk service is stateless in this phase: it holds no database and owns no
rows, so this folder carries the analyser rather than a data-access
repository. The naming mirrors the TypeScript services.
"""

from .risk_repository import UnbuiltRiskAnalyser, create_risk_analyser

__all__ = ["UnbuiltRiskAnalyser", "create_risk_analyser"]
