"""Seed derivation: keyed, so public inputs alone cannot predict a result."""

from __future__ import annotations

import hashlib
import hmac
import random


def seed_material(match_id: str, model_version: str, configuration_version: int) -> str:
    """Return the un-keyed, storable string a seed is derived from."""
    return f"{match_id}:{model_version}:{configuration_version}"


def derive_seed(
    match_id: str,
    model_version: str,
    configuration_version: int,
    secret: str | None = None,
) -> str:
    """Return HMAC-SHA256 of the material under ``secret``; plain sha256 without one."""
    material = seed_material(match_id, model_version, configuration_version).encode()

    if secret is None:
        return hashlib.sha256(material).hexdigest()

    return hmac.new(secret.encode(), material, hashlib.sha256).hexdigest()


def create_prng(seed: str) -> random.Random:
    """Return the PRNG seeded from a hex seed."""
    return random.Random(int(seed, 16))
