import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "link";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly compact?: boolean;
  readonly loading?: boolean;
  readonly leadingIcon?: React.ReactNode;
  readonly trailingIcon?: React.ReactNode;
  readonly fullWidth?: boolean;
  /** @deprecated Use `leadingIcon`. */
  readonly icon?: React.ReactNode;
  /** @deprecated Use `fullWidth`. */
  readonly full?: boolean;
}

const FILLED = "inset-shadow-2xs inset-shadow-white/20";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: cn(
    "border-brand bg-brand text-text-on-brand enabled:hover:border-brand-hover enabled:hover:bg-brand-hover enabled:active:border-brand-active enabled:active:bg-brand-active",
    FILLED,
  ),
  secondary:
    "border-border-strong bg-surface text-text-primary inset-shadow-2xs inset-shadow-white/40 enabled:hover:bg-surface-hover enabled:active:bg-surface-sunken",
  outline:
    "border-border-strong bg-transparent text-text-primary enabled:hover:bg-surface-hover enabled:active:bg-surface-sunken",
  ghost:
    "border-transparent bg-transparent text-text-secondary enabled:hover:bg-surface-hover enabled:hover:text-text-primary enabled:active:bg-surface-sunken",
  danger: cn(
    "border-danger bg-danger text-white enabled:hover:opacity-90 enabled:active:opacity-100",
    FILLED,
  ),
  success: cn(
    "border-success bg-success text-white enabled:hover:opacity-90 enabled:active:opacity-100",
    FILLED,
  ),
  link: "border-transparent bg-transparent text-brand underline-offset-2 enabled:hover:text-brand-hover enabled:hover:underline",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-6 gap-1 px-2 text-xs",
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-base",
  lg: "h-12 gap-2 px-5 text-md",
};

const COMPACT: Record<ButtonSize, string> = {
  xs: "gap-1 px-1.5",
  sm: "gap-1 px-2",
  md: "gap-1.5 px-2.5",
  lg: "gap-1.5 px-3.5",
};

const SPINNER: Record<ButtonSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      compact = false,
      loading = false,
      leadingIcon,
      trailingIcon,
      fullWidth,
      icon,
      full,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    const leading = leadingIcon ?? icon;
    const stretch = fullWidth ?? full ?? false;

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled === true || loading}
        aria-busy={loading ? true : undefined}
        data-variant={variant}
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center rounded-sm border font-semibold whitespace-nowrap transition-[background-color,border-color,color,opacity,transform] duration-[var(--bn-duration-fast)] focus-ring enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:inset-shadow-none",
          VARIANTS[variant],
          SIZES[size],
          compact && COMPACT[size],
          variant === "link" && "h-auto px-0 enabled:active:translate-y-0",
          stretch && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <Loader2 className={cn("animate-spin", SPINNER[size])} aria-hidden />
        ) : (
          leading
        )}
        {children}
        {trailingIcon}
      </button>
    );
  },
);
