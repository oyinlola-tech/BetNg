import type { PlayerMarkerView, TeamView } from "@betng/ui-core";

/*
 * One player, at the position the platform reported, in pitch coordinates.
 * Movement is a CSS transform between authoritative positions: it smooths the
 * trip between two reported points and never changes either of them.
 *
 * A card is shown because the platform reported a card; a player is dimmed
 * because the platform reported them sent off or substituted. Nothing here
 * reads a state out of an animation.
 */

export interface PlayerMarkerProps {
  readonly player: PlayerMarkerView;
  readonly team: TeamView;
  /** Shows the shirt number inside the marker and the name beneath it. */
  readonly labelled?: boolean;
  readonly radius?: number;
  readonly durationMs?: number;
}

export function PlayerMarker({
  player,
  team,
  labelled = false,
  radius = 2.1,
  durationMs = 700,
}: PlayerMarkerProps): React.JSX.Element {
  const inactive = player.sentOff || player.substituted;
  const primary = team.colors.primary;
  const secondary = team.colors.onPrimary;

  return (
    <g
      style={{
        transform: `translate(${String(player.position.x)}px, ${String(player.position.y)}px)`,
        transition:
          durationMs <= 0
            ? "none"
            : `transform ${String(durationMs)}ms cubic-bezier(0.33, 1, 0.68, 1)`,
        opacity: inactive ? 0.35 : 1,
      }}
      aria-hidden
    >
      <ellipse
        cx={radius * 0.2}
        cy={radius * 0.9}
        rx={radius * 0.85}
        ry={radius * 0.35}
        fill="rgb(0 0 0 / 0.25)"
      />
      <circle
        r={radius}
        fill={primary}
        stroke={secondary}
        strokeWidth={radius * 0.18}
      />

      {labelled && player.shirtNumber !== undefined && (
        <text
          y={radius * 0.38}
          textAnchor="middle"
          fill={secondary}
          style={{
            fontSize: `${String(radius * 1.05)}px`,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {player.shirtNumber}
        </text>
      )}

      {player.card !== undefined && (
        <rect
          x={radius * 0.55}
          y={-radius * 1.5}
          width={radius * 0.62}
          height={radius * 0.9}
          rx={radius * 0.12}
          fill={player.card === "RED" ? "#D7263D" : "#F2B705"}
          stroke="rgb(0 0 0 / 0.35)"
          strokeWidth={radius * 0.06}
        />
      )}

      {labelled && (
        <text
          y={radius * 2.4}
          textAnchor="middle"
          fill="rgb(255 255 255 / 0.9)"
          style={{
            fontSize: `${String(radius * 0.82)}px`,
            fontWeight: 600,
            paintOrder: "stroke",
            stroke: "rgb(0 0 0 / 0.5)",
            strokeWidth: radius * 0.16,
          }}
        >
          {player.name}
        </text>
      )}
    </g>
  );
}
