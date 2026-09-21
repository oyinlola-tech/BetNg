"""The tunable parameters of the model, as they travel and as they are stored.

Every field is optional so the same shape serves a partial update and a stored
version. Bounds live here so an operator cannot store a configuration that
makes the engine meaningless or its output unbounded.
"""

from __future__ import annotations

from typing import Annotated, Any, Self

from pydantic import Field, model_validator

from .base_dto import ContractModel


def _number(low: float, high: float) -> Any:
    return Field(ge=low, le=high, allow_inf_nan=False)


Weight = Annotated[float | None, _number(0, 10)]
Probability = Annotated[float | None, _number(0, 1)]
Rate = Annotated[float | None, _number(0, 30)]
Cap = Annotated[int | None, Field(ge=0, le=40)]

#: The one parameter whose null is meaningful: it switches the low-score
#: correction off.
NULLABLE_PARAMETERS = frozenset({"rho"})


class ModelParametersDto(ContractModel):
    """Bounded model parameters; every field optional for partial updates."""

    base_goals: Annotated[float | None, _number(0.1, 5)] = None
    rating_scale: Annotated[float | None, _number(1, 1000)] = None
    strength_sensitivity: Annotated[float | None, _number(0, 10)] = None
    home_advantage_weight: Annotated[float | None, _number(0, 2)] = None
    form_weight: Annotated[float | None, _number(0, 0.2)] = None
    attack_weight: Annotated[float | None, _number(0.01, 10)] = None
    finishing_weight: Weight = None
    midfield_attack_weight: Weight = None
    pace_weight: Weight = None
    possession_attack_weight: Weight = None
    defence_weight: Annotated[float | None, _number(0.01, 10)] = None
    goalkeeping_weight: Weight = None
    midfield_defence_weight: Weight = None
    min_expected_goals: Annotated[float | None, _number(0.01, 5)] = None
    max_expected_goals: Annotated[float | None, _number(0.5, 8)] = None
    max_goals: Annotated[int | None, Field(ge=4, le=15)] = None
    rho: Annotated[float | None, _number(-0.2, 0.2)] = None
    first_half_goal_share: Probability = None
    assist_probability: Probability = None
    scorer_weight_forward: Weight = None
    scorer_weight_midfielder: Weight = None
    scorer_weight_defender: Weight = None
    yellow_cards_per_team: Rate = None
    max_yellow_cards_per_team: Annotated[int | None, Field(ge=0, le=9)] = None
    red_card_probability: Probability = None
    corners_per_team: Rate = None
    max_corners_per_team: Cap = None
    corner_attack_weight: Annotated[float | None, _number(0, 1)] = None
    min_substitutions: Annotated[int | None, Field(ge=0, le=5)] = None
    max_substitutions: Annotated[int | None, Field(ge=0, le=5)] = None
    possession_rating_weight: Weight = None
    possession_midfield_weight: Weight = None
    possession_noise: Annotated[float | None, _number(0, 15)] = None
    min_possession: Annotated[int | None, Field(ge=5, le=45)] = None
    extra_shots_on_target_per_team: Rate = None
    shots_off_target_per_team: Rate = None
    max_extra_shots: Cap = None
    fouls_per_team: Rate = None
    max_extra_fouls: Cap = None
    offsides_per_team: Rate = None
    max_offsides: Cap = None

    @model_validator(mode="after")
    def _reject_explicit_nulls(self) -> Self:
        for name in self.model_fields_set - NULLABLE_PARAMETERS:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")

        return self
