"""Request validation.

FastAPI validates each REST body, path and query parameter against the
Pydantic models in ``dtos``, and the RPC server validates each payload against
the same models. What is here covers the one input those cannot describe.
"""

from .odds_validator import parse_match_ids

__all__ = ["parse_match_ids"]
