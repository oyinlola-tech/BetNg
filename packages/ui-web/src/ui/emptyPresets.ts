import {
  BellOff,
  CalendarClock,
  ClipboardList,
  FileSearch,
  LayoutList,
  Radio,
  Receipt,
  SearchX,
  Shield,
  Ticket,
  Trophy,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type EmptyPresetName =
  | "noLiveMatches"
  | "noUpcomingMatches"
  | "noResults"
  | "noTransactions"
  | "emptyBetslip"
  | "noNotifications"
  | "noTeams"
  | "noMarkets"
  | "noSearchResults"
  | "noShopTransactions"
  | "noAdminRecords";

export interface EmptyPreset {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

export const emptyPresets: Record<EmptyPresetName, EmptyPreset> = {
  noLiveMatches: {
    icon: Radio,
    title: "No live matches",
    description: "Nothing is in play right now. The next kick-off appears here as it starts.",
  },
  noUpcomingMatches: {
    icon: CalendarClock,
    title: "No upcoming matches",
    description: "There are no fixtures scheduled for this selection yet.",
  },
  noResults: {
    icon: Trophy,
    title: "No results yet",
    description: "Final scores appear here once matches finish.",
  },
  noTransactions: {
    icon: Receipt,
    title: "No transactions",
    description: "Deposits, withdrawals and bet activity will be listed here.",
  },
  emptyBetslip: {
    icon: Ticket,
    title: "Your bet slip is empty",
    description: "Select a price on any market to add it here.",
  },
  noNotifications: {
    icon: BellOff,
    title: "No notifications",
    description: "You are up to date. New alerts will show here.",
  },
  noTeams: {
    icon: Shield,
    title: "No teams",
    description: "No teams are available for this league.",
  },
  noMarkets: {
    icon: LayoutList,
    title: "No markets available",
    description: "Markets for this match have not opened or have already closed.",
  },
  noSearchResults: {
    icon: SearchX,
    title: "No matches for that search",
    description: "Check the spelling or try a shorter term.",
  },
  noShopTransactions: {
    icon: ClipboardList,
    title: "No shop transactions",
    description: "Tickets sold and paid out in this shift will be listed here.",
  },
  noAdminRecords: {
    icon: FileSearch,
    title: "No records found",
    description: "Nothing matches the current filters. Adjust or clear them.",
  },
};
