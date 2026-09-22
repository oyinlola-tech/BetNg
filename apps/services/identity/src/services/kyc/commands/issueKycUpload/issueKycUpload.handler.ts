import { randomUUID } from "node:crypto";
import { CommandHandler } from "@zudojs/cqrs";
import type { KycUploadTicket } from "@betng/contracts";
import { IDENTITY_COMMAND, KYC } from "../../../../constants/index.js";
import { ServiceUnavailableError, TooManyAttemptsError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { kycObjectKey } from "../../storage.provider.js";
import type { IssueKycUploadCommand } from "./issueKycUpload.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "storage">;

export const storageUnavailable = (): ServiceUnavailableError =>
  new ServiceUnavailableError("Document upload is not available right now. Try again later.");

/** A short-lived PUT whose signature binds the key, content type and exact size. Without configured storage there is no ticket. */
export class IssueKycUploadHandler extends CommandHandler<IssueKycUploadCommand, KycUploadTicket> {
  public readonly commandType = IDENTITY_COMMAND.ISSUE_KYC_UPLOAD;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: IssueKycUploadCommand): Promise<KycUploadTicket> {
    const { store, resolver, storage } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    if (storage === undefined) {
      throw storageUnavailable();
    }

    const now = new Date();

    if ((await store.kyc.countUploadsSince(customer.id, new Date(now.getTime() - 3_600_000))) >= KYC.MAX_UPLOADS_PER_HOUR) {
      throw new TooManyAttemptsError("Too many uploads started. Try again in an hour.");
    }

    const id = randomUUID();
    const objectKey = kycObjectKey(customer.id, id);
    const { request } = command;
    const ticket = storage.presignPut(objectKey, request.contentType, request.sizeBytes, KYC.UPLOAD_TTL_SECONDS);

    await store.kyc.createUpload({
      id,
      customerId: customer.id,
      type: request.type,
      fileName: request.fileName,
      contentType: request.contentType,
      sizeBytes: request.sizeBytes,
      objectKey,
      expiresAt: ticket.expiresAt,
    });

    return { uploadId: id, uploadUrl: ticket.url, method: "PUT", headers: ticket.headers, expiresAt: ticket.expiresAt.toISOString() };
  }
}
