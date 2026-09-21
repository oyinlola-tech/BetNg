import { QueryHandler } from "@zudojs/cqrs";
import type { AdminCustomer } from "@betng/contracts";
import { IDENTITY_QUERY, LIST_LIMIT } from "../../../../constants/index.js";
import { toAdminCustomer } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import type { ListCustomersQuery } from "./listCustomers.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "readModel">;

export class ListCustomersHandler extends QueryHandler<ListCustomersQuery, readonly AdminCustomer[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_CUSTOMERS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListCustomersQuery): Promise<readonly AdminCustomer[]> {
    const rows = await this.deps.store.customers.search(query.q, LIST_LIMIT.CUSTOMERS);
    const figures = await this.deps.readModel.customerFigures(rows.map((row) => row.id));

    return rows.map((row) => toAdminCustomer(row, figures.get(row.id)));
  }
}
