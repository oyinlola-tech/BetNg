import type { MatchEventKind } from "@betng/ui-core";
import { Corner } from "./Corner";
import { Foul } from "./Foul";
import { FreeKick } from "./FreeKick";
import { FullTime } from "./FullTime";
import { Goal } from "./Goal";
import { HalfTime } from "./HalfTime";
import type { FootballIconProps } from "./IconBase";
import { Kickoff } from "./Kickoff";
import { Offside } from "./Offside";
import { OwnGoal } from "./OwnGoal";
import { Penalty } from "./Penalty";
import { PenaltyMissed } from "./PenaltyMissed";
import { RedCard } from "./RedCard";
import { Shot } from "./Shot";
import { Substitution } from "./Substitution";
import { Var } from "./Var";
import { YellowCard } from "./YellowCard";

export type FootballIconComponent = (props: FootballIconProps) => React.JSX.Element;

const EVENT_ICONS: Readonly<Record<MatchEventKind, FootballIconComponent>> = {
  KICK_OFF: Kickoff,
  GOAL: Goal,
  OWN_GOAL: OwnGoal,
  PENALTY_GOAL: Penalty,
  PENALTY_MISSED: PenaltyMissed,
  VAR: Var,
  OFFSIDE: Offside,
  FOUL: Foul,
  FREE_KICK: FreeKick,
  YELLOW_CARD: YellowCard,
  RED_CARD: RedCard,
  SUBSTITUTION: Substitution,
  CORNER: Corner,
  SHOT: Shot,
  HALF_TIME: HalfTime,
  SECOND_HALF: Kickoff,
  FULL_TIME: FullTime,
};

const EVENT_TONES: Readonly<Record<MatchEventKind, string>> = {
  KICK_OFF: "text-text-muted",
  GOAL: "text-text-primary",
  OWN_GOAL: "text-text-primary",
  PENALTY_GOAL: "text-text-primary",
  PENALTY_MISSED: "text-text-secondary",
  VAR: "text-info",
  OFFSIDE: "text-text-secondary",
  FOUL: "text-text-secondary",
  FREE_KICK: "text-text-secondary",
  YELLOW_CARD: "text-warning",
  RED_CARD: "text-danger",
  SUBSTITUTION: "text-text-secondary",
  CORNER: "text-text-secondary",
  SHOT: "text-text-secondary",
  HALF_TIME: "text-text-muted",
  SECOND_HALF: "text-text-muted",
  FULL_TIME: "text-text-muted",
};

export function eventIcon(kind: MatchEventKind): FootballIconComponent {
  return EVENT_ICONS[kind];
}

export function eventTone(kind: MatchEventKind): string {
  return EVENT_TONES[kind];
}
