import type { TransactionType } from "@betng/contracts";

export interface PageQuery {
  readonly page?: number;
  readonly pageSize?: number;
  readonly sort?: string;
  readonly direction?: "asc" | "desc";
  readonly search?: string;
}

export interface PageView<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export interface TransactionQuery extends PageQuery {
  readonly types?: readonly TransactionType[];
  readonly statuses?: readonly TransactionStatus[];
  readonly from?: string;
  readonly to?: string;
}
