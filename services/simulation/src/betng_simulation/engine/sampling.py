"""Sampling primitives built on ``Random.random`` alone.

``Random.random`` is the one generator method whose output for a given seed is
stable across Python versions. The higher-level helpers (``choices``,
``randint``, ``shuffle``) are free to change their algorithm, which would
silently change every replayed match.
"""

from __future__ import annotations

import math
import random
from collections.abc import Sequence
from typing import TypeVar

T = TypeVar("T")


def sample_index(rng: random.Random, size: int) -> int:
    if size < 1:
        raise ValueError("Cannot sample from an empty range.")

    return min(int(rng.random() * size), size - 1)


def sample_int(rng: random.Random, low: int, high: int) -> int:
    """Uniform integer in ``[low, high]``."""
    return low + sample_index(rng, high - low + 1)


def sample_bool(rng: random.Random, probability: float) -> bool:
    return rng.random() < probability


def sample_choice(rng: random.Random, items: Sequence[T]) -> T:
    return items[sample_index(rng, len(items))]


def sample_weighted(
    rng: random.Random, items: Sequence[T], weights: Sequence[float]
) -> T:
    """Inverse-CDF draw. Falls back to uniform when every weight is zero."""
    total = sum(weights)

    if total <= 0:
        return sample_choice(rng, items)

    target = rng.random() * total
    cumulative = 0.0

    for item, weight in zip(items, weights, strict=True):
        cumulative += weight
        if target < cumulative:
            return item

    return items[-1]


def sample_poisson(rng: random.Random, mean: float, cap: int) -> int:
    """Knuth's multiplication method, bounded by ``cap``."""
    if mean <= 0 or cap <= 0:
        return 0

    threshold = math.exp(-mean)
    count = 0
    product = rng.random()

    while product > threshold and count < cap:
        count += 1
        product *= rng.random()

    return count
