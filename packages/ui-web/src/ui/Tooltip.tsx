import { useId } from "react";
import { cn } from "../lib/cn";

/** A CSS-only tooltip shown on hover and keyboard focus. The content is also the accessible description. */
export function Tooltip({ content, children, side = "top", className }: { readonly content: string; readonly children: React.ReactNode; readonly side?: "top" | "bottom"; readonly className?: string }): React.JSX.Element {
  const id = useId();

  return (
    <span className={cn("group/tip relative inline-flex", className)} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-toast w-max max-w-56 -translate-x-1/2 rounded-xs bg-text-primary px-2 py-1 text-sm font-medium text-background opacity-0 shadow-md transition-opacity duration-[var(--bn-duration-fast)] group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {content}
      </span>
    </span>
  );
}
