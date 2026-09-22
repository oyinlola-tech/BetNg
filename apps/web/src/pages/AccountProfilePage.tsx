import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Pencil } from "lucide-react";
import type { CustomerProfile } from "@betng/contracts";
import { DataSourceError, formatDateTime } from "@betng/ui-core";
import { Button, Card, FormError, Input, ProfileSkeleton, SectionHeading, StatusBadge, applyFieldErrors, useToast } from "@betng/ui-web";
import { useAuth } from "../features/auth";
import { downloadJson, exportFileName } from "../features/account/downloadJson";
import { profileDefaults, profileFormSchema, toProfileRequest, type ProfileFormValues } from "../features/account/profileSchema";
import { isNotImplemented } from "../features/account/queries";
import { Unavailable } from "../features/account/Unavailable";
import { usePageMeta } from "../features/seo";
import { accountServices, logger } from "../services/runtime";

const EMAIL_HINT = "Your email address signs you in, so it changes through its own verified flow rather than here.";

function ProfileForm({ user, onDone }: { readonly user: CustomerProfile; readonly onDone: () => void }): React.JSX.Element {
  const { toast } = useToast();
  const form = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: profileDefaults(user), mode: "onTouched" });
  const [error, setError] = useState<unknown>();
  const [unavailable, setUnavailable] = useState(false);
  const errors = form.formState.errors;
  const busy = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);

    if (values.phone.trim() === "" && user.phone !== undefined) {
      form.setError("phone", { type: "manual", message: "A phone number can't be removed here. Enter a new one instead." });

      return;
    }

    const request = toProfileRequest(values, user);

    if (request === undefined) {
      form.setError("root", { type: "manual", message: "Change at least one field before saving." });

      return;
    }

    try {
      await accountServices.profile.update(request);
      toast({ tone: "success", title: "Profile updated", message: "Your details were saved." });
      onDone();
    } catch (cause) {
      logger.warn("flow", "Profile update failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });

      if (isNotImplemented(cause)) {
        setUnavailable(true);

        return;
      }

      const { applied, unmatched } = applyFieldErrors(cause, form.setError, ["displayName", "phone"]);

      setError(applied.length > 0 && Object.keys(unmatched).length === 0 ? undefined : cause);
    }
  });

  if (unavailable) {
    return (
      <div className="mt-4">
        <Unavailable
          title="Profile editing is not available yet"
          description="The platform does not accept profile changes at the moment. Your details are unchanged."
          action={
            <Button variant="secondary" size="sm" onClick={onDone}>
              Back to profile
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate aria-label="Edit profile" className="mt-4 space-y-4">
      <FormError error={error} />
      {errors.root?.message !== undefined && (
        <p role="alert" className="type-small text-danger">
          {errors.root.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Display name" autoComplete="nickname" disabled={busy} error={errors.displayName?.message} {...form.register("displayName")} />
        <Input label="Email" type="email" value={user.email} readOnly autoComplete="off" hint={EMAIL_HINT} />
        <Input label="Phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+234 800 000 0000" disabled={busy} error={errors.phone?.message} {...form.register("phone")} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Save changes
        </Button>
      </div>
    </form>
  );
}

function ProfileDetails({ user }: { readonly user: CustomerProfile }): React.JSX.Element {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Input label="Display name" value={user.displayName} readOnly autoComplete="off" />
      <Input label="Email" type="email" value={user.email} readOnly autoComplete="off" hint={EMAIL_HINT} />
      <Input label="Phone" type="tel" value={user.phone ?? ""} placeholder="Not provided" readOnly autoComplete="off" />
    </div>
  );
}

function DataExport(): React.JSX.Element {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();

  const run = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);

    try {
      const data = await accountServices.profile.exportData();

      downloadJson(data, exportFileName());
      toast({ tone: "success", title: "Download ready", message: "Your account data was saved as a JSON file." });
    } catch (cause) {
      logger.warn("flow", "Account data export failed", { code: cause instanceof DataSourceError ? cause.code : "UNKNOWN" });
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="profile-export" className="mt-5 border-t border-border pt-4">
      <h3 id="profile-export" className="type-h3 text-text-primary">
        Your data
      </h3>
      {isNotImplemented(error) ? (
        <div className="mt-2">
          <Unavailable title="Data download is not available yet" description="The platform does not offer an account data export at the moment." />
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="type-small max-w-prose text-text-secondary">Download a copy of the identity data BETNG holds for your account, exactly as the platform returns it.</p>
            <Button variant="secondary" size="sm" loading={busy} leadingIcon={<Download className="size-3.5" aria-hidden />} onClick={() => void run()}>
              Download my data
            </Button>
          </div>
          <FormError error={error} />
        </div>
      )}
    </section>
  );
}

export function AccountProfilePage(): React.JSX.Element {
  usePageMeta({ title: "Profile", noindex: true });

  const { user } = useAuth();
  const [editing, setEditing] = useState(false);

  if (user === undefined) return <ProfileSkeleton />;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SectionHeading as="h2">Profile</SectionHeading>
          <StatusBadge status={user.status} />
        </div>
        {!editing && (
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil className="size-3.5" aria-hidden />}
            onClick={() => {
              setEditing(true);
            }}
          >
            Edit profile
          </Button>
        )}
      </div>
      {editing ? (
        <ProfileForm
          key={`${user.displayName}|${user.phone ?? ""}`}
          user={user}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : (
        <ProfileDetails user={user} />
      )}
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
        <div>
          <dt className="type-caption">Member since</dt>
          <dd className="type-data mt-0.5 text-text-primary">{formatDateTime(user.createdAt)}</dd>
        </div>
        <div>
          <dt className="type-caption">Last active</dt>
          <dd className="type-data mt-0.5 text-text-primary">{formatDateTime(user.lastActiveAt)}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="type-caption">Account ID</dt>
          <dd className="type-data mt-0.5 break-all font-mono text-text-primary">{user.id}</dd>
        </div>
      </dl>
      <DataExport />
    </Card>
  );
}
