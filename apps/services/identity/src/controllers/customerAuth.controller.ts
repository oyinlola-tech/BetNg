import { getRequestId, parseBody } from "@betng/service-kit";
import type { HttpRouterContext } from "@betng/service-kit";
import type { CustomerProfile, CustomerSession, RegistrationPending } from "@betng/contracts";
import type { IdentityBuses } from "../loaders/index.js";
import {
  GetCustomerProfileQuery,
  LoginCustomerCommand,
  LogoutCommand,
  RegisterCustomerCommand,
  RequestPasswordResetCommand,
  ResendVerificationCommand,
  VerifyEmailCommand,
} from "../services/index.js";
import { readBearerToken } from "../utils/index.js";
import {
  emailOnlyValidator,
  loginCustomerValidator,
  registerCustomerValidator,
  verifyEmailValidator,
} from "../validators/index.js";

export interface CustomerAuthController {
  register(context: HttpRouterContext): Promise<RegistrationPending>;
  verify(context: HttpRouterContext): Promise<CustomerSession>;
  resendVerification(context: HttpRouterContext): Promise<void>;
  login(context: HttpRouterContext): Promise<CustomerSession>;
  logout(context: HttpRouterContext): Promise<void>;
  me(context: HttpRouterContext): Promise<CustomerProfile>;
  forgotPassword(context: HttpRouterContext): Promise<void>;
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
        new VerifyEmailCommand(parseBody(context.request, verifyEmailValidator)),
      ),

    resendVerification: async (context) =>
      commandBus.execute<ResendVerificationCommand>(
        new ResendVerificationCommand(
          parseBody(context.request, emailOnlyValidator).email,
          getRequestId(context.request),
        ),
      ),

    login: async (context) =>
      commandBus.execute<LoginCustomerCommand, CustomerSession>(
        new LoginCustomerCommand(parseBody(context.request, loginCustomerValidator)),
      ),

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
        new RequestPasswordResetCommand(parseBody(context.request, emailOnlyValidator).email),
      ),
  };
}
