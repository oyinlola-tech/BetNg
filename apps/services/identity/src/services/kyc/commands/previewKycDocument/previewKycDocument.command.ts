import { Command } from "@zudojs/cqrs";
import { IDENTITY_COMMAND } from "../../../../constants/index.js";
import type { AdminActor } from "../../../../interfaces/index.js";

export class PreviewKycDocumentCommand extends Command<"identity.previewKycDocument"> {
  public readonly actor: AdminActor;

  public readonly documentId: string;

  public constructor(actor: AdminActor, documentId: string) {
    super(IDENTITY_COMMAND.PREVIEW_KYC_DOCUMENT);
    this.actor = actor;
    this.documentId = documentId;
  }
}
