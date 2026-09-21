import { Link } from "react-router";
import { DataSourceError, type FeatureFlag } from "@betng/ui-core";
import { OfflineState, useFlag, useOnline } from "@betng/ui-web";
import { Unavailable } from "../account/Unavailable";
import { AccountErrorState } from "../auth";

export function isNotImplemented(error: unknown): boolean {
  return error instanceof DataSourceError && error.code === "NOT_IMPLEMENTED";
}

export interface BackLink {
  readonly to: string;
  readonly label: string;
}

const WALLET: BackLink = { to: "/wallet", label: "Back to wallet" };

function BackAction({ back }: { readonly back: BackLink }): React.JSX.Element {
  return (
    <Link to={back.to} className="type-small rounded-xs font-semibold text-brand hover:underline focus-ring">
      {back.label}
    </Link>
  );
}

export interface ServiceUnavailableProps {
  readonly title?: string;
  readonly description?: string;
  readonly back?: BackLink;
}

export function ServiceUnavailable({
  title = "Not available yet",
  description = "This service is not available on the platform yet. Nothing has been changed on your account.",
  back = WALLET,
}: ServiceUnavailableProps): React.JSX.Element {
  return <Unavailable title={title} description={description} action={<BackAction back={back} />} />;
}

export interface ServiceErrorProps {
  readonly error: unknown;
  readonly onRetry?: () => void;
  readonly compact?: boolean;
  readonly back?: BackLink;
}

/** A service that is not deployed reads as unavailable; offline reads as offline; everything else uses the account error wording. */
export function ServiceError({ error, onRetry, compact = false, back = WALLET }: ServiceErrorProps): React.JSX.Element {
  const online = useOnline();

  if (isNotImplemented(error)) return <ServiceUnavailable back={back} />;
  if (!online) return <OfflineState {...(onRetry === undefined ? {} : { onRetry })} />;

  return <AccountErrorState error={error} compact={compact} {...(onRetry === undefined ? {} : { onRetry })} />;
}

export interface FlagGuardProps {
  readonly flag: FeatureFlag;
  readonly title: string;
  readonly description: string;
  readonly back?: BackLink;
  readonly children: React.ReactNode;
}

/** A switched-off feature shows a plain unavailable state instead of its screen. */
export function FlagGuard({ flag, title, description, back = WALLET, children }: FlagGuardProps): React.JSX.Element {
  return useFlag(flag) ? <>{children}</> : <ServiceUnavailable title={title} description={description} back={back} />;
}
