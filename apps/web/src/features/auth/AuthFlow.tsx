import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, MailCheck } from "lucide-react";
import { DataSourceError } from "@betng/ui-core";
import { Button, Checkbox, CodeInput, FormError, Input, PasswordInput, applyFieldErrors, useSession } from "@betng/ui-web";
import { authSource, logger, session as sessionStore } from "../../services/runtime";
import type { AuthView } from "./auth.store";
import { forgotSchema, loginSchema, registerSchema, toRegisterRequest, type RegisterValues } from "./schemas";

const RESEND_SECONDS = 30;

export const AUTH_TITLES: Record<AuthView, string> = {
  login: "Sign in",
  register: "Create your account",
  verify: "Verify your email",
  forgot: "Reset your password",
  expired: "Session ended",
};

export interface AuthFlowProps {
  readonly view: AuthView;
  readonly onView: (view: AuthView) => void;
  readonly pendingEmail: string;
  readonly onPendingEmail: (email: string) => void;
  readonly reason?: string | undefined;
  readonly onAuthenticated: () => void;
}

/** Field messages go onto the form; anything else, and fields the form does not own, surface at form level. */
function serverFailure<TName extends string>(
  flow: string,
  cause: unknown,
  setError: (name: TName, error: { type: string; message: string }) => void,
  fields: readonly TName[],
): unknown {
  logger.warn("auth", `${flow} failed`, { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

  const { applied, unmatched } = applyFieldErrors(cause, setError, fields);

  return applied.length > 0 && Object.keys(unmatched).length === 0 ? undefined : cause;
}

function TextLink({ children, onClick }: { readonly children: React.ReactNode; readonly onClick: () => void }): React.JSX.Element {
  return (
    <button type="button" onClick={onClick} className="rounded-xs font-semibold text-brand hover:underline focus-ring">
      {children}
    </button>
  );
}

function Welcome({ name }: { readonly name: string }): React.JSX.Element {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-10 text-center animate-fade-in">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-subtle text-success">
        <CheckCircle2 className="size-6" aria-hidden />
      </span>
      <p className="text-lg font-semibold">You are in, {name.split(" ")[0]}</p>
      <p className="text-sm text-text-muted">Picking up where you left off…</p>
    </div>
  );
}

function useWelcome(onAuthenticated: () => void): readonly [string | undefined, (name: string) => void] {
  const [name, setName] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return [
    name,
    (next) => {
      setName(next);
      timer.current = setTimeout(onAuthenticated, 650);
    },
  ];
}

function LoginView({ onView, onPendingEmail, onAuthenticated, lockedEmail }: AuthFlowProps & { readonly lockedEmail?: string | undefined }): React.JSX.Element {
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: lockedEmail ?? "", password: "" } });
  const [error, setError] = useState<unknown>();
  const [welcome, showWelcome] = useWelcome(onAuthenticated);
  const { setFocus } = form;

  useEffect(() => {
    setFocus(lockedEmail === undefined ? "email" : "password");
  }, [setFocus, lockedEmail]);

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);

    try {
      const session = await authSource.login(values);

      showWelcome(session.user.displayName);
    } catch (cause) {
      if (cause instanceof DataSourceError && cause.code === "CONFLICT") {
        onPendingEmail(values.email);
        onView("verify");

        return;
      }

      setError(serverFailure("Sign-in", cause, form.setError, ["email", "password"]));
      if (cause instanceof DataSourceError && cause.code === "INVALID_CREDENTIALS") setFocus("password");
    }
  });

  if (welcome !== undefined) return <Welcome name={welcome} />;

  const busy = form.formState.isSubmitting;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <FormError error={error} />
      <Input label="Email" type="email" autoComplete="email" inputMode="email" readOnly={lockedEmail !== undefined} disabled={busy} error={form.formState.errors.email?.message} {...form.register("email")} />
      <div>
        <PasswordInput label="Password" autoComplete="current-password" disabled={busy} error={form.formState.errors.password?.message} {...form.register("password")} />
        <div className="mt-1.5 text-right text-sm">
          <TextLink
            onClick={() => {
              onView("forgot");
            }}
          >
            Forgot password?
          </TextLink>
        </div>
      </div>
      <Button type="submit" fullWidth size="lg" loading={busy}>
        Sign in
      </Button>
      <p className="text-center text-sm text-text-secondary">
        {lockedEmail === undefined ? (
          <>
            New to BETNG?{" "}
            <TextLink
              onClick={() => {
                onView("register");
              }}
            >
              Create an account
            </TextLink>
          </>
        ) : (
          <TextLink
            onClick={() => {
              sessionStore.clear();
              onView("login");
            }}
          >
            Sign in as someone else
          </TextLink>
        )}
      </p>
    </form>
  );
}

function RegisterView({ onView, onPendingEmail }: AuthFlowProps): React.JSX.Element {
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { displayName: "", email: "", phone: "", password: "", acceptTerms: false } });
  const [error, setError] = useState<unknown>();
  const { setFocus } = form;

  useEffect(() => {
    setFocus("displayName");
  }, [setFocus]);

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);

    try {
      const pending = await authSource.register(toRegisterRequest(values));

      onPendingEmail(pending.email);
      onView("verify");
    } catch (cause) {
      setError(serverFailure("Registration", cause, form.setError, ["displayName", "email", "phone", "password"]));
      if (cause instanceof DataSourceError && cause.code === "CONFLICT") setFocus("email");
    }
  });

  const busy = form.formState.isSubmitting;
  const errors = form.formState.errors;

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <FormError error={error} />
      <Input label="Display name" autoComplete="name" disabled={busy} error={errors.displayName?.message} {...form.register("displayName")} />
      <Input label="Email" type="email" autoComplete="email" inputMode="email" disabled={busy} error={errors.email?.message} {...form.register("email")} />
      <Input label="Phone (optional)" type="tel" autoComplete="tel" inputMode="tel" placeholder="+234 …" disabled={busy} error={errors.phone?.message} {...form.register("phone")} />
      <PasswordInput label="Password" autoComplete="new-password" hint="At least 8 characters." disabled={busy} error={errors.password?.message} {...form.register("password")} />
      <div>
        <Checkbox label="I understand BETNG is a simulation" description="Balances, stakes and returns are play-money with no real-world value." disabled={busy} aria-invalid={errors.acceptTerms !== undefined} {...form.register("acceptTerms")} />
        {errors.acceptTerms !== undefined && <p className="mt-1 text-sm text-danger">{errors.acceptTerms.message}</p>}
      </div>
      <Button type="submit" fullWidth size="lg" loading={busy}>
        Create account
      </Button>
      <p className="text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <TextLink
          onClick={() => {
            onView("login");
          }}
        >
          Sign in
        </TextLink>
      </p>
    </form>
  );
}

function VerifyView({ onView, pendingEmail, onAuthenticated }: AuthFlowProps): React.JSX.Element {
  const [code, setCode] = useState("");
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);
  const [welcome, showWelcome] = useWelcome(onAuthenticated);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => {
      setCooldown((c) => c - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [cooldown]);

  const submit = async (value: string): Promise<void> => {
    if (value.length !== 6 || busy) return;

    setBusy(true);
    setError(undefined);

    try {
      const session = await authSource.verify({ email: pendingEmail, code: value });

      showWelcome(session.user.displayName);
    } catch (cause) {
      setError(cause);
      if (cause instanceof DataSourceError && cause.code === "VALIDATION") setCode("");
    } finally {
      setBusy(false);
    }
  };

  const resend = async (): Promise<void> => {
    setError(undefined);

    try {
      await authSource.resendVerification(pendingEmail);
      setResent(true);
      setCooldown(RESEND_SECONDS);
    } catch (cause) {
      setError(cause);
    }
  };

  if (welcome !== undefined) return <Welcome name={welcome} />;

  const codeError = error instanceof DataSourceError && error.code === "VALIDATION" ? (error.detail.fields?.code ?? "That code is not valid. Check it and try again.") : undefined;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(code);
      }}
      className="space-y-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
          <MailCheck className="size-4.5" aria-hidden />
        </span>
        <p className="text-base text-text-secondary">
          We sent a 6-digit code to <span className="font-semibold text-text-primary">{pendingEmail}</span>. It expires in 15 minutes.
        </p>
      </div>
      {codeError === undefined && <FormError error={error} />}
      <CodeInput label="Verification code" length={6} value={code} onChange={setCode} onComplete={(value) => void submit(value)} error={codeError} disabled={busy} autoFocus />
      <Button type="submit" fullWidth size="lg" loading={busy} disabled={code.length !== 6}>
        Verify and continue
      </Button>
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <TextLink
          onClick={() => {
            onView("register");
          }}
        >
          Use a different email
        </TextLink>
        {cooldown > 0 ? (
          <span aria-live="polite" className="tabular text-text-muted">
            {resent ? "Code sent. " : ""}Resend in {cooldown}s
          </span>
        ) : (
          <TextLink onClick={() => void resend()}>Resend code</TextLink>
        )}
      </div>
    </form>
  );
}

function ForgotView({ onView }: AuthFlowProps): React.JSX.Element {
  const form = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const [error, setError] = useState<unknown>();
  const [sentTo, setSentTo] = useState<string>();
  const { setFocus } = form;

  useEffect(() => {
    setFocus("email");
  }, [setFocus]);

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);

    try {
      await authSource.requestPasswordReset(values.email);
      setSentTo(values.email);
    } catch (cause) {
      setError(serverFailure("Password reset request", cause, form.setError, ["email"]));
    }
  });

  const back = (
    <button
      type="button"
      onClick={() => {
        onView("login");
      }}
      className="mx-auto flex items-center gap-1.5 rounded-xs text-sm font-semibold text-brand hover:underline focus-ring"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Back to sign in
    </button>
  );

  if (sentTo !== undefined) {
    return (
      <div role="status" className="space-y-4 text-center animate-fade-in">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <MailCheck className="size-6" aria-hidden />
        </span>
        <p className="text-md font-semibold">Check your inbox</p>
        <p className="text-base text-text-secondary">
          If an account exists for <span className="font-medium text-text-primary">{sentTo}</span>, a link to reset the password is on its way.
        </p>
        {back}
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-4">
      <p className="text-base text-text-secondary">Enter the email you signed up with and we will send a reset link.</p>
      <FormError error={error} />
      <Input label="Email" type="email" autoComplete="email" inputMode="email" disabled={form.formState.isSubmitting} error={form.formState.errors.email?.message} {...form.register("email")} />
      <Button type="submit" fullWidth size="lg" loading={form.formState.isSubmitting}>
        Send reset link
      </Button>
      {back}
    </form>
  );
}

function ExpiredView(props: AuthFlowProps): React.JSX.Element {
  const expired = useSession(sessionStore).session;

  return (
    <div className="space-y-4">
      <p className="text-base text-text-secondary">Your session has ended. Sign in again to pick up where you left off. Your bet slip and this page are kept.</p>
      <LoginView {...props} lockedEmail={expired?.user.email} />
    </div>
  );
}

export function AuthFlow(props: AuthFlowProps): React.JSX.Element {
  const { view, reason } = props;

  return (
    <div className="space-y-4">
      {reason !== undefined && (view === "login" || view === "register") && <p className="rounded-sm bg-brand-subtle px-3 py-2 text-sm font-medium text-brand">{reason}</p>}
      {view === "login" && <LoginView key="login" {...props} />}
      {view === "register" && <RegisterView {...props} />}
      {view === "verify" && <VerifyView {...props} />}
      {view === "forgot" && <ForgotView {...props} />}
      {view === "expired" && <ExpiredView {...props} />}
    </div>
  );
}
