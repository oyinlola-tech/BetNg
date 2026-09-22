import { describe, expect, it } from "vitest";
import { profileChange } from "../../src/lib/profile";

const user = { displayName: "Ada Obi", phone: "+234 801 234 5678" };

describe("profileChange", () => {
  it("sends only the fields that changed, trimmed", () => {
    expect(profileChange(user, { displayName: "  Ada O. ", phone: user.phone })).toEqual({ ok: true, request: { displayName: "Ada O." } });
    expect(profileChange(user, { displayName: user.displayName, phone: "+2348012345678" })).toEqual({ ok: true, request: { phone: "+2348012345678" } });
    expect(profileChange({ displayName: "Ada" }, { displayName: "Ada", phone: "08012345678" })).toEqual({ ok: true, request: { phone: "08012345678" } });
  });

  it("rejects what the contract would reject", () => {
    expect(profileChange(user, { displayName: "A", phone: user.phone })).toMatchObject({ ok: false, field: "displayName" });
    expect(profileChange(user, { displayName: "x".repeat(61), phone: user.phone })).toMatchObject({ ok: false, field: "displayName" });
    expect(profileChange(user, { displayName: user.displayName, phone: "080-123" })).toMatchObject({ ok: false, field: "phone" });
    expect(profileChange(user, { displayName: user.displayName, phone: "" })).toMatchObject({ ok: false, field: "phone" });
    expect(profileChange(user, { displayName: user.displayName, phone: user.phone })).toEqual({ ok: false, message: "Nothing has changed." });
  });
});
