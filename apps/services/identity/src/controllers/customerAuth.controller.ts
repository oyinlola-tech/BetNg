import { getRequestId, parseBody } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { CustomerProfile, CustomerSession, RegistrationPending, SessionRefresh } from "@betng/contracts";
import type { CustomerLoginOutcome } from "../dtos/index.js";
import type { IdentityBuses } from "../loaders/index.js";
import {
  CompleteTwoFactorLoginCommand,
  GetCustomerProfileQuery,
  LoginCustomerCommand,
  LogoutCommand,
  RefreshSessionCommand,
  RegisterCustomerCommand,
  RequestPasswordResetCommand,
  ResendVerificationCommand,
  ResetPasswordCommand,
  VerifyEmailCommand,
} from "../services/index.js";
import { readBearerToken } from "../utils/index.js";
import {
  emailOnlyValidator,
  loginCustomerValidator,
  passwordResetConfirmValidator,
  registerCustomerValidator,
  twoFactorChallengeValidator,
  verifyEmailValidator,
} from "../validators/index.js";
import { customerCaller, userAgent } from "./request.helper.js";

export interface CustomerAuthController {
  readonly register: (context: HttpRouterContext) => Promise<RegistrationPending>;
  readonly verify: (context: HttpRouterContext) => Promise<CustomerSession>;
  readonly resendVerification: (context: HttpRouterContext) => Promise<void>;
  readonly login: (context: HttpRouterContext) => Promise<CustomerLoginOutcome>;
  readonly loginTwoFactor: (context: HttpRouterContext) => Promise<CustomerSession>;
  readonly resetPassword: (context: HttpRouterContext) => Promise<void>;
  readonly refreshSession: (context: HttpRouterContext) => Promise<SessionRefresh>;
  readonly logout: (context: HttpRouterContext) => Promise<void>;
  readonly me: (context: HttpRouterContext) => Promise<CustomerProfile>;
  readonly forgotPassword: (context: HttpRouterContext) => Promise<void>;
}

/** None of these handlers reads an `x-betng-*` header: the caller is whoever holds the bearer token. */
export function createCustomerAuthController(buses: IdentityBuses): CustomerAuthController {
  const { commandBus, queryBus } = buses;

  return {
    register: async (context) =>
      commandBus.execute<RegisterCustomerCommand, RegistrationPending>(
        new RegisterCustomerCommand(
          parseBody(context.request, registerCustomerValidator),
          getRequestId(context.request),
        ),
      ),

    verify: async (context) =>
      commandBus.execute<VerifyEmailCommand, CustomerSession>(
        new VerifyEmailCommand(parseBody(context.request, verifyEmailValidator), userAgent(context)),
      ),

    resendVerification: async (context) =>
      commandBus.execute<ResendVerificationCommand>(
        new ResendVerificationCommand(
          parseBody(context.request, emailOnlyValidator).email,
          getRequestId(context.request),
        ),
      ),

    login: async (context) =>
      commandBus.execute<LoginCustomerCommand, CustomerLoginOutcome>(
        new LoginCustomerCommand(parseBody(context.request, loginCustomerValidator), userAgent(context)),
      ),

    loginTwoFactor: async (context) =>
      commandBus.execute<CompleteTwoFactorLoginCommand, CustomerSession>(
        new CompleteTwoFactorLoginCommand(
          parseBody(context.request, twoFactorChallengeValidator),
          userAgent(context),
          getRequestId(context.request),
        ),
      ),

    resetPassword: async (context) =>
      commandBus.execute<ResetPasswordCommand>(
        new ResetPasswordCommand(parseBody(context.request, passwordResetConfirmValidator), getRequestId(context.request)),
      ),

    refreshSession: async (context) =>
      commandBus.execute<RefreshSessionCommand, SessionRefresh>(new RefreshSessionCommand(customerCaller(context))),

    logout: async (context) =>
      commandBus.execute<LogoutCommand>(
        new LogoutCommand(readBearerToken(context.request), "CUSTOMER", getRequestId(context.request)),
      ),

    me: async (context) =>
      queryBus.execute<GetCustomerProfileQuery, CustomerProfile>(
        new GetCustomerProfileQuery(readBearerToken(context.request)),
      ),

    forgotPassword: async (context) =>
      commandBus.execute<RequestPasswordResetCommand>(
        new RequestPasswordResetCommand(parseBody(context.request, emailOnlyValidator).email, getRequestId(context.request)),
      ),
  };
}
