import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { OperatorRepository } from "../../../../interfaces/index.js";
import type { OperatorPeriodRecord } from "../../../../models/index.js";
import type { ListOperatorPeriodsQuery } from "./listOperatorPeriods.query.js";

export class ListOperatorPeriodsHandler extends QueryHandler<
  ListOperatorPeriodsQuery,
  readonly OperatorPeriodRecord[]
> {
  public readonly queryType = SETTLEMENT_QUERY.LIST_OPERATOR_PERIODS;

  private readonly operator: OperatorRepository;

  public constructor(operator: OperatorRepository) {
    super();
    this.operator = operator;
  }

  public async execute(query: ListOperatorPeriodsQuery): Promise<readonly OperatorPeriodRecord[]> {
    return this.operator.listPeriods(query.limit);
  }
}
