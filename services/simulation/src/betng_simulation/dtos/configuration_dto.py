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

#: Null is meaningful only here: it switches the low-score correction off.
NULLABLE_PARAMETERS = frozenset({"rho"})


class ModelParametersDto(ContractModel):
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
    effective_minutes: Annotated[float | None, _number(80, 130)] = None
    stoppage_first_half_base: Annotated[float | None, _number(0, 5)] = None
    stoppage_second_half_base: Annotated[float | None, _number(0, 8)] = None
    stoppage_per_goal: Annotated[float | None, _number(0, 2)] = None
    stoppage_per_card: Annotated[float | None, _number(0, 2)] = None
    stoppage_per_substitution: Annotated[float | None, _number(0, 2)] = None
    max_stoppage_first_half: Annotated[int | None, Field(ge=0, le=10)] = None
    max_stoppage_second_half: Annotated[int | None, Field(ge=0, le=15)] = None
    leading_attack_factor: Annotated[float | None, _number(0.5, 1.5)] = None
    trailing_attack_factor: Annotated[float | None, _number(0.5, 2)] = None
    counter_attack_factor: Annotated[float | None, _number(0.5, 2)] = None
    late_urgency_minute: Annotated[int | None, Field(ge=46, le=90)] = None
    late_urgency_factor: Annotated[float | None, _number(0.5, 2)] = None
    red_card_attack_penalty_min: Annotated[float | None, _number(0, 0.8)] = None
    red_card_attack_penalty_max: Annotated[float | None, _number(0, 0.8)] = None
    red_card_defence_penalty_min: Annotated[float | None, _number(0, 1.5)] = None
    red_card_defence_penalty_max: Annotated[float | None, _number(0, 1.5)] = None
    max_red_cards_per_team: Annotated[int | None, Field(ge=0, le=3)] = None
    booked_player_caution: Probability = None
    trailing_card_factor: Annotated[float | None, _number(0.5, 2)] = None
    momentum_boost: Annotated[float | None, _number(0, 1)] = None
    concede_vulnerability: Annotated[float | None, _number(0, 1)] = None
    momentum_minutes: Annotated[int | None, Field(ge=0, le=15)] = None
    possession_state_shift: Annotated[float | None, _number(0, 10)] = None
    possession_red_card_shift: Annotated[float | None, _number(0, 15)] = None
    pricing_simulations: Annotated[int | None, Field(ge=1000, le=50000)] = None
    weather_enabled: bool | None = None
    weather_severity: Probability = None
    pitch_quality: Annotated[float | None, _number(0.5, 1)] = None
    referee_strictness: Annotated[float | None, _number(0.5, 1.5)] = None
    referee_variance: Annotated[float | None, _number(0, 0.5)] = None
    fatigue_enabled: bool | None = None
    fatigue_onset_minute: Annotated[int | None, Field(ge=30, le=90)] = None
    fatigue_rate: Annotated[float | None, _number(0, 0.02)] = None
    formation_attack_modifier: Annotated[float | None, _number(0.5, 2)] = None
    formation_defence_modifier: Annotated[float | None, _number(0.5, 2)] = None
    formation_midfield_modifier: Annotated[float | None, _number(0.5, 2)] = None
    fatigue_rate_forward: Annotated[float | None, _number(0, 3)] = None
    fatigue_rate_midfielder: Annotated[float | None, _number(0, 3)] = None
    fatigue_rate_defender: Annotated[float | None, _number(0, 3)] = None
    fatigue_rate_goalkeeper: Annotated[float | None, _number(0, 3)] = None
    substitution_fresh_boost: Annotated[float | None, _number(0, 1)] = None

    @model_validator(mode="after")
    def _reject_explicit_nulls(self) -> Self:
        for name in self.model_fields_set - NULLABLE_PARAMETERS:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null.")

        return self
