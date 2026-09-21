import type { CashMovementRequest, CashierShift, CloseShiftRequest, Cashier, ShopDailyReport, ShopLoginRequest, ShopSession, ShopTransaction, Ticket, TicketStatus } from "@betng/contracts";
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

/** Pending backend. Totals, expected cash and discrepancies are always the platform's figures. */
export interface ShopShiftSource {
  getCurrent(): Promise<CashierShift | null>;
  open(openingFloat: number, idempotencyKey: string): Promise<CashierShift>;
  recordCash(request: CashMovementRequest, idempotencyKey: string): Promise<CashierShift>;
  close(shiftId: string, request: CloseShiftRequest, idempotencyKey: string): Promise<CashierShift>;
  list(date?: string): Promise<readonly CashierShift[]>;
}

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
  readonly shifts: ShopShiftSource;

  /** Fires when tickets or the float change (a sale, a settlement, a payout), so lists refresh without polling blindly. */
  subscribe(listener: () => void): () => void;
}
