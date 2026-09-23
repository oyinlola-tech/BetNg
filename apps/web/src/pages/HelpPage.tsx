import { useEffect } from "react";
import { Link, useLocation } from "react-router";
import { formatAge } from "@betng/ui-core";
import { PitchRule, SectionHeading, StatusBadge, useNow, useOnline, type ErrorHelpTopic } from "@betng/ui-web";
import { usePageMeta } from "../features/seo";
import { useConnection, useLastSyncedAt } from "../hooks/useConnection";
import { paths } from "../lib/paths";

const SECTIONS = [
  { id: "how-it-works", label: "How it works" },
  { id: "responsible-use", label: "Responsible use" },
  { id: "problems", label: "When something goes wrong" },
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

const TOPICS: readonly { readonly id: ErrorHelpTopic; readonly title: string; readonly body: readonly string[] }[] = [
  {
    id: "bet-rejected",
    title: "Why was my bet not accepted?",
    body: [
      "Every bet is checked by the platform when it arrives. It can decline a bet when a market has closed or been suspended, when a price moved, when the stake is outside what the platform takes for that bet, or when its risk checks decline it.",
      "A declined bet is not placed and no stake is taken for it. The slip keeps your selections and says what the platform reported, so you can adjust and try again.",
    ],
  },
  {
    id: "stake-limited",
    title: "Why was my stake limited?",
    body: [
      "The platform sets a maximum stake per bet, which can depend on the market, the price and how much has already been staked on that outcome. When your stake is above it, the platform either accepts a lower stake or declines the bet and tells you the most it will take.",
      "When a lower stake is accepted, the ticket shows the stake the platform accepted, not the one you entered.",
    ],
  },
  {
    id: "odds-changed",
    title: "Why did the odds change?",
    body: [
      "Prices move while betting is open. Your bet is placed at the price the platform confirms, so if a price moved between adding it to the slip and placing the bet, the platform asks you to review the new price first.",
      "Choose Accept new prices in the slip to continue, or remove the selection.",
    ],
  },
  {
    id: "market-suspended",
    title: "What is a suspended market?",
    body: [
      "A market is suspended while the platform is not taking bets on it, for example around a goal, a card or a price update. Selections on a suspended market cannot be placed until it reopens.",
      "Suspended selections show a lock in the slip. They stay there until you remove them or the market reopens.",
    ],
  },
  {
    id: "betting-closed",
    title: "When does betting close?",
    body: [
      "Each match has a betting window that the platform opens and closes. Once it closes, no new bets are taken on that match, even if the page still shows its last prices.",
      "Match pages show the time betting closes while the window is open.",
    ],
  },
  {
    id: "insufficient-funds",
    title: "About your available balance",
    body: [
      "Only your available balance can be staked or withdrawn. Money held by open bets and payments still being processed is shown separately in the wallet and cannot be used until the platform releases it.",
    ],
  },
  {
    id: "limits",
    title: "How limits work",
    body: [
      "Deposit, loss and session limits you set are applied by the platform. The slip and the wallet show what is left on each limit using the platform's latest figures, and may warn you before you go over one, but the platform makes the final decision when you submit.",
      "Lowering a limit applies at once. Raising or removing one takes effect only after a waiting period.",
    ],
  },
  {
    id: "self-exclusion",
    title: "About self-exclusion",
    body: [
      "While a self-exclusion is active, betting and deposits are paused on your account. Browsing matches, results and tables stays open. The end date, if there is one, is shown on the responsible gaming page.",
    ],
  },
  {
    id: "verification",
    title: "Why verification is needed",
    body: [
      "The platform can ask for your identity to be verified before some actions, depending on your account. The verification page shows what it still needs and the status of anything you have sent.",
    ],
  },
  {
    id: "payment-failed",
    title: "Why a payment may not go through",
    body: [
      "A payment can fail at the payment provider, time out before it is completed, or be declined by your bank. A deposit is only credited once the platform confirms it; a failed or expired attempt credits nothing.",
      "The payment's status page shows what the platform reports for its reference. Starting again creates a new payment.",
    ],
  },
  {
    id: "too-many-requests",
    title: "Why am I asked to wait?",
    body: ["The platform limits how often some actions can be repeated in a short time. The message says how long to wait; after that, try again."],
  },
  {
    id: "connection-problems",
    title: "Connection problems",
    body: [
      "When this device loses its connection, the pages you have open keep showing the last data they received and say so. They refresh on their own when the connection returns.",
      "Bets, deposits and withdrawals are never queued while you are offline. If a submission was interrupted, the slip or payment page says whether the platform received it; trying again sends the same submission, so it is never placed twice.",
    ],
  },
];

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
        <p>BETNG takes bets on virtual football. Match outcomes are produced by the platform’s simulation rather than real-world fixtures, and every market is settled against that result.</p>
        <p>It is built to demonstrate a football platform, not to encourage gambling. If betting is causing you harm, speak to a local support service.</p>
      </Section>

      <Section id="problems" title="When something goes wrong">
        <p>What the messages you may see mean, and what to do next.</p>
        <div className="space-y-5 pt-1">
          {TOPICS.map((topic) => (
            <section key={topic.id} id={topic.id} aria-labelledby={`${topic.id}-title`} className="scroll-mt-32">
              <h3 id={`${topic.id}-title`} className="type-h3 text-text-primary">
                {topic.title}
              </h3>
              {topic.body.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="mt-1.5">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </Section>

      <Section id="terms" title="Terms">
        <p>Use BETNG for evaluation and demonstration. Do not rely on it for real wagering, financial decisions or as a record of real sporting events.</p>
        <p>Teams, competitions, players and results are fictional. Any resemblance to real clubs or people is unintended.</p>
        <p>The service may be changed or taken offline for maintenance. Any planned interruption is announced in advance.</p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>An account holds the email address, display name and optional phone number you provide. They are used to sign you in and to show your own activity.</p>
        <p>
          Your session is kept for the current browser tab only and ends when you sign out or close it. Theme, interface preferences and an unplaced bet slip are
          kept in this browser.
        </p>
        <p>
          BETNG does not load third-party trackers or advertising. Where usage counts are switched on, they are cookieless: only the name of an action, the page
          shape and coarse categories are sent, never your account, amounts or identifiers, and nothing is sent when your browser asks sites not to track.
        </p>
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
