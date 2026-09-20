import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { cn } from "../../lib/cn";

export interface SectionHeaderProps {
  readonly title: string;
  readonly eyebrow?: string;
  readonly to?: string;
  readonly linkLabel?: string;
  readonly aside?: React.ReactNode;
  readonly className?: string;
  readonly as?: "h1" | "h2" | "h3";
}

export function SectionHeader({ title, eyebrow, to, linkLabel = "View all", aside, className, as: Heading = "h2" }: SectionHeaderProps): React.JSX.Element {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow !== undefined && <p className="caps-label">{eyebrow}</p>}
        <Heading className={cn("font-display font-bold tracking-tight text-text-primary", Heading === "h1" ? "text-2xl md:text-3xl" : "text-lg")}>
          {title}
        </Heading>
      </div>
      {aside}
      {to !== undefined && (
        <Link to={to} className="inline-flex items-center gap-0.5 rounded-xs text-sm font-medium text-text-secondary hover:text-brand focus-ring">
          {linkLabel}
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
