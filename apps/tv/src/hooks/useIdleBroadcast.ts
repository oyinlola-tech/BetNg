import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

const IDLE_MS = 60_000;
const RESUME_KEY = "betng.tv.broadcast";

function wasBroadcasting(): boolean {
  try {
    return localStorage.getItem(RESUME_KEY) === "on";
  } catch {
    return false;
  }
}

/** A display nobody is holding a remote for becomes the channel: after a minute without input, or at once if it was broadcasting when it last ran. */
export function useIdleBroadcast(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/" && wasBroadcasting()) void navigate("/broadcast", { replace: true });
    // Resume once, at start-up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pathname === "/broadcast") return;

    let timer = setTimeout(start, IDLE_MS);

    function start(): void {
      void navigate("/broadcast");
    }

    function reset(): void {
      clearTimeout(timer);
      timer = setTimeout(start, IDLE_MS);
    }

    document.addEventListener("keydown", reset);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", reset);
    };
  }, [pathname, navigate]);
}
