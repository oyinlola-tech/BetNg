import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "../../lib/cn";
import { useTheme, type ThemePreference } from "../../providers/ThemeProvider";

const OPTIONS: readonly {
  readonly value: ThemePreference;
  readonly label: string;
  readonly Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeSwitcher({
  showLabels = false,
  className,
}: {
  readonly showLabels?: boolean;
  readonly className?: string;
}): React.JSX.Element {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex gap-0.5 rounded-sm bg-surface-sunken p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;

        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => {
              setPreference(value);
            }}
            className={cn(
              "inline-flex h-8 items-center justify-center gap-1.5 rounded-xs px-2.5 text-sm font-medium transition-colors focus-ring",
              active
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-primary",
            )}
          >
            <Icon className="size-4" />
            {showLabels && label}
          </button>
        );
      })}
    </div>
  );
}
