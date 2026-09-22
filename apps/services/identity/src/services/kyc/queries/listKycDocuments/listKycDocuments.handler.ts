import { QueryHandler } from "@zudojs/cqrs";
import type { KycDocument } from "@betng/contracts";
import { IDENTITY_QUERY } from "../../../../constants/index.js";
import { toKycDocument } from "../../../../dtos/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import type { ListKycDocumentsQuery } from "./listKycDocuments.query.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver">;

export class ListKycDocumentsHandler extends QueryHandler<ListKycDocumentsQuery, readonly KycDocument[]> {
  public readonly queryType = IDENTITY_QUERY.LIST_KYC_DOCUMENTS;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(query: ListKycDocumentsQuery): Promise<readonly KycDocument[]> {
    const { store, resolver } = this.deps;
    const { customer } = await resolveCaller(resolver, store, query.caller);

    return (await store.kyc.listDocuments(customer.id)).map(toKycDocument);
  }
}
