"""The concrete analytics reader.

Analytics owns no rows, so this folder carries a reader over the other
services' schemas rather than a repository of its own tables.
"""

from .analytics_repository import PostgresAnalyticsReader, create_analytics_reader

__all__ = ["PostgresAnalyticsReader", "create_analytics_reader"]
