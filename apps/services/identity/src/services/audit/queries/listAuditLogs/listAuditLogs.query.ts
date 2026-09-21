import { Query } from "@zudojs/cqrs";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { AuditLogFilter } from "../../../../interfaces/index.js";

export class ListAuditLogsQuery extends Query<"identity.listAuditLogs"> {
  public readonly filter: AuditLogFilter;

  public constructor(filter: AuditLogFilter) {
    super(IDENTITY_QUERY.LIST_AUDIT_LOGS);
    this.filter = filter;
  }
}
