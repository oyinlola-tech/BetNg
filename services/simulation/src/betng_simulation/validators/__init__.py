"""Request checks that are not expressed by a body schema.

FastAPI validates each body, path and query value against the Pydantic models
in ``dtos``; what remains is who is calling.
"""

from .actor_validator import require_admin

__all__ = ["require_admin"]
