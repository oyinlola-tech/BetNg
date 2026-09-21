import type { ColorTheme, StateTone } from "@betng/design-tokens";

export interface ToneColors {
  readonly fg: string;
  readonly bg: string;
}

export function toneColors(c: ColorTheme, tone: StateTone): ToneColors {
  switch (tone) {
    case "live":
      return { fg: c.live, bg: c.liveSubtle };
    case "brand":
      return { fg: c.brand, bg: c.brandSubtle };
    case "warning":
      return { fg: c.warning, bg: c.warningSubtle };
    case "success":
      return { fg: c.success, bg: c.successSubtle };
    case "danger":
      return { fg: c.danger, bg: c.dangerSubtle };
    case "info":
      return { fg: c.info, bg: c.infoSubtle };
    case "pending":
      return { fg: c.pending, bg: c.pendingSubtle };
    case "void":
      return { fg: c.void, bg: c.voidSubtle };
    case "suspended":
      return { fg: c.suspended, bg: c.suspendedSubtle };
    case "neutral":
      return { fg: c.textSecondary, bg: c.surfaceSunken };
    case "muted":
      return { fg: c.textMuted, bg: c.surfaceSunken };
  }
}
