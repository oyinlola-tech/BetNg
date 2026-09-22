import { createContext, useContext } from "react";
import { CircleHelp } from "lucide-react";
import type { BetRejectionReason, DataSourceErrorCode } from "@betng/ui-core";
import { cn } from "../lib/cn";

export type ErrorHelpTopic =
  | "bet-rejected"
  | "stake-limited"
  | "odds-changed"
  | "market-suspended"
  | "betting-closed"
  | "insufficient-funds"
  | "limits"
  | "self-exclusion"
  | "verification"
  | "payment-failed"
  | "too-many-requests"
  | "connection-problems";

const BY_CODE: Partial<Record<DataSourceErrorCode, ErrorHelpTopic>> = {
  BET_REJECTED: "bet-rejected",
  STAKE_LIMITED: "stake-limited",
  ODDS_CHANGED: "odds-changed",
  MARKET_SUSPENDED: "market-suspended",
  BETTING_CLOSED: "betting-closed",
  INSUFFICIENT_FUNDS: "insufficient-funds",
  LIMIT_EXCEEDED: "limits",
  SELF_EXCLUDED: "self-exclusion",
  KYC_REQUIRED: "verification",
  PAYMENT_FAILED: "payment-failed",
  RATE_LIMITED: "too-many-requests",
  NETWORK: "connection-problems",
  OFFLINE: "connection-problems",
  TIMEOUT: "connection-problems",
};

const BY_REASON: Record<BetRejectionReason, ErrorHelpTopic> = {
  MARKET_CLOSED: "betting-closed",
  MARKET_SUSPENDED: "market-suspended",
  ODDS_CHANGED: "odds-changed",
  STAKE_LIMITED: "stake-limited",
  RISK_REJECTED: "bet-rejected",
  INSUFFICIENT_FUNDS: "insufficient-funds",
  INVALID_BET: "bet-rejected",
};

export function errorHelpTopic(code: DataSourceErrorCode | undefined): ErrorHelpTopic | undefined {
  return code === undefined ? undefined : BY_CODE[code];
}

export function rejectionHelpTopic(reason: BetRejectionReason | undefined): ErrorHelpTopic {
  return reason === undefined ? "bet-rejected" : BY_REASON[reason];
}

export interface ErrorHelpLinkProps {
  readonly href: string;
  readonly className: string;
  readonly children: React.ReactNode;
}

export interface ErrorHelpContextValue {
  /** Where a topic is explained, or undefined when this app has no page for it. */
  readonly hrefFor: (topic: ErrorHelpTopic) => string | undefined;
  /** Renders the link, e.g. with the router's `Link`; a plain anchor otherwise. */
  readonly renderLink?: (props: ErrorHelpLinkProps) => React.ReactNode;
}

const ErrorHelpContext = createContext<ErrorHelpContextValue | undefined>(undefined);

export function ErrorHelpProvider({ value, children }: { readonly value: ErrorHelpContextValue; readonly children: React.ReactNode }): React.JSX.Element {
  return <ErrorHelpContext.Provider value={value}>{children}</ErrorHelpContext.Provider>;
}

const TOPIC_LABEL: Record<ErrorHelpTopic, string> = {
  "bet-rejected": "Why was my bet not accepted?",
  "stake-limited": "Why was my stake limited?",
  "odds-changed": "Why did the odds change?",
  "market-suspended": "What is a suspended market?",
  "betting-closed": "When does betting close?",
  "insufficient-funds": "About your available balance",
  limits: "How limits work",
  "self-exclusion": "About self-exclusion",
  verification: "Why verification is needed",
  "payment-failed": "Why a payment may not go through",
  "too-many-requests": "Why am I asked to wait?",
  "connection-problems": "Connection problems",
};

export interface ErrorHelpProps {
  readonly topic: ErrorHelpTopic | undefined;
  readonly label?: string;
  readonly className?: string;
}

/** A link to the explanation of a failure. Renders nothing outside an `ErrorHelpProvider` or for a topic the app does not explain. */
export function ErrorHelp({ topic, label, className }: ErrorHelpProps): React.JSX.Element | null {
  const context = useContext(ErrorHelpContext);
  const href = topic === undefined ? undefined : context?.hrefFor(topic);

  if (topic === undefined || href === undefined || context === undefined) return null;

  const classes = cn("inline-flex items-center gap-1 rounded-xs text-sm font-semibold text-brand hover:underline focus-ring", className);
  const children = (
    <>
      <CircleHelp className="size-3.5 shrink-0" aria-hidden />
      {label ?? TOPIC_LABEL[topic]}
    </>
  );

  if (context.renderLink !== undefined) return <>{context.renderLink({ href, className: classes, children })}</>;

  return (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}
