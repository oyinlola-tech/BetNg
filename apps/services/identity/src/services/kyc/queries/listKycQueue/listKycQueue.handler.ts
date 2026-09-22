import { QueryHandler } from "@zudojs/cqrs";
import type { KycReviewItem, Page } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { toKycReviewItem } from "../../kycReview.helper.js";
import type { ListKycQueueQuery } from "./listKycQueue.query.js";

type Dependencies = Pick<HandlerDependencies, "store">;

export class ListKycQueueHandler extends QueryHandler<ListKycQueueQuery, Page<KycReviewItem>> {
  public readonly queryType = IDENTITY_QUERY.LIST_KYC_QUEUE;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListKycQueueQuery): Promise<Page<KycReviewItem>> {
    const { store } = this.deps;
    const { items, total } = await store.kyc.queue(query.filter);

    return {
      items: await Promise.all(items.map(async (entry) => toKycReviewItem(store, entry.customer))),
      page: query.filter.page,
      pageSize: query.filter.pageSize,
      total,
    };
  }
}
