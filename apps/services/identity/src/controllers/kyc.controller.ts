import type { IdentityCheckResult, KycDocument, KycOverview, KycUploadTicket } from "@betng/contracts";
import { parseBody } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { ListDto } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  GetKycOverviewQuery,
  IssueKycUploadCommand,
  ListKycDocumentsQuery,
  SubmitKycDocumentCommand,
  VerifyIdentityNumberCommand,
} from "../services/index.js";
import { bvnVerifyValidator, kycSubmitValidator, kycUploadValidator, ninVerifyValidator } from "../validators/index.js";
import { customerCaller } from "./request.helper.js";

export interface KycController {
  readonly status: (context: HttpRouterContext) => Promise<KycOverview>;
  readonly documents: (context: HttpRouterContext) => Promise<ListDto<KycDocument>>;
  readonly upload: (context: HttpRouterContext) => Promise<KycUploadTicket>;
  readonly submit: (context: HttpRouterContext) => Promise<KycDocument>;
  readonly verifyBvn: (context: HttpRouterContext) => Promise<IdentityCheckResult>;
  readonly verifyNin: (context: HttpRouterContext) => Promise<IdentityCheckResult>;
}

export function createKycController(buses: IdentityBuses): KycController {
  const { commandBus, queryBus } = buses;

  return {
    status: async (context) => queryBus.execute<GetKycOverviewQuery, KycOverview>(new GetKycOverviewQuery(customerCaller(context))),

    documents: async (context) => ({
      items: await queryBus.execute<ListKycDocumentsQuery, readonly KycDocument[]>(new ListKycDocumentsQuery(customerCaller(context))),
    }),

    upload: async (context) =>
      commandBus.execute<IssueKycUploadCommand, KycUploadTicket>(
        new IssueKycUploadCommand(customerCaller(context), parseBody(context.request, kycUploadValidator)),
      ),

    submit: async (context) =>
      commandBus.execute<SubmitKycDocumentCommand, KycDocument>(
        new SubmitKycDocumentCommand(customerCaller(context), parseBody(context.request, kycSubmitValidator).uploadId),
      ),

    verifyBvn: async (context) => {
      const { bvn, dateOfBirth } = parseBody(context.request, bvnVerifyValidator);

      return commandBus.execute<VerifyIdentityNumberCommand, IdentityCheckResult>(
        new VerifyIdentityNumberCommand(customerCaller(context), "BVN", bvn, dateOfBirth),
      );
    },

    verifyNin: async (context) => {
      const { nin, dateOfBirth } = parseBody(context.request, ninVerifyValidator);

      return commandBus.execute<VerifyIdentityNumberCommand, IdentityCheckResult>(
        new VerifyIdentityNumberCommand(customerCaller(context), "NIN", nin, dateOfBirth),
      );
    },
  };
}
