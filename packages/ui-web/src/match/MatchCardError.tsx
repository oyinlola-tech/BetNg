import { RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../ui";
import {
  MATCH_CARD_VARIANTS,
  type MatchCardVariant,
} from "./matchCardVariants";

export interface MatchCardErrorProps {
  readonly onRetry?: (() => void) | undefined;
  readonly variant?: MatchCardVariant;
  readonly message?: string;
  readonly className?: string | undefined;
}

export function MatchCardError({
  onRetry,
  variant = "standard",
  message = "This match could not be loaded.",
  className,
}: MatchCardErrorProps): React.JSX.Element {
  const spec = MATCH_CARD_VARIANTS[variant];

  return (
    <div
      role="alert"
      className={cn(
        spec.root,
        spec.main,
        "flex items-center justify-between gap-3",
        className,
      )}
    >
      <p className="type-small flex min-w-0 items-center gap-2 text-text-secondary">
        <TriangleAlert className="size-4 shrink-0 text-danger" aria-hidden />
        <span className="truncate">{message}</span>
      </p>
      {onRetry !== undefined && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leadingIcon={<RefreshCw className="size-3.5" aria-hidden />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
