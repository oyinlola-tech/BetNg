import { Link } from "react-router";
import { ArrowUp, ArrowUpRight, LifeBuoy, Radio, ShieldCheck } from "lucide-react";
import { WORDMARK } from "@betng/brand";
import { BrandLogo, useFeatureFlags } from "@betng/ui-web";
import { paths } from "../../lib/paths";
import { LEGAL_LINKS, legalPath } from "../../pages/legal/content";

interface FooterLink {
  readonly to: string;
  readonly label: string;
}

function Group({ index, title, links }: { readonly index: number; readonly title: string; readonly links: readonly FooterLink[] }): React.JSX.Element {
  return (
    <nav aria-label={title} className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
      <h2 className="flex items-baseline gap-2 type-caption text-text-muted">
        <span aria-hidden className="font-display tabular text-brand">
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-text-primary">{title}</span>
      </h2>
      <ul className="mt-3 space-y-0.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className="group inline-flex min-h-8 items-center gap-1 rounded-xs text-base text-text-secondary transition-colors hover:text-text-primary focus-ring">
              {link.label}
              <ArrowUpRight aria-hidden className="size-3.5 -translate-x-1 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FeatureCard({ to, icon, eyebrow, title, body }: { readonly to: string; readonly icon: React.ReactNode; readonly eyebrow: string; readonly title: string; readonly body: string }): React.JSX.Element {
  return (
    <Link to={to} className="group flex flex-col gap-3 rounded-md border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover focus-ring">
      <span className="flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-sm bg-surface-sunken text-brand">{icon}</span>
        <ArrowUpRight aria-hidden className="size-4 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </span>
      <span>
        <span className="type-caption text-text-muted">{eyebrow}</span>
        <span className="mt-0.5 block font-display text-lg font-bold leading-tight text-text-primary">{title}</span>
        <span className="mt-1 block text-sm text-text-secondary">{body}</span>
      </span>
    </Link>
  );
}

export function Footer(): React.JSX.Element {
  const flags = useFeatureFlags();

  const football: readonly FooterLink[] = [
    { to: paths.leagues, label: "Competitions" },
    ...(flags.liveEnabled ? [{ to: paths.live, label: "Live now" }] : []),
    ...(flags.virtualFootballEnabled ? [{ to: paths.virtuals, label: "Virtual football" }] : []),
    { to: paths.results, label: "Results" },
    { to: paths.standings, label: "Standings" },
  ];
  const platform: readonly FooterLink[] = [
    { to: paths.tickets, label: "My bets" },
    ...(flags.walletEnabled ? [{ to: paths.wallet, label: "Wallet" }] : []),
    { to: paths.account, label: "Account" },
    { to: paths.settings, label: "Settings" },
  ];
  const company: readonly FooterLink[] = [
    { to: paths.help("how-it-works"), label: "How BETNG works" },
    { to: legalPath("responsible-gaming"), label: "Responsible gaming" },
    { to: paths.help("system-status"), label: "System status" },
  ];
  const support: readonly FooterLink[] = [
    { to: paths.help(), label: "Help centre" },
    { to: paths.help("support"), label: "Contact support" },
    { to: legalPath("complaints"), label: "Complaints" },
  ];

  return (
    <footer data-scheme="dark" className="mt-16 overflow-hidden border-t border-border bg-background text-text-primary">
      <div className="mx-auto max-w-[1600px] px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-10 md:px-6 lg:px-8 lg:pb-24 xl:pb-8">
        <div className="grid gap-3 md:grid-cols-3">
          <FeatureCard
            to={flags.responsibleGamingEnabled ? "/responsible-gaming" : legalPath("responsible-gaming")}
            icon={<ShieldCheck className="size-5" aria-hidden />}
            eyebrow="Stay in control"
            title="Set your limits"
            body="Deposit, loss and time limits, or a break from betting when you need one."
          />
          {flags.liveEnabled ? (
            <FeatureCard to={paths.live} icon={<Radio className="size-5" aria-hidden />} eyebrow="On the pitch" title="Live now" body="Every match in play, with the score and clock straight from the platform." />
          ) : (
            <FeatureCard to={paths.results} icon={<Radio className="size-5" aria-hidden />} eyebrow="Full time" title="Latest results" body="Final scores and settled markets across every competition." />
          )}
          <FeatureCard to={paths.help("support")} icon={<LifeBuoy className="size-5" aria-hidden />} eyebrow="Support" title="Talk to us" body="Questions about a bet, a payment or your account. Quote your reference and we can trace it." />
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)]">
          <div className="flex flex-col gap-4">
            <BrandLogo size={28} />
            <p className="max-w-xs text-base text-text-secondary">Virtual football and sports platform. Live matches, markets, results and tables, with the match as the subject.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 min-[420px]:grid-cols-2 sm:gap-y-8 lg:grid-cols-4">
            <Group index={1} title="Football" links={football} />
            <Group index={2} title="Platform" links={platform} />
            <Group index={3} title="Company" links={company} />
            <Group index={4} title="Support" links={support} />
          </div>
        </div>

        <p
          aria-hidden
          className="mt-12 select-none whitespace-nowrap font-display text-[min(26.5vw,24rem)] font-extrabold uppercase leading-[0.78] tracking-[-0.06em] text-text-primary"
        >
          {WORDMARK.text}
          <span className="text-brand">{WORDMARK.accent}</span>
        </p>

        <div className="mt-6 flex flex-col gap-5 border-t border-border pt-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Legal">
              <ul className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                {LEGAL_LINKS.map((link, index) => (
                  <li key={link.slug} className="flex items-center gap-1">
                    {index > 0 && (
                      <span aria-hidden className="text-text-muted">
                        ·
                      </span>
                    )}
                    <Link to={legalPath(link.slug)} className="inline-flex min-h-8 items-center rounded-xs px-1 font-medium text-text-secondary hover:text-text-primary focus-ring">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="flex items-center gap-3">
              <span aria-label="Adults only, 18 and over" className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-text-primary px-1 text-xs font-extrabold tabular text-text-primary">
                18+
              </span>
              <span className="text-sm text-text-muted">© {new Date().getFullYear()} BETNG</span>
              <button
                type="button"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
                }}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-sm border border-border px-2.5 text-sm font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus-ring"
              >
                <ArrowUp className="size-3.5" aria-hidden />
                Back to top
              </button>
            </div>
          </div>
          <div className="max-w-3xl space-y-1.5 text-sm text-text-muted">
            <p>For adults aged 18 and over. Bet only what you can afford to lose, set limits, and take a break if it stops being fun.</p>
            <p>BETNG is a simulated platform. Matches are virtual, and balances, stakes and returns are play money with no real-world value.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
