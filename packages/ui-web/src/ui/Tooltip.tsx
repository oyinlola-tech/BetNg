import { cloneElement, isValidElement, useId, useState } from "react";
import { cn } from "../lib/cn";

export interface TooltipProps {
  readonly content: string;
  readonly children: React.ReactNode;
  readonly side?: "top" | "bottom";
  /** Set false when the content repeats the trigger's accessible name. */
  readonly describe?: boolean;
  readonly className?: string;
}

interface Describable {
  readonly "aria-describedby"?: string;
}

export function Tooltip({
  content,
  children,
  side = "top",
  describe = true,
  className,
}: TooltipProps): React.JSX.Element {
  const id = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const open = (hovered || focused) && !dismissed;

  const element = isValidElement<Describable>(children) ? children : undefined;
  const describedBy = [element?.props["aria-describedby"], id]
    .filter((value) => value !== undefined && value !== "")
    .join(" ");

  return (
    <span
      className={cn("relative inline-flex", className)}
      {...(describe && element === undefined ? { "aria-describedby": id } : {})}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setDismissed(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        setDismissed(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setDismissed(true);
        }
      }}
    >
      {element !== undefined && describe
        ? cloneElement(element, { "aria-describedby": describedBy })
        : children}
      <span
        id={id}
        role="tooltip"
        data-state={open ? "open" : "closed"}
        className={cn(
          "pointer-events-none absolute left-1/2 z-toast w-max max-w-56 -translate-x-1/2 rounded-xs bg-text-primary px-2 py-1 text-sm font-medium text-background shadow-md transition-opacity duration-[var(--bn-duration-fast)]",
          open ? "opacity-100" : "invisible opacity-0",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {content}
      </span>
    </span>
  );
}
