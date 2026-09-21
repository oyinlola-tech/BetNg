import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { focusInitial, installRemote } from "./spatial";

export function useRemote(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(
    () =>
      installRemote({
        onBack: () => {
          // The address bar, not the router: a screen still loading has not reached the router yet.
          if (window.location.pathname === "/") return;

          void navigate(-1);
        },
      }),
    [navigate],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (document.activeElement === document.body) focusInitial();
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [location.pathname]);
}
