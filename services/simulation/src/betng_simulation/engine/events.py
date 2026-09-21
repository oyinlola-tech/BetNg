"""Timeline and statistics generation.

The score is fixed before this module runs. It decides *when* things happen
and *who* is involved, never *how many goals* there are: the timeline carries
exactly the goals of the sampled score.

Minutes are drawn first and the match is then walked in order, so who is on
the pitch is always known: a player who was sent off or substituted cannot
score afterwards, and a substitute cannot score before coming on.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Final

from .models import (
    FIRST_PLAYING_MINUTE,
    FULL_TIME_MINUTE,
    HALF_TIME_MINUTE,
    KICK_OFF_MINUTE,
    SECOND_HALF_MINUTE,
    EventType,
    MatchEventDraft,
    MatchStats,
    ModelConfiguration,
    Side,
    SideStats,
    SimulationTeam,
)
from .players import Player, squad_for
from .probabilities import defensive_rating, offensive_rating
from .sampling import (
    sample_bool,
    sample_choice,
    sample_int,
    sample_poisson,
    sample_weighted,
)

MAX_DESCRIPTION_LENGTH: Final = 240
EVEN_POSSESSION: Final = 50
FULL_POSSESSION: Final = 100


@dataclass(frozen=True)
class _Slot:
    minute: int
    tie_break: float
    type: EventType
    side: Side


@dataclass
class _Lineup:
    team: SimulationTeam
    on_pitch: list[Player]
    bench: list[Player]
    booked: set[str] = field(default_factory=set)
    introduced: set[str] = field(default_factory=set)


@dataclass
class _Timeline:
    home: _Lineup
    away: _Lineup
    events: list[MatchEventDraft] = field(default_factory=list)
    score_home: int = 0
    score_away: int = 0

    def lineup(self, side: Side) -> _Lineup:
        return self.home if side == "HOME" else self.away

    def scoreline(self) -> str:
        return (
            f"{self.home.team.short_name} {self.score_home}-{self.score_away} "
            f"{self.away.team.short_name}"
        )

    def add(
        self,
        minute: int,
        event_type: EventType,
        description: str,
        *,
        side: Side | None = None,
        player: str | None = None,
        secondary_player: str | None = None,
    ) -> None:
        self.events.append(
            MatchEventDraft(
                sequence=len(self.events) + 1,
                minute=minute,
                type=event_type,
                side=side,
                player=player,
                secondary_player=secondary_player,
                score_home=self.score_home,
                score_away=self.score_away,
                description=description[:MAX_DESCRIPTION_LENGTH],
            )
        )


def _goal_minute(rng: random.Random, configuration: ModelConfiguration) -> int:
    if sample_bool(rng, configuration.first_half_goal_share):
        return sample_int(rng, FIRST_PLAYING_MINUTE, HALF_TIME_MINUTE)

    return sample_int(rng, SECOND_HALF_MINUTE, FULL_TIME_MINUTE)


def _corner_mean(
    attacking: SimulationTeam,
    defending: SimulationTeam,
    configuration: ModelConfiguration,
) -> float:
    gap = (
        offensive_rating(attacking.strength, configuration)
        - defensive_rating(defending.strength, configuration)
    ) / configuration.rating_scale

    return max(
        configuration.corners_per_team
        * (1.0 + configuration.corner_attack_weight * gap),
        0.0,
    )


def _draw_slots(
    rng: random.Random,
    home: SimulationTeam,
    away: SimulationTeam,
    goals: dict[Side, int],
    configuration: ModelConfiguration,
) -> list[_Slot]:
    slots: list[_Slot] = []
    sides: tuple[tuple[Side, SimulationTeam, SimulationTeam], ...] = (
        ("HOME", home, away),
        ("AWAY", away, home),
    )

    def place(minute: int, event_type: EventType, side: Side) -> None:
        slots.append(_Slot(minute, rng.random(), event_type, side))

    for side, team, opponent in sides:
        for _ in range(goals[side]):
            place(_goal_minute(rng, configuration), "GOAL", side)

        yellow_cards = sample_poisson(
            rng,
            configuration.yellow_cards_per_team,
            configuration.max_yellow_cards_per_team,
        )
        for _ in range(yellow_cards):
            place(
                sample_int(rng, FIRST_PLAYING_MINUTE, FULL_TIME_MINUTE),
                "YELLOW_CARD",
                side,
            )

        if sample_bool(rng, configuration.red_card_probability):
            place(
                sample_int(rng, FIRST_PLAYING_MINUTE, FULL_TIME_MINUTE),
                "RED_CARD",
                side,
            )

        corners = sample_poisson(
            rng,
            _corner_mean(team, opponent, configuration),
            configuration.max_corners_per_team,
        )
        for _ in range(corners):
            place(
                sample_int(rng, FIRST_PLAYING_MINUTE, FULL_TIME_MINUTE),
                "CORNER",
                side,
            )

        substitutions = sample_int(
            rng, configuration.min_substitutions, configuration.max_substitutions
        )
        for _ in range(substitutions):
            place(
                sample_int(rng, SECOND_HALF_MINUTE, FULL_TIME_MINUTE),
                "SUBSTITUTION",
                side,
            )

    return sorted(slots, key=lambda slot: (slot.minute, slot.tie_break))


def _scorer_weight(player: Player, configuration: ModelConfiguration) -> float:
    if player.position == "FORWARD":
        return configuration.scorer_weight_forward
    if player.position == "MIDFIELDER":
        return configuration.scorer_weight_midfielder
    if player.position == "DEFENDER":
        return configuration.scorer_weight_defender

    return 0.0


def _outfield(players: list[Player]) -> list[Player]:
    return [player for player in players if player.position != "GOALKEEPER"]


def _play_goal(
    rng: random.Random,
    timeline: _Timeline,
    slot: _Slot,
    configuration: ModelConfiguration,
) -> None:
    lineup = timeline.lineup(slot.side)
    candidates = _outfield(lineup.on_pitch)
    scorer = sample_weighted(
        rng,
        candidates,
        [_scorer_weight(player, configuration) for player in candidates],
    )

    assist: Player | None = None
    if sample_bool(rng, configuration.assist_probability):
        others = [player for player in candidates if player is not scorer]
        if others:
            assist = sample_choice(rng, others)

    if slot.side == "HOME":
        timeline.score_home += 1
    else:
        timeline.score_away += 1

    credit = f", assisted by {assist.name}" if assist else ""
    timeline.add(
        slot.minute,
        "GOAL",
        f"Goal for {lineup.team.name}! {scorer.name} scores{credit}. "
        f"{timeline.scoreline()}.",
        side=slot.side,
        player=scorer.name,
        secondary_player=assist.name if assist else None,
    )


def _play_yellow_card(rng: random.Random, timeline: _Timeline, slot: _Slot) -> None:
    lineup = timeline.lineup(slot.side)
    candidates = [
        player for player in lineup.on_pitch if player.name not in lineup.booked
    ]

    if not candidates:
        return

    player = sample_choice(rng, candidates)
    lineup.booked.add(player.name)
    timeline.add(
        slot.minute,
        "YELLOW_CARD",
        f"Yellow card for {player.name} ({lineup.team.name}).",
        side=slot.side,
        player=player.name,
    )


def _play_red_card(rng: random.Random, timeline: _Timeline, slot: _Slot) -> None:
    lineup = timeline.lineup(slot.side)
    candidates = _outfield(lineup.on_pitch)

    if not candidates:
        return

    player = sample_choice(rng, candidates)
    lineup.on_pitch.remove(player)
    timeline.add(
        slot.minute,
        "RED_CARD",
        f"Red card! {player.name} ({lineup.team.name}) is sent off.",
        side=slot.side,
        player=player.name,
    )


def _play_substitution(rng: random.Random, timeline: _Timeline, slot: _Slot) -> None:
    lineup = timeline.lineup(slot.side)
    # A player who came on is not taken off again.
    leaving_candidates = [
        player
        for player in _outfield(lineup.on_pitch)
        if player.name not in lineup.introduced
    ]
    arriving_candidates = _outfield(lineup.bench)

    if not leaving_candidates or not arriving_candidates:
        return

    leaving = sample_choice(rng, leaving_candidates)
    like_for_like = [
        player for player in arriving_candidates if player.position == leaving.position
    ]
    arriving = sample_choice(rng, like_for_like or arriving_candidates)

    lineup.on_pitch[lineup.on_pitch.index(leaving)] = arriving
    lineup.bench.remove(arriving)
    lineup.introduced.add(arriving.name)
    timeline.add(
        slot.minute,
        "SUBSTITUTION",
        f"Substitution for {lineup.team.name}: {arriving.name} replaces "
        f"{leaving.name}.",
        side=slot.side,
        player=arriving.name,
        secondary_player=leaving.name,
    )


def _play(
    rng: random.Random,
    timeline: _Timeline,
    slot: _Slot,
    configuration: ModelConfiguration,
) -> None:
    if slot.type == "GOAL":
        _play_goal(rng, timeline, slot, configuration)
    elif slot.type == "YELLOW_CARD":
        _play_yellow_card(rng, timeline, slot)
    elif slot.type == "RED_CARD":
        _play_red_card(rng, timeline, slot)
    elif slot.type == "SUBSTITUTION":
        _play_substitution(rng, timeline, slot)
    else:
        team = timeline.lineup(slot.side).team
        timeline.add(slot.minute, "CORNER", f"Corner to {team.name}.", side=slot.side)


def _possession_share(
    rng: random.Random,
    home: SimulationTeam,
    away: SimulationTeam,
    configuration: ModelConfiguration,
) -> int:
    def control(team: SimulationTeam) -> float:
        return (
            team.strength.possession * configuration.possession_rating_weight
            + team.strength.midfield * configuration.possession_midfield_weight
        )

    home_control = control(home)
    total = home_control + control(away)
    share = (
        float(EVEN_POSSESSION) if total <= 0 else home_control / total * FULL_POSSESSION
    )
    share += (rng.random() * 2.0 - 1.0) * configuration.possession_noise

    return min(
        max(round(share), configuration.min_possession),
        FULL_POSSESSION - configuration.min_possession,
    )


def _count(events: list[MatchEventDraft], event_type: EventType, side: Side) -> int:
    return sum(1 for event in events if event.type == event_type and event.side == side)


def _side_stats(
    rng: random.Random,
    events: list[MatchEventDraft],
    side: Side,
    goals: int,
    possession: int,
    expected_goals: float,
    configuration: ModelConfiguration,
) -> SideStats:
    # A side that was expected to score more also shot more.
    pressure = expected_goals / configuration.base_goals
    yellow_cards = _count(events, "YELLOW_CARD", side)
    red_cards = _count(events, "RED_CARD", side)

    shots_on_target = goals + sample_poisson(
        rng,
        configuration.extra_shots_on_target_per_team * pressure,
        configuration.max_extra_shots,
    )
    shots = shots_on_target + sample_poisson(
        rng,
        configuration.shots_off_target_per_team * pressure,
        configuration.max_extra_shots,
    )

    return SideStats(
        possession=possession,
        shots=shots,
        shots_on_target=shots_on_target,
        corners=_count(events, "CORNER", side),
        # Every card follows a foul.
        fouls=yellow_cards
        + red_cards
        + sample_poisson(
            rng, configuration.fouls_per_team, configuration.max_extra_fouls
        ),
        offsides=sample_poisson(
            rng, configuration.offsides_per_team, configuration.max_offsides
        ),
        yellow_cards=yellow_cards,
        red_cards=red_cards,
    )


def generate_timeline(
    rng: random.Random,
    home: SimulationTeam,
    away: SimulationTeam,
    score: tuple[int, int],
    expected: tuple[float, float],
    configuration: ModelConfiguration,
) -> tuple[tuple[MatchEventDraft, ...], MatchStats]:
    """Build the timeline and final statistics for an already-decided score."""
    home_goals, away_goals = score
    home_squad = squad_for(home.team_id)
    away_squad = squad_for(away.team_id)
    timeline = _Timeline(
        home=_Lineup(home, list(home_squad.starters), list(home_squad.bench)),
        away=_Lineup(away, list(away_squad.starters), list(away_squad.bench)),
    )
    slots = _draw_slots(
        rng, home, away, {"HOME": home_goals, "AWAY": away_goals}, configuration
    )

    timeline.add(KICK_OFF_MINUTE, "KICK_OFF", f"Kick-off: {home.name} v {away.name}.")

    for slot in slots:
        if slot.minute <= HALF_TIME_MINUTE:
            _play(rng, timeline, slot, configuration)

    timeline.add(HALF_TIME_MINUTE, "HALF_TIME", f"Half-time: {timeline.scoreline()}.")
    timeline.add(SECOND_HALF_MINUTE, "SECOND_HALF", "The second half is under way.")

    for slot in slots:
        if slot.minute > HALF_TIME_MINUTE:
            _play(rng, timeline, slot, configuration)

    timeline.add(FULL_TIME_MINUTE, "FULL_TIME", f"Full-time: {timeline.scoreline()}.")

    home_possession = _possession_share(rng, home, away, configuration)
    stats = MatchStats(
        as_of_minute=FULL_TIME_MINUTE,
        home=_side_stats(
            rng,
            timeline.events,
            "HOME",
            home_goals,
            home_possession,
            expected[0],
            configuration,
        ),
        away=_side_stats(
            rng,
            timeline.events,
            "AWAY",
            away_goals,
            FULL_POSSESSION - home_possession,
            expected[1],
            configuration,
        ),
    )

    return tuple(timeline.events), stats
