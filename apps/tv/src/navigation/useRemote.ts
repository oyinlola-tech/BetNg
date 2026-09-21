import { useEffect } from "react";
import { useNavigate } from "react-router";
import { installFocusKeeper, installRemote } from "./spatial";

/** The router keeps the entry's position in history.state; 0 means this display opened here. */
function hasHistoryBehind(): boolean {
  const state = window.history.state as { readonly idx?: unknown } | null;

  return typeof state?.idx === "number" && state.idx > 0;
}

export function backTarget(pathname: string, canGoBack: boolean): "stay" | "home" | "back" {
  if (pathname === "/") return "stay";

  return canGoBack ? "back" : "home";
}

export function useRemote(): void {
  const navigate = useNavigate();

  useEffect(
    () =>
      installRemote({
        onBack: () => {
          // The address bar, not the router: a screen still loading has not reached the router yet.
          const target = backTarget(window.location.pathname, hasHistoryBehind());

          if (target === "back") void navigate(-1);
          else if (target === "home") void navigate("/", { replace: true });
        },
      }),
    [navigate],
  );

  useEffect(() => installFocusKeeper(), []);
}
