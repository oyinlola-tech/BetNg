import { useCallback, useState } from "react";
import { LogoMark } from "../components/BrandMarks";
import { NavLink, Outlet, useLocation } from "react-router";
import { Radio, Settings } from "lucide-react";
import { ConnectionPill, OddsTicker, ScreenBoundary } from "../components";
import { AmbientScreensaver } from "../components/AmbientScreensaver";
import { DimLayer } from "../components/DimLayer";
import { RemoteToast, type Toast } from "../components/RemoteToast";
import { ScheduleOverlay } from "../components/ScheduleOverlay";
import { useIdleBroadcast } from "../hooks/useIdleBroadcast";
import { useNow } from "../hooks/useNow";
import { useRemoteCommands } from "../hooks/useRemoteCommands";
import { useSoundSync } from "../hooks/useSoundSync";
import { cn } from "../lib/cn";
import { useRemote } from "../navigation/useRemote";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/board", label: "Board" },
  { to: "/live", label: "Live" },
  { to: "/multi", label: "Multi" },
  { to: "/feed", label: "Feed" },
  { to: "/matchday", label: "Today" },
  { to: "/results", label: "Results" },
  { to: "/standings", label: "Table" },
  { to: "/upcoming", label: "Next" },
] as const;

const NO_TICKER = new Set(["/settings"]);

export function Shell(): React.JSX.Element {
  const [toast, setToast] = useState<Toast | undefined>(undefined);
  const [schedule, setSchedule] = useState(false);
  const closeSchedule = useCallback(() => {
    setSchedule(false);
  }, []);

  useRemote();
  useIdleBroadcast();
  useSoundSync();
  useRemoteCommands({
    onToast: (message) => {
      setToast({ message, key: Date.now() });
    },
    onToggleSchedule: () => {
      setSchedule((open) => !open);
    },
  });

  const now = useNow(1000);
  const location = useLocation();
  const ticker = !NO_TICKER.has(location.pathname) && !location.pathname.startsWith("/replay/");

  return (
    <div className="flex h-dvh flex-col px-[3rem] py-[1.6rem]">
      <header className="flex items-center gap-[1.4rem] whitespace-nowrap">
        <div className="flex shrink-0 items-center gap-[0.7rem]">
          <LogoMark className="size-[2.2rem]" />
          <span className="font-display text-[1.5rem] font-black tracking-tight">
            BETNG <span className="text-live">LIVE</span>
          </span>
        </div>
        {/*
          * The nav yields space before anything else: the clock and the
          * connection status sit in the right group and must stay inside the
          * safe area, where an overscanning panel can still show them. Without
          * min-w-0 the nowrap items refuse to shrink and push that group off
          * the edge, where overflow:hidden simply cuts it off.
          */}
        <nav aria-label="Sections" className="flex min-w-0 flex-1 gap-[0.2rem] overflow-hidden">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item}
              data-tv-focusable=""
              className={({ isActive }) =>
                cn(
                  "tv-focus rounded-md px-[0.8rem] py-[0.5rem] text-[1.05rem] font-semibold",
                  isActive
                    ? "bg-surface-sunken text-text-primary"
                    : "text-text-muted",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-[0.8rem]">
          <NavLink
            to="/broadcast"
            data-tv-focusable=""
            className={({ isActive }) =>
              cn(
                "tv-focus inline-flex items-center gap-[0.5rem] rounded-full border px-[1rem] py-[0.45rem] text-[0.95rem] font-bold",
                isActive ? "border-live bg-live text-text-on-live" : "border-border bg-surface text-text-secondary",
              )
            }
          >
            <Radio className="size-[1rem]" aria-hidden />
            Auto Broadcast
          </NavLink>
          <NavLink
            to="/settings"
            aria-label="Settings"
            data-tv-focusable=""
            className={({ isActive }) =>
              cn(
                "tv-focus inline-flex items-center rounded-md p-[0.5rem]",
                isActive ? "bg-surface-sunken text-text-primary" : "text-text-muted",
              )
            }
          >
            <Settings className="size-[1.3rem]" aria-hidden />
          </NavLink>
          <span className="font-display text-[1.3rem] font-bold tabular text-text-secondary">
            {new Date(now).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </header>

      <main className="mt-[1.4rem] min-h-0 flex-1">
        <ScreenBoundary resetKey={location.pathname + location.search}>
          <Outlet />
        </ScreenBoundary>
      </main>

      {ticker && <OddsTicker className="mt-[0.8rem]" />}

      <footer className="mt-[0.8rem] flex items-center gap-[1.3rem] whitespace-nowrap text-[0.85rem] font-medium text-text-muted">
        <Hint keys="↑ ↓ ← →" label="Move" />
        <Hint keys="OK" label="Select" />
        <Hint keys="Back" label="Previous screen" />
        <Hint keys="CH + −" label="League" />
        <Hint keys="Vol + −" label="Volume" />
        <Hint keys="Info" label="Next 24 hours" />
        <span className="ml-auto min-w-0 truncate">
          Virtual football · 18+ · bet responsibly
        </span>
      </footer>
      <ConnectionPill />
      <RemoteToast toast={toast} />
      {schedule && <ScheduleOverlay onClose={closeSchedule} />}
      <AmbientScreensaver />
      <DimLayer />
    </div>
  );
}

function Hint({
  keys,
  label,
}: {
  readonly keys: string;
  readonly label: string;
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-[0.5rem]">
      <kbd className="rounded-xs border border-border-strong bg-surface px-[0.5rem] py-[0.1rem] font-sans text-text-secondary">
        {keys}
      </kbd>
      {label}
    </span>
  );
}
