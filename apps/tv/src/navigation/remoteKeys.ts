export type RemoteCommand = "CHANNEL_UP" | "CHANNEL_DOWN" | "VOLUME_UP" | "VOLUME_DOWN" | "MUTE" | "SCHEDULE";

const COMMANDS: Readonly<Record<string, RemoteCommand>> = {
  ChannelUp: "CHANNEL_UP",
  PageUp: "CHANNEL_UP",
  "]": "CHANNEL_UP",
  ChannelDown: "CHANNEL_DOWN",
  PageDown: "CHANNEL_DOWN",
  "[": "CHANNEL_DOWN",
  AudioVolumeUp: "VOLUME_UP",
  "+": "VOLUME_UP",
  "=": "VOLUME_UP",
  AudioVolumeDown: "VOLUME_DOWN",
  "-": "VOLUME_DOWN",
  _: "VOLUME_DOWN",
  AudioVolumeMute: "MUTE",
  Info: "SCHEDULE",
  Guide: "SCHEDULE",
  i: "SCHEDULE",
  g: "SCHEDULE",
};

export function commandFor(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">): RemoteCommand | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey) return undefined;

  return COMMANDS[event.key];
}

export const LEAGUE_PATHS: readonly string[] = ["/board", "/standings", "/results"];

/* Channel up and down step through the platform's leagues on a league screen, or open the board on the next one from anywhere else. */
export function channelTarget(pathname: string, search: string, leagueIds: readonly string[], step: 1 | -1): { readonly to: string; readonly leagueId: string } | undefined {
  if (leagueIds.length === 0) return undefined;

  const current = new URLSearchParams(search).get("league");
  const index = current === null ? -1 : leagueIds.indexOf(current);
  const nextIndex = index === -1 ? (step === 1 ? 0 : leagueIds.length - 1) : (index + step + leagueIds.length) % leagueIds.length;
  const leagueId = leagueIds[nextIndex] as string;
  const path = LEAGUE_PATHS.includes(pathname) ? pathname : "/board";

  return { to: `${path}?league=${encodeURIComponent(leagueId)}`, leagueId };
}
