import { forwardRef, useId } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/cn";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label: React.ReactNode;
  readonly description?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start gap-2.5 text-base", rest.disabled === true && "cursor-not-allowed opacity-50", className)}>
      <span className="relative mt-0.5 flex size-4 shrink-0">
        <input ref={ref} id={inputId} type="checkbox" className="peer size-4 appearance-none rounded-xs border border-border-strong bg-surface checked:border-brand checked:bg-brand focus-ring" {...rest} />
        <Check className="pointer-events-none absolute inset-0 m-auto hidden size-3 text-text-on-brand peer-checked:block" strokeWidth={3} aria-hidden />
      </span>
      <span>
        <span className="text-text-primary">{label}</span>
        {description !== undefined && <span className="block text-sm text-text-muted">{description}</span>}
      </span>
    </label>
  );
});
