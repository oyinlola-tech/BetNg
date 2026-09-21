export type BiometricAvailability = "available" | "not-enrolled" | "unavailable";

export type BiometricResult = "success" | "cancelled" | "failed" | "unavailable";

/** A local presence check before a sensitive action. It never replaces the platform's own authorisation. */
export interface Biometrics {
  availability(): Promise<BiometricAvailability>;
  authenticate(reason: string): Promise<BiometricResult>;
}

/** expo-local-authentication is not installed in this workspace. */
export function createUnavailableBiometrics(): Biometrics {
  return {
    availability: () => Promise.resolve("unavailable"),
    authenticate: () => Promise.resolve("unavailable"),
  };
}

/** Passes when biometrics are unavailable or not enrolled; stops only when the customer cancels or fails a prompt that was shown. */
export async function confirmPresence(biometrics: Biometrics, reason: string): Promise<boolean> {
  if ((await biometrics.availability()) !== "available") return true;

  return (await biometrics.authenticate(reason)) === "success";
}
