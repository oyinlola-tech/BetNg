"""Sampling on ``Random.random`` alone: the one method stable across Pythons."""

from __future__ import annotations

import math
import random
from collections.abc import Sequence


def sample_index(rng: random.Random, size: int) -> int:
    """Draw a uniform index below ``size``."""
    if size < 1:
        raise ValueError("Cannot sample from an empty range.")

    return min(int(rng.random() * size), size - 1)


def sample_int(rng: random.Random, low: int, high: int) -> int:
    """Draw a uniform integer in ``[low, high]``."""
    return low + sample_index(rng, high - low + 1)


def sample_bool(rng: random.Random, probability: float) -> bool:
    """Draw ``True`` with the given probability."""
    return rng.random() < probability


def sample_choice[T](rng: random.Random, items: Sequence[T]) -> T:
    """Draw one item uniformly."""
    return items[sample_index(rng, len(items))]


def sample_weighted[T](
    rng: random.Random, items: Sequence[T], weights: Sequence[float]
) -> T:
    """Draw by inverse CDF; uniform when every weight is zero."""
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
