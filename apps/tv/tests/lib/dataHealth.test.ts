import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { reportReadFailure, reportReadSuccess, useDataHealth } from "../../src/lib/dataHealth";

describe("TV data health", () => {
  it("marks the display stale only after repeated failures and keeps the last good time", () => {
    const { result } = renderHook(() => useDataHealth());

    act(() => {
      reportReadSuccess(1_000);
    });
    expect(result.current).toEqual({ failing: false, lastSuccessAt: 1_000 });

    act(() => {
      reportReadFailure();
    });
    expect(result.current.failing).toBe(false);

    act(() => {
      reportReadFailure();
    });
    expect(result.current).toEqual({ failing: true, lastSuccessAt: 1_000 });

    act(() => {
      reportReadSuccess(2_000);
    });
    expect(result.current).toEqual({ failing: false, lastSuccessAt: 2_000 });
  });
});
