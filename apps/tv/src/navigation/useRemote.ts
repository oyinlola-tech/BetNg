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
          if (location.pathname === "/") return;

          void navigate(-1);
        },
      }),
    [navigate, location.pathname],
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
