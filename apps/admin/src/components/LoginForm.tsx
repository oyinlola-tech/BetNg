import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ShieldCheck, TriangleAlert } from "lucide-react";
import { DataSourceError } from "@betng/ui-core";
import { Button, CodeInput, Input, PasswordInput, presentError } from "@betng/ui-web";
import { appConfig } from "../configs/app.config";
import { loginSchema, type LoginValues } from "../lib/schemas";
import { adminSource } from "../services/sources";

const DEMO: readonly (readonly [string, string])[] = [
  ["ops@betng.test", "Super admin · 2FA code 246810"],
  ["operations@betng.test", "Operations"],
  ["risk@betng.test", "Risk analyst"],
  ["support@betng.test", "Support"],
];

export function LoginForm({ lockedEmail, onSignedIn }: { readonly lockedEmail?: string | undefined; readonly onSignedIn?: () => void }): React.JSX.Element {
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<{ readonly title: string; readonly message: string } | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: lockedEmail ?? "", password: "" }, mode: "onTouched" });

  const attempt = async (values: LoginValues, totp?: string): Promise<void> => {
    setPending(true);
    setFailure(undefined);
    setCodeError(undefined);

    try {
      await adminSource.login({ ...values, ...(totp === undefined ? {} : { code: totp }) });
      onSignedIn?.();
    } catch (error) {
      if (error instanceof DataSourceError && error.code === "VALIDATION") {
        if (totp === undefined) setStep("code");
        else setCodeError(error.message);
        setCode("");
      } else {
        const presented = presentError(error);

        setFailure(presented);
        if (step === "code" && error instanceof DataSourceError && error.code === "INVALID_CREDENTIALS") setStep("credentials");
      }
    } finally {
      setPending(false);
    }
  };

  const alert = failure !== undefined && (
    <div role="alert" className="flex items-start gap-2.5 rounded-sm border border-danger/40 bg-danger-subtle px-3 py-2.5 text-sm text-danger">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{failure.title}</p>
        <p className="text-text-secondary">{failure.message}</p>
      </div>
    </div>
  );

  if (step === "code") {
    return (
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.length === 6) void attempt(form.getValues(), code);
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-brand-subtle text-brand">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-md font-semibold text-text-primary">Two-factor verification</h2>
            <p className="text-sm text-text-muted">Enter the six-digit code from your authenticator for {form.getValues("email")}.</p>
          </div>
        </div>
        {alert}
        <CodeInput
          label="Authentication code"
          length={6}
          value={code}
          onChange={setCode}
          onComplete={(value) => {
            void attempt(form.getValues(), value);
          }}
          error={codeError}
          disabled={pending}
          autoFocus
        />
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="size-3.5" />}
            disabled={pending}
            onClick={() => {
              setStep("credentials");
              setCode("");
              setCodeError(undefined);
            }}
          >
            Back
          </Button>
          <Button type="submit" loading={pending} disabled={code.length !== 6}>
            Verify and sign in
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => attempt(values))(event);
      }}
    >
      {alert}
      <Input label="Work email" type="email" autoComplete="username" autoFocus={lockedEmail === undefined} readOnly={lockedEmail !== undefined} error={form.formState.errors.email?.message} {...form.register("email")} />
      <PasswordInput label="Password" autoComplete="current-password" autoFocus={lockedEmail !== undefined} error={form.formState.errors.password?.message} {...form.register("password")} />
      <Button type="submit" full size="lg" loading={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
      {appConfig.dataSource === "mock" && lockedEmail === undefined && (
        <div className="rounded-sm border border-dashed border-border-strong px-3 py-2.5 text-sm">
          <p className="caps-label">Mock mode accounts · password betng-admin</p>
          <ul className="mt-1.5 space-y-1">
            {DEMO.map(([email, role]) => (
              <li key={email}>
                <button
                  type="button"
                  onClick={() => {
                    form.setValue("email", email, { shouldValidate: true });
                    form.setValue("password", "betng-admin", { shouldValidate: true });
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-xs text-left hover:text-text-primary focus-ring"
                >
                  <span className="mono-id text-text-secondary">{email}</span>
                  <span className="text-text-muted">{role}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
