import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { LeagueView } from "@betng/ui-core";
import { updateSettings, VOLUME_MAX } from "../lib/displaySettings";
import { reads } from "../lib/reads";
import { channelTarget, commandFor } from "../navigation/remoteKeys";

export interface RemoteCommandHandlers {
  readonly onToast: (message: string) => void;
  readonly onToggleSchedule: () => void;
}

function editing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type !== "button"));
}

export function useRemoteCommands(handlers: RemoteCommandHandlers): void {
  const navigate = useNavigate();
  const latest = useRef(handlers);

  latest.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented || editing(event.target)) return;

      const command = commandFor(event);

      if (command === undefined) return;

      event.preventDefault();
      if (event.repeat && (command === "SCHEDULE" || command === "MUTE")) return;

      switch (command) {
        case "CHANNEL_UP":
        case "CHANNEL_DOWN": {
          const step = command === "CHANNEL_UP" ? 1 : -1;

          void reads
            .listLeagues()
            .then((leagues: readonly LeagueView[]) => {
              const target = channelTarget(window.location.pathname, window.location.search, leagues.map((l) => l.id), step);

              if (target === undefined) return;
              void navigate(target.to);
              latest.current.onToast(`Channel · ${leagues.find((l) => l.id === target.leagueId)?.name ?? ""}`);
            })
            .catch(() => {
              latest.current.onToast("Leagues are unavailable right now");
            });

          return;
        }
        case "VOLUME_UP":
        case "VOLUME_DOWN": {
          let message = "";

          updateSettings((s) => {
            const volume = Math.min(VOLUME_MAX, Math.max(0, s.volume + (command === "VOLUME_UP" ? 1 : -1)));

            message = s.audioEnabled ? `Volume ${String(volume)} / ${String(VOLUME_MAX)}` : `Volume ${String(volume)} · sound is off, turn it on in Settings`;

            return { ...s, volume };
          });
          latest.current.onToast(message);

          return;
        }
        case "MUTE": {
          let message = "";

          updateSettings((s) => {
            message = s.audioEnabled ? "Sound off" : "Sound on";

            return { ...s, audioEnabled: !s.audioEnabled };
          });
          latest.current.onToast(message);

          return;
        }
        case "SCHEDULE":
          latest.current.onToggleSchedule();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [navigate]);
}
