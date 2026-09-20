import type { CustomerLoginRequest, CustomerRegisterRequest, CustomerSession, RegistrationPending, VerifyEmailRequest } from "@betng/contracts";
import type { SessionStore } from "./session.js";

/** Customer accounts for web and mobile. Browsing never needs one; betting, wallet and account screens do. */
export interface AuthDataSource {
  readonly session: SessionStore<CustomerSession>;
  register(request: CustomerRegisterRequest): Promise<RegistrationPending>;
  verify(request: VerifyEmailRequest): Promise<CustomerSession>;
  resendVerification(email: string): Promise<void>;
  login(request: CustomerLoginRequest): Promise<CustomerSession>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
}
