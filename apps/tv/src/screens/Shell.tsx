import { NavLink, Outlet } from "react-router";
import { Moon, Radio, Sun } from "lucide-react";
import { ConnectionPill } from "../components";
import { useBroadcastDirector } from "../hooks/useBroadcastDirector";
import { useBroadcastMode } from "../hooks/useBroadcastMode";
import { useNow } from "../hooks/useNow";
import { useTvTheme } from "../hooks/useTheme";
import { cn } from "../lib/cn";
import { useRemote } from "../navigation/useRemote";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/live", label: "Live" },
  { to: "/matchday", label: "Matchday" },
  { to: "/results", label: "Results" },
  { to: "/standings", label: "Table" },
  { to: "/upcoming", label: "Next" },
] as const;

export function Shell(): React.JSX.Element {
  useRemote();
  useBroadcastDirector();

  const now = useNow(1000);
  const [theme, toggleTheme] = useTvTheme();
  const [broadcast, setBroadcast] = useBroadcastMode();

  return (
    <div className="flex h-dvh flex-col px-[3rem] py-[1.6rem]">
      <header className="flex items-center gap-[2rem]">
        <div className="flex items-center gap-[0.7rem]">
          <span className="flex size-[2.2rem] items-center justify-center rounded-sm bg-brand font-display text-[1.1rem] font-black text-white">
            B
          </span>
          <span className="font-display text-[1.5rem] font-black tracking-tight">
            BetNG <span className="text-live">LIVE</span>
          </span>
        </div>
        <nav aria-label="Sections" className="flex gap-[0.4rem]">
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
        <div className="ml-auto flex items-center gap-[0.8rem]">
          <button
            type="button"
            data-tv-focusable=""
            aria-pressed={broadcast}
            onClick={() => {
              setBroadcast(!broadcast);
            }}
            className={cn(
              "tv-focus inline-flex items-center gap-[0.5rem] rounded-full border px-[1rem] py-[0.45rem] text-[0.95rem] font-bold",
              broadcast
                ? "border-live bg-live text-white"
                : "border-border bg-surface text-text-secondary",
            )}
          >
            <Radio className="size-[1rem]" aria-hidden />
            {broadcast ? "Broadcast mode on" : "Broadcast mode"}
          </button>
          <button
            type="button"
            data-tv-focusable=""
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
            className="tv-focus inline-flex size-[2.4rem] items-center justify-center rounded-full border border-border bg-surface text-text-secondary"
          >
            {theme === "dark" ? (
              <Sun className="size-[1.1rem]" />
            ) : (
              <Moon className="size-[1.1rem]" />
            )}
          </button>
          <span className="font-display text-[1.3rem] font-bold tabular text-text-secondary">
            {new Date(now).toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </header>

      <main className="mt-[1.4rem] min-h-0 flex-1">
        <Outlet />
      </main>

      <footer className="mt-[1rem] flex items-center gap-[2rem] text-[0.85rem] font-medium text-text-muted">
        <Hint keys="↑ ↓ ← →" label="Move" />
        <Hint keys="OK" label="Select" />
        <Hint keys="Back" label="Previous screen" />
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
