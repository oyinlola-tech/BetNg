import { formatDateTime } from "@betng/ui-core";
import { Card, Input, ProfileSkeleton, SectionHeading, StatusBadge } from "@betng/ui-web";
import { useAuth } from "../features/auth";
import { usePageMeta } from "../features/seo";

export function AccountProfilePage(): React.JSX.Element {
  usePageMeta({ title: "Profile", noindex: true });

  const { user } = useAuth();

  if (user === undefined) return <ProfileSkeleton />;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <SectionHeading as="h2">Profile</SectionHeading>
        <StatusBadge status={user.status} />
      </div>
      <p className="type-small mt-2 text-text-muted">These details come from your BETNG account. Editing them here is not available yet, so the fields are read-only.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input label="Display name" value={user.displayName} readOnly autoComplete="off" />
        <Input label="Email" type="email" value={user.email} readOnly autoComplete="off" />
        <Input label="Phone" type="tel" value={user.phone ?? ""} placeholder="Not provided" readOnly autoComplete="off" />
      </div>
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
    </Card>
  );
}
