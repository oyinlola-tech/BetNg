import { afterEach, describe, expect, it, vi } from "vitest";
import { installRemote, nextFocusable } from "../../src/navigation/spatial";

function place(id: string, rect: { x: number; y: number; w?: number; h?: number }): HTMLButtonElement {
  const el = document.createElement("button");

  el.id = id;
  el.setAttribute("data-tv-focusable", "");
  el.scrollIntoView = vi.fn();
  el.getBoundingClientRect = () => new DOMRect(rect.x, rect.y, rect.w ?? 100, rect.h ?? 40);
  document.body.append(el);

  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("TV spatial navigation", () => {
  it("moves to the nearest focusable in the pressed direction", () => {
    const a = place("a", { x: 0, y: 0 });
    place("b", { x: 200, y: 0 });
    place("c", { x: 0, y: 100 });

    expect(nextFocusable(a, "RIGHT")?.id).toBe("b");
    expect(nextFocusable(a, "DOWN")?.id).toBe("c");
    expect(nextFocusable(a, "LEFT")).toBeUndefined();
  });

  it("prefers an aligned target over a closer diagonal one", () => {
    const a = place("a", { x: 0, y: 0 });
    place("diagonal", { x: 160, y: 60 });
    place("aligned", { x: 0, y: 130 });

    expect(nextFocusable(a, "DOWN")?.id).toBe("aligned");
  });

  it("skips disabled and off-screen elements", () => {
    const a = place("a", { x: 0, y: 0 });
    const disabled = place("disabled", { x: 150, y: 0 });

    disabled.disabled = true;
    place("hidden", { x: 300, y: 0, w: 0, h: 0 });
    place("far", { x: 450, y: 0 });

    expect(nextFocusable(a, "RIGHT")?.id).toBe("far");
  });

  it("focuses with the arrow keys, selects with Enter and goes back with Escape", () => {
    const a = place("a", { x: 0, y: 0 });
    const b = place("b", { x: 200, y: 0 });
    const onBack = vi.fn();
    const clicked = vi.fn();

    b.addEventListener("click", clicked);

    const uninstall = installRemote({ onBack });

    a.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(document.activeElement).toBe(b);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(clicked).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    uninstall();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
