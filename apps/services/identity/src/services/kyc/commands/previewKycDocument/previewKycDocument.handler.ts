import { CommandHandler } from "@zudojs/cqrs";
import type { KycDocumentPreview } from "@betng/contracts";
import { AUDIT_ACTION, AUDIT_ENTITY, IDENTITY_COMMAND, KYC } from "../../../../constants/index.js";
import { ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { storageUnavailable } from "../issueKycUpload/issueKycUpload.handler.js";
import type { PreviewKycDocumentCommand } from "./previewKycDocument.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "storage" | "audit">;

/** The access is recorded before the signed URL is handed out; if the audit write fails, no URL leaves the service. */
export class PreviewKycDocumentHandler extends CommandHandler<PreviewKycDocumentCommand, KycDocumentPreview> {
  public readonly commandType = IDENTITY_COMMAND.PREVIEW_KYC_DOCUMENT;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: PreviewKycDocumentCommand): Promise<KycDocumentPreview> {
    const { store, storage, audit } = this.deps;
    const { actor } = command;

    if (storage === undefined) {
      throw storageUnavailable();
    }

    const document = await store.kyc.findDocument(command.documentId);

    if (document === undefined) {
      throw new ResourceNotFoundError("No document has that id.");
    }

    await audit.write(store, {
      actorId: actor.id,
      actorRole: actor.role,
      actorName: actor.name,
      action: AUDIT_ACTION.KYC_DOCUMENT_VIEWED,
      entityType: AUDIT_ENTITY.KYC_DOCUMENT,
      entityId: document.id,
      after: { customerId: document.customerId, type: document.type },
      requestId: actor.requestId,
    });

    const signed = storage.presignGet(document.objectKey, KYC.PREVIEW_TTL_SECONDS);

    return { url: signed.url, expiresAt: signed.expiresAt.toISOString(), contentType: document.contentType };
  }
}
