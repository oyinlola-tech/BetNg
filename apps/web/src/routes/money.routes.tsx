import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router";
import { PageSkeleton } from "@betng/ui-web";
import type { AuthIntentName } from "../features/auth/auth.store";
import { RequireAuth } from "../features/auth/RequireAuth";

type Loader = () => Promise<{ readonly default: React.ComponentType }>;

function page(load: Loader, intent: AuthIntentName): React.ComponentType {
  const Loaded = lazy(load);

  return function Page() {
    return (
      <RequireAuth intent={intent}>
        <Suspense fallback={<PageSkeleton cards={2} />}>
          <Loaded />
        </Suspense>
      </RequireAuth>
    );
  };
}

const DepositPage = page(() => import("../pages/DepositPage").then((m) => ({ default: m.DepositPage })), "wallet");
const WithdrawPage = page(() => import("../pages/WithdrawPage").then((m) => ({ default: m.WithdrawPage })), "wallet");
const BankAccountsPage = page(() => import("../pages/BankAccountsPage").then((m) => ({ default: m.BankAccountsPage })), "wallet");
const PaymentsPage = page(() => import("../pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })), "wallet");
const PaymentReturnPage = page(() => import("../pages/PaymentStatusPage").then((m) => ({ default: m.PaymentReturnPage })), "wallet");
const PaymentStatusPage = page(() => import("../pages/PaymentStatusPage").then((m) => ({ default: m.PaymentStatusPage })), "wallet");
const StatementsPage = page(() => import("../pages/StatementsPage").then((m) => ({ default: m.StatementsPage })), "wallet");
const KycPage = page(() => import("../pages/KycPage").then((m) => ({ default: m.KycPage })), "account");
const ResponsibleGamingPage = page(() => import("../pages/ResponsibleGamingPage").then((m) => ({ default: m.ResponsibleGamingPage })), "account");

/** Wallet, payments, bank accounts, statements, KYC and responsible gaming. Mounted under the app shell; `/wallet` itself lives in the account routes. */
export const moneyRoutes: RouteObject[] = [
  { path: "wallet/deposit", Component: DepositPage },
  { path: "wallet/withdraw", Component: WithdrawPage },
  { path: "wallet/bank-accounts", Component: BankAccountsPage },
  { path: "payments", Component: PaymentsPage },
  { path: "payments/return", Component: PaymentReturnPage },
  { path: "payments/:reference", Component: PaymentStatusPage },
  { path: "statements", Component: StatementsPage },
  { path: "kyc", Component: KycPage },
  { path: "responsible-gaming", Component: ResponsibleGamingPage },
];
