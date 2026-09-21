import { Monitor, Moon, Sun } from "lucide-react";
import { Dropdown, useTheme } from "@betng/ui-web";

export function ThemeMenu(): React.JSX.Element {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;

  return (
    <Dropdown
      label={`Theme: ${preference}`}
      trigger={
        <span className="inline-flex size-10 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
      }
      items={[
        { key: "light", label: "Light", icon: <Sun />, onSelect: () => setPreference("light") },
        { key: "dark", label: "Dark", icon: <Moon />, onSelect: () => setPreference("dark") },
        { key: "system", label: "System", icon: <Monitor />, onSelect: () => setPreference("system") },
      ]}
    />
  );
}
