import { API_PREFIX } from "@betng/contracts/runtime";
import type { CustomerLoginRequest, CustomerProfile, CustomerRegisterRequest, CustomerSession, RegistrationPending, VerifyEmailRequest } from "@betng/contracts";
import type { Requester } from "./request.js";

export interface BetNgAuthClient {
  register(request: CustomerRegisterRequest): Promise<RegistrationPending>;
  verify(request: VerifyEmailRequest): Promise<CustomerSession>;
  resendVerification(email: string): Promise<void>;
  login(request: CustomerLoginRequest): Promise<CustomerSession>;
  logout(): Promise<void>;
  me(): Promise<CustomerProfile>;
  requestPasswordReset(email: string): Promise<void>;
}

export function createAuthClient(request: Requester): BetNgAuthClient {
  const base = `${API_PREFIX}/auth`;

  return {
    register: async (body) => request<RegistrationPending>("POST", `${base}/register`, body),
    verify: async (body) => request<CustomerSession>("POST", `${base}/verify`, body),
    resendVerification: async (email) => {
      await request<unknown>("POST", `${base}/verify/resend`, { email });
    },
    login: async (body) => request<CustomerSession>("POST", `${base}/login`, body),
    logout: async () => {
      await request<unknown>("POST", `${base}/logout`);
    },
    me: async () => request<CustomerProfile>("GET", `${base}/me`),
    requestPasswordReset: async (email) => {
      await request<unknown>("POST", `${base}/password/forgot`, { email });
    },
  };
}
