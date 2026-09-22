import { Minus, Plus, Star } from "lucide-react";
import type { LeagueView, TeamView } from "@betng/ui-core";
import { ErrorPanel, Focusable, Skeleton, TeamMark } from "../components";
import { useAsync } from "../hooks/useAsync";
import { HOUR_OPTIONS } from "../lib/ambient";
import { cn } from "../lib/cn";
import { AMBIENT_OPTIONS, BRIGHTNESS_OPTIONS, COOLDOWN_OPTIONS, cycle, useDisplaySettings, VOLUME_MAX } from "../lib/displaySettings";
import { toggleFavourite, useFavourites } from "../lib/favourites";
import { reads } from "../lib/reads";

function Setting({
  label,
  hint,
  value,
  onPress,
  pressed,
  autoFocus = false,
}: {
  readonly label: string;
  readonly hint: string;
  readonly value: string;
  readonly onPress: () => void;
  readonly pressed?: boolean;
  readonly autoFocus?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      onClick={onPress}
      autoFocusOnMount={autoFocus}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className="flex w-full items-center gap-[1rem] border border-border bg-surface px-[1.2rem] py-[0.7rem] text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[1.1rem] font-bold">{label}</span>
        <span className="block truncate text-[0.85rem] text-text-muted">{hint}</span>
      </span>
      <span className={cn("shrink-0 rounded-xs px-[0.7rem] py-[0.2rem] font-display text-[1.05rem] font-black tabular", pressed === true ? "bg-brand text-text-on-brand" : "bg-surface-sunken text-text-secondary")}>{value}</span>
    </Focusable>
  );
}

function Teams({ leagues, teams }: { readonly leagues: readonly LeagueView[]; readonly teams: readonly TeamView[] }): React.JSX.Element {
  const favourites = useFavourites();

  return (
    <div className="space-y-[1rem]">
      {leagues.map((league) => (
        <section key={league.id} aria-label={league.name}>
          <h3 className="caps-label mb-[0.4rem]">{league.name}</h3>
          <div className="grid grid-cols-3 gap-[0.5rem]">
            {teams
              .filter((t) => t.leagueId === league.id)
              .map((team) => {
                const on = favourites.has(team.id);

                return (
                  <Focusable
                    key={team.id}
                    aria-pressed={on}
                    aria-label={`${on ? "Unfollow" : "Follow"} ${team.name}`}
                    onClick={() => {
                      toggleFavourite(team.id);
                    }}
                    className={cn("flex w-full items-center gap-[0.6rem] border px-[0.7rem] py-[0.45rem] text-left text-[0.95rem] font-semibold", on ? "border-warning bg-warning-subtle" : "border-border bg-surface")}
                  >
                    <TeamMark team={team} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{team.name}</span>
                    <Star className={cn("size-[1.1rem] shrink-0", on ? "fill-current text-warning" : "text-text-muted")} aria-hidden />
                  </Focusable>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SettingsScreen(): React.JSX.Element {
  const [s, update] = useDisplaySettings();
  const leagues = useAsync(() => reads.listLeagues(), [], 60_000);
  const teams = useAsync(() => reads.listTeams(), [], 60_000);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-[1.4rem]">
      <div className="-mx-[0.6rem] min-h-0 space-y-[1.2rem] overflow-y-auto px-[0.6rem] py-[0.4rem]">
        <div>
          <p className="caps-label">This display</p>
          <h1 className="font-display text-[2.2rem] font-black tracking-tight">Settings</h1>
          <p className="text-[0.9rem] text-text-muted">Stored on this device only.</p>
        </div>
        <section aria-label="Sound" className="space-y-[0.5rem]">
          <h2 className="caps-label">Sound</h2>
          <Setting
            label="Sound effects"
            hint="Crowd, goal and whistle, made on this display from the match events"
            value={s.audioEnabled ? "On" : "Off"}
            pressed={s.audioEnabled}
            autoFocus
            onPress={() => {
              update((c) => ({ ...c, audioEnabled: !c.audioEnabled }));
            }}
          />
          <div className="flex items-center gap-[0.5rem]">
            <Focusable
              aria-label="Volume down"
              onClick={() => {
                update((c) => ({ ...c, volume: Math.max(0, c.volume - 1) }));
              }}
              className="border border-border bg-surface p-[0.7rem]"
            >
              <Minus className="size-[1.3rem]" aria-hidden />
            </Focusable>
            <div className="flex flex-1 items-center gap-[0.8rem] border border-border bg-surface px-[1.2rem] py-[0.7rem]">
              <span className="text-[1.1rem] font-bold">Volume</span>
              <span className="h-[0.5rem] flex-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                <span className="block h-full bg-brand" style={{ width: `${String((s.volume / VOLUME_MAX) * 100)}%` }} />
              </span>
              <span className="font-display text-[1.1rem] font-black tabular">
                {s.volume} / {VOLUME_MAX}
              </span>
            </div>
            <Focusable
              aria-label="Volume up"
              onClick={() => {
                update((c) => ({ ...c, volume: Math.min(VOLUME_MAX, c.volume + 1) }));
              }}
              className="border border-border bg-surface p-[0.7rem]"
            >
              <Plus className="size-[1.3rem]" aria-hidden />
            </Focusable>
          </div>
        </section>
        <section aria-label="Broadcast" className="space-y-[0.5rem]">
          <h2 className="caps-label">Broadcast</h2>
          <Setting
            label="Quiet mode"
            hint="Only goals, red cards and full time in overlays, commentary and sound"
            value={s.quietMode ? "On" : "Off"}
            pressed={s.quietMode}
            onPress={() => {
              update((c) => ({ ...c, quietMode: !c.quietMode }));
            }}
          />
          <Setting
            label="Full screen on a goal"
            hint="In Multi-match, a goal takes its match full screen for 15 seconds"
            value={s.autoSwitchOnGoal ? "On" : "Off"}
            pressed={s.autoSwitchOnGoal}
            onPress={() => {
              update((c) => ({ ...c, autoSwitchOnGoal: !c.autoSwitchOnGoal }));
            }}
          />
          <Setting
            label="Goal switch cooldown"
            hint="The shortest time between two automatic switches"
            value={`${String(s.autoSwitchCooldownSec)}s`}
            onPress={() => {
              update((c) => ({ ...c, autoSwitchCooldownSec: cycle(COOLDOWN_OPTIONS, c.autoSwitchCooldownSec as (typeof COOLDOWN_OPTIONS)[number]) }));
            }}
          />
          <Setting
            label="Screensaver"
            hint="Rotating statistics after this long without a key press, while nothing is in play"
            value={s.ambientAfterMin === 0 ? "Off" : `${String(s.ambientAfterMin)} min`}
            onPress={() => {
              update((c) => ({ ...c, ambientAfterMin: cycle(AMBIENT_OPTIONS, c.ambientAfterMin as (typeof AMBIENT_OPTIONS)[number]) }));
            }}
          />
        </section>
        <section aria-label="Dimming" className="space-y-[0.5rem]">
          <h2 className="caps-label">Night dimming</h2>
          <Setting
            label="Dim on a schedule"
            hint={`From ${s.dim.start} to ${s.dim.end} at ${String(Math.round(s.dim.brightness * 100))}% brightness`}
            value={s.dim.enabled ? "On" : "Off"}
            pressed={s.dim.enabled}
            onPress={() => {
              update((c) => ({ ...c, dim: { ...c.dim, enabled: !c.dim.enabled } }));
            }}
          />
          <div className="grid grid-cols-3 gap-[0.5rem]">
            <Setting
              label="Starts"
              hint="Hour"
              value={s.dim.start}
              onPress={() => {
                update((c) => ({ ...c, dim: { ...c.dim, start: cycle(HOUR_OPTIONS, c.dim.start) } }));
              }}
            />
            <Setting
              label="Ends"
              hint="Hour"
              value={s.dim.end}
              onPress={() => {
                update((c) => ({ ...c, dim: { ...c.dim, end: cycle(HOUR_OPTIONS, c.dim.end) } }));
              }}
            />
            <Setting
              label="Level"
              hint="Brightness"
              value={`${String(Math.round(s.dim.brightness * 100))}%`}
              onPress={() => {
                update((c) => ({ ...c, dim: { ...c.dim, brightness: cycle(BRIGHTNESS_OPTIONS, c.dim.brightness as (typeof BRIGHTNESS_OPTIONS)[number]) } }));
              }}
            />
          </div>
        </section>
      </div>
      <section aria-label="Favourite teams" className="flex min-h-0 flex-col">
        <h2 className="caps-label">Favourite teams</h2>
        <p className="mb-[0.6rem] text-[0.9rem] text-text-muted">Followed teams are starred on the table, the schedule and Multi-match, and their live matches come first.</p>
        <div className="-mx-[0.6rem] min-h-0 flex-1 overflow-y-auto px-[0.6rem] py-[0.4rem]">
          {(leagues.error !== undefined && leagues.data === undefined) || (teams.error !== undefined && teams.data === undefined) ? (
            <ErrorPanel title="Teams could not be loaded" />
          ) : leagues.data === undefined || teams.data === undefined ? (
            <Skeleton className="h-[20rem]" />
          ) : (
            <Teams leagues={leagues.data} teams={teams.data} />
          )}
        </div>
      </section>
    </div>
  );
}
