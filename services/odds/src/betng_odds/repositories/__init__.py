"""Concrete implementations of the odds pricing contract.

The odds service is stateless in this phase: it holds no database and owns no
rows, so this folder carries the pricer rather than a data-access repository.
The naming mirrors the TypeScript services.
"""

from .odds_repository import UnbuiltOddsPricer, create_odds_pricer

__all__ = ["UnbuiltOddsPricer", "create_odds_pricer"]
