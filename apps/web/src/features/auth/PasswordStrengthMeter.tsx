import { cn } from "@betng/ui-web";
import { passwordStrength } from "./passwordStrength";

const TONES = ["bg-border-strong", "bg-danger", "bg-warning", "bg-success", "bg-success"] as const;
const TEXT = ["text-text-muted", "text-danger", "text-warning", "text-success", "text-success"] as const;

export function PasswordStrengthMeter({ password, id }: { readonly password: string; readonly id?: string }): React.JSX.Element | null {
  if (password === "") return null;

  const strength = passwordStrength(password);

  return (
    <div id={id} className="mt-1.5" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={cn("h-1 flex-1 rounded-full", step <= strength.level ? TONES[strength.level] : "bg-surface-sunken")} />
        ))}
      </div>
      <p className="type-small mt-1 text-text-muted">
        <span className={cn("font-semibold", TEXT[strength.level])}>Strength: {strength.label}</span>
        {strength.hint === undefined ? null : <> · {strength.hint}</>}
      </p>
    </div>
  );
}
