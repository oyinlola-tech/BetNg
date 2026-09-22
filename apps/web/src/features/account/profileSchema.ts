import { z } from "zod";
import type { CustomerProfile, UpdateProfileRequest } from "@betng/contracts";

/* Mirrors updateProfileRequestSchema in packages/contracts/src/auth; the form keeps an empty phone as "unchanged". */
export const profileFormSchema = z.object({
  displayName: z.string().trim().min(2, "Enter at least 2 characters.").max(60, "Keep it under 60 characters."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{7,20}$/, "Enter a phone number with its country code.")
    .or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export function profileDefaults(user: CustomerProfile): ProfileFormValues {
  return { displayName: user.displayName, phone: user.phone ?? "" };
}

/** Only the fields that changed; undefined when nothing did. */
export function toProfileRequest(values: ProfileFormValues, user: CustomerProfile): UpdateProfileRequest | undefined {
  const displayName = values.displayName.trim();
  const phone = values.phone.trim();
  const request = {
    ...(displayName === user.displayName ? {} : { displayName }),
    ...(phone === "" || phone === (user.phone ?? "") ? {} : { phone }),
  } satisfies UpdateProfileRequest;

  return Object.keys(request).length === 0 ? undefined : request;
}
