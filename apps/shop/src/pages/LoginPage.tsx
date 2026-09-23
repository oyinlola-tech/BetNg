import { ShieldCheck } from "lucide-react";
import { BrandLogo, ConnectionStrip, ThemeSwitcher } from "@betng/ui-web";
import { LoginForm } from "../components/LoginForm";
import { useConnection } from "../hooks/useConnection";

export function LoginPage(): React.JSX.Element {
  const connection = useConnection();

  return (
    /*
     * Sign-in is the first screen on a terminal that may be 1024x600, so it
     * obeys the same rule as the workspace behind it: the page itself never
     * scrolls. If the card genuinely cannot fit, the centred area scrolls and
     * the header stays put, rather than the whole document growing.
     */
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <ConnectionStrip state={connection === "CONNECTING" ? "CONNECTED" : connection} />
      <header className="flex items-center justify-between px-6 py-4">
        <BrandLogo product="Shop" />
        <ThemeSwitcher />
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-4 scrollbar-thin">
        <div className="w-full max-w-md">
          <div className="rounded-md border border-border bg-surface p-6 shadow-sm sm:p-7">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Cashier sign-in</h1>
            <p className="mt-1 mb-5 text-sm text-text-muted">Use the shop code on your terminal card and your own cashier details.</p>
            <LoginForm />
          </div>
          <p className="mt-4 flex items-start gap-2 px-1 text-sm text-text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Every sale, payout and cancellation is recorded against the signed-in cashier. Sign out when you leave the counter.
          </p>
        </div>
      </main>
    </div>
  );
}
