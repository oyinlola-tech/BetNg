import { Fragment } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

export interface BreadcrumbItem {
  readonly label: string;
  /** Omitted for the current location, which is marked `aria-current="page"` when it is last. */
  readonly to?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[];
  readonly label?: string;
  /** Hides the first crumb below `md` when there is more than one, keeping the trail on one line. */
  readonly compactOnMobile?: boolean;
  readonly className?: string;
}

export function Breadcrumbs({
  items,
  label = "Breadcrumb",
  compactOnMobile = false,
  className,
}: BreadcrumbsProps): React.JSX.Element {
  return (
    <nav aria-label={label} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <Fragment key={`${item.label}-${String(index)}`}>
              {index > 0 && (
                <li aria-hidden className="shrink-0 text-text-muted">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
              <li
                className={cn(
                  last
                    ? "min-w-0 truncate"
                    : "min-w-0 shrink truncate first:shrink-0",
                  compactOnMobile &&
                    index === 0 &&
                    items.length > 1 &&
                    "hidden md:block",
                )}
              >
                {item.to !== undefined ? (
                  <Link
                    to={item.to}
                    className="rounded-xs text-text-secondary hover:text-text-primary hover:underline focus-ring"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={
                      last
                        ? "font-semibold text-text-primary"
                        : "text-text-muted"
                    }
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
