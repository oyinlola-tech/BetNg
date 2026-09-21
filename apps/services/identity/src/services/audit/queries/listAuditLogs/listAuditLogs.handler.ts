import { QueryHandler } from "@zudojs/cqrs";
import type { AuditLogEntry, Page } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toAuditLogEntry } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { ListAuditLogsQuery } from "./listAuditLogs.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class ListAuditLogsHandler extends QueryHandler<ListAuditLogsQuery, Page<AuditLogEntry>> {
  public readonly queryType = IDENTITY_QUERY.LIST_AUDIT_LOGS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListAuditLogsQuery): Promise<Page<AuditLogEntry>> {
    const { items, total } = await this.deps.store.audit.page(query.filter);

    return {
      items: items.map(toAuditLogEntry),
      total,
      page: query.filter.page,
      pageSize: query.filter.pageSize,
    };
  }
}
