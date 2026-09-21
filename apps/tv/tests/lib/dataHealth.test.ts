import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  freshness,
  liveClockNow,
  polledClockNow,
  reportConnection,
  reportReadFailure,
  reportReadSuccess,
  resetDataHealth,
  STALE_AFTER_MS,
  useDataHealth,
  type DataHealth,
} from "../../src/lib/dataHealth";

beforeEach(() => {
  resetDataHealth();
});

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

  it("records when the live stream went down and clears it on reconnect", () => {
    const { result } = renderHook(() => useDataHealth());

    act(() => {
      reportConnection("RECONNECTING", 5_000);
      reportConnection("OFFLINE", 9_000);
    });
    expect(result.current.realtimeDownSince).toBe(5_000);

    act(() => {
      reportConnection("CONNECTED", 12_000);
    });
    expect(result.current.realtimeDownSince).toBeUndefined();
  });
});

describe("TV freshness", () => {
  const healthy: DataHealth = { failing: false, lastSuccessAt: 1_000, realtimeDownSince: undefined };

  it("marks live-fed data stale after a long realtime disconnect, not before", () => {
    const down = { ...healthy, realtimeDownSince: 10_000 };

    expect(freshness(healthy, 50_000, true)).toBe("current");
    expect(freshness(down, 10_000 + STALE_AFTER_MS - 1, true)).toBe("reconnecting");
    expect(freshness(down, 10_000 + STALE_AFTER_MS, true)).toBe("stale");
  });

  it("does not call polled data stale just because the live stream is down", () => {
    expect(freshness({ ...healthy, realtimeDownSince: 0 }, 10 * STALE_AFTER_MS)).toBe("reconnecting");
  });

  it("marks polled data delayed, then stale, while reads keep failing", () => {
    const failing = { ...healthy, failing: true };

    expect(freshness(failing, 1_000 + STALE_AFTER_MS - 1)).toBe("delayed");
    expect(freshness(failing, 1_000 + STALE_AFTER_MS)).toBe("stale");
    expect(freshness({ ...failing, lastSuccessAt: undefined }, 0)).toBe("stale");
  });

  it("stops the clocks running on once data is stale", () => {
    expect(liveClockNow(undefined, 90_000)).toBe(90_000);
    expect(liveClockNow(10_000, 10_000 + 5_000)).toBe(15_000);
    expect(liveClockNow(10_000, 500_000)).toBe(10_000 + STALE_AFTER_MS);
    expect(polledClockNow(healthy, 500_000)).toBe(500_000);
    expect(polledClockNow({ ...healthy, failing: true }, 500_000)).toBe(1_000 + STALE_AFTER_MS);
  });
});
