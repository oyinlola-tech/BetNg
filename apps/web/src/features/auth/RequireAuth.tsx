import { Lock } from "lucide-react";
import { Button, EmptyState } from "@betng/ui-web";
import { useAuth } from "./useAuth";

export interface RequireAuthProps {
  readonly title: string;
  readonly description: string;
  readonly reason: string;
  readonly children: React.ReactNode;
}

/** Account pages stay routable when signed out: they explain what is behind the door instead of redirecting. */
export function RequireAuth({ title, description, reason, children }: RequireAuthProps): React.JSX.Element {
  const { isAuthenticated, status, openAuth } = useAuth();

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="mx-auto max-w-md rounded-md border border-border bg-surface">
      <EmptyState
        icon={<Lock className="size-5" />}
        title={status === "EXPIRED" ? "Your session has ended" : title}
        description={status === "EXPIRED" ? "Log in again to pick up where you left off." : description}
        action={
          <div className="flex gap-2">
            <Button
              onClick={() => {
                openAuth(status === "EXPIRED" ? "expired" : "login", { reason });
              }}
            >
              Log in
            </Button>
            {status !== "EXPIRED" && (
              <Button
                variant="secondary"
                onClick={() => {
                  openAuth("register", { reason });
                }}
              >
                Create account
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
