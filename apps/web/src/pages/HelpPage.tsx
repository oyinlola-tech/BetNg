import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { formatAge } from "@betng/ui-core";
import { PitchRule, SectionHeading, StatusBadge, useNow, useOnline } from "@betng/ui-web";
import { usePageMeta } from "../features/seo";
import { useConnection, useLastSyncedAt } from "../hooks/useConnection";
import { paths } from "../lib/paths";

const SECTIONS = [
  { id: "how-it-works", label: "How it works" },
  { id: "responsible-use", label: "Responsible use" },
  { id: "terms", label: "Terms" },
  { id: "privacy", label: "Privacy" },
  { id: "support", label: "Support" },
  { id: "system-status", label: "System status" },
] as const;

function Section({ id, title, children }: { readonly id: string; readonly title: string; readonly children: React.ReactNode }): React.JSX.Element {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32">
      <SectionHeading id={`${id}-title`}>{title}</SectionHeading>
      <div className="mt-3 max-w-2xl space-y-3 text-md text-text-secondary">{children}</div>
    </section>
  );
}

function SystemStatus(): React.JSX.Element {
  const online = useOnline();
  const connection = useConnection();
  const lastSyncedAt = useLastSyncedAt();
  const now = useNow(10_000);
  const healthy = online && (connection === "CONNECTED" || connection === "CONNECTING");
  const live = !online
    ? { tone: "danger" as const, label: "Offline", text: "This device has no network connection." }
    : connection === "CONNECTED"
      ? { tone: "success" as const, label: "Connected", text: "Live updates are arriving." }
      : connection === "CONNECTING"
        ? { tone: "neutral" as const, label: "Standing by", text: "Live updates connect when a match is opened." }
        : connection === "RECONNECTING"
          ? { tone: "warning" as const, label: "Reconnecting", text: "Live updates were interrupted and are being restored." }
          : { tone: "danger" as const, label: "Unavailable", text: "Live updates cannot be reached. Pages still refresh on their own." };

  return (
    <dl className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface text-base">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="min-w-0">
          <span className="block font-medium text-text-primary">Live updates</span>
          <span className="block type-small text-text-muted">{live.text}</span>
        </dt>
        <dd>
          <StatusBadge tone={live.tone}>{live.label}</StatusBadge>
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="font-medium text-text-primary">Last successful update</dt>
        <dd className="type-data text-text-secondary">{lastSyncedAt === undefined ? "None yet" : formatAge(new Date(lastSyncedAt).toISOString(), now)}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="font-medium text-text-primary">Overall</dt>
        <dd>
          <StatusBadge tone={healthy ? "success" : "warning"}>{healthy ? "Operational" : "Degraded"}</StatusBadge>
        </dd>
      </div>
    </dl>
  );
}

export function HelpPage(): React.JSX.Element {
  const location = useLocation();

  usePageMeta({ title: "Help", description: "How BETNG works, responsible use, terms, privacy, support and system status." });

  useEffect(() => {
    if (location.hash === "") return;

    document.getElementById(location.hash.slice(1))?.scrollIntoView?.({ block: "start" });
  }, [location.hash]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="type-h1">Help</h1>
        <p className="mt-1 max-w-2xl text-base text-text-secondary">What BETNG is, how to use it, and where things stand right now.</p>
        <nav aria-label="Help sections" className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <Link
              key={section.id}
              to={paths.help(section.id)}
              className="inline-flex h-9 items-center rounded-sm border border-border bg-surface px-3 text-base font-medium text-text-secondary hover:border-border-strong hover:text-text-primary focus-ring"
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </header>

      <Section id="how-it-works" title="How it works">
        <p>
          BETNG runs virtual football. Every competition plays matchdays on a fixed cycle: betting opens, betting closes, the match is played, and bets are settled
          when it ends.
        </p>
        <p>
          The platform decides everything that matters: scores, the match clock, prices, whether a market is open, whether a bet is accepted and what it pays. This
          site shows what the platform reports and nothing else.
        </p>
        <p>
          Pick a price to add it to your slip, set a stake and place the bet. The slip shows an estimated return; the accepted bet shows the figure the platform
          confirmed.
        </p>
      </Section>

      <Section id="responsible-use" title="Responsible use">
        <p>BETNG is a simulation. Balances, stakes and returns are play money and can never be withdrawn or exchanged for anything of value.</p>
        <p>It is built to demonstrate a football platform, not to encourage gambling. If betting is causing you harm, speak to a local support service.</p>
      </Section>

      <Section id="terms" title="Terms">
        <p>Use BETNG for evaluation and demonstration. Do not rely on it for real wagering, financial decisions or as a record of real sporting events.</p>
        <p>Teams, competitions, players and results are fictional. Any resemblance to real clubs or people is unintended.</p>
        <p>The service may be reset, changed or taken offline at any time, and simulated balances may be cleared.</p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>An account holds the email address, display name and optional phone number you provide. They are used to sign you in and to show your own activity.</p>
        <p>
          Your session is kept for the current browser tab only and ends when you sign out or close it. Theme, interface preferences and an unplaced bet slip are
          kept in this browser.
        </p>
        <p>BETNG does not load third-party trackers or advertising.</p>
      </Section>

      <Section id="support" title="Support">
        <p>
          When something fails, the error panel shows a request reference. Quote that reference when reporting a problem so the request can be found in the
          platform logs.
        </p>
        <p>Most interruptions clear on their own: pages refresh in the background and live matches resynchronise after a reconnect.</p>
      </Section>

      <PitchRule />

      <Section id="system-status" title="System status">
        <SystemStatus />
      </Section>
    </div>
  );
}
