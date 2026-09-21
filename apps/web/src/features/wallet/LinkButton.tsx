import { Link } from "react-router";
import { cn } from "@betng/ui-web";

const VARIANTS = {
  primary: "border-brand bg-brand text-text-on-brand hover:border-brand-hover hover:bg-brand-hover",
  secondary: "border-border-strong bg-surface text-text-primary hover:bg-surface-hover",
  ghost: "border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-base",
} as const;

export interface LinkButtonProps {
  readonly to: string;
  readonly variant?: keyof typeof VARIANTS;
  readonly size?: keyof typeof SIZES;
  readonly icon?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** Navigation that looks like a button; it stays a link for the keyboard, screen readers and new tabs. */
export function LinkButton({ to, variant = "secondary", size = "md", icon, className, children }: LinkButtonProps): React.JSX.Element {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm border font-semibold whitespace-nowrap transition-colors focus-ring pointer-coarse:min-h-11",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
