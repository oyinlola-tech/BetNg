"""Seed derivation.

A seed is a function of the match, the model and the configuration, and of
nothing else, so the same three inputs always replay the same match.
"""

from __future__ import annotations

import hashlib
import random


def derive_seed(match_id: str, model_version: str, configuration_version: int) -> str:
    """Return sha256 of ``match_id:model_version:configuration_version``."""
    material = f"{match_id}:{model_version}:{configuration_version}"

    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def create_prng(seed: str) -> random.Random:
    """Return the PRNG seeded from a hex seed."""
    return random.Random(int(seed, 16))
