import { QueryHandler } from "@zudojs/cqrs";
import { SETTLEMENT_QUERY } from "../../../../constants/index.js";
import type { OperatorRepository } from "../../../../interfaces/index.js";
import type { OperatorSummaryRecord } from "../../../../models/index.js";
import type { GetOperatorOverviewQuery } from "./getOperatorOverview.query.js";

export interface OperatorOverview {
  readonly current: OperatorSummaryRecord;
  readonly closed: readonly OperatorSummaryRecord[];
}

export class GetOperatorOverviewHandler extends QueryHandler<GetOperatorOverviewQuery, OperatorOverview> {
  public readonly queryType = SETTLEMENT_QUERY.GET_OPERATOR_OVERVIEW;

  private readonly operator: OperatorRepository;

  public constructor(operator: OperatorRepository) {
    super();
    this.operator = operator;
  }

  public async execute(query: GetOperatorOverviewQuery): Promise<OperatorOverview> {
    const open = await this.operator.ensureOpenPeriod(new Date());

    return {
      current: await this.operator.summarise(open),
      closed: await this.operator.listClosed(query.closedLimit),
    };
  }
}
