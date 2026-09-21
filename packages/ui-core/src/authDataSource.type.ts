import type { CustomerLoginRequest, CustomerRegisterRequest, CustomerSession, PasswordResetConfirmRequest, RegistrationPending, TwoFactorChallengeRequest, VerifyEmailRequest } from "@betng/contracts";
import type { SessionStore } from "./session.js";

/** Customer accounts for web and mobile. Browsing never needs one; betting, wallet and account screens do. */
export interface AuthDataSource {
  readonly session: SessionStore<CustomerSession>;
  register(request: CustomerRegisterRequest): Promise<RegistrationPending>;
  verify(request: VerifyEmailRequest): Promise<CustomerSession>;
  resendVerification(email: string): Promise<void>;
  /** Rejects with TWO_FACTOR_REQUIRED, carrying the challenge, when the account has a second factor. */
  login(request: CustomerLoginRequest): Promise<CustomerSession>;
  completeTwoFactor(request: TwoFactorChallengeRequest): Promise<CustomerSession>;
  logout(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<void>;
}
