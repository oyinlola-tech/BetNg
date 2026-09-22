import { describe, expect, it, vi } from "vitest";
import { createKeyboardWedgeScanner } from "../../src/services/scanner";

function harness(options: { readonly maxKeyGapMs?: number; readonly minLength?: number } = {}) {
  let clock = 0;
  const target = new EventTarget() as unknown as Window;
  const onScan = vi.fn();
  const stop = createKeyboardWedgeScanner({ target, now: () => clock, ...options }).start(onScan);

  const press = (key: string, gapMs: number, init: KeyboardEventInit = {}): KeyboardEvent => {
    clock += gapMs;

    const event = new KeyboardEvent("keydown", { key, cancelable: true, ...init });

    target.dispatchEvent(event);

    return event;
  };

  const type = (text: string, gapMs: number): void => {
    for (const key of text) press(key, gapMs);
  };

  return { onScan, press, type, stop };
}

describe("keyboard-wedge scanner", () => {
  it("reads a fast burst ending in Enter as a scan and keeps the Enter from submitting anything else", () => {
    const { onScan, press, type } = harness();

    type("BNG7K2QX9", 5);
    const enter = press("Enter", 5);

    expect(onScan).toHaveBeenCalledWith("BNG7K2QX9");
    expect(enter.defaultPrevented).toBe(true);
  });

  it("leaves a person's typing and Enter alone", () => {
    const { onScan, press, type } = harness();

    type("BNG7K2QX9", 120);
    const enter = press("Enter", 150);

    expect(onScan).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it("ignores a burst shorter than a ticket code", () => {
    const { onScan, press, type } = harness();

    type("12", 5);
    expect(press("Enter", 5).defaultPrevented).toBe(false);
    expect(onScan).not.toHaveBeenCalled();
  });

  it("does not count slow characters typed before a fast burst", () => {
    const { onScan, press, type } = harness();

    type("xyz", 200);
    press("B", 200);
    type("NG7K2QX9", 5);
    press("Enter", 5);

    expect(onScan).toHaveBeenCalledWith("BNG7K2QX9");
  });

  it("drops the buffer on modifier shortcuts such as paste", () => {
    const { onScan, press, type } = harness();

    type("BNG7K2", 5);
    press("v", 5, { ctrlKey: true });
    type("QX9", 5);
    press("Enter", 5);

    expect(onScan).not.toHaveBeenCalled();
  });

  it("accepts Shift between characters, as scanners send for capitals", () => {
    const { onScan, press } = harness();

    for (const key of "BNG7K2QX9") {
      press("Shift", 2);
      press(key, 2);
    }
    press("Enter", 2);

    expect(onScan).toHaveBeenCalledWith("BNG7K2QX9");
  });

  it("stops listening when stopped", () => {
    const { onScan, press, type, stop } = harness();

    stop();
    type("BNG7K2QX9", 5);
    press("Enter", 5);

    expect(onScan).not.toHaveBeenCalled();
  });
});
