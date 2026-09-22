export interface PresignedUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface PresignedDownload {
  readonly url: string;
  readonly expiresAt: Date;
}

export type StoredObject =
  | { readonly exists: false }
  | { readonly exists: true; readonly sizeBytes: number; readonly contentType: string | undefined };

export interface DocumentStorage {
  /** A PUT URL whose signature binds the content type and exact length. */
  presignPut(key: string, contentType: string, sizeBytes: number, expiresSeconds: number): PresignedUpload;
  presignGet(key: string, expiresSeconds: number): PresignedDownload;
  head(key: string): Promise<StoredObject>;
  /** The first `bytes` bytes of the object, for a file-signature check. */
  readPrefix(key: string, bytes: number): Promise<Buffer>;
}

export interface IdentityVerificationInput {
  readonly check: "BVN" | "NIN";
  readonly number: string;
  readonly dateOfBirth: string;
}

export interface IdentityVerificationOutcome {
  readonly status: "VERIFIED" | "REJECTED" | "REQUIRES_ACTION";
  readonly reference: string | undefined;
  readonly message: string | undefined;
}

export interface IdentityVerificationProvider {
  readonly name: string;
  /** @throws ServiceUnavailableError when no approved provider is integrated. */
  verify(input: IdentityVerificationInput): Promise<IdentityVerificationOutcome>;
}
