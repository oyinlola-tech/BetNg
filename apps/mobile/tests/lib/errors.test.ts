import { describe, expect, it } from "vitest";
import { DataSourceError } from "@betng/ui-core";
import { presentError } from "../../src/lib/errors";

describe("presentError", () => {
  it("carries the platform request id as the support reference", () => {
    const error = new DataSourceError("SERVER", "boom", { requestId: "req_7f3a" });

    expect(presentError(error)).toMatchObject({ title: "Something went wrong", requestId: "req_7f3a" });
  });

  it("omits the reference when the platform sent none", () => {
    expect(presentError(new DataSourceError("NETWORK", "offline"))).not.toHaveProperty("requestId");
    expect(presentError(new DataSourceError("SERVER", "boom", { requestId: "" }))).not.toHaveProperty("requestId");
    expect(presentError(new Error("x"))).not.toHaveProperty("requestId");
  });
});
