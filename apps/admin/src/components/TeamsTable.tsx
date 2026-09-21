import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { AdminTeam, TeamRatings } from "@betng/contracts";
import { formatRelative } from "@betng/ui-core";
import { Button, DataTable, Drawer, Input, Panel, SearchInput, Select, Switch, cn, type Column } from "@betng/ui-web";
import { useAdminAction, useTeams } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { adminSource } from "../services/sources";
import { FilterBar, Mono, Status } from "./Bits";

const RATING_FIELDS: readonly { readonly key: Exclude<keyof TeamRatings, "form">; readonly label: string; readonly help: string }[] = [
  { key: "attack", label: "Attack", help: "Raises the number of chances the team creates, and so its expected goals." },
  { key: "midfield", label: "Midfield", help: "Drives possession share and how often attacks reach the final third." },
  { key: "defence", label: "Defence", help: "Lowers the opponent's chance quality and expected goals." },
  { key: "goalkeeper", label: "Goalkeeper", help: "Lowers the share of the opponent's shots on target that become goals." },
  { key: "pace", label: "Pace", help: "Raises dangerous attacks and counter-attacks, mostly when playing away." },
  { key: "finishing", label: "Finishing", help: "Raises the share of the team's own shots on target that become goals." },
];

function inkOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;

  return luminance > 0.62 ? "#111111" : "#FFFFFF";
}

export function overall(r: TeamRatings): number {
  return Math.round(r.attack * 0.22 + r.midfield * 0.2 + r.defence * 0.22 + r.goalkeeper * 0.12 + r.pace * 0.1 + r.finishing * 0.14 + r.form * 0.3);
}

function RatingInput({ label, help, value, min, max, onChange, disabled }: { readonly label: string; readonly help: string; readonly value: number; readonly min: number; readonly max: number; readonly onChange: (value: number) => void; readonly disabled: boolean }): React.JSX.Element {
  const id = `rating-${label.toLowerCase()}`;
  const clamp = (raw: number): number => (Number.isFinite(raw) ? Math.max(min, Math.min(max, Math.round(raw))) : value);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-base font-medium text-text-primary">
          {label}
        </label>
        <input
          type="number"
          aria-label={`${label} value`}
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(clamp(event.target.valueAsNumber))}
          className="h-8 w-16 rounded-sm border border-border bg-surface-sunken px-2 text-right text-base tabular outline-none focus:border-brand disabled:opacity-50"
        />
      </div>
      <input id={id} type="range" min={min} max={max} value={value} disabled={disabled} aria-describedby={`${id}-help`} onChange={(event) => onChange(clamp(event.target.valueAsNumber))} className="mt-1.5 h-1.5 w-full cursor-pointer accent-[var(--bn-brand)] disabled:cursor-not-allowed disabled:opacity-50" />
      <p id={`${id}-help`} className="mt-1 text-sm text-text-muted">
        {help}
      </p>
    </div>
  );
}

function TeamDrawer({ team, onClose }: { readonly team: AdminTeam | undefined; readonly onClose: () => void }): React.JSX.Element {
  const { can } = useAdmin();
  const editable = can("catalogue:write");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [active, setActive] = useState(true);
  const [ratings, setRatings] = useState<TeamRatings | undefined>();
  const save = useAdminAction({
    run: (input: { readonly id: string; readonly name: string; readonly shortName: string; readonly status: "ACTIVE" | "INACTIVE"; readonly ratings: TeamRatings }) =>
      adminSource.updateTeam(input.id, { name: input.name, shortName: input.shortName, status: input.status, ratings: input.ratings }),
    success: (saved) => `${saved.name} updated`,
    onDone: onClose,
  });

  useEffect(() => {
    if (team === undefined) return;
    setName(team.name);
    setShortName(team.shortName);
    setActive(team.status === "ACTIVE");
    setRatings(team.ratings);
  }, [team]);

  const dirty = team !== undefined && ratings !== undefined && (name !== team.name || shortName !== team.shortName || active !== (team.status === "ACTIVE") || JSON.stringify(ratings) !== JSON.stringify(team.ratings));
  const valid = name.trim().length > 0 && shortName.trim().length >= 2 && shortName.trim().length <= 12;

  return (
    <Drawer
      open={team !== undefined}
      onClose={onClose}
      size="lg"
      title={team?.name ?? ""}
      description={team === undefined ? "" : `${team.leagueName} · ${team.code}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            {editable ? "Cancel" : "Close"}
          </Button>
          {editable && (
            <Button
              loading={save.isPending}
              disabled={!dirty || !valid}
              onClick={() => {
                if (team !== undefined && ratings !== undefined) save.mutate({ id: team.id, name: name.trim(), shortName: shortName.trim(), status: active ? "ACTIVE" : "INACTIVE", ratings });
              }}
            >
              Save team
            </Button>
          )}
        </>
      }
    >
      {team !== undefined && ratings !== undefined && (
        <div className="space-y-6">
          <p className="flex items-start gap-2.5 rounded-sm border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-secondary">
            <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>
              These values are <strong className="font-semibold text-text-primary">inputs to the simulation</strong>. They move probabilities and therefore prices; they never decide a result. Each match is still drawn by the simulation service, and changes apply only to fixtures whose run has not been prepared.
            </span>
          </p>

          <section className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Input label="Name" value={name} disabled={!editable} onChange={(event) => setName(event.target.value)} />
            <Input label="Short name" value={shortName} disabled={!editable} hint="2 to 12 characters" onChange={(event) => setShortName(event.target.value)} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-text-secondary">Logo</p>
              <span
                role="img"
                aria-label={`${team.name} generated badge`}
                className="flex size-10 items-center justify-center rounded-full font-display text-xs font-bold"
                style={{ background: team.colors.primary, color: inkOn(team.colors.primary), boxShadow: `inset 0 0 0 2px ${team.colors.secondary}` }}
              >
                {team.code}
              </span>
            </div>
          </section>
          <Switch checked={active} onChange={setActive} disabled={!editable} label="Active" description="Inactive teams are left out of future fixture generation." />

          <section>
            <div className="mb-3 flex items-end justify-between border-b border-border pb-2">
              <h3 className="font-display text-md font-semibold">Ratings</h3>
              <p className="text-sm text-text-muted">
                Overall <span className={cn("ml-1 font-display text-xl font-bold tabular text-text-primary")}>{overall(ratings)}</span>
              </p>
            </div>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {RATING_FIELDS.map((field) => (
                <RatingInput key={field.key} label={field.label} help={field.help} min={1} max={99} value={ratings[field.key]} disabled={!editable} onChange={(value) => setRatings({ ...ratings, [field.key]: value })} />
              ))}
              <RatingInput label="Form" help="Recent results, from -10 (poor run) to +10 (excellent run). A small modifier on every rating above, refreshed by the platform after each matchday." min={-10} max={10} value={ratings.form} disabled={!editable} onChange={(value) => setRatings({ ...ratings, form: value })} />
            </div>
          </section>
          <p className="text-sm text-text-muted">Last updated {formatRelative(team.updatedAt)}.</p>
        </div>
      )}
    </Drawer>
  );
}

export function TeamsTable({ leagueId, initialTeamId }: { readonly leagueId?: string; readonly initialTeamId?: string | undefined }): React.JSX.Element {
  const teams = useTeams(leagueId);
  const [q, setQ] = useState("");
  const [league, setLeague] = useState("ALL");
  const [selectedId, setSelectedId] = useState(initialTeamId);
  const leagueNames = useMemo(() => [...new Set((teams.data ?? []).map((t) => t.leagueName))], [teams.data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return teams.data?.filter((t) => (league === "ALL" || t.leagueName === league) && (needle === "" || `${t.name} ${t.shortName} ${t.code}`.toLowerCase().includes(needle)));
  }, [teams.data, q, league]);

  const rating = (key: keyof TeamRatings, header: string, hide?: "md" | "lg" | "xl"): Column<AdminTeam> => ({
    key,
    header,
    numeric: true,
    sortValue: (t) => t.ratings[key],
    cell: (t) => (key === "form" ? <span className={cn(t.ratings.form > 0 ? "text-success" : t.ratings.form < 0 ? "text-danger" : "text-text-muted")}>{t.ratings.form > 0 ? `+${String(t.ratings.form)}` : t.ratings.form}</span> : t.ratings[key]),
    ...(hide === undefined ? {} : { hideBelow: hide }),
  });

  const columns: readonly Column<AdminTeam>[] = [
    {
      key: "team",
      header: "Team",
      sortValue: (t) => t.name,
      cell: (t) => (
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: t.colors.primary, color: inkOn(t.colors.primary), boxShadow: `inset 0 0 0 1.5px ${t.colors.secondary}` }}>
            {t.code}
          </span>
          <span className="whitespace-nowrap font-medium">{t.name}</span>
        </span>
      ),
    },
    { key: "code", header: "Code", cell: (t) => <Mono>{t.code}</Mono>, hideBelow: "md" },
    ...(leagueId === undefined ? [{ key: "league", header: "League", sortValue: (t: AdminTeam) => t.leagueName, cell: (t: AdminTeam) => <span className="whitespace-nowrap text-text-secondary">{t.leagueName}</span> }] : []),
    { key: "status", header: "Status", sortValue: (t) => t.status, cell: (t) => <Status value={t.status} /> },
    { key: "overall", header: "OVR", numeric: true, sortValue: (t) => overall(t.ratings), cell: (t) => <span className="font-display font-semibold">{overall(t.ratings)}</span> },
    rating("attack", "ATT"),
    rating("midfield", "MID", "md"),
    rating("defence", "DEF"),
    rating("goalkeeper", "GK", "lg"),
    rating("pace", "PAC", "lg"),
    rating("finishing", "FIN", "lg"),
    rating("form", "Form"),
  ];

  return (
    <>
      <Panel flush>
        <FilterBar>
          <SearchInput label="Search teams" placeholder="Search team or code" value={q} onChange={setQ} className="w-full sm:w-64" />
          {leagueId === undefined && <Select label="League" size="sm" value={league} onChange={setLeague} options={[{ value: "ALL", label: "All leagues" }, ...leagueNames.map((n) => ({ value: n, label: n }))]} />}
          <span className="ml-auto text-sm tabular text-text-muted">{rows === undefined ? "" : `${String(rows.length)} teams`}</span>
        </FilterBar>
        <DataTable
          caption="Teams"
          columns={columns}
          rows={rows}
          rowKey={(t) => t.id}
          loading={teams.isLoading}
          error={teams.error}
          onRetry={() => void teams.refetch()}
          onRowClick={(t) => setSelectedId(t.id)}
          selectedKey={selectedId}
          initialSort={{ key: "overall", direction: "desc" }}
          pageSize={20}
          empty={{ title: "No teams match" }}
        />
      </Panel>
      <TeamDrawer team={teams.data?.find((t) => t.id === selectedId)} onClose={() => setSelectedId(undefined)} />
    </>
  );
}
