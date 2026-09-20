import { depositRequestSchema, withdrawRequestSchema } from "@betng/contracts";
import type { DepositRequest, WithdrawRequest } from "@betng/contracts";
import type { ValidationSchema } from "@zudojs/validation";

export const depositValidator: ValidationSchema<DepositRequest> =
  depositRequestSchema;

export const withdrawValidator: ValidationSchema<WithdrawRequest> =
  withdrawRequestSchema;
