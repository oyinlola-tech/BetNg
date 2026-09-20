import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "live";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly icon?: React.ReactNode;
  readonly full?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-text-on-brand hover:bg-brand-hover active:bg-brand-active",
  secondary:
    "bg-surface border border-border-strong text-text-primary hover:bg-surface-hover",
  ghost: "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
  danger: "bg-danger text-white hover:opacity-90",
  live: "bg-live text-text-on-live hover:opacity-90",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-base gap-2",
  lg: "h-12 px-5 text-md gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      full = false,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled === true || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-sm font-semibold whitespace-nowrap transition-colors duration-[var(--bn-duration-fast)] focus-ring disabled:opacity-50",
          VARIANTS[variant],
          SIZES[size],
          full && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  },
);
