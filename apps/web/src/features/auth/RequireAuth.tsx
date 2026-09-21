import { Button, Card, SessionExpiredState, UnauthorizedState } from "@betng/ui-web";
import { INTENT_REASONS, type AuthIntentName } from "./auth.store";
import { useAuth } from "./useAuth";

export interface RequireAuthProps {
  readonly intent: AuthIntentName;
  readonly description?: string;
  readonly children: React.ReactNode;
}

/** Presentation only: the platform enforces access. Signed-out and expired visitors stay on the route they asked for. */
export function RequireAuth({
  intent,
  description,
  children,
}: RequireAuthProps): React.JSX.Element {
  const { status, openAuth } = useAuth();
  const reason = INTENT_REASONS[intent];

  if (status === "AUTHENTICATED") return <>{children}</>;

  return (
    <Card padding="none" className="mx-auto max-w-md">
      {status === "EXPIRED" ? (
        <SessionExpiredState
          onSignIn={() => {
            openAuth("expired", { reason });
          }}
        />
      ) : (
        <UnauthorizedState
          description={description ?? reason}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => {
                  openAuth("login", { reason });
                }}
              >
                Sign in
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  openAuth("register", { reason });
                }}
              >
                Create account
              </Button>
            </div>
          }
        />
      )}
    </Card>
  );
}
