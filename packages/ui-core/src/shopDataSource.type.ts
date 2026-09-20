import type { Cashier, ShopDailyReport, ShopLoginRequest, ShopSession, ShopTransaction, Ticket, TicketStatus } from "@betng/contracts";
import type { SessionStore } from "./session.js";
import type { SlipSelection } from "./types/index.js";

export interface PlaceTicketInput {
  readonly selections: readonly SlipSelection[];
  readonly stake: number;
  readonly customerName?: string;
  readonly customerPhone?: string;
}

export interface TicketFilter {
  readonly status?: TicketStatus;
  readonly q?: string;
  readonly date?: string;
}

/** The cashier terminal's view of the platform. Matches and markets still come from `BetNgDataSource`. */
export interface ShopDataSource {
  readonly session: SessionStore<ShopSession>;
  login(request: ShopLoginRequest): Promise<ShopSession>;
  logout(): Promise<void>;

  placeTicket(input: PlaceTicketInput): Promise<Ticket>;
  listTickets(filter?: TicketFilter): Promise<readonly Ticket[]>;
  getTicket(code: string): Promise<Ticket>;
  payoutTicket(code: string, pin: string): Promise<Ticket>;
  cancelTicket(code: string, reason: string): Promise<Ticket>;

  listTransactions(date?: string): Promise<readonly ShopTransaction[]>;
  getDailyReport(date?: string): Promise<ShopDailyReport>;
  listDailyReports(from: string, to: string): Promise<readonly ShopDailyReport[]>;
  listCashiers(): Promise<readonly Cashier[]>;

  /** Fires when tickets or the float change (a sale, a settlement, a payout), so lists refresh without polling blindly. */
  subscribe(listener: () => void): () => void;
}
