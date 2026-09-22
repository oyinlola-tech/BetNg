import { ShieldAlert } from "lucide-react";

export function BreachWarning(): React.JSX.Element {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning-subtle px-3 py-2 text-sm text-text-primary">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <p>
        <span className="font-semibold">This password has appeared in a data breach.</span> Attackers try known passwords first. Choose one you have not used anywhere else.
      </p>
    </div>
  );
}
