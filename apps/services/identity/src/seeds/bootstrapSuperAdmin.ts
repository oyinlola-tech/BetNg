import type { Logger } from "@betng/service-kit";
import {
  AUDIT_ACTION,
  AUDIT_ENTITY,
  SECURITY,
  SYSTEM_ACTOR,
} from "../constants/index.js";
import type { IdentityStore, PasswordHasher } from "../interfaces/index.js";
import { normaliseEmail } from "../utils/index.js";

/** The `.env.example` value: public, so refused outright. */
export const PLACEHOLDER_SUPER_ADMIN_PASSWORD = "change-this-before-you-deploy";

export type BootstrapOutcome =
  | { readonly kind: "exists" }
  | { readonly kind: "skipped"; readonly reason: string }
  | { readonly kind: "created"; readonly email: string; readonly expiresAt: Date };

export class BootstrapRefusedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BootstrapRefusedError";
  }
}

export interface BootstrapOptions {
  readonly store: IdentityStore;
  readonly hasher: PasswordHasher;
  readonly production: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly logger?: Logger;
}

function text(env: BootstrapOptions["env"], key: string): string | undefined {
  const value = env[key]?.trim();

  return value === undefined || value === "" ? undefined : value;
}

/**
 * Creates the platform's first super administrator, once. The password hash comes from scrypt, which SQL
 * cannot produce, so this runs beside the migration rather than inside it.
 *
 * It issues no authenticator secret. The account is created needing activation, and the first person to
 * hold SUPER_ADMIN_PASSWORD enrols their own authenticator over the connection they activate on — so no
 * secret is ever written to a log, a console or a backup of either.
 *
 * Idempotent and non-destructive: with any super administrator already present it changes nothing, and it
 * never overwrites a live account. Missing credentials are a refusal in production, where the platform
 * would otherwise have no way in, and a skip everywhere else so a CI or development migration still runs.
 */
export async function bootstrapSuperAdmin(options: BootstrapOptions): Promise<BootstrapOutcome> {
  const { store, hasher, production, env } = options;

  // Checked first, so a re-run costs one query and changes nothing.
  if ((await store.admins.countSuperAdmins()) > 0) {
    return { kind: "exists" };
  }

  const rawEmail = text(env, "SUPER_ADMIN_EMAIL");
  const password = text(env, "SUPER_ADMIN_PASSWORD");

  if (rawEmail === undefined || password === undefined) {
    const reason = "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are not set.";

    if (production) {
      throw new BootstrapRefusedError(`${reason} The platform would have no way in.`);
    }

    return { kind: "skipped", reason };
  }

  const email = normaliseEmail(rawEmail);

  if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/u.test(email)) {
    throw new BootstrapRefusedError("SUPER_ADMIN_EMAIL is not an email address.");
  }

  if (password === PLACEHOLDER_SUPER_ADMIN_PASSWORD) {
    throw new BootstrapRefusedError(
      "SUPER_ADMIN_PASSWORD is the .env.example placeholder; choose a password no one else has seen.",
    );
  }

  if (password.length < SECURITY.OPERATOR_PASSWORD_MIN_LENGTH) {
    throw new BootstrapRefusedError(
      `SUPER_ADMIN_PASSWORD must be at least ${String(SECURITY.OPERATOR_PASSWORD_MIN_LENGTH)} characters.`,
    );
  }

  const passwordHash = await hasher.hash(password);
  const expiresAt = new Date(Date.now() + SECURITY.TEMPORARY_CREDENTIALS_TTL_MS);

  await store.transaction(async (repositories) => {
    const created = await repositories.admins.create({
      email,
      name: text(env, "SUPER_ADMIN_NAME") ?? "Platform Owner",
      role: "SUPER_ADMIN",
      passwordHash,
      totpSecret: undefined,
      mustChangePassword: true,
      credentialsExpireAt: expiresAt,
      isBootstrap: true,
    });

    await repositories.audit.append({
      actorId: SYSTEM_ACTOR.id,
      actorRole: SYSTEM_ACTOR.role,
      actorName: "Super administrator bootstrap",
      action: AUDIT_ACTION.ADMIN_CREATED,
      entityType: AUDIT_ENTITY.ADMIN_USER,
      entityId: created.id,
      before: null,
      after: { email, role: "SUPER_ADMIN", bootstrap: true },
      reason: undefined,
      severity: "CRITICAL",
      requestId: "bootstrap",
    });
  });

  return { kind: "created", email, expiresAt };
}
