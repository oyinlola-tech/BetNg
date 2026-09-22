import type { UpdateProfileRequest } from "@betng/contracts";

/* Mirrors updateProfileRequestSchema; the platform validates again and has the final word. */
const PHONE = /^\+?[0-9 ]{7,20}$/;

export interface ProfileDraft {
  readonly displayName: string;
  readonly phone: string;
}

export type ProfileChange =
  | { readonly ok: true; readonly request: UpdateProfileRequest }
  | { readonly ok: false; readonly field?: keyof ProfileDraft; readonly message: string };

export function profileChange(current: { readonly displayName: string; readonly phone?: string | undefined }, draft: ProfileDraft): ProfileChange {
  const displayName = draft.displayName.trim();
  const phone = draft.phone.trim();
  const request: { displayName?: string; phone?: string } = {};

  if (displayName !== current.displayName.trim()) {
    if (displayName.length < 2) return { ok: false, field: "displayName", message: "Enter at least 2 characters." };
    if (displayName.length > 60) return { ok: false, field: "displayName", message: "Keep it under 60 characters." };

    request.displayName = displayName;
  }

  if (phone !== (current.phone ?? "").trim()) {
    if (phone === "") return { ok: false, field: "phone", message: "A phone number cannot be removed here. Contact support to remove it." };
    if (!PHONE.test(phone)) return { ok: false, field: "phone", message: "Enter a phone number with its country code." };

    request.phone = phone;
  }

  if (request.displayName === undefined && request.phone === undefined) return { ok: false, message: "Nothing has changed." };

  return { ok: true, request };
}
