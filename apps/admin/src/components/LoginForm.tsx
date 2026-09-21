import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { DataSourceError } from "@betng/ui-core";
import { Button, CodeInput, FormError, PasswordInput, applyFieldErrors, useLogger } from "@betng/ui-web";
import { loginSchema, type LoginValues } from "../lib/schemas";
import { adminSource, demoSignIns, env } from "../services/runtime";
import { TextField } from "./form/TextField";

export function LoginForm({ lockedEmail, onSignedIn }: { readonly lockedEmail?: string | undefined; readonly onSignedIn?: () => void }): React.JSX.Element {
  const logger = useLogger();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: lockedEmail ?? "", password: "" }, mode: "onTouched" });

  const attempt = async (values: LoginValues, totp?: string): Promise<void> => {
    setPending(true);
    setFailure(undefined);
    setCodeError(undefined);

    try {
      await adminSource.login({ ...values, ...(totp === undefined ? {} : { code: totp }) });
      logger.info("auth", "Admin signed in");
      onSignedIn?.();
    } catch (error) {
      const secondFactorAsked = error instanceof DataSourceError && error.code === "VALIDATION" && totp === undefined && error.detail.fields === undefined;

      if (secondFactorAsked) logger.info("auth", "Second factor requested");
      else logger.warn("auth", "Admin sign-in failed", { code: error instanceof DataSourceError ? error.code : "UNKNOWN", step });

      if (error instanceof DataSourceError && error.code === "VALIDATION") {
        const { applied } = applyFieldErrors(error, form.setError, ["email", "password"]);

        if (applied.length > 0) setStep("credentials");
        else if (totp === undefined) setStep("code");
        else setCodeError("That code was not accepted. Check your authenticator and try again.");

        setCode("");
      } else {
        setFailure(error);
        if (step === "code" && error instanceof DataSourceError && error.code === "INVALID_CREDENTIALS") setStep("credentials");
      }
    } finally {
      setPending(false);
    }
  };

  if (step === "code") {
    return (
      <form
        className="space-y-5"
        aria-label="Two-factor verification"
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
        <FormError error={failure} />
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
            leadingIcon={<ArrowLeft className="size-3.5" aria-hidden />}
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
      aria-label="Sign in"
      className="space-y-4"
      onSubmit={(event) => {
        void form.handleSubmit((values) => attempt(values))(event);
      }}
    >
      <FormError error={failure} />
      <TextField label="Work email" type="email" autoComplete="username" required autoFocus={lockedEmail === undefined} readOnly={lockedEmail !== undefined} error={form.formState.errors.email?.message} {...form.register("email")} />
      <PasswordInput label="Password" autoComplete="current-password" autoFocus={lockedEmail !== undefined} error={form.formState.errors.password?.message} {...form.register("password")} />
      <Button type="submit" full size="lg" loading={pending}>
        {pending ? "Signing in" : "Sign in"}
      </Button>
      {env.dataSource === "mock" && lockedEmail === undefined && demoSignIns.length > 0 && (
        <section aria-label="Development sign-ins" className="rounded-sm border border-dashed border-border-strong px-3 py-2.5 text-sm">
          <p className="caps-label">Mock data · development sign-ins</p>
          <ul className="mt-1.5 space-y-1">
            {demoSignIns.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => {
                    form.setValue("email", account.email, { shouldValidate: true });
                    form.setValue("password", account.password, { shouldValidate: true });
                  }}
                  className="flex w-full items-baseline justify-between gap-3 rounded-xs text-left hover:text-text-primary focus-ring"
                >
                  <span className="mono-id text-text-secondary">{account.email}</span>
                  <span className="text-text-muted">
                    {account.role}
                    {account.code === undefined ? "" : ` · code ${account.code}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  );
}
