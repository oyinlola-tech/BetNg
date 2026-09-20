/**
 * Request validation for the wallet service.
 *
 * The schemas come from `@betng/contracts`, so what the service accepts and
 * what the contract documents cannot drift apart.
 */

import { depositRequestSchema, withdrawRequestSchema } from "@betng/contracts";
import type { DepositRequest, WithdrawRequest } from "@betng/contracts";
import type { ValidationSchema } from "@zudojs/validation";

/** Guards the body of `POST /api/v1/wallet/deposit`. */
export const depositValidator: ValidationSchema<DepositRequest> =
  depositRequestSchema;

/** Guards the body of `POST /api/v1/wallet/withdraw`. */
export const withdrawValidator: ValidationSchema<WithdrawRequest> =
  withdrawRequestSchema;
