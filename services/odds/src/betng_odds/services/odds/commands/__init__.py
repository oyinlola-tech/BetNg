"""The write side of the odds service."""

from .generate_odds import GenerateOddsCommand, GenerateOddsHandler

__all__ = ["GenerateOddsCommand", "GenerateOddsHandler"]
