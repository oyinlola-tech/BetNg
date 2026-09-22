import { Lock } from "lucide-react";
import { BrandLogo, ThemeSwitcher } from "@betng/ui-web";
import { LoginForm } from "../components/LoginForm";
import { env } from "../services/runtime";

export function LoginPage(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
          <BrandLogo product="Admin" size={32} />
          <div>
            <p className="caps-label">Control plane</p>
            <p className="mt-2 max-w-sm font-display text-3xl font-bold leading-tight tracking-tight text-text-primary">Monitor, configure, operate and audit the simulated football platform.</p>
            <dl className="mt-8 grid max-w-sm grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {[
                ["Results", "Come only from the simulation service. Nothing here can write one."],
                ["Actions", "Every change needs a reason and lands in the audit log."],
                ["Access", "Role-based. The platform enforces every permission again."],
                ["Money", "Simulated naira. Nothing here moves real funds."],
              ].map(([term, text]) => (
                <div key={term}>
                  <dt className="font-semibold text-text-primary">{term}</dt>
                  <dd className="mt-0.5 text-text-muted">{text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mono-id text-text-muted">{env.appEnv} · platform</p>
          <svg aria-hidden viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -top-24 size-[26rem] text-border">
            <circle cx="200" cy="200" r="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="200" cy="200" r="4" fill="currentColor" />
            <line x1="200" y1="0" x2="200" y2="400" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </aside>
        <main className="flex flex-col items-center justify-center px-5 py-10">
          <div className="w-full max-w-sm">
            <BrandLogo product="Admin" className="mb-8 lg:hidden" />
            <div className="mb-6 flex items-center gap-2">
              <Lock className="size-4 text-text-muted" aria-hidden />
              <h1 className="type-h2">Sign in to the console</h1>
            </div>
            <LoginForm />
            <div className="mt-8 flex items-center justify-between text-sm text-text-muted">
              <span>Private system. Activity is recorded.</span>
              <ThemeSwitcher />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
