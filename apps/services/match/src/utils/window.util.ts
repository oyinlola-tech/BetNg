import { LIST_LIMIT } from "../constants/index.js";

export interface KickoffWindow {
  readonly from?: Date;
  readonly to?: Date;
}

export function resolveWindow(
  bounds: {
    readonly from?: string | undefined;
    readonly to?: string | undefined;
  },
  now: Date,
  unbounded: boolean,
): KickoffWindow {
  if (bounds.from === undefined && bounds.to === undefined) {
    return unbounded
      ? {}
      : {
          from: new Date(now.getTime() - LIST_LIMIT.WINDOW_MS),
          to: new Date(now.getTime() + LIST_LIMIT.WINDOW_MS),
        };
  }

  return {
    ...(bounds.from === undefined ? {} : { from: new Date(bounds.from) }),
    ...(bounds.to === undefined ? {} : { to: new Date(bounds.to) }),
  };
}
