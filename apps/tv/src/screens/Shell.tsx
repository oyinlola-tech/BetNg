import { LogoMark } from "../components/BrandMarks";
import { NavLink, Outlet, useLocation } from "react-router";
import { Radio } from "lucide-react";
import { ConnectionPill, DevelopmentBanner, ScreenBoundary } from "../components";
import { useIdleBroadcast } from "../hooks/useIdleBroadcast";
import { useNow } from "../hooks/useNow";
import { cn } from "../lib/cn";
import { useRemote } from "../navigation/useRemote";
import { getRuntimeInfo } from "../services/dataSource";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/board", label: "Board" },
  { to: "/live", label: "Live" },
  { to: "/matchday", label: "Matchday" },
  { to: "/results", label: "Results" },
  { to: "/standings", label: "Table" },
  { to: "/upcoming", label: "Next" },
] as const;

export function Shell(): React.JSX.Element {
  useRemote();
  useIdleBroadcast();

  const now = useNow(1000);
  const location = useLocation();
  const mock = getRuntimeInfo().mode === "mock";

  return (
    <div className="flex h-dvh flex-col px-[3rem] py-[1.6rem]">
      <header className="flex items-center gap-[1.4rem] whitespace-nowrap">
        <div className="flex shrink-0 items-center gap-[0.7rem]">
          <LogoMark className="size-[2.2rem]" />
          <span className="font-display text-[1.5rem] font-black tracking-tight">
            BETNG <span className="text-live">LIVE</span>
          </span>
        </div>
        <nav aria-label="Sections" className="flex gap-[0.2rem]">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={"end" in item}
              data-tv-focusable=""
              className={({ isActive }) =>
                cn(
                  "tv-focus rounded-md px-[1.1rem] py-[0.5rem] text-[1.05rem] font-semibold",
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
        <div className="ml-auto flex shrink-0 items-center gap-[0.8rem]">
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

      <footer className="mt-[1rem] flex items-center gap-[2rem] text-[0.85rem] font-medium text-text-muted">
        <Hint keys="↑ ↓ ← →" label="Move" />
        <Hint keys="OK" label="Select" />
        <Hint keys="Back" label="Previous screen" />
        {mock && <DevelopmentBanner />}
        <span className="ml-auto">
          Virtual football · simulated · no real money
        </span>
      </footer>
      <ConnectionPill />
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
