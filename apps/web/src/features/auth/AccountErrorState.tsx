import { DataSourceError } from "@betng/ui-core";
import { ErrorState, ForbiddenState, SessionExpiredState } from "@betng/ui-web";
import { useAuth } from "./useAuth";

export interface AccountErrorStateProps {
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly compact?: boolean;
}

/** Error state for account data: an ended session asks for sign-in, a refusal says so, everything else offers a retry. */
export function AccountErrorState({
  error,
  onRetry,
  compact = false,
}: AccountErrorStateProps): React.JSX.Element {
  const { openAuth } = useAuth();
  const code = error instanceof DataSourceError ? error.code : undefined;

  if (code === "SESSION_EXPIRED" || code === "UNAUTHENTICATED") {
    return (
      <SessionExpiredState
        onSignIn={() => {
          openAuth("expired");
        }}
      />
    );
  }

  if (code === "FORBIDDEN") return <ForbiddenState />;

  return (
    <ErrorState
      error={error}
      compact={compact}
      {...(onRetry === undefined ? {} : { onRetry })}
    />
  );
}
