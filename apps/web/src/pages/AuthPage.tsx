import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { BrandLogo } from "@betng/ui-web";
import { AUTH_TITLES, AuthFlow } from "../features/auth/AuthFlow";
import type { AuthView } from "../features/auth/auth.store";
import { useAuth } from "../features/auth/useAuth";

const PATHS: Partial<Record<AuthView, string>> = { login: "/login", register: "/register", forgot: "/forgot-password" };

function safeNext(raw: string | null): string {
  return raw !== null && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

/** The deep-linkable form of the auth dialog: /login, /register, /forgot-password. */
export function AuthPage({ initial }: { readonly initial: AuthView }): React.JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<AuthView>(initial);
  const [pendingEmail, setPendingEmail] = useState("");
  const [arrivedSignedIn] = useState(isAuthenticated);
  const next = safeNext(params.get("next"));

  useEffect(() => {
    setView(initial);
  }, [initial]);

  useEffect(() => {
    if (arrivedSignedIn) void navigate(next, { replace: true });
  }, [arrivedSignedIn, navigate, next]);

  return (
    <div className="mx-auto w-full max-w-sm py-6 md:py-12">
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <BrandLogo size={24} />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">{AUTH_TITLES[view]}</h1>
        <div className="mt-5">
          <AuthFlow
            view={view}
            onView={(target) => {
              const path = PATHS[target];

              setView(target);
              if (path !== undefined) void navigate({ pathname: path, search: params.toString() }, { replace: true });
            }}
            pendingEmail={pendingEmail}
            onPendingEmail={setPendingEmail}
            onAuthenticated={() => {
              void navigate(next, { replace: true });
            }}
          />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-text-muted">Browsing matches, results and tables never needs an account.</p>
    </div>
  );
}

export function LoginPage(): React.JSX.Element {
  return <AuthPage initial="login" />;
}

export function RegisterPage(): React.JSX.Element {
  return <AuthPage initial="register" />;
}

export function ForgotPasswordPage(): React.JSX.Element {
  return <AuthPage initial="forgot" />;
}
