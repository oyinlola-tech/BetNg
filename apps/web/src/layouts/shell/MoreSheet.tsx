import { Link } from "react-router";
import { ChevronRight, CircleHelp, ListOrdered, LogIn, LogOut, Settings, Trophy, UserRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BottomSheet, ThemeSwitcher, useFlag } from "@betng/ui-web";
import { useAuth, useLogoutFlow } from "../../features/auth";
import { paths } from "../../lib/paths";
import { InstallAppButton } from "./InstallApp";

interface MoreLink {
  readonly to: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

const ROW = "flex min-h-12 w-full items-center gap-3 rounded-sm px-2 text-md font-medium text-text-primary hover:bg-surface-hover focus-ring";

export function MoreSheet({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }): React.JSX.Element {
  const walletEnabled = useFlag("walletEnabled");
  const { status, requireAuth } = useAuth();
  const logout = useLogoutFlow();
  const signedIn = status === "AUTHENTICATED";

  const links: readonly MoreLink[] = [
    { to: paths.results, label: "Results", icon: ListOrdered },
    { to: paths.standings, label: "Standings", icon: Trophy },
    ...(walletEnabled ? [{ to: paths.wallet, label: "Wallet", icon: Wallet }] : []),
    { to: paths.account, label: "Account", icon: UserRound },
    { to: paths.settings, label: "Settings", icon: Settings },
    { to: paths.help(), label: "Help", icon: CircleHelp },
  ];

  return (
    <>
    <BottomSheet open={open} onClose={onClose} title="More">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} onClick={onClose} className={ROW}>
              <link.icon className="size-5 text-text-muted" aria-hidden />
              <span className="flex-1">{link.label}</span>
              <ChevronRight className="size-4 text-text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-border px-2 pt-4">
        <span className="text-md font-medium">Theme</span>
        <ThemeSwitcher showLabels />
      </div>
      <div className="mt-4 border-t border-border pt-2">
        <InstallAppButton className={ROW} onDone={onClose} />
        {signedIn ? (
          <button
            type="button"
            className={ROW}
            onClick={() => {
              onClose();
              logout.request();
            }}
          >
            <LogOut className="size-5 text-text-muted" aria-hidden />
            Sign out
          </button>
        ) : (
          <button
            type="button"
            className={ROW}
            onClick={() => {
              onClose();
              requireAuth({ reason: "Sign in to BETNG" });
            }}
          >
            <LogIn className="size-5 text-text-muted" aria-hidden />
            Sign in
          </button>
        )}
      </div>
    </BottomSheet>
    {logout.dialog}
    </>
  );
}
