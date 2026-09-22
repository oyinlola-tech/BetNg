import { CommandHandler } from "@zudojs/cqrs";
import type { KycDocument } from "@betng/contracts";
import { AUDIT_ACTION, IDENTITY_COMMAND, KYC } from "../../../../constants/index.js";
import { toKycDocument } from "../../../../dtos/index.js";
import { ConflictError, InvalidInputError, ResourceNotFoundError } from "../../../../errors/index.js";
import type { HandlerDependencies } from "../../../../interfaces/index.js";
import { resolveCaller } from "../../../security/index.js";
import { customerAuditActor } from "../../../accountSecurity/accountSecurity.helper.js";
import { matchesFileSignature, SIGNATURE_BYTES } from "../../storage.provider.js";
import { storageUnavailable } from "../issueKycUpload/issueKycUpload.handler.js";
import type { SubmitKycDocumentCommand } from "./submitKycDocument.command.js";

type Dependencies = Pick<HandlerDependencies, "store" | "resolver" | "storage" | "audit">;

const gone = (): ResourceNotFoundError => new ResourceNotFoundError("That upload is not available any more. Upload the file again.");
const mismatch = (): InvalidInputError => new InvalidInputError("uploadId", "The uploaded file does not match the file that was declared.");

/** The stored object is checked (exists, exact size, declared type, file signature) before the document is accepted. */
export class SubmitKycDocumentHandler extends CommandHandler<SubmitKycDocumentCommand, KycDocument> {
  public readonly commandType = IDENTITY_COMMAND.SUBMIT_KYC_DOCUMENT;

  private readonly deps: Dependencies;

  public constructor(deps: Dependencies) {
    super();
    this.deps = deps;
  }

  public async execute(command: SubmitKycDocumentCommand): Promise<KycDocument> {
    const { store, resolver, storage, audit } = this.deps;
    const { customer } = await resolveCaller(resolver, store, command.caller);

    if (storage === undefined) {
      throw storageUnavailable();
    }

    const now = new Date();
    const upload = await store.kyc.findUpload(customer.id, command.uploadId);

    if (upload === undefined || upload.consumedAt !== null || upload.createdAt.getTime() + KYC.SUBMIT_GRACE_MS < now.getTime()) {
      throw gone();
    }

    if (await store.kyc.hasPendingOfType(customer.id, upload.type)) {
      throw new ConflictError("A document of this type is already waiting for review.");
    }

    const stored = await storage.head(upload.objectKey);

    if (!stored.exists) {
      throw new InvalidInputError("uploadId", "The file has not finished uploading.");
    }

    const storedType = stored.contentType?.split(";")[0]?.trim().toLowerCase();

    if (stored.sizeBytes !== upload.sizeBytes || storedType !== upload.contentType) {
      throw mismatch();
    }

    if (!matchesFileSignature(upload.contentType, await storage.readPrefix(upload.objectKey, SIGNATURE_BYTES))) {
      throw mismatch();
    }

    const document = await store.transaction(async (repositories) => {
      if (!(await repositories.kyc.consumeUpload(upload.id, now))) {
        throw gone();
      }

      const created = await repositories.kyc.createDocument(upload, now);

      await audit.write(repositories, {
        ...customerAuditActor(customer, command.caller.requestId),
        action: AUDIT_ACTION.KYC_DOCUMENT_SUBMITTED,
        after: { documentId: created.id, type: created.type, sizeBytes: created.sizeBytes },
      });

      return created;
    });

    return toKycDocument(document);
  }
}
