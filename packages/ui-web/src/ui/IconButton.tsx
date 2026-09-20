import { forwardRef } from "react";
import { cn } from "../lib/cn";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly label: string;
  readonly size?: "sm" | "md";
  readonly active?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { label, size = "md", active = false, className, children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-sm text-text-secondary transition-colors duration-[var(--bn-duration-fast)] hover:bg-surface-hover hover:text-text-primary focus-ring disabled:opacity-50",
          size === "sm" ? "size-8" : "size-10",
          active && "bg-brand-subtle text-brand",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
