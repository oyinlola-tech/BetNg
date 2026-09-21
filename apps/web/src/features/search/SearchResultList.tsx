import { Link } from "react-router";
import { LayoutList, SearchX, UserRound } from "lucide-react";
import type { SearchHit } from "@betng/ui-core";
import { EmptyState, ErrorState, Football, LeagueMark, SkeletonRows, TeamCrest, cn } from "@betng/ui-web";
import { useLeagues, useTeams } from "../../hooks/queries";
import { searchHitPath } from "../../lib/paths";
import { KIND_LABEL, type SearchState } from "./useSearchResults";

export function hitDomId(listId: string, hit: SearchHit): string {
  return `${listId}-${hit.kind}-${hit.id}`;
}

function HitIcon({ hit }: { readonly hit: SearchHit }): React.JSX.Element {
  const needsTeam = hit.teamId !== undefined && (hit.kind === "TEAM" || hit.kind === "PLAYER");
  const teams = useTeams(undefined, { enabled: needsTeam });
  const leagues = useLeagues();
  const team = needsTeam ? teams.data?.find((entry) => entry.id === hit.teamId) : undefined;
  const league = hit.kind === "LEAGUE" ? leagues.data?.find((entry) => entry.id === (hit.leagueId ?? hit.id)) : undefined;

  if (hit.kind === "TEAM" && team !== undefined) return <TeamCrest team={team} size={24} decorative />;
  if (league !== undefined) return <LeagueMark slug={league.slug} code={league.code} size={24} />;
  if (hit.kind === "PLAYER") return <UserRound className="size-5 text-text-muted" aria-hidden />;
  if (hit.kind === "MARKET") return <LayoutList className="size-5 text-text-muted" aria-hidden />;

  return <Football size={20} className="text-text-muted" aria-hidden />;
}

export interface SearchResultListProps {
  readonly state: SearchState;
  readonly listId: string;
  readonly activeId?: string | undefined;
  readonly onPick?: ((hit: SearchHit) => void) | undefined;
  readonly onHover?: ((hit: SearchHit) => void) | undefined;
  readonly idle?: React.ReactNode;
  readonly className?: string;
}

export function SearchResultList({ state, listId, activeId, onPick, onHover, idle, className }: SearchResultListProps): React.JSX.Element {
  if (state.status === "idle") return <div className={className}>{idle}</div>;

  if (state.status === "loading") {
    return (
      <div className={className} role="status" aria-label="Searching">
        <SkeletonRows rows={5} />
      </div>
    );
  }

  if (state.status === "unavailable") {
    return (
      <EmptyState
        compact
        icon={<SearchX className="size-5" />}
        title="Search is not available yet"
        description="The platform does not serve search at the moment. Browse by competition instead."
        className={className}
      />
    );
  }

  if (state.status === "error") return <ErrorState compact error={state.error} onRetry={state.retry} className={className} />;

  if (state.status === "empty") return <EmptyState compact preset="noSearchResults" className={className} />;

  return (
    <div id={listId} role="listbox" aria-label="Search results" className={className}>
      {state.groups.map((group) => (
        <div key={group.kind} role="group" aria-label={KIND_LABEL[group.kind]} className="py-1.5">
          <p className="type-caption px-3 py-1.5">{KIND_LABEL[group.kind]}</p>
          {group.hits.map((hit) => {
            const id = hitDomId(listId, hit);
            const to = searchHitPath(hit);
            const active = id === activeId;
            const body = (
              <>
                <span className="flex size-8 shrink-0 items-center justify-center">
                  <HitIcon hit={hit} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-text-primary">{hit.title}</span>
                  {hit.subtitle !== undefined && <span className="block truncate text-sm text-text-muted">{hit.subtitle}</span>}
                </span>
              </>
            );
            const rowClass = cn(
              "flex min-h-11 w-full items-center gap-3 rounded-sm px-3 py-1.5 text-left",
              active ? "bg-brand-subtle" : "hover:bg-surface-hover",
            );

            return to === undefined ? (
              <div key={id} id={id} role="option" aria-selected={active} aria-disabled className={rowClass}>
                {body}
              </div>
            ) : (
              <Link
                key={id}
                id={id}
                role="option"
                aria-selected={active}
                to={to}
                tabIndex={-1}
                onClick={() => onPick?.(hit)}
                onMouseEnter={() => onHover?.(hit)}
                className={cn(rowClass, "focus-ring")}
              >
                {body}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
