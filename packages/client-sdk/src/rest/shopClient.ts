import { API_PREFIX } from "@betng/contracts/runtime";
import type { CancelTicketRequest, Cashier, PayoutTicketRequest, PlaceTicketRequest, ShopDailyReport, ShopLoginRequest, ShopSession, ShopTransaction, Ticket } from "@betng/contracts";
import { buildQuery, type ListResponse, type Requester } from "./request.js";

export interface TicketQuery {
  readonly status?: string;
  readonly q?: string;
  readonly date?: string;
}

export interface BetNgShopClient {
  login(request: ShopLoginRequest): Promise<ShopSession>;
  logout(): Promise<void>;
  session(): Promise<ShopSession>;
  placeTicket(request: PlaceTicketRequest): Promise<Ticket>;
  listTickets(query?: TicketQuery): Promise<readonly Ticket[]>;
  getTicket(code: string): Promise<Ticket>;
  payoutTicket(code: string, request: PayoutTicketRequest): Promise<Ticket>;
  cancelTicket(code: string, request: CancelTicketRequest): Promise<Ticket>;
  listTransactions(date?: string): Promise<readonly ShopTransaction[]>;
  getDailyReport(date?: string): Promise<ShopDailyReport>;
  listDailyReports(from: string, to: string): Promise<readonly ShopDailyReport[]>;
  listCashiers(): Promise<readonly Cashier[]>;
}

export function createShopClient(request: Requester): BetNgShopClient {
  const base = `${API_PREFIX}/shop`;

  return {
    login: async (body) => request<ShopSession>("POST", `${base}/auth/login`, body),
    logout: async () => {
      await request<unknown>("POST", `${base}/auth/logout`);
    },
    session: async () => request<ShopSession>("GET", `${base}/auth/session`),
    placeTicket: async (body) => request<Ticket>("POST", `${base}/tickets`, body),
    listTickets: async (query = {}) => (await request<ListResponse<Ticket>>("GET", `${base}/tickets${buildQuery({ ...query })}`)).items,
    getTicket: async (code) => request<Ticket>("GET", `${base}/tickets/${encodeURIComponent(code)}`),
    payoutTicket: async (code, body) => request<Ticket>("POST", `${base}/tickets/${encodeURIComponent(code)}/payout`, body),
    cancelTicket: async (code, body) => request<Ticket>("POST", `${base}/tickets/${encodeURIComponent(code)}/cancel`, body),
    listTransactions: async (date) => (await request<ListResponse<ShopTransaction>>("GET", `${base}/transactions${buildQuery({ date })}`)).items,
    getDailyReport: async (date) => request<ShopDailyReport>("GET", `${base}/reports/daily${buildQuery({ date })}`),
    listDailyReports: async (from, to) => (await request<ListResponse<ShopDailyReport>>("GET", `${base}/reports/daily/range${buildQuery({ from, to })}`)).items,
    listCashiers: async () => (await request<ListResponse<Cashier>>("GET", `${base}/cashiers`)).items,
  };
}
