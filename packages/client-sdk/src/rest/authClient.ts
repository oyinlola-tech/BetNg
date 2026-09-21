import { API_PREFIX } from "@betng/contracts/runtime";
import {
  twoFactorChallengeSchema,
  type CustomerLoginRequest,
  type CustomerProfile,
  type CustomerRegisterRequest,
  type CustomerSession,
  type PasswordResetConfirmRequest,
  type RegistrationPending,
  type TwoFactorChallenge,
  type TwoFactorChallengeRequest,
  type VerifyEmailRequest,
} from "@betng/contracts";
import type { Requester } from "./request.js";
import { validated } from "./validated.js";

/** A login that needs a second factor answers with a challenge instead of a session. */
export type LoginResult = { readonly session: CustomerSession } | { readonly challenge: TwoFactorChallenge };

export interface BetNgAuthClient {
  register(request: CustomerRegisterRequest): Promise<RegistrationPending>;
  verify(request: VerifyEmailRequest): Promise<CustomerSession>;
  resendVerification(email: string): Promise<void>;
  login(request: CustomerLoginRequest): Promise<LoginResult>;
  completeTwoFactor(request: TwoFactorChallengeRequest): Promise<CustomerSession>;
  logout(): Promise<void>;
  me(): Promise<CustomerProfile>;
  requestPasswordReset(email: string): Promise<void>;
  confirmPasswordReset(request: PasswordResetConfirmRequest): Promise<void>;
}

export function createAuthClient(request: Requester): BetNgAuthClient {
  const base = `${API_PREFIX}/auth`;

  return {
    register: async (body) => request<RegistrationPending>("POST", `${base}/register`, body),
    verify: async (body) => request<CustomerSession>("POST", `${base}/verify`, body),
    resendVerification: async (email) => {
      await request<unknown>("POST", `${base}/verify/resend`, { email });
    },
    login: async (body) => {
      const reply = await request<CustomerSession | { readonly twoFactor: unknown }>("POST", `${base}/login`, body);

      return "twoFactor" in reply ? { challenge: validated(twoFactorChallengeSchema, reply.twoFactor) } : { session: reply };
    },
    completeTwoFactor: async (body) => request<CustomerSession>("POST", `${base}/login/2fa`, body),
    logout: async () => {
      await request<unknown>("POST", `${base}/logout`);
    },
    me: async () => request<CustomerProfile>("GET", `${base}/me`),
    requestPasswordReset: async (email) => {
      await request<unknown>("POST", `${base}/password/forgot`, { email });
    },
    confirmPasswordReset: async (body) => {
      await request<unknown>("POST", `${base}/password/reset`, body);
    },
  };
}
