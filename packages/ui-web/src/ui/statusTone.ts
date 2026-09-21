import {
  Ban,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  CircleSlash,
  Clock,
  Gauge,
  Lock,
  PauseCircle,
  Radio,
  RotateCcw,
  TimerOff,
  Trophy,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type StatusTone =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "live"
  | "pending"
  | "void"
  | "suspended"
  | "neutral"
  | "brand";

export interface StatusPresentation {
  readonly tone: StatusTone;
  readonly icon: LucideIcon;
  readonly label: string;
}

interface StatusPreset {
  readonly tone: StatusTone;
  readonly icon: LucideIcon;
}

const open: StatusPreset = { tone: "success", icon: CircleDot };
const done: StatusPreset = { tone: "success", icon: CheckCircle2 };
const waiting: StatusPreset = { tone: "pending", icon: Clock };
const failed: StatusPreset = { tone: "danger", icon: XCircle };
const stopped: StatusPreset = { tone: "neutral", icon: Ban };
const voided: StatusPreset = { tone: "void", icon: CircleSlash };
const paused: StatusPreset = { tone: "suspended", icon: PauseCircle };
const closed: StatusPreset = { tone: "neutral", icon: Lock };
const live: StatusPreset = { tone: "live", icon: Radio };
const reversed: StatusPreset = { tone: "info", icon: RotateCcw };

const STATUSES: Readonly<Record<string, StatusPreset>> = {
  OPEN: open,
  BETTING_OPEN: open,
  ACTIVE: open,
  ENABLED: open,
  ONLINE: open,
  HEALTHY: open,
  LIVE: live,
  IN_PLAY: live,
  HALFTIME: live,
  SUSPENDED: paused,
  PAUSED: paused,
  ON_HOLD: paused,
  CLOSED: closed,
  BETTING_CLOSED: closed,
  LOCKED: closed,
  DISABLED: closed,
  SETTLED: done,
  COMPLETED: done,
  ACCEPTED: done,
  APPROVED: done,
  PAID: done,
  PAID_OUT: done,
  SUCCESS: done,
  SUCCEEDED: done,
  VERIFIED: done,
  FINISHED: done,
  WON: { tone: "success", icon: Trophy },
  LOST: failed,
  REJECTED: failed,
  FAILED: failed,
  DECLINED: failed,
  ERROR: failed,
  CRITICAL: failed,
  BLOCKED: failed,
  PENDING: waiting,
  PROCESSING: waiting,
  SUBMITTED: waiting,
  QUEUED: waiting,
  SCHEDULED: waiting,
  AWAITING_SETTLEMENT: waiting,
  PARTIALLY_ACCEPTED: { tone: "warning", icon: CircleDashed },
  LIMITED: { tone: "warning", icon: Gauge },
  DEGRADED: { tone: "warning", icon: Gauge },
  WARNING: { tone: "warning", icon: Gauge },
  DELAYED: { tone: "warning", icon: Clock },
  POSTPONED: { tone: "warning", icon: Clock },
  EXPIRED: { tone: "neutral", icon: TimerOff },
  CANCELLED: stopped,
  CANCELED: stopped,
  INACTIVE: stopped,
  OFFLINE: stopped,
  VOID: voided,
  VOIDED: voided,
  REFUNDED: reversed,
  REVERSED: reversed,
  CASHED_OUT: reversed,
};

const UNKNOWN: StatusPreset = { tone: "neutral", icon: CircleDashed };

function humanise(status: string): string {
  const words = status.trim().replace(/[_-]+/g, " ").toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function statusTone(status: string): StatusPresentation {
  const key = status.trim().replace(/[\s-]+/g, "_").toUpperCase();
  const preset = Object.hasOwn(STATUSES, key) ? STATUSES[key] : undefined;

  return { ...(preset ?? UNKNOWN), label: humanise(status) };
}
