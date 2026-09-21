from __future__ import annotations

import math
import random
from collections.abc import Sequence


def sample_index(rng: random.Random, size: int) -> int:
    if size < 1:
        raise ValueError("Cannot sample from an empty range.")

    return min(int(rng.random() * size), size - 1)


def sample_int(rng: random.Random, low: int, high: int) -> int:
    return low + sample_index(rng, high - low + 1)


def sample_bool(rng: random.Random, probability: float) -> bool:
    return rng.random() < probability


def sample_choice[T](rng: random.Random, items: Sequence[T]) -> T:
    return items[sample_index(rng, len(items))]


def sample_weighted[T](
    rng: random.Random, items: Sequence[T], weights: Sequence[float]
) -> T:
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
    if mean <= 0 or cap <= 0:
        return 0

    threshold = math.exp(-mean)
    count = 0
    product = rng.random()

    while product > threshold and count < cap:
        count += 1
        product *= rng.random()

    return count
