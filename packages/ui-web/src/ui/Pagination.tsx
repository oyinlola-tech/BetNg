import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./IconButton";

export interface PaginationProps {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly onPage: (page: number) => void;
  readonly className?: string;
}

export function Pagination({ page, pageSize, total, onPage, className }: PaginationProps): React.JSX.Element | null {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav aria-label="Pagination" className={className}>
      <div className="flex items-center justify-between gap-3 text-sm text-text-muted">
        <p className="tabular">
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
        </p>
        <div className="flex items-center gap-1">
          <IconButton
            label="Previous page"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              onPage(page - 1);
            }}
          >
            <ChevronLeft className="size-4" />
          </IconButton>
          <span className="min-w-16 text-center tabular text-text-secondary" aria-current="page">
            {page} / {pages}
          </span>
          <IconButton
            label="Next page"
            size="sm"
            disabled={page >= pages}
            onClick={() => {
              onPage(page + 1);
            }}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
      </div>
    </nav>
  );
}
