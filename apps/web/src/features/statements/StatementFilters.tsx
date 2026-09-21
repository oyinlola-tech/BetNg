import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { StatementRequest } from "@betng/contracts";
import { Button, FormError, Input, RadioGroup, applyFieldErrors } from "@betng/ui-web";

function today(): string {
  const now = new Date();

  return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysAgo(days: number): string {
  const date = new Date();

  date.setDate(date.getDate() - days);

  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    from: z.string().regex(DATE, "Choose a start date."),
    to: z.string().regex(DATE, "Choose an end date."),
    format: z.enum(["PDF", "CSV"]),
  })
  .superRefine((values, ctx) => {
    if (values.to > today()) ctx.addIssue({ code: "custom", path: ["to"], message: "The end date cannot be in the future." });
    if (values.from > values.to) ctx.addIssue({ code: "custom", path: ["from"], message: "The start date must be on or before the end date." });
  });

type Values = z.infer<typeof schema>;

export interface StatementFiltersProps {
  readonly onSubmit: (request: StatementRequest) => Promise<void>;
  readonly error?: unknown;
  readonly disabled?: boolean;
}

export function StatementFilters({ onSubmit, error, disabled = false }: StatementFiltersProps): React.JSX.Element {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { from: daysAgo(30), to: today(), format: "PDF" }, mode: "onSubmit" });

  const submit = form.handleSubmit(async (values) => {
    try {
      await onSubmit({ from: values.from, to: values.to, format: values.format });
    } catch (cause) {
      applyFieldErrors(cause, form.setError, ["from", "to", "format"]);
    }
  });

  const busy = form.formState.isSubmitting || disabled;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <FormError error={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input type="date" label="From" max={today()} disabled={busy} error={form.formState.errors.from?.message} {...form.register("from")} />
        <Input type="date" label="To" max={today()} disabled={busy} error={form.formState.errors.to?.message} {...form.register("to")} />
      </div>
      <Controller
        control={form.control}
        name="format"
        render={({ field }) => (
          <RadioGroup
            legend="Format"
            layout="row"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: "PDF", label: "PDF", description: "For reading and printing", disabled: busy },
              { value: "CSV", label: "CSV", description: "For spreadsheets", disabled: busy },
            ]}
          />
        )}
      />
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" loading={busy}>
          Request statement
        </Button>
      </div>
    </form>
  );
}
