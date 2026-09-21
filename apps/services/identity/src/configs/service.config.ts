import { loadServiceConfig } from "@betng/service-kit";
import type { ServiceConfig } from "@betng/service-kit";
import { z } from "@zudojs/validation";

export const SERVICE_NAME = "identity" as const;

export const SERVICE_VERSION = "0.1.0";

export const DEFAULT_PORT = 3010;

export interface SecurityConfig {
  readonly customerSessionTtlHours: number;
  readonly cashierSessionTtlHours: number;
  readonly adminSessionTtlHours: number;
  /** Outside production only: a fixed code accepted in place of the issued one. Unset by default. */
  readonly devVerificationCode: string | undefined;
  /** There is no mail server; issued codes are logged in development and test, never in production. */
  readonly logVerificationCodes: boolean;
  /** Base32 secret for the seeded two-factor admin. Read by the development seed only. */
  readonly seedAdminTotpSecret: string | undefined;
}

export interface IdentityConfig {
  readonly service: ServiceConfig;
  readonly security: SecurityConfig;
}

const ttlHours = (fallback: number): z.ZodType<number> =>
  z.coerce.number().int().min(1).max(24 * 90).default(fallback);

const blankAsUnset = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const securityEnvSchema = z.object({
  CUSTOMER_SESSION_TTL_HOURS: z.preprocess(blankAsUnset, ttlHours(168)),
  CASHIER_SESSION_TTL_HOURS: z.preprocess(blankAsUnset, ttlHours(12)),
  ADMIN_SESSION_TTL_HOURS: z.preprocess(blankAsUnset, ttlHours(8)),
  DEV_VERIFICATION_CODE: z.preprocess(
    blankAsUnset,
    z.string().regex(/^\d{6}$/, "must be six digits").optional(),
  ),
  SEED_ADMIN_TOTP_SECRET: z.preprocess(
    blankAsUnset,
    z.string().regex(/^[A-Z2-7]{16,64}$/, "must be 16-64 base32 characters").optional(),
  ),
});

export async function loadIdentityConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<IdentityConfig> {
  const service = await loadServiceConfig({
    serviceName: SERVICE_NAME,
    version: SERVICE_VERSION,
    defaultPort: DEFAULT_PORT,
    databaseUrlKey: "IDENTITY_DATABASE_URL",
    env,
  });

  const parsed = securityEnvSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".")} ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid identity configuration: ${problems}.`);
  }

  const production = service.environment === "production";

  return Object.freeze({
    service,
    security: Object.freeze({
      customerSessionTtlHours: parsed.data.CUSTOMER_SESSION_TTL_HOURS,
      cashierSessionTtlHours: parsed.data.CASHIER_SESSION_TTL_HOURS,
      adminSessionTtlHours: parsed.data.ADMIN_SESSION_TTL_HOURS,
      devVerificationCode: production ? undefined : parsed.data.DEV_VERIFICATION_CODE,
      logVerificationCodes: !production,
      seedAdminTotpSecret: production ? undefined : parsed.data.SEED_ADMIN_TOTP_SECRET,
    }),
  });
}
