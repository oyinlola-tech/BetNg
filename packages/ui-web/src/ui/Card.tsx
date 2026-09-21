import { cn } from "../lib/cn";

export type CardPadding = "none" | "compact" | "standard" | "featured";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  readonly as?: React.ElementType;
  readonly padding?: CardPadding;
  readonly elevated?: boolean;
  readonly interactive?: boolean;
}

const PADDING: Record<CardPadding, string> = {
  none: "p-0",
  compact: "p-3",
  standard: "p-4",
  featured: "p-6",
};

export function Card({
  as: Component = "div",
  padding = "standard",
  elevated = false,
  interactive = false,
  className,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <Component
      className={cn(
        "block rounded-md border border-border bg-surface text-text-primary",
        PADDING[padding],
        elevated && "shadow-sm",
        interactive &&
          "cursor-pointer text-left transition-[background-color,border-color] duration-[var(--bn-duration-fast)] focus-ring hover:border-border-strong hover:bg-surface-hover",
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}
