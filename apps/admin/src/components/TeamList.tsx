import { useEffect, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info } from "lucide-react";
import type { AdminTeam, TeamRatings } from "@betng/contracts";
import { formatRelative } from "@betng/ui-core";
import { Button, ConfirmationDialog, Drawer, FormError, Switch, TeamCrest, applyFieldErrors, type Column } from "@betng/ui-web";
import { useAdminAction, useLeagues } from "../hooks/queries";
import { useAdmin } from "../hooks/useAdmin";
import { useAdminList } from "../hooks/useAdminList";
import { teamSchema, type TeamValues } from "../lib/schemas";
import { adminSource } from "../services/runtime";
import { AdminListTable } from "./AdminListTable";
import { Mono, Status } from "./Bits";
import { TextField } from "./form/TextField";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";

type RatingKey = keyof TeamRatings;

const RATING_FIELDS: readonly { readonly key: RatingKey; readonly label: string; readonly help: string; readonly min: number; readonly max: number }[] = [
  { key: "attack", label: "Attack", help: "Raises the number of chances the team creates.", min: 1, max: 99 },
  { key: "midfield", label: "Midfield", help: "Drives possession and how often attacks reach the final third.", min: 1, max: 99 },
  { key: "defence", label: "Defence", help: "Lowers the quality of the opponent's chances.", min: 1, max: 99 },
  { key: "goalkeeper", label: "Goalkeeper", help: "Lowers the share of shots on target that are conceded.", min: 1, max: 99 },
  { key: "pace", label: "Pace", help: "Raises dangerous attacks and counter-attacks.", min: 1, max: 99 },
  { key: "finishing", label: "Finishing", help: "Raises the share of the team's own shots on target that score.", min: 1, max: 99 },
  { key: "form", label: "Form", help: "Recent results, from -10 to +10. The platform refreshes it after each matchday.", min: -10, max: 10 },
];

const FORM_FIELDS = ["name", "shortName", ...RATING_FIELDS.map((f) => f.key)] as const;

function crestTeam(team: AdminTeam): { readonly id: AdminTeam["id"]; readonly name: string; readonly colors: { readonly primary: string; readonly secondary: string; readonly onPrimary: string } } {
  return { id: team.id, name: team.name, colors: { ...team.colors, onPrimary: team.colors.secondary } };
}

function toValues(team: AdminTeam): TeamValues {
  return { name: team.name, shortName: team.shortName, active: team.status === "ACTIVE", ...team.ratings };
}

function RatingField({ form, field, disabled }: { readonly form: UseFormReturn<TeamValues>; readonly field: (typeof RATING_FIELDS)[number]; readonly disabled: boolean }): React.JSX.Element {
  return (
    <TextField
      label={field.label}
      type="number"
      inputMode="numeric"
      min={field.min}
      max={field.max}
      step={1}
      disabled={disabled}
      hint={field.help}
      error={form.formState.errors[field.key]?.message}
      {...form.register(field.key, { valueAsNumber: true })}
    />
  );
}

function TeamDrawer({ team, onClose }: { readonly team: AdminTeam | undefined; readonly onClose: () => void }): React.JSX.Element {
  const { can } = useAdmin();
  const editable = can("catalogue:write");
  const form = useForm<TeamValues>({ resolver: zodResolver(teamSchema), mode: "onTouched" });
  const { isDirty } = form.formState;
  const [pending, setPending] = useState<TeamValues | undefined>();
  const [discarding, setDiscarding] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const teamId = team?.id;

  const save = useAdminAction({
    run: (input: { readonly id: string; readonly values: TeamValues }) => {
      const { name, shortName, active, ...ratings } = input.values;

      return adminSource.updateTeam(input.id, { name, shortName, status: active ? "ACTIVE" : "INACTIVE", ratings });
    },
    success: (saved) => `${saved.name} updated`,
    silentError: true,
    onDone: () => {
      setPending(undefined);
      form.reset();
      onClose();
    },
  });

  useEffect(() => {
    if (team === undefined) return;

    setFailure(undefined);
    form.reset(toValues(team));
    // The form follows the selected team, not each background refresh of the same team.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const requestClose = (): void => {
    if (isDirty) setDiscarding(true);
    else onClose();
  };

  return (
    <>
      <Drawer
        open={team !== undefined}
        onClose={requestClose}
        size="lg"
        title={team?.name ?? ""}
        description={team === undefined ? "" : `${team.leagueName} · ${team.code}`}
        footer={
          <>
            <Button variant="ghost" onClick={requestClose} disabled={save.isPending}>
              {editable ? "Cancel" : "Close"}
            </Button>
            {editable && (
              <>
                <Button variant="ghost" disabled={!isDirty || save.isPending} onClick={() => form.reset()}>
                  Reset
                </Button>
                <Button type="submit" form="team-form" loading={save.isPending} disabled={!isDirty}>
                  Review changes
                </Button>
              </>
            )}
          </>
        }
      >
        {team !== undefined && (
          <form
            id="team-form"
            noValidate
            aria-label="Team record and ratings"
            className="space-y-6"
            onSubmit={(event) => {
              void form.handleSubmit((values) => {
                setFailure(undefined);
                setPending(values);
              })(event);
            }}
          >
            <p className="flex items-start gap-2.5 rounded-sm border border-border bg-surface-sunken px-3 py-2.5 text-sm text-text-secondary">
              <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>
                Ratings are <strong className="font-semibold text-text-primary">inputs to the simulation</strong>. They move probabilities, and so prices, for fixtures that have not been prepared yet. Every match is still drawn by the simulation service.
              </span>
            </p>
            <FormError error={failure} />
            <div className="flex items-start gap-4">
              <TeamCrest team={crestTeam(team)} size={64} decorative />
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <TextField label="Name" required disabled={!editable} error={form.formState.errors.name?.message} {...form.register("name")} />
                <TextField label="Short name" required disabled={!editable} hint="2 to 12 characters" error={form.formState.errors.shortName?.message} {...form.register("shortName")} />
              </div>
            </div>
            <Switch checked={form.watch("active")} onChange={(checked) => form.setValue("active", checked, { shouldDirty: true })} disabled={!editable} label="Active" description="Inactive teams are left out of future fixture generation." />
            <fieldset>
              <legend className="type-section mb-3">Ratings</legend>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {RATING_FIELDS.map((field) => (
                  <RatingField key={field.key} form={form} field={field} disabled={!editable} />
                ))}
              </div>
            </fieldset>
            <p className="text-sm text-text-muted">Last updated {formatRelative(team.updatedAt)}.</p>
          </form>
        )}
      </Drawer>

      <ConfirmationDialog
        open={pending !== undefined}
        onClose={() => {
          if (!save.isPending) setPending(undefined);
        }}
        title={`Save ${team?.name ?? "this team"}?`}
        description="New ratings change the probabilities and prices of every fixture this team has not yet been prepared for. The platform records the change in the audit log."
        confirmLabel="Save team"
        tone="danger"
        loading={save.isPending}
        onConfirm={async () => {
          if (pending === undefined || team === undefined) return;

          try {
            await save.mutateAsync({ id: team.id, values: pending });
          } catch (error) {
            applyFieldErrors(error, form.setError, FORM_FIELDS);
            setFailure(error);
            setPending(undefined);
          }
        }}
      />
      <ConfirmationDialog
        open={discarding}
        onClose={() => setDiscarding(false)}
        onConfirm={() => {
          setDiscarding(false);
          form.reset();
          onClose();
        }}
        title="Discard your changes?"
        description="The edits to this team have not been saved."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
      />
      <UnsavedChangesDialog dirty={team !== undefined && isDirty} />
    </>
  );
}

const rating = (key: RatingKey, header: string, hide?: "lg" | "xl"): Column<AdminTeam> => ({
  key: `ratings.${key}`,
  header,
  numeric: true,
  cell: (t) => (key === "form" && t.ratings.form > 0 ? `+${String(t.ratings.form)}` : t.ratings[key]),
  ...(hide === undefined ? {} : { hideBelow: hide }),
});

export function TeamList({ leagueId, initialTeamId }: { readonly leagueId?: string; readonly initialTeamId?: string | undefined }): React.JSX.Element {
  const scoped = leagueId !== undefined;
  const leagues = useLeagues();
  const list = useAdminList("teams", { defaults: { sort: "name", direction: "asc" }, filterKeys: scoped ? ["status"] : ["leagueId", "status"], ...(scoped ? { fixedFilters: { leagueId } } : {}) });
  const [selectedId, setSelectedId] = useState(initialTeamId);

  const columns: readonly Column<AdminTeam>[] = [
    {
      key: "name",
      header: "Team",
      sortable: true,
      hideable: false,
      cell: (t) => (
        <span className="flex items-center gap-2.5">
          <TeamCrest team={crestTeam(t)} size={24} decorative />
          <span className="whitespace-nowrap font-medium">{t.name}</span>
        </span>
      ),
    },
    { key: "code", header: "Code", sortable: true, cell: (t) => <Mono>{t.code}</Mono>, hideBelow: "lg" },
    ...(scoped ? [] : [{ key: "leagueName", header: "League", sortable: true, cell: (t: AdminTeam) => <span className="whitespace-nowrap text-text-secondary">{t.leagueName}</span> }]),
    { key: "status", header: "Status", sortable: true, cell: (t) => <Status value={t.status} /> },
    rating("attack", "ATT"),
    rating("midfield", "MID"),
    rating("defence", "DEF"),
    rating("goalkeeper", "GK", "lg"),
    rating("pace", "PAC", "xl"),
    rating("finishing", "FIN", "xl"),
    rating("form", "Form"),
    { key: "updatedAt", header: "Updated", sortable: true, cell: (t) => <span className="whitespace-nowrap text-text-secondary">{formatRelative(t.updatedAt)}</span>, hideBelow: "xl" },
  ];

  return (
    <>
      <AdminListTable
        list={list}
        caption="Teams"
        noun="teams"
        columns={columns}
        rowKey={(t) => t.id}
        search={{ label: "Search teams by name or code", placeholder: "Search team or code" }}
        filters={[
          ...(scoped ? [] : [{ key: "leagueId", label: "League", anyLabel: "All leagues", options: (leagues.data ?? []).map((l) => ({ value: l.id, label: l.name })) }]),
          {
            key: "status",
            label: "Status",
            anyLabel: "All statuses",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
        ]}
        onRowClick={(t) => setSelectedId(t.id)}
        selectedKey={selectedId}
        renderCard={(t) => (
          <div className="flex items-center gap-3">
            <TeamCrest team={crestTeam(t)} size={32} decorative />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.name}</span>
              <span className="block truncate text-sm text-text-muted">{t.leagueName}</span>
            </span>
            <Status value={t.status} />
          </div>
        )}
      />
      <TeamDrawer team={list.query.data?.items.find((t) => t.id === selectedId)} onClose={() => setSelectedId(undefined)} />
    </>
  );
}
