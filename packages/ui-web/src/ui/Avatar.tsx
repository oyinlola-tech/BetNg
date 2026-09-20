import { cn } from "../lib/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";

  return (first + last).toUpperCase();
}

export function Avatar({ name, size = "md", className }: { readonly name: string; readonly size?: "sm" | "md" | "lg"; readonly className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-subtle font-semibold text-brand",
        size === "sm" && "size-6 text-[10px]",
        size === "md" && "size-8 text-sm",
        size === "lg" && "size-11 text-md",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
