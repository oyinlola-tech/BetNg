import type { KycDocumentPreview, KycReviewItem, Page, ResponsibleGamingAccount } from "@betng/contracts";
import { parseBody, parseQuery } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import { ADMIN_PERMISSION, RESPONSIBLE_GAMING } from "../constants/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  ListKycQueueQuery,
  ListResponsibleGamingQuery,
  PreviewKycDocumentCommand,
  ReviewKycCommand,
} from "../services/index.js";
import { kycQueueQueryValidator, kycReviewValidator, responsibleGamingQueryValidator } from "../validators/index.js";
import { requireAdmin, uuidParam } from "./request.helper.js";

export interface ComplianceController {
  readonly kycQueue: (context: HttpRouterContext) => Promise<Page<KycReviewItem>>;
  readonly reviewKyc: (context: HttpRouterContext) => Promise<KycReviewItem>;
  readonly previewDocument: (context: HttpRouterContext) => Promise<KycDocumentPreview>;
  readonly responsibleGaming: (context: HttpRouterContext) => Promise<Page<ResponsibleGamingAccount>>;
}

export function createComplianceController(buses: IdentityBuses): ComplianceController {
  const { commandBus, queryBus } = buses;

  return {
    kycQueue: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.KYC_READ);

      const query = parseQuery(context.query, kycQueueQueryValidator);

      return queryBus.execute<ListKycQueueQuery, Page<KycReviewItem>>(
        new ListKycQueueQuery({ status: query.status, search: query.search, page: query.page, pageSize: query.pageSize }),
      );
    },

    reviewKyc: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.KYC_WRITE);

      return commandBus.execute<ReviewKycCommand, KycReviewItem>(
        new ReviewKycCommand(actor, uuidParam(context, "userId"), parseBody(context.request, kycReviewValidator)),
      );
    },

    previewDocument: async (context) => {
      const actor = requireAdmin(context, ADMIN_PERMISSION.KYC_READ);

      return commandBus.execute<PreviewKycDocumentCommand, KycDocumentPreview>(new PreviewKycDocumentCommand(actor, uuidParam(context, "id")));
    },

    responsibleGaming: async (context) => {
      requireAdmin(context, ADMIN_PERMISSION.USERS_READ);

      const query = parseQuery(context.query, responsibleGamingQueryValidator);
      const now = new Date();

      return queryBus.execute<ListResponsibleGamingQuery, Page<ResponsibleGamingAccount>>(
        new ListResponsibleGamingQuery({
          search: query.search,
          flag: query.flag,
          page: query.page,
          pageSize: query.pageSize,
          now,
          lookbackSince: new Date(now.getTime() - RESPONSIBLE_GAMING.FLAG_LOOKBACK_MS),
          longSessionBefore: new Date(now.getTime() - RESPONSIBLE_GAMING.LONG_SESSION_MS),
          activeSince: new Date(now.getTime() - RESPONSIBLE_GAMING.ACTIVE_WITHIN_MS),
        }),
      );
    },
  };
}
