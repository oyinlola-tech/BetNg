import { randomUUID } from "node:crypto";
import { ServiceUnavailableError } from "../../errors/index.js";
import type { IdentityVerificationProvider } from "../../interfaces/index.js";

/**
 * Development and test only (refused in production by the config loader). Deterministic, and it never calls out:
 * a number starting with 0 is rejected, one ending in 000 needs action, anything else verifies.
 */
function sandbox(): IdentityVerificationProvider {
  return {
    name: "sandbox",
    verify: (input) => {
      if (input.number.startsWith("0")) {
        return Promise.resolve({ status: "REJECTED", reference: `sandbox-${randomUUID()}`, message: "The details did not match the record." });
      }

      if (input.number.endsWith("000")) {
        return Promise.resolve({ status: "REQUIRES_ACTION", reference: `sandbox-${randomUUID()}`, message: "Upload an identity document to finish verification." });
      }

      return Promise.resolve({ status: "VERIFIED", reference: `sandbox-${randomUUID()}`, message: undefined });
    },
  };
}

/** Stands in until an approved BVN/NIN provider is integrated: it performs no check and answers 503, so nothing is marked verified. */
function unconfigured(): IdentityVerificationProvider {
  return {
    name: "unconfigured",
    verify: () =>
      Promise.reject(new ServiceUnavailableError("Identity number verification is not available yet. Upload an identity document instead.")),
  };
}

export function createIdentityVerificationProvider(kind: "sandbox" | "unconfigured"): IdentityVerificationProvider {
  return kind === "sandbox" ? sandbox() : unconfigured();
}
