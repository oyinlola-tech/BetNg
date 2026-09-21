import { Link } from "react-router";
import { WORDMARK } from "@betng/brand";
import { BrandLogo, PitchRule, useFeatureFlags } from "@betng/ui-web";
import { paths } from "../../lib/paths";

interface FooterLink {
  readonly to: string;
  readonly label: string;
}

function Group({ title, links }: { readonly title: string; readonly links: readonly FooterLink[] }): React.JSX.Element {
  return (
    <nav aria-label={title}>
      <h2 className="type-caption">{title}</h2>
      <ul className="mt-3 space-y-0.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className="inline-flex min-h-8 items-center rounded-xs text-base text-text-secondary hover:text-text-primary focus-ring">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer(): React.JSX.Element {
  const flags = useFeatureFlags();

  const football: readonly FooterLink[] = [
    { to: paths.leagues, label: "Football" },
    ...(flags.virtualFootballEnabled ? [{ to: paths.virtuals, label: "Virtual Football" }] : []),
    { to: paths.results, label: "Results" },
    { to: paths.standings, label: "Standings" },
  ];
  const platform: readonly FooterLink[] = [
    { to: paths.account, label: "Account" },
    ...(flags.walletEnabled ? [{ to: paths.wallet, label: "Wallet" }] : []),
    { to: paths.help("support"), label: "Support" },
  ];
  const legal: readonly FooterLink[] = [
    { to: paths.help("responsible-use"), label: "Responsible use" },
    { to: paths.help("terms"), label: "Terms" },
    { to: paths.help("privacy"), label: "Privacy" },
    { to: paths.help("system-status"), label: "System status" },
  ];

  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-[1600px] px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-12 md:px-6 lg:px-8 lg:pb-24 xl:pb-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <p className="font-display text-[clamp(3.5rem,11vw,7rem)] font-extrabold uppercase leading-none tracking-[-0.04em] text-text-primary">
              {WORDMARK.text}
              <span className="text-brand">{WORDMARK.accent}</span>
            </p>
            <p className="mt-4 max-w-sm text-base text-text-secondary">
              A football command center. Live matches, markets, results and tables, with the match as the subject.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <Group title="Football" links={football} />
            <Group title="Platform" links={platform} />
            <Group title="Legal" links={legal} />
          </div>
        </div>
        <PitchRule className="my-10" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <BrandLogo size={24} />
          <p className="max-w-2xl text-sm text-text-muted sm:text-right">
            BETNG is a simulated platform. Matches are virtual, and balances, stakes and returns are play money with no real-world value.
          </p>
        </div>
      </div>
    </footer>
  );
}
