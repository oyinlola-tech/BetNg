import { EmptyState } from "../ui";

export interface MarketsEmptyProps {
  readonly title?: string;
  readonly description?: string;
  readonly action?: React.ReactNode;
  readonly className?: string | undefined;
}

export function MarketsEmpty({
  title = "No markets",
  description = "Nothing is priced for this match right now.",
  action,
  className,
}: MarketsEmptyProps): React.JSX.Element {
  return (
    <EmptyState
      compact
      title={title}
      description={description}
      {...(action === undefined ? {} : { action })}
      className={className}
    />
  );
}
