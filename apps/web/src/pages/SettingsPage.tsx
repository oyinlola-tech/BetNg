import { useState } from "react";
import { RefreshCcw, WifiOff } from "lucide-react";
import { Button, SectionHeader, Switch } from "../components/ui";
import { ThemeSwitcher } from "../components/domain";
import { usePreferences, useSetPreferences } from "../hooks/queries";
import { appConfig } from "../configs/app.config";
import { useToast } from "../providers/ToastProvider";
import { asMock, dataSource } from "../services/dataSource";

export function SettingsPage(): React.JSX.Element {
  const prefs = usePreferences();
  const setPrefs = useSetPreferences();
  const { toast } = useToast();
  const mock = asMock(dataSource);
  const [resetting, setResetting] = useState(false);

  const update = (
    key: keyof NonNullable<typeof prefs.data>,
    value: boolean,
  ): void => {
    if (prefs.data === undefined) return;

    setPrefs.mutate({ ...prefs.data, [key]: value });
  };

  return (
    <div className="max-w-2xl space-y-8">
      <SectionHeader as="h1" eyebrow="Preferences" title="Settings" />

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-md font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-text-muted">
          Dark mode is tuned for live viewing; light mode for browsing in
          daylight. System follows your device.
        </p>
        <ThemeSwitcher showLabels className="mt-4" />
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-md font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-text-muted">
          In-app alerts for matches you have bet on or watched.
        </p>
        <div className="mt-2 divide-y divide-border">
          <Switch
            label="Match starting"
            description="When a match you follow is about to kick off"
            checked={prefs.data?.matchStarting ?? true}
            onChange={(v) => {
              update("matchStarting", v);
            }}
            disabled={prefs.data === undefined}
          />
          <Switch
            label="Full time"
            description="Final scores for matches you follow"
            checked={prefs.data?.matchFinished ?? true}
            onChange={(v) => {
              update("matchFinished", v);
            }}
            disabled={prefs.data === undefined}
          />
          <Switch
            label="Bet settled"
            description="When a simulated bet wins, loses or is voided"
            checked={prefs.data?.betSettled ?? true}
            onChange={(v) => {
              update("betSettled", v);
            }}
            disabled={prefs.data === undefined}
          />
          <Switch
            label="Goals"
            description="Every goal in matches you are watching"
            checked={prefs.data?.goals ?? false}
            onChange={(v) => {
              update("goals", v);
            }}
            disabled={prefs.data === undefined}
          />
        </div>
      </section>

      <section className="rounded-md border border-border bg-surface p-5">
        <h2 className="text-md font-semibold">Platform</h2>
        <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-text-muted">Data source</dt>
          <dd className="font-medium">
            {appConfig.dataSource === "mock"
              ? "In-browser virtual season (mock)"
              : "BetNG platform"}
          </dd>
          <dt className="text-text-muted">Gateway</dt>
          <dd className="font-mono text-xs">{appConfig.client.gatewayUrl}</dd>
          <dt className="text-text-muted">Live stream</dt>
          <dd className="font-mono text-xs">{appConfig.client.liveUrl}</dd>
        </dl>
        {mock !== undefined && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<WifiOff className="size-3.5" />}
              onClick={() => {
                mock.platform.simulateOutage(6000);
                toast({
                  tone: "info",
                  title: "Connection dropped for 6 seconds",
                  message: "Watch the live match re-synchronise.",
                });
              }}
            >
              Simulate connection loss
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCcw className="size-3.5" />}
              loading={resetting}
              onClick={() => {
                setResetting(true);
                localStorage.removeItem("betng.mock.account.v1");
                localStorage.removeItem("betng.betslip");
                window.location.reload();
              }}
            >
              Reset simulated account
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-md border border-border bg-surface p-5 text-sm text-text-secondary">
        <h2 className="text-md font-semibold text-text-primary">About</h2>
        <p className="mt-1">
          BetNG is a portfolio demonstration of a virtual football platform.
          Every balance, stake and payout is simulated and no real money is
          involved.
        </p>
      </section>
    </div>
  );
}
