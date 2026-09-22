import { DEFAULT_PAGE_SIZE, MAX_PAGE, MAX_PAGE_SIZE } from "../constants/index.js";

export interface PageWindow {
  readonly page: number;
  readonly pageSize: number;
  readonly offset: number;
}

function wholeNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

/** The edge validates paging; this keeps a bad caller from ever producing a negative or unbounded OFFSET/LIMIT. */
export function pageWindow(page: number, pageSize: number): PageWindow {
  const safePage = Math.min(MAX_PAGE, Math.max(1, wholeNumber(page, 1)));
  const safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, wholeNumber(pageSize, DEFAULT_PAGE_SIZE)));

  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}
