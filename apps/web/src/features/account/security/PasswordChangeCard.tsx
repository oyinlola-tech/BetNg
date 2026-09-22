import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DataSourceError } from "@betng/ui-core";
import { Button, Card, FormError, PasswordInput, SectionHeading, applyFieldErrors, useToast } from "@betng/ui-web";
import { BreachWarning } from "../../auth/BreachWarning";
import { PasswordStrengthMeter } from "../../auth/PasswordStrengthMeter";
import { isBreachMessage } from "../../auth/passwordStrength";
import { passwordChangeSchema, type PasswordChangeValues } from "../../auth/schemas";
import { accountServices, authSource, logger } from "../../../services/runtime";
import { isNotImplemented } from "../queries";

function ResetLinkFallback({ email }: { readonly email: string | undefined }): React.JSX.Element {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>();

  const send = async (): Promise<void> => {
    if (email === undefined) return;
    setBusy(true);
    setFailure(undefined);

    try {
      await authSource.requestPasswordReset(email);
      toast({ tone: "success", title: "Reset code requested", message: "If the address is registered, a code to set a new password is on its way." });
    } catch (cause) {
      logger.warn("auth", "Password reset request failed");
      setFailure(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="type-small max-w-prose text-text-secondary">Changing the password from this page is not available from the platform yet. You can ask for a reset code by email instead.</p>
        <Button variant="secondary" loading={busy} onClick={() => void send()}>
          Email me a reset code
        </Button>
      </div>
      <FormError error={failure} />
    </div>
  );
}

export function PasswordChangeCard({ email }: { readonly email: string | undefined }): React.JSX.Element {
  const { toast } = useToast();
  const form = useForm<PasswordChangeValues>({ resolver: zodResolver(passwordChangeSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });
  const [error, setError] = useState<unknown>();
  const errors = form.formState.errors;
  const busy = form.formState.isSubmitting;
  const password = form.watch("newPassword");

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);

    try {
      await accountServices.security.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      form.reset();
      toast({ tone: "success", title: "Password changed", message: "Other devices signed in to your account have been signed out." });
    } catch (cause) {
      logger.warn("auth", "Password change failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

      const { applied, unmatched } = applyFieldErrors(cause, form.setError, ["currentPassword", "newPassword"]);

      setError(applied.length > 0 && Object.keys(unmatched).length === 0 ? undefined : cause);
    }
  });

  return (
    <Card>
      <SectionHeading as="h2">Password</SectionHeading>
      <div className="mt-3">
        {isNotImplemented(error) ? (
          <ResetLinkFallback email={email} />
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate className="max-w-md space-y-4">
            <FormError error={error} />
            <PasswordInput label="Current password" autoComplete="current-password" disabled={busy} error={errors.currentPassword?.message} {...form.register("currentPassword")} />
            <div>
              <PasswordInput label="New password" autoComplete="new-password" disabled={busy} error={errors.newPassword?.message} {...form.register("newPassword")} />
              <PasswordStrengthMeter password={password} />
            </div>
            {isBreachMessage(errors.newPassword?.message) && <BreachWarning />}
            <PasswordInput label="Confirm new password" autoComplete="new-password" disabled={busy} error={errors.confirmPassword?.message} {...form.register("confirmPassword")} />
            <Button type="submit" loading={busy}>
              Change password
            </Button>
          </form>
        )}
      </div>
    </Card>
  );
}
