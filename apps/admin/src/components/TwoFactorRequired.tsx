import { LogOut, ShieldAlert } from "lucide-react";
import { BrandLogo, Button, DevelopmentBanner } from "@betng/ui-web";
import { env } from "../services/runtime";

export interface TwoFactorRequiredProps {
  readonly email: string;
  readonly onSignOut: () => void;
  /** Offered only on the development stand-in, whose seeded operators mostly lack a second factor. */
  readonly onContinueInDevelopment?: () => void;
}

export function TwoFactorRequired({ email, onSignOut, onContinueInDevelopment }: TwoFactorRequiredProps): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {env.dataSource === "mock" && <DevelopmentBanner />}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
        <BrandLogo product="Admin" size={28} />
        <section role="alertdialog" aria-modal="true" aria-labelledby="two-factor-title" aria-describedby="two-factor-body" className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-warning-subtle text-warning">
              <ShieldAlert className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 id="two-factor-title" className="type-h3 text-text-primary">
                Two-step verification required
              </h1>
              <p id="two-factor-body" className="mt-1 text-sm text-text-secondary">
                Operator accounts must sign in with an authenticator code. <span className="font-medium text-text-primary">{email}</span> has no second factor enrolled, so the console stays locked.
              </p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
            <div>
              <dt className="font-semibold text-text-primary">How to enrol</dt>
              <dd className="mt-0.5 text-text-muted">Enrolment is issued by the platform team. Ask a super admin to enrol this account, then sign in again with your code.</dd>
            </div>
            <div>
              <dt className="font-semibold text-text-primary">Self-service enrolment</dt>
              <dd className="mt-0.5 text-text-muted">Pending backend. The platform has no operator enrolment route yet, so it cannot be done from this screen.</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {onContinueInDevelopment !== undefined && (
              <Button variant="ghost" onClick={onContinueInDevelopment}>
                Continue on development data
              </Button>
            )}
            <Button variant="primary" leadingIcon={<LogOut className="size-4" aria-hidden />} onClick={onSignOut} autoFocus>
              Sign out
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
